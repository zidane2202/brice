"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { ProviderGlyph } from "@/components/ProviderGlyph";
import { RailGlyph } from "@/components/RailGlyph";
import { CheckBox } from "@/components/ui/CheckBox";
import { FilterPill, SegmentedControl } from "@/components/ui/FilterPill";
import { BulkActionBar } from "@/components/clients/BulkActionBar";
import { ClientDrawer } from "@/components/clients/ClientDrawer";
import { NewClientForm } from "@/components/clients/NewClientForm";
import { formatDate, daysUntil, toDateInputValue } from "@/lib/dates";
import type { AccountSlot, ClientSubscription, Invoice } from "@/lib/types";

type FilterKey = "active" | "warning" | "danger" | "grace";
type SortKey = "recent" | "echeance" | "ltv";

type FreeSlot = AccountSlot & { account: { id: string; service_name: string } };

type Props = {
  subscriptions: ClientSubscription[];
  freeSlots: FreeSlot[];
  invoices: Invoice[];
};

const STATUS_META: Record<
  string,
  { tone: "success" | "warning" | "danger"; label: string; dot: string }
> = {
  active:    { tone: "success", label: "Actif",  dot: "var(--sr-mint-500)" },
  warning:   { tone: "warning", label: "Expire", dot: "var(--sr-warning)"  },
  danger:    { tone: "danger",  label: "Expiré", dot: "var(--sr-danger)"   },
  grace:     { tone: "warning", label: "Grâce",  dot: "var(--sr-warning)"  },
  cancelled: { tone: "danger",  label: "Expiré", dot: "var(--sr-danger)"   },
};

function bucket(sub: ClientSubscription, today: string): FilterKey {
  if (sub.status === "grace") return "grace";
  if (sub.status === "cancelled" || sub.end_date < today) return "danger";
  const d = daysUntil(sub.end_date);
  if (d >= 0 && d <= 3) return "warning";
  return "active";
}

export function ClientsView({ subscriptions, freeSlots, invoices }: Props) {
  const today = toDateInputValue();
  const [filter, setFilter] = useState<FilterKey>("active");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const counts = useMemo(() => {
    const c = { active: 0, warning: 0, danger: 0, grace: 0, visible: 0 };
    for (const sub of subscriptions) {
      const b = bucket(sub, today);
      c[b]++;
      if (b !== "danger") c.visible++;
    }
    return c;
  }, [subscriptions, today]);

  const rows = useMemo(() => {
    let r = subscriptions.filter((s) => bucket(s, today) === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((s) => {
        const name = `${s.client?.first_name ?? ""} ${s.client?.last_name ?? ""}`.toLowerCase();
        return (
          name.includes(q) ||
          (s.client?.phone ?? "").includes(q) ||
          (s.client?.email ?? "").toLowerCase().includes(q) ||
          (s.slot?.account?.service_name ?? "").toLowerCase().includes(q)
        );
      });
    }

    if (sortBy === "echeance") {
      r = [...r].sort((a, b) => a.end_date.localeCompare(b.end_date));
    } else if (sortBy === "ltv") {
      const lifetime = new Map<string, number>();
      for (const s of subscriptions) {
        if (!s.client?.id) continue;
        lifetime.set(s.client.id, (lifetime.get(s.client.id) ?? 0) + (s.price ?? 0));
      }
      r = [...r].sort((a, b) => (lifetime.get(b.client?.id ?? "") ?? 0) - (lifetime.get(a.client?.id ?? "") ?? 0));
    } else {
      r = [...r].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    }
    return r;
  }, [subscriptions, filter, query, sortBy, today]);

  const topClient = useMemo(() => {
    const totals = new Map<string, { name: string; total: number }>();
    for (const sub of subscriptions) {
      const id = sub.client?.id;
      if (!id) continue;
      const name =
        [sub.client?.first_name, sub.client?.last_name].filter(Boolean).join(" ") || "—";
      const prev = totals.get(id);
      totals.set(id, { name, total: (prev?.total ?? 0) + (sub.price ?? 0) });
    }
    let best: { name: string; total: number } | null = null;
    for (const entry of totals.values()) {
      if (!best || entry.total > best.total) best = entry;
    }
    return best;
  }, [subscriptions]);

  const uniqueClientIds = useMemo(() => {
    const s = new Set<string>();
    for (const sub of subscriptions) if (sub.client?.id) s.add(sub.client.id);
    return s;
  }, [subscriptions]);

  const totalRevenue = useMemo(
    () => subscriptions.reduce((sum, s) => sum + (s.price ?? 0), 0),
    [subscriptions]
  );

  const ltvAvg = uniqueClientIds.size > 0 ? Math.round(totalRevenue / uniqueClientIds.size) : 0;

  const newThisMonth = useMemo(() => {
    const now = new Date();
    const ids = new Set<string>();
    for (const sub of subscriptions) {
      if (!sub.client) continue;
      const c = new Date(sub.client.created_at);
      if (c.getFullYear() === now.getFullYear() && c.getMonth() === now.getMonth()) {
        ids.add(sub.client.id);
      }
    }
    return ids.size;
  }, [subscriptions]);

  const selectedSub = useMemo(
    () => subscriptions.find((s) => s.id === selectedId) ?? null,
    [subscriptions, selectedId]
  );

  const selectedLifetime = useMemo(() => {
    if (!selectedSub?.client?.id) return 0;
    return subscriptions
      .filter((s) => s.client?.id === selectedSub.client?.id)
      .reduce((sum, s) => sum + (s.price ?? 0), 0);
  }, [subscriptions, selectedSub]);

  const selectedHistory = useMemo(() => {
    if (!selectedSub?.client?.id) return [];
    return subscriptions
      .filter((s) => s.client?.id === selectedSub.client?.id)
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
  }, [subscriptions, selectedSub]);

  const selectedCycles = selectedHistory.length;

  const selectedInvoices = useMemo(() => {
    if (!selectedSub?.client?.id) return [];
    return invoices.filter((inv) => inv.client_id === selectedSub.client?.id);
  }, [invoices, selectedSub]);

  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const somePicked = !allPicked && rows.some((r) => picked.has(r.id));

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pickAll = (checked: boolean) => {
    setPicked(checked ? new Set(rows.map((r) => r.id)) : new Set());
  };

  return (
    <div className="mobile-full-bleed" style={{ display: "flex", flex: 1, minHeight: 0, marginInline: -32, marginTop: -32, marginBottom: -32 }}>
      <div className="sr-scroll" style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        <div
          className="mobile-page-hero"
          style={{
            padding: "32px 32px 24px",
            borderBottom: "1px solid var(--sr-border-subtle)",
          }}
        >
          <div className="mobile-page-heading" style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="dash-eyebrow" style={{ marginBottom: 12 }}>Carnet d&apos;adresses</p>
              <h1 style={{ font: "600 32px/1.1 var(--font-geist-sans)", letterSpacing: "-0.022em", color: "var(--sr-fg-strong)" }}>
                Mes clients
              </h1>
              <div style={{ marginTop: 8, font: "400 14px/1.4 var(--font-geist-sans)", color: "var(--sr-fg-muted)" }}>
                <strong style={{ color: "var(--sr-fg)" }}>{uniqueClientIds.size}</strong> client{uniqueClientIds.size > 1 ? "s" : ""}
                {" · "}
                <strong style={{ color: "var(--sr-success)" }}>{counts.active} actif{counts.active > 1 ? "s" : ""}</strong>
                {counts.warning > 0 && (
                  <> · <strong style={{ color: "var(--sr-warning)" }}>{counts.warning} expire{counts.warning > 1 ? "nt" : ""}</strong></>
                )}
                {counts.danger > 0 && (
                  <>, <strong style={{ color: "var(--sr-danger)" }}>{counts.danger} en retard</strong></>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setFormOpen((v) => !v)}
              >
                <Icon name={formOpen ? "x" : "plus"} size={14} />
                {formOpen ? "Fermer" : "Nouveau client"}
              </button>
            </div>
          </div>

          <div
            className="mobile-stats-grid"
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 1,
              background: "var(--sr-border-subtle)",
              borderRadius: 8,
              border: "1px solid var(--sr-border-subtle)",
              overflow: "hidden",
            }}
          >
            <StatCell
              label="Meilleur client"
              value={topClient ? topClient.total.toLocaleString("en-US").replace(/,/g, " ") : "—"}
              suffix={topClient ? "FCFA" : undefined}
              sub={topClient?.name}
              accent
            />
            <StatCell
              label="LTV moyenne"
              value={ltvAvg.toLocaleString("en-US").replace(/,/g, " ")}
              suffix="FCFA"
              sub="par client"
            />
            <StatCell
              label="Revenus totaux"
              value={totalRevenue.toLocaleString("en-US").replace(/,/g, " ")}
              suffix="FCFA"
            />
            <StatCell
              label="Acquisition"
              value={`+${newThisMonth}`}
              sub="ce mois"
              tone={newThisMonth > 0 ? "success" : "neutral"}
            />
          </div>
        </div>

        <Collapse open={formOpen}>
          <div className="mobile-section-pad" style={{ padding: "20px 32px 8px" }}>
            <NewClientForm freeSlots={freeSlots} onClose={() => setFormOpen(false)} />
          </div>
        </Collapse>

        <div
          className="mobile-toolbar"
          style={{
            padding: "20px 32px 0",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: 3,
              background: "var(--sr-surface)",
              border: "1px solid var(--sr-border-subtle)",
              borderRadius: 8,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
            }}
          >
            <FilterPill label="Actifs"   count={counts.active}  active={filter === "active"}  onClick={() => setFilter("active")}  tone="success" />
            <FilterPill label="Expirés"  count={counts.danger}  active={filter === "danger"}  onClick={() => setFilter("danger")}  tone="danger" />
            <FilterPill label="En grâce" count={counts.grace}   active={filter === "grace"}   onClick={() => setFilter("grace")}   tone="warning" />
          </div>

          <div className="mobile-search-field" style={{ position: "relative", width: 260 }}>
            <Icon
              name="search"
              size={13}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--sr-fg-subtle)",
                pointerEvents: "none",
              }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher nom, téléphone, service…"
              style={{
                paddingLeft: 32,
                height: 32,
                minHeight: 32,
                background: "var(--sr-surface)",
                fontSize: "0.82rem",
              }}
            />
          </div>

          <div style={{ flex: 1 }} />

          <SegmentedControl
            value={sortBy}
            onChange={setSortBy}
            options={[
              { id: "recent",   label: "Récents" },
              { id: "echeance", label: "Échéance" },
              { id: "ltv",      label: "LTV" },
            ]}
          />
        </div>

        <div className="mobile-section-pad mobile-bottom-pad" style={{ padding: "16px 32px 48px" }}>
          {picked.size > 0 && (
            <BulkActionBar ids={Array.from(picked)} onClear={() => setPicked(new Set())} />
          )}

          <div
            className="clients-list"
            style={{
              background: "var(--sr-surface)",
              border: "1px solid var(--sr-border-subtle)",
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "var(--sr-hairline-top)",
            }}
          >
            <div
              className="clients-list-head"
              style={{
                display: "grid",
                gridTemplateColumns: "28px minmax(160px,1.6fr) minmax(140px,1fr) 40px 80px 100px 130px 110px 36px",
                gap: 12,
                padding: "10px 16px",
                borderBottom: "1px solid var(--sr-border-subtle)",
                background: "var(--sr-bg)",
                font: "500 10px/1 var(--font-geist-sans)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--sr-fg-muted)",
                alignItems: "center",
              }}
            >
              <div>
                <CheckBox
                  checked={allPicked}
                  indeterminate={somePicked}
                  onChange={pickAll}
                />
              </div>
              <div>Client</div>
              <div>Service</div>
              <div title="Mode de paiement" style={{ textAlign: "center" }}>Paie.</div>
              <div>PIN</div>
              <div>Statut</div>
              <div style={{ textAlign: "right" }}>Renouvellement</div>
              <div style={{ textAlign: "right" }}>Payé</div>
              <div></div>
            </div>

            {rows.length === 0 ? (
              <div
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  color: "var(--sr-fg-muted)",
                  font: "400 13px/1.4 var(--font-geist-sans)",
                }}
              >
                Aucun client ne correspond à ce filtre.
              </div>
            ) : (
              rows.map((sub, i) => (
                <Row
                  key={sub.id}
                  sub={sub}
                  today={today}
                  last={i === rows.length - 1}
                  isPicked={picked.has(sub.id)}
                  isSelected={selectedId === sub.id && drawerOpen}
                  onPick={() => togglePick(sub.id)}
                  onSelect={() => {
                    setSelectedId(sub.id);
                    setDrawerOpen(true);
                  }}
                />
              ))
            )}
          </div>

          {rows.length > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: "0 4px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                font: "400 12px/1 var(--font-geist-sans)",
                color: "var(--sr-fg-subtle)",
              }}
            >
              <div>
                <span style={{ color: "var(--sr-fg)", fontFamily: "var(--font-geist-mono)", fontVariantNumeric: "tabular-nums" }}>
                  {rows.length}
                </span>
                {" "}sur{" "}
                <span style={{ color: "var(--sr-fg)", fontFamily: "var(--font-geist-mono)", fontVariantNumeric: "tabular-nums" }}>
                  {counts.visible}
                </span>
                {" "}abonnement{counts.visible > 1 ? "s" : ""} affiché{rows.length > 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      </div>

      {drawerOpen && selectedSub && (
        <ClientDrawer
          sub={selectedSub}
          lifetime={selectedLifetime}
          cyclesCount={selectedCycles}
          history={selectedHistory}
          invoices={selectedInvoices}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  suffix,
  sub,
  tone,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  sub?: string;
  tone?: "success" | "warning" | "danger" | "neutral";
  accent?: boolean;
}) {
  const color =
    tone === "success" ? "var(--sr-success)" :
    tone === "warning" ? "var(--sr-warning)" :
    tone === "danger"  ? "var(--sr-danger)" :
    accent             ? "var(--sr-mint-300)" :
    "var(--sr-fg-strong)";
  return (
    <div
      style={{
        padding: "14px 18px",
        background: "var(--sr-surface)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          font: "500 10px/1 var(--font-geist-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--sr-fg-muted)",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <div
          style={{
            font: "600 22px/1 var(--font-geist-mono)",
            letterSpacing: "-0.025em",
            fontVariantNumeric: "tabular-nums",
            color,
          }}
        >
          {value}
        </div>
        {suffix && <div style={{ font: "400 11px/1 var(--font-geist-mono)", color: "var(--sr-fg-subtle)" }}>{suffix}</div>}
      </div>
      {sub && (
        <div style={{ font: "400 11px/1.2 var(--font-geist-sans)", color: "var(--sr-fg-subtle)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Row({
  sub,
  today,
  last,
  isPicked,
  isSelected,
  onPick,
  onSelect,
}: {
  sub: ClientSubscription;
  today: string;
  last: boolean;
  isPicked: boolean;
  isSelected: boolean;
  onPick: () => void;
  onSelect: () => void;
}) {
  const b = bucket(sub, today);
  const status = STATUS_META[b];
  const fullName = `${sub.client?.first_name ?? ""} ${sub.client?.last_name ?? ""}`.trim() || "—";
  const serviceName = sub.slot?.account?.service_name ?? "—";
  const rail = sub.client?.payment_rail ?? null;
  const pin = sub.client?.pin_code ?? null;
  const endDateColor = b === "warning" ? "var(--sr-warning)" : b === "danger" ? "var(--sr-danger)" : "var(--sr-fg)";

  return (
    <div
      className="client-row"
      onClick={onSelect}
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "28px minmax(160px,1.6fr) minmax(140px,1fr) 40px 80px 100px 130px 110px 36px",
        gap: 12,
        alignItems: "center",
        padding: "10px 16px",
        borderBottom: last ? "none" : "1px solid var(--sr-border-subtle)",
        background: isSelected ? "var(--sr-surface-2)" : isPicked ? "rgba(41,220,133,0.04)" : "transparent",
        cursor: "pointer",
        transition: "background var(--sr-dur-fast) var(--sr-ease)",
      }}
      onMouseEnter={(e) => {
        if (!isSelected && !isPicked) e.currentTarget.style.background = "var(--sr-surface-2)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !isPicked) e.currentTarget.style.background = "transparent";
      }}
    >
      <div className="client-mobile-card">
        <div onClick={(e) => e.stopPropagation()} className="client-mobile-check">
          <CheckBox checked={isPicked} onChange={() => onPick()} />
        </div>
        <div className="client-mobile-main">
          <div className="client-mobile-title">
            <Avatar name={fullName} size={32} />
            <div>
              <div className="client-mobile-name">{fullName}</div>
              <div className="client-mobile-service">
                <ProviderGlyph name={serviceName} size={16} />
                <span>{serviceName}</span>
              </div>
            </div>
          </div>
          <div className="client-mobile-meta">
            <span className={`status ${b === "active" ? "active" : b === "danger" ? "cancelled" : "grace"}`}>
              {status.label}
            </span>
            <span style={{ color: endDateColor }}>Renouv. {formatDate(sub.end_date)}</span>
            {sub.price ? <span>{sub.price.toLocaleString("en-US").replace(/,/g, " ")} FCFA</span> : null}
            {pin ? <span>PIN {pin}</span> : null}
          </div>
        </div>
        <Icon name="chevronR" size={14} style={{ color: "var(--sr-fg-subtle)" }} />
      </div>

      {isSelected && (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            background: "var(--sr-mint-500)",
            boxShadow: "0 0 12px rgba(41,220,133,0.5)",
          }}
        />
      )}

      <div
        onClick={(e) => { e.stopPropagation(); onPick(); }}
        style={{ display: "inline-flex", alignItems: "center" }}
      >
        <CheckBox checked={isPicked} onChange={() => onPick()} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Avatar name={fullName} size={28} />
        <div
          style={{
            font: "500 13px/1.2 var(--font-geist-sans)",
            color: "var(--sr-fg-strong)",
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {fullName}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <ProviderGlyph name={serviceName} size={20} />
        <span
          style={{
            font: "500 13px/1.2 var(--font-geist-sans)",
            color: "var(--sr-fg)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {serviceName}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        {rail ? <RailGlyph rail={rail} size={18} /> : <span style={{ color: "var(--sr-fg-disabled)", fontSize: "0.7rem" }}>—</span>}
      </div>

      <div
        style={{
          font: "500 12px/1 var(--font-geist-mono)",
          color: pin ? "var(--sr-fg)" : "var(--sr-fg-disabled)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: pin ? "0.1em" : 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {pin ?? "—"}
      </div>

      <div>
        <span
          className={`status ${b === "active" ? "active" : b === "danger" ? "cancelled" : "grace"}`}
        >
          <span
            style={{
              display: "none",
            }}
          />
          {status.label}
        </span>
      </div>

      <div
        style={{
          textAlign: "right",
          font: "500 12px/1 var(--font-geist-mono)",
          color: endDateColor,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {formatDate(sub.end_date)}
      </div>

      <div
        style={{
          textAlign: "right",
          font: "500 13px/1 var(--font-geist-mono)",
          color: "var(--sr-fg-strong)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.015em",
          whiteSpace: "nowrap",
        }}
      >
        {sub.price ? (
          <>
            {sub.price.toLocaleString("en-US").replace(/,/g, " ")}
            <span style={{ color: "var(--sr-fg-subtle)", marginLeft: 4, fontWeight: 400, letterSpacing: 0, fontSize: 11 }}>FCFA</span>
          </>
        ) : (
          <span style={{ color: "var(--sr-fg-disabled)" }}>—</span>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Icon name="chevronR" size={13} style={{ color: "var(--sr-fg-subtle)" }} />
      </div>
    </div>
  );
}

function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        maxHeight: open ? 2000 : 0,
        opacity: open ? 1 : 0,
        overflow: "hidden",
        transition: "max-height var(--sr-dur-slow) var(--sr-ease), opacity var(--sr-dur-slow) var(--sr-ease)",
      }}
    >
      {children}
    </div>
  );
}

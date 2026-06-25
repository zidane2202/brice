"use client";

import { useMemo, useState } from "react";
import { AccountCard } from "@/components/AccountCard";
import { AddAccountForm } from "@/components/AddAccountForm";
import { Icon } from "@/components/Icon";
import { FilterPill } from "@/components/ui/FilterPill";
import { daysUntil, toDateInputValue } from "@/lib/dates";
import type { ProviderAccount } from "@/lib/types";

type AccountWithSlots = ProviderAccount & { used_slots: number };

type FilterKey = "active" | "warning" | "expired";

type Props = { accounts: AccountWithSlots[]; displayNames: Record<string, string>; balance: number };

function bucket(a: AccountWithSlots): FilterKey {
  if (a.status === "inactive") return "expired";
  const d = daysUntil(a.end_date);
  if (d < 0) return "expired";
  if (d <= 3) return "warning";
  return "active";
}

export function AbonnementsView({ accounts, displayNames, balance }: Props) {
  const [filter, setFilter] = useState<FilterKey>("active");
  const [formOpen, setFormOpen] = useState(false);
  const today = toDateInputValue();

  const counts = useMemo(() => {
    const c = { active: 0, warning: 0, expired: 0, visible: 0 };
    for (const a of accounts) {
      const b = bucket(a);
      c[b]++;
      if (b !== "expired") c.visible++;
    }
    return c;
  }, [accounts]);

  const filtered = useMemo(() => {
    return accounts.filter((a) => bucket(a) === filter);
  }, [accounts, filter]);

  const byName = (x: { id: string }, y: { id: string }) =>
    displayNames[x.id].localeCompare(displayNames[y.id]);
  const sorted = useMemo(() => [...filtered].sort(byName), [filtered, displayNames]);

  const stats = useMemo(() => {
    const live = accounts.filter((a) => a.status === "active" && a.end_date >= today);
    const profilsUsed = live.reduce((s, a) => s + a.used_slots, 0);
    const profilsTotal = live.reduce((s, a) => s + a.max_slots, 0);
    const now = new Date();
    const spentThisMonth = accounts
      .filter((a) => {
        const d = new Date(a.start_date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((s, a) => s + (a.cost ?? 0), 0);
    return { profilsUsed, profilsTotal, spentThisMonth, liveCount: live.length };
  }, [accounts, today]);

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column", marginInline: -32, marginTop: -32, marginBottom: -32 }}>
      <div className="sr-scroll" style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        <div
          style={{
            padding: "32px 32px 24px",
            borderBottom: "1px solid var(--sr-border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="dash-eyebrow" style={{ marginBottom: 12 }}>Vos comptes</p>
              <h1 style={{ font: "600 32px/1.1 var(--font-geist-sans)", letterSpacing: "-0.022em", color: "var(--sr-fg-strong)" }}>
                Mes abonnements
              </h1>
              <div style={{ marginTop: 8, font: "400 14px/1.4 var(--font-geist-sans)", color: "var(--sr-fg-muted)" }}>
                Suivez vos comptes fournisseurs, profils vendus et échéances. Tout est exprimé en FCFA.
              </div>
            </div>

            <button type="button" onClick={() => setFormOpen((v) => !v)}>
              <Icon name={formOpen ? "x" : "plus"} size={14} />
              {formOpen ? "Fermer" : "Nouveau compte"}
            </button>
          </div>

          <div
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
            <StatCell label="Comptes actifs" value={stats.liveCount} sub={`/ ${counts.visible} au total`} />
            <StatCell
              label="Profils en cours"
              value={stats.profilsUsed}
              sub={`sur ${stats.profilsTotal} disponibles`}
              accent
            />
            <StatCell
              label="Dépensé ce mois"
              value={stats.spentThisMonth.toLocaleString("en-US").replace(/,/g, " ")}
              suffix="FCFA"
            />
            <StatCell
              label="Expirent bientôt"
              value={counts.warning}
              sub={counts.warning > 0 ? "à renouveler" : "tout est OK"}
              tone={counts.warning > 0 ? "warning" : "neutral"}
            />
          </div>
        </div>

        <Collapse open={formOpen}>
          <div style={{ padding: "20px 32px 8px" }}>
            <div
              style={{
                background: "var(--sr-surface)",
                border: "1px solid var(--sr-border-subtle)",
                borderRadius: 10,
                boxShadow: "var(--sr-hairline-top), 0 1px 0 rgba(0,0,0,0.3)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  borderBottom: "1px solid var(--sr-border-subtle)",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.02), transparent)",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: "linear-gradient(180deg, rgba(41,220,133,0.18), rgba(41,220,133,0.08))",
                    border: "1px solid var(--sr-success-border)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--sr-mint-300)",
                  }}
                >
                  <Icon name="plus" size={15} />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      font: "500 10px/1 var(--font-geist-sans)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--sr-mint-300)",
                    }}
                  >
                    Ajouter
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      font: "600 15px/1.2 var(--font-geist-sans)",
                      letterSpacing: "-0.01em",
                      color: "var(--sr-fg-strong)",
                    }}
                  >
                    Nouveau compte fournisseur
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="secondary"
                  style={{ width: 28, minHeight: 28, height: 28, padding: 0, justifyContent: "center" }}
                  aria-label="Fermer"
                >
                  <Icon name="x" size={13} />
                </button>
              </div>
              <div style={{ padding: 18 }}>
                <AddAccountForm today={today} />
              </div>
            </div>
          </div>
        </Collapse>

        <div
          style={{
            padding: "20px 32px 0",
            display: "flex",
            alignItems: "center",
            gap: 12,
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
            <FilterPill label="Actifs"          count={counts.active}  active={filter === "active"}  onClick={() => setFilter("active")}  tone="success" />
            <FilterPill label="Expirent bientôt" count={counts.warning} active={filter === "warning"} onClick={() => setFilter("warning")} tone="warning" />
            <FilterPill label="Expirés"         count={counts.expired} active={filter === "expired"} onClick={() => setFilter("expired")} tone="danger" />
          </div>
        </div>

        <div
          style={{
            padding: "20px 32px 48px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 14,
          }}
        >
          {sorted.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                padding: "64px 24px",
                textAlign: "center",
                color: "var(--sr-fg-muted)",
                background: "var(--sr-surface)",
                border: "1px dashed var(--sr-border)",
                borderRadius: 8,
              }}
            >
              <div style={{ font: "500 14px/1.3 var(--font-geist-sans)", color: "var(--sr-fg)" }}>
                Aucun compte dans cette catégorie.
              </div>
              <div style={{ marginTop: 4, font: "400 12px/1.4 var(--font-geist-sans)" }}>
                Ajoutez votre premier compte fournisseur pour commencer.
              </div>
            </div>
          ) : (
            sorted.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                displayName={displayNames[account.id]}
                balance={balance}
              />
            ))
          )}
        </div>
      </div>
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
  value: string | number;
  suffix?: string;
  sub?: string;
  tone?: "success" | "warning" | "danger" | "neutral";
  accent?: boolean;
}) {
  const color =
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

function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        maxHeight: open ? 2400 : 0,
        opacity: open ? 1 : 0,
        overflow: "hidden",
        transition: "max-height var(--sr-dur-slow) var(--sr-ease), opacity var(--sr-dur-slow) var(--sr-ease)",
      }}
    >
      {children}
    </div>
  );
}

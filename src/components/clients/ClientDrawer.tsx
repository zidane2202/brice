"use client";

import { useEffect, useState } from "react";
import { updateClientMeta, updateClientPin } from "@/app/actions/clients";
import {
  cancelClientSubscription,
  generateInvoiceForSubscription,
  removeGraceStatus,
  renewClientSubscription,
  setGraceStatus,
} from "@/app/actions/subscriptions";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { ProviderGlyph } from "@/components/ProviderGlyph";
import { RailGlyph, RAIL_NAMES } from "@/components/RailGlyph";
import { addDays, formatDate, toDateInputValue } from "@/lib/dates";
import type { ClientSubscription, Invoice } from "@/lib/types";

type Props = {
  sub: ClientSubscription;
  lifetime: number;
  cyclesCount: number;
  history: ClientSubscription[];
  invoices: Invoice[];
  onClose: () => void;
};

const STATUS_LABEL: Record<ClientSubscription["status"], { tone: string; label: string; dot: string }> = {
  active:    { tone: "success", label: "Actif",         dot: "var(--sr-mint-500)" },
  grace:     { tone: "warning", label: "En grâce",      dot: "var(--sr-warning)"  },
  cancelled: { tone: "danger",  label: "Expiré",        dot: "var(--sr-danger)"   },
};

export function ClientDrawer({ sub, lifetime, cyclesCount, history, invoices, onClose }: Props) {
  const client = sub.client;
  if (!client) return null;
  const status = STATUS_LABEL[sub.status];
  const fullName = [client.first_name, client.last_name].filter(Boolean).join(" ");
  const serviceName = sub.slot?.account?.service_name ?? "—";
  const slotLabel = sub.slot?.label || `Profil ${sub.slot?.slot_number ?? ""}`;
  const [editingNotes, setEditingNotes] = useState(false);
  const [rail, setRail] = useState<string>(client.payment_rail ?? "");

  return (
    <aside
      className="sr-scroll"
      style={{
        width: 380,
        flex: "0 0 380px",
        borderLeft: "1px solid var(--sr-border-subtle)",
        background: "var(--sr-bg)",
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--sr-border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "var(--sr-bg)",
          position: "sticky",
          top: 0,
          zIndex: 2,
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
          Fiche client
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onClose}
          className="secondary"
          style={{ width: 28, minHeight: 28, height: 28, padding: 0, justifyContent: "center" }}
          aria-label="Fermer"
        >
          <Icon name="x" size={13} />
        </button>
      </div>

      <div
        style={{
          padding: "20px 18px 18px",
          borderBottom: "1px solid var(--sr-border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          background: "linear-gradient(180deg, rgba(41,220,133,0.04), transparent 80%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name={fullName} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                font: "600 18px/1.2 var(--font-geist-sans)",
                letterSpacing: "-0.012em",
                color: "var(--sr-fg-strong)",
              }}
            >
              {fullName}
            </div>
            <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8 }}>
              <StatusTag tone={status.tone} dot={status.dot} label={status.label} pulse={sub.status === "active"} />
              <span style={{ font: "400 11px/1 var(--font-geist-mono)", color: "var(--sr-fg-subtle)" }}>
                client depuis {formatDate(client.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            background: "var(--sr-border-subtle)",
            borderRadius: 6,
            overflow: "hidden",
            border: "1px solid var(--sr-border-subtle)",
          }}
        >
          <ContactRow icon="bell" label="Téléphone" value={client.phone ?? "—"} />
          <ContactRow icon="inbox" label="Email" value={client.email ?? "—"} />
          <PinControl clientId={client.id} initialPin={client.pin_code} />
        </div>
      </div>

      <Section title="Abonnement en cours">
        <div
          style={{
            padding: 14,
            background: "var(--sr-surface)",
            border: "1px solid var(--sr-border-subtle)",
            borderRadius: 8,
            boxShadow: "var(--sr-hairline-top)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ProviderGlyph name={serviceName} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "600 14px/1.2 var(--font-geist-sans)", color: "var(--sr-fg-strong)" }}>
                {serviceName}
              </div>
              <div
                style={{
                  marginTop: 3,
                  font: "400 12px/1 var(--font-geist-mono)",
                  color: "var(--sr-fg-subtle)",
                }}
              >
                {slotLabel}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
            <MiniStat label="Échéance" value={formatDate(sub.end_date)} tone={sub.status === "grace" ? "warning" : "neutral"} />
            <MiniStat
              label="Tarif"
              value={sub.price ? sub.price.toLocaleString("en-US").replace(/,/g, " ") : "—"}
              suffix={sub.price ? " FCFA" : undefined}
            />
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <form action={renewClientSubscription} style={{ margin: 0, flex: 1, minWidth: 140 }}>
              <input type="hidden" name="id" value={sub.id} />
              <input type="hidden" name="end_date" value={sub.end_date} />
              <input type="hidden" name="duration_months" value="1" />
              <input type="hidden" name="status" value={sub.status} />
              <button
                type="submit"
                style={{
                  width: "100%",
                  minHeight: 32,
                  height: 32,
                  fontSize: "0.78rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Icon name="refresh" size={12} />
                Renouveler +1 mois
              </button>
            </form>
            {sub.status !== "cancelled" && <CancelButton subId={sub.id} />}
          </div>

          <form
            action={updateClientMeta}
            style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}
          >
            <input type="hidden" name="id" value={client.id} />
            <input type="hidden" name="payment_rail" value={rail} />
            <input type="hidden" name="notes" value={client.notes ?? ""} />
            <RailGlyph rail={rail} size={20} />
            <select
              value={rail}
              onChange={(e) => setRail(e.target.value)}
              style={{
                flex: 1,
                minHeight: 30,
                height: 30,
                padding: "0 8px",
                fontSize: "0.78rem",
                background: "var(--sr-bg)",
                color: "var(--sr-fg)",
              }}
            >
              <option value="">— Aucun rail —</option>
              {RAIL_NAMES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button type="submit" className="secondary" style={{ minHeight: 30, height: 30, fontSize: "0.75rem", paddingInline: 10 }}>
              <Icon name="check" size={12} /> Enregistrer
            </button>
          </form>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--sr-border-subtle)" }}>
            <GraceControl subId={sub.id} status={sub.status} graceUntil={sub.grace_until} endDate={sub.end_date} />
          </div>
        </div>
      </Section>

      <Section title="Valeur client">
        <div
          style={{
            padding: "14px 16px",
            background: "var(--sr-surface)",
            border: "1px solid var(--sr-border-subtle)",
            borderRadius: 8,
            boxShadow: "var(--sr-hairline-top)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <div
              style={{
                font: "600 24px/1 var(--font-geist-mono)",
                letterSpacing: "-0.025em",
                fontVariantNumeric: "tabular-nums",
                color: "var(--sr-mint-300)",
              }}
            >
              {lifetime.toLocaleString("en-US").replace(/,/g, " ")}
            </div>
            <div style={{ font: "400 12px/1 var(--font-geist-mono)", color: "var(--sr-fg-subtle)" }}>
              FCFA total
            </div>
          </div>
          <div
            style={{
              marginTop: 6,
              font: "400 11px/1.3 var(--font-geist-sans)",
              color: "var(--sr-fg-subtle)",
            }}
          >
            {cyclesCount} cycle{cyclesCount > 1 ? "s" : ""} honoré{cyclesCount > 1 ? "s" : ""}
          </div>
        </div>
      </Section>

      <Section title="Factures">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {invoices.length === 0 && (
            <div
              style={{
                padding: "12px 14px",
                background: "var(--sr-surface)",
                border: "1px dashed var(--sr-border)",
                borderRadius: 8,
                font: "400 12px/1.4 var(--font-geist-sans)",
                color: "var(--sr-fg-subtle)",
                textAlign: "center",
              }}
            >
              Aucune facture pour ce client.
            </div>
          )}
          {invoices.map((inv) => (
            <InvoiceRow key={inv.id} invoice={inv} clientPhone={client.phone} />
          ))}
          {sub.price && sub.price > 0 && (
            <form action={generateInvoiceForSubscription} style={{ margin: 0 }}>
              <input type="hidden" name="id" value={sub.id} />
              <button
                type="submit"
                style={{
                  width: "100%",
                  minHeight: 36,
                  height: 36,
                  fontSize: "0.8rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: "linear-gradient(180deg, rgba(41,220,133,0.18), rgba(41,220,133,0.08))",
                  border: "1px solid var(--sr-success-border)",
                  color: "var(--sr-mint-300)",
                }}
              >
                <Icon name="bill" size={13} /> Générer la facture pour cet abonnement
              </button>
            </form>
          )}
        </div>
      </Section>

      <Section title="Notes privées">
        <NotesForm clientId={client.id} initialNotes={client.notes ?? ""} editing={editingNotes} onToggle={setEditingNotes} paymentRail={client.payment_rail ?? ""} />
      </Section>

      {history.length > 0 && (
        <Section title="Historique">
          <div
            style={{
              padding: "10px 14px",
              background: "var(--sr-surface)",
              border: "1px solid var(--sr-border-subtle)",
              borderRadius: 8,
              boxShadow: "var(--sr-hairline-top)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 14 + 11,
                top: 14,
                bottom: 14,
                width: 1,
                background: "var(--sr-border-subtle)",
              }}
            />
            {history.map((h, i) => (
              <HistoryRow key={h.id} h={h} last={i === history.length - 1} />
            ))}
          </div>
        </Section>
      )}

      <div style={{ height: 24, flex: "0 0 24px" }} />
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "16px 18px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          font: "500 10px/1 var(--font-geist-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--sr-fg-muted)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function StatusTag({ tone, dot, label, pulse }: { tone: string; dot: string; label: string; pulse?: boolean }) {
  const colorMap: Record<string, { bg: string; border: string; color: string }> = {
    success: { bg: "var(--sr-success-bg)", border: "var(--sr-success-border)", color: "var(--sr-success)" },
    warning: { bg: "var(--sr-warning-bg)", border: "var(--sr-warning-border)", color: "var(--sr-warning)" },
    danger:  { bg: "var(--sr-danger-bg)",  border: "var(--sr-danger-border)",  color: "var(--sr-danger)" },
  };
  const c = colorMap[tone] ?? colorMap.success;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 20,
        padding: "0 7px",
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 4,
        color: c.color,
        font: "500 11px/1 var(--font-geist-sans)",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: dot,
          boxShadow: pulse ? `0 0 8px ${dot}` : "none",
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}

function ContactRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--sr-surface)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Icon name={icon} size={14} style={{ color: "var(--sr-fg-subtle)" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "500 10px/1 var(--font-geist-sans)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--sr-fg-subtle)",
          }}
        >
          {label}
        </div>
        <div
          style={{
            marginTop: 3,
            font: "500 12px/1.2 var(--font-geist-mono)",
            color: "var(--sr-fg)",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, suffix, tone }: { label: string; value: string; suffix?: string; tone?: "warning" | "danger" | "neutral" }) {
  const color = tone === "warning" ? "var(--sr-warning)" : tone === "danger" ? "var(--sr-danger)" : "var(--sr-fg-strong)";
  return (
    <div
      style={{
        padding: "8px 10px",
        background: "var(--sr-bg)",
        border: "1px solid var(--sr-border-subtle)",
        borderRadius: 6,
      }}
    >
      <div
        style={{
          font: "500 9px/1 var(--font-geist-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--sr-fg-subtle)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 5,
          font: "500 12px/1 var(--font-geist-mono)",
          color,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
        {suffix && <span style={{ color: "var(--sr-fg-subtle)", fontWeight: 400 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function HistoryRow({ h, last }: { h: ClientSubscription; last: boolean }) {
  const kind = h.status === "active" ? "success" : h.status === "grace" ? "warning" : "danger";
  const map: Record<string, { color: string; bg: string; border: string }> = {
    success: { color: "var(--sr-mint-500)", bg: "var(--sr-success-bg)", border: "var(--sr-success-border)" },
    warning: { color: "var(--sr-warning)",  bg: "var(--sr-warning-bg)", border: "var(--sr-warning-border)" },
    danger:  { color: "var(--sr-danger)",   bg: "var(--sr-danger-bg)",  border: "var(--sr-danger-border)" },
  };
  const c = map[kind];
  return (
    <div style={{ position: "relative", paddingLeft: 30, paddingBlock: 8, display: "flex", flexDirection: "column", gap: 3 }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 12,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: c.bg,
          border: `1px solid ${c.border}`,
          color: c.color,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: c.color,
            boxShadow: kind === "success" ? `0 0 6px ${c.color}` : "none",
          }}
        />
      </div>
      <div style={{ font: "500 12px/1.3 var(--font-geist-sans)", color: "var(--sr-fg-strong)" }}>
        {h.slot?.account?.service_name ?? "Service"} · {formatDate(h.start_date)} → {formatDate(h.end_date)}
      </div>
      <div style={{ font: "400 11px/1.3 var(--font-geist-sans)", color: "var(--sr-fg-muted)" }}>
        {h.price ? `${h.price.toLocaleString("en-US").replace(/,/g, " ")} FCFA · ` : ""}
        {h.status === "active" ? "Actif" : h.status === "grace" ? "En grâce" : "Expiré"}
      </div>
      {last && null}
    </div>
  );
}

function InvoiceRow({ invoice, clientPhone }: { invoice: Invoice; clientPhone: string | null }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const url = `${origin}/facture/${invoice.code}`;
  const digits = clientPhone ? clientPhone.replace(/[^\d]/g, "") : "";
  const text = `Bonjour ${invoice.client_name}, voici ta facture pour ${invoice.service_name} (${invoice.amount.toLocaleString("en-US").replace(/,/g, " ")} FCFA). Lien : ${url}`;
  const waHref = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "var(--sr-surface)",
        border: "1px solid var(--sr-border-subtle)",
        borderRadius: 6,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 5,
          background: "var(--sr-success-bg)",
          border: "1px solid var(--sr-success-border)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--sr-mint-400)",
          flex: "0 0 28px",
        }}
      >
        <Icon name="bill" size={13} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "500 12px/1.2 var(--font-geist-sans)",
            color: "var(--sr-fg-strong)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          N° {String(invoice.number).padStart(4, "0")}
        </div>
        <div
          style={{
            marginTop: 2,
            font: "400 10px/1.2 var(--font-geist-mono)",
            color: "var(--sr-fg-subtle)",
          }}
        >
          {invoice.kind === "new" ? "Vente" : "Renouvellement"} · {formatDate(invoice.created_at)} · {invoice.amount.toLocaleString("en-US").replace(/,/g, " ")} FCFA
        </div>
      </div>
      <a
        href={`/facture/${invoice.code}`}
        target="_blank"
        rel="noopener noreferrer"
        className="secondary"
        title="Ouvrir la facture pour télécharger ou imprimer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          minHeight: 28,
          padding: 0,
          textDecoration: "none",
        }}
      >
        <Icon name="download" size={12} />
      </a>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        title="Envoyer via WhatsApp"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          minHeight: 28,
          padding: 0,
          borderRadius: 5,
          background: "#25D366",
          color: "white",
          textDecoration: "none",
        }}
      >
        <Icon name="send" size={12} />
      </a>
    </div>
  );
}

function PinControl({ clientId, initialPin }: { clientId: string; initialPin: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialPin ?? "");

  if (!editing) {
    return (
      <div
        style={{
          padding: "10px 12px",
          background: "var(--sr-surface)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icon name="lock" size={14} style={{ color: "var(--sr-fg-subtle)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: "500 10px/1 var(--font-geist-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--sr-fg-subtle)",
            }}
          >
            Code PIN
          </div>
          <div
            style={{
              marginTop: 3,
              font: "500 13px/1.2 var(--font-geist-mono)",
              color: initialPin ? "var(--sr-fg)" : "var(--sr-fg-subtle)",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: initialPin ? "0.12em" : 0,
            }}
          >
            {initialPin || "non défini"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="secondary"
          style={{ minHeight: 26, height: 26, fontSize: "0.72rem", paddingInline: 8 }}
        >
          <Icon name="pencil" size={11} /> Modifier
        </button>
      </div>
    );
  }

  return (
    <form
      action={updateClientPin}
      onSubmit={() => setEditing(false)}
      style={{
        padding: "10px 12px",
        background: "var(--sr-surface)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <input type="hidden" name="id" value={clientId} />
      <Icon name="lock" size={14} style={{ color: "var(--sr-fg-subtle)" }} />
      <input
        name="pin_code"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={12}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ex. 1234"
        autoFocus
        style={{
          flex: 1,
          minHeight: 28,
          height: 28,
          padding: "0 8px",
          background: "var(--sr-bg)",
          color: "var(--sr-fg)",
          fontFamily: "var(--font-geist-mono)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.12em",
          fontSize: "0.85rem",
        }}
      />
      <button
        type="submit"
        className="secondary"
        style={{ minHeight: 28, height: 28, fontSize: "0.72rem", paddingInline: 8 }}
      >
        <Icon name="check" size={11} />
      </button>
      <button
        type="button"
        onClick={() => {
          setValue(initialPin ?? "");
          setEditing(false);
        }}
        className="secondary"
        style={{ minHeight: 28, height: 28, fontSize: "0.72rem", paddingInline: 8 }}
      >
        <Icon name="x" size={11} />
      </button>
    </form>
  );
}

function CancelButton({ subId }: { subId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="secondary"
        title="Annuler l'abonnement (libère le profil)"
        style={{
          minHeight: 32,
          height: 32,
          fontSize: "0.78rem",
          paddingInline: 12,
          color: "var(--sr-danger)",
        }}
      >
        <Icon name="x" size={12} /> Annuler
      </button>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 8px",
        height: 32,
        border: "1px solid var(--sr-danger-border)",
        background: "var(--sr-danger-bg)",
        borderRadius: 6,
      }}
    >
      <Icon name="alert" size={13} style={{ color: "var(--sr-danger)" }} />
      <span style={{ font: "500 11px/1 var(--font-geist-sans)", color: "var(--sr-danger)", whiteSpace: "nowrap" }}>
        Sûr ?
      </span>
      <form action={cancelClientSubscription} style={{ margin: 0 }}>
        <input type="hidden" name="id" value={subId} />
        <button
          type="submit"
          style={{
            minHeight: 24,
            height: 24,
            paddingInline: 8,
            fontSize: "0.72rem",
            background: "var(--sr-danger)",
            border: "1px solid var(--sr-danger)",
            color: "#fff",
          }}
        >
          Terminer
        </button>
      </form>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="secondary"
        style={{
          minHeight: 24,
          height: 24,
          paddingInline: 8,
          fontSize: "0.72rem",
        }}
      >
        Retour
      </button>
    </div>
  );
}

function GraceControl({
  subId,
  status,
  graceUntil,
  endDate,
}: {
  subId: string;
  status: ClientSubscription["status"];
  graceUntil: string | null;
  endDate: string;
}) {
  const defaultGraceDate =
    graceUntil ??
    (endDate > toDateInputValue() ? addDays(endDate, 7) : addDays(toDateInputValue(), 7));
  const [graceDate, setGraceDate] = useState(defaultGraceDate);

  if (status === "grace") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Icon name="alert" size={13} style={{ color: "var(--sr-warning)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "500 11px/1.2 var(--font-geist-sans)", color: "var(--sr-fg-strong)" }}>
            En grâce
          </div>
          <div style={{ marginTop: 2, font: "400 10px/1.2 var(--font-geist-mono)", color: "var(--sr-fg-subtle)" }}>
            jusqu&apos;au {graceUntil ? formatDate(graceUntil) : "—"}
          </div>
        </div>
        <form action={removeGraceStatus} style={{ margin: 0 }}>
          <input type="hidden" name="id" value={subId} />
          <button
            type="submit"
            className="secondary"
            style={{ minHeight: 28, height: 28, fontSize: "0.72rem", paddingInline: 10 }}
          >
            <Icon name="check" size={11} /> Sortir de grâce
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={setGraceStatus} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <input type="hidden" name="id" value={subId} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "500 10px/1 var(--font-geist-sans)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--sr-fg-subtle)",
          }}
        >
          Délai de paiement
        </div>
        <div style={{ marginTop: 4, font: "400 11px/1.3 var(--font-geist-sans)", color: "var(--sr-fg-muted)" }}>
          Suspend les relances jusqu&apos;à la date choisie.
        </div>
      </div>
      <input
        type="date"
        name="grace_until"
        value={graceDate}
        min={toDateInputValue()}
        onChange={(e) => setGraceDate(e.target.value)}
        style={{
          minHeight: 30,
          height: 30,
          padding: "0 8px",
          fontSize: "0.75rem",
          background: "var(--sr-bg)",
          colorScheme: "dark",
          fontFamily: "var(--font-geist-mono)",
        }}
      />
      <button
        type="submit"
        className="secondary"
        style={{ minHeight: 30, height: 30, fontSize: "0.75rem", paddingInline: 10 }}
      >
        <Icon name="alert" size={12} /> Mettre en grâce
      </button>
    </form>
  );
}

function NotesForm({
  clientId,
  initialNotes,
  editing,
  onToggle,
  paymentRail,
}: {
  clientId: string;
  initialNotes: string;
  editing: boolean;
  onToggle: (e: boolean) => void;
  paymentRail: string;
}) {
  const [value, setValue] = useState(initialNotes);
  return (
    <form
      action={updateClientMeta}
      onSubmit={() => onToggle(false)}
      style={{
        padding: "12px 14px",
        background: "var(--sr-surface)",
        border: "1px solid var(--sr-border-subtle)",
        borderRadius: 8,
        boxShadow: "var(--sr-hairline-top)",
      }}
    >
      <input type="hidden" name="id" value={clientId} />
      <input type="hidden" name="payment_rail" value={paymentRail} />
      <textarea
        name="notes"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => onToggle(true)}
        placeholder="Ajoutez une note privée — visible par vous seul."
        style={{
          width: "100%",
          minHeight: 70,
          background: "transparent",
          border: "none",
          outline: "none",
          resize: "vertical",
          color: "var(--sr-fg)",
          font: "400 12px/1.5 var(--font-geist-sans)",
          padding: 0,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          paddingTop: 8,
          borderTop: "1px dashed var(--sr-border-subtle)",
        }}
      >
        <div style={{ flex: 1, font: "400 10px/1 var(--font-geist-mono)", color: "var(--sr-fg-subtle)" }}>
          {editing ? "modifications non sauvegardées" : "à jour"}
        </div>
        <button
          type="submit"
          className="secondary"
          style={{ minHeight: 24, height: 24, fontSize: "0.7rem", paddingInline: 8 }}
        >
          <Icon name="check" size={11} /> Enregistrer
        </button>
      </div>
    </form>
  );
}

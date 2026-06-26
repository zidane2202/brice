"use client";

import { useState, useTransition } from "react";
import { addClientWithSubscription } from "@/app/actions/clients";
import { Icon } from "@/components/Icon";
import { ProviderGlyph } from "@/components/ProviderGlyph";
import { RAIL_NAMES, RailGlyph } from "@/components/RailGlyph";
import { toDateInputValue } from "@/lib/dates";
import type { AccountSlot } from "@/lib/types";

type FreeSlot = AccountSlot & { account: { id: string; service_name: string } };

type Props = { freeSlots: FreeSlot[]; onClose: () => void };

export function NewClientForm({ freeSlots, onClose }: Props) {
  const [rail, setRail] = useState<string>("MTN MoMo");
  const [slotId, setSlotId] = useState<string>(freeSlots[0]?.id ?? "");
  const [price, setPrice] = useState<number>(0);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    invoiceCode: string | null;
    clientName: string;
    clientPhone: string | null;
  } | null>(null);
  const today = toDateInputValue();

  async function handleSubmit(formData: FormData) {
    setErrorMsg(null);
    const amount = Number(formData.get("price"));
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMsg("Le montant payÃ© par le client est obligatoire.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await addClientWithSubscription(formData);
        setSuccess(result);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Erreur lors de la création");
      }
    });
  }

  if (success) {
    return (
      <SuccessPanel
        clientName={success.clientName}
        clientPhone={success.clientPhone}
        invoiceCode={success.invoiceCode}
        onClose={onClose}
      />
    );
  }

  return (
    <form
      action={handleSubmit}
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
          <Icon name="users" size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: "500 10px/1 var(--font-geist-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--sr-mint-300)",
            }}
          >
            Inscrire
          </div>
          <div
            style={{
              marginTop: 4,
              font: "600 15px/1.2 var(--font-geist-sans)",
              letterSpacing: "-0.01em",
              color: "var(--sr-fg-strong)",
            }}
          >
            Nouveau client
          </div>
        </div>
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
          padding: "20px 18px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <NewField label="Prénom">
          <input name="first_name" required placeholder="ex. Aïcha" style={{ height: 36, minHeight: 36 }} />
        </NewField>

        <NewField label="Nom" hint={<span style={{ color: "var(--sr-fg-subtle)" }}>optionnel</span>}>
          <input name="last_name" placeholder="ex. Mbarga" style={{ height: 36, minHeight: 36 }} />
        </NewField>

        <NewField label="Téléphone" hint="WhatsApp préféré">
          <input
            name="phone"
            type="tel"
            placeholder="+237 6 78 12 04 91"
            style={{
              height: 36,
              minHeight: 36,
              fontFamily: "var(--font-geist-mono)",
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </NewField>

        <NewField label="Email" hint={<span style={{ color: "var(--sr-fg-subtle)" }}>optionnel</span>}>
          <input name="email" type="email" placeholder="aicha@hey.cm" style={{ height: 36, minHeight: 36 }} />
        </NewField>

        <NewField label="Code PIN" hint={<span style={{ color: "var(--sr-fg-subtle)" }}>optionnel</span>}>
          <input
            name="pin_code"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="ex. 1234"
            maxLength={12}
            style={{
              height: 36,
              minHeight: 36,
              fontFamily: "var(--font-geist-mono)",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.1em",
            }}
          />
        </NewField>

        <NewField label="Profil libre" style={{ gridColumn: "1 / -1" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
              gap: 6,
            }}
          >
            {freeSlots.length === 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: "16px",
                  textAlign: "center",
                  font: "400 12px/1.4 var(--font-geist-sans)",
                  color: "var(--sr-fg-subtle)",
                  background: "var(--sr-bg)",
                  border: "1px dashed var(--sr-border)",
                  borderRadius: 6,
                }}
              >
                Aucun profil libre — ajoute un compte fournisseur d&apos;abord.
              </div>
            )}
            {freeSlots.map((slot) => {
              const selected = slotId === slot.id;
              const slotLabel = slot.label || `Profil ${slot.slot_number}`;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setSlotId(slot.id)}
                  className="secondary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    height: 36,
                    minHeight: 36,
                    padding: "0 10px",
                    background: selected
                      ? "linear-gradient(180deg, rgba(41,220,133,0.10), rgba(41,220,133,0.04))"
                      : "var(--sr-bg)",
                    border: "1px solid " + (selected ? "var(--sr-success-border)" : "var(--sr-border-subtle)"),
                    color: selected ? "var(--sr-fg-strong)" : "var(--sr-fg)",
                    boxShadow: selected
                      ? "0 0 0 1px var(--sr-success-border), inset 0 1px 0 rgba(255,255,255,0.04)"
                      : "none",
                    textAlign: "left",
                    justifyContent: "flex-start",
                    fontWeight: 500,
                  }}
                >
                  <ProviderGlyph name={slot.account.service_name} size={20} />
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "0.8rem",
                    }}
                  >
                    {slot.account.service_name} · {slotLabel}
                  </span>
                  {selected && <Icon name="check" size={13} style={{ color: "var(--sr-mint-300)" }} />}
                </button>
              );
            })}
          </div>
          <input type="hidden" name="slot_id" value={slotId} required />
        </NewField>

        <NewField label="Prix (FCFA)" hint="obligatoire">
          <div style={{ position: "relative" }}>
            <input
              type="number"
              name="price"
              required
              min={1}
              step={1}
              value={price || ""}
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
              placeholder="2500"
              style={{
                height: 36,
                minHeight: 36,
                paddingRight: 56,
                fontFamily: "var(--font-geist-mono)",
                fontVariantNumeric: "tabular-nums",
              }}
            />
            <span
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                font: "500 11px/1 var(--font-geist-mono)",
                color: "var(--sr-fg-subtle)",
                padding: "3px 6px",
                border: "1px solid var(--sr-border-subtle)",
                borderRadius: 3,
                background: "var(--sr-surface)",
                pointerEvents: "none",
              }}
            >
              FCFA
            </span>
          </div>
        </NewField>

        <NewField label="Durée (mois)">
          <input
            name="duration_months"
            type="number"
            min={1}
            max={12}
            defaultValue={1}
            required
            style={{
              height: 36,
              minHeight: 36,
              fontFamily: "var(--font-geist-mono)",
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </NewField>

        <NewField label="Date de début">
          <input
            name="start_date"
            type="date"
            defaultValue={today}
            required
            style={{
              height: 36,
              minHeight: 36,
              fontFamily: "var(--font-geist-mono)",
              fontVariantNumeric: "tabular-nums",
              colorScheme: "dark",
            }}
          />
        </NewField>

        <NewField label="Mode de paiement" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {RAIL_NAMES.map((name) => {
              const selected = rail === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setRail(name)}
                  className="secondary"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    height: 30,
                    minHeight: 30,
                    padding: "0 9px 0 4px",
                    background: selected ? "var(--sr-surface-3)" : "var(--sr-bg)",
                    border: "1px solid " + (selected ? "var(--sr-border-strong)" : "var(--sr-border-subtle)"),
                    color: selected ? "var(--sr-fg-strong)" : "var(--sr-fg)",
                    fontWeight: 500,
                    fontSize: "0.78rem",
                    boxShadow: "none",
                  }}
                >
                  <RailGlyph rail={name} size={18} />
                  {name}
                  {selected && <Icon name="check" size={12} style={{ color: "var(--sr-mint-300)", marginLeft: 2 }} />}
                </button>
              );
            })}
          </div>
          <input type="hidden" name="payment_rail" value={rail} />
        </NewField>
      </div>

      <div
        style={{
          padding: "12px 18px",
          borderTop: "1px solid var(--sr-border-subtle)",
          background: "var(--sr-bg)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            flex: 1,
            font: "400 12px/1.4 var(--font-geist-sans)",
            color: errorMsg ? "var(--sr-danger)" : "var(--sr-fg-muted)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Icon
            name="alert"
            size={13}
            style={{ color: errorMsg ? "var(--sr-danger)" : "var(--sr-fg-subtle)" }}
          />
          {errorMsg ?? "Le montant payÃ© est obligatoire pour crÃ©er le profil et gÃ©nÃ©rer la facture."}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="secondary"
          style={{ minHeight: 36, height: 36, opacity: isPending ? 0.5 : 1 }}
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isPending}
          style={{
            minHeight: 36,
            height: 36,
            paddingInline: 16,
            opacity: isPending ? 0.7 : 1,
            cursor: isPending ? "not-allowed" : "pointer",
          }}
        >
          {isPending ? (
            <>
              <Icon name="refresh" size={14} style={{ animation: "sr-spin 0.8s linear infinite" }} />
              Inscription…
            </>
          ) : (
            <>
              <Icon name="check" size={14} />
              Inscrire le client
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function NewField({
  label,
  hint,
  children,
  style,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ minWidth: 0, display: "block", ...style }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            font: "500 10px/1 var(--font-geist-sans)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--sr-fg-muted)",
          }}
        >
          {label}
        </span>
        {hint && (
          <span
            style={{
              font: "400 11px/1 var(--font-geist-sans)",
              color: "var(--sr-fg-subtle)",
              marginLeft: "auto",
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function SuccessPanel({
  clientName,
  clientPhone,
  invoiceCode,
  onClose,
}: {
  clientName: string;
  clientPhone: string | null;
  invoiceCode: string | null;
  onClose: () => void;
}) {
  const invoiceUrl = invoiceCode && typeof window !== "undefined"
    ? `${window.location.origin}/facture/${invoiceCode}`
    : invoiceCode
      ? `/facture/${invoiceCode}`
      : null;
  const digits = clientPhone ? clientPhone.replace(/[^\d]/g, "") : "";
  const waText = `Bonjour ${clientName}, voici ta facture. Lien : ${invoiceUrl ?? ""}`;
  const waHref = invoiceUrl
    ? digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(waText)}`
      : `https://wa.me/?text=${encodeURIComponent(waText)}`
    : null;

  return (
    <div
      style={{
        background: "var(--sr-surface)",
        border: "1px solid var(--sr-success-border)",
        borderRadius: 10,
        boxShadow: "var(--sr-hairline-top), 0 0 0 1px rgba(41,220,133,0.15)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "20px 22px",
          background: "linear-gradient(180deg, rgba(41,220,133,0.10), rgba(41,220,133,0.02))",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "linear-gradient(135deg, rgba(41,220,133,0.35), rgba(41,220,133,0.15))",
            border: "1px solid var(--sr-success-border)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--sr-mint-300)",
          }}
        >
          <Icon name="check" size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: "600 16px/1.2 var(--font-geist-sans)",
              color: "var(--sr-fg-strong)",
              letterSpacing: "-0.01em",
            }}
          >
            {clientName} inscrit avec succès
          </div>
          <div
            style={{
              marginTop: 4,
              font: "400 12px/1.4 var(--font-geist-sans)",
              color: "var(--sr-fg-muted)",
            }}
          >
            {invoiceCode
              ? "Facture générée — télécharge ou envoie-la directement au client."
              : "Aucun prix défini — pas de facture générée."}
          </div>
        </div>
      </div>

      {invoiceCode && invoiceUrl && (
        <div
          style={{
            padding: "16px 22px",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <a
            href={`/facture/${invoiceCode}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: "1 1 auto",
              minHeight: 38,
              height: 38,
              paddingInline: 14,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "linear-gradient(180deg, rgba(41,220,133,0.20), rgba(41,220,133,0.08))",
              border: "1px solid var(--sr-success-border)",
              color: "var(--sr-mint-300)",
              borderRadius: 8,
              font: "500 13px/1 var(--font-geist-sans)",
              textDecoration: "none",
            }}
          >
            <Icon name="bill" size={14} /> Ouvrir la facture
          </a>
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: "1 1 auto",
                minHeight: 38,
                height: 38,
                paddingInline: 14,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "#25D366",
                color: "white",
                borderRadius: 8,
                font: "500 13px/1 var(--font-geist-sans)",
                textDecoration: "none",
              }}
            >
              <Icon name="send" size={14} /> Envoyer via WhatsApp
            </a>
          )}
        </div>
      )}

      <div
        style={{
          padding: "12px 22px",
          borderTop: "1px solid var(--sr-border-subtle)",
          background: "var(--sr-bg)",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="secondary"
          style={{ minHeight: 32, height: 32, fontSize: "0.8rem" }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

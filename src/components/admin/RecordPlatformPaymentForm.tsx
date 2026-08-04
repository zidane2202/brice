"use client";

import { recordPlatformPayment } from "@/app/actions/admin";
import {
  PLATFORM_PAYMENT_KIND_LABELS,
  PLATFORM_PAYMENT_KINDS,
  defaultAmountForKind,
  type PlatformPaymentKind,
} from "@/lib/platform-payments";
import { useMemo, useState, useTransition } from "react";

type ResellerOption = { userId: string; label: string; plan: string; activePro?: boolean };

type Confirmation = {
  formData: FormData;
  reseller: string;
  kind: string;
  amount: string;
  detail: string;
};

type Props = {
  /** If set, vendeur is fixed (fiche). If omitted, show select (Finances). */
  resellerUserId?: string;
  resellers?: ResellerOption[];
  defaultPlan?: string;
  defaultExtras?: number;
  defaultActivePro?: boolean;
};

export function RecordPlatformPaymentForm({
  resellerUserId,
  resellers = [],
  defaultPlan = "pro",
  defaultExtras = 0,
  defaultActivePro = defaultPlan === "pro",
}: Props) {
  const [kind, setKind] = useState<PlatformPaymentKind>("pro_monthly");
  const [amount, setAmount] = useState(String(defaultAmountForKind("pro_monthly")));
  const [extras, setExtras] = useState(String(defaultExtras || 0));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [selectedResellerId, setSelectedResellerId] = useState(resellerUserId ?? "");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const canAddExtras = resellerUserId
    ? defaultActivePro
    : Boolean(resellers.find((item) => item.userId === selectedResellerId)?.activePro);

  function onKindChange(next: PlatformPaymentKind) {
    setKind(next);
    const def = defaultAmountForKind(next);
    if (def > 0) setAmount(String(def));
    if (next === "extra_accounts") {
      if (!extras || extras === "0") setExtras("1");
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setOk(false);
    const selectedReseller = resellerUserId
      ? "ce vendeur"
      : resellers.find((item) => item.userId === String(formData.get("reseller_user_id")))?.label ?? "ce vendeur";
    const selectedKind = PLATFORM_PAYMENT_KIND_LABELS[kind];
    const selectedAmount = Number(formData.get("amount") ?? 0).toLocaleString("fr-FR");
    const activationText = kind === "pro_monthly" || kind === "business_monthly"
      ? "\nLe pack sera activé ou prolongé de 30 jours."
      : kind === "extra_accounts"
        ? `\n${extras} compte(s) supplémentaire(s) seront ajouté(s).`
        : "";
    setConfirmation({
      formData,
      reseller: selectedReseller,
      kind: selectedKind,
      amount: `${selectedAmount} FCFA`,
      detail: activationText.trim(),
    });
  }

  function confirmSubmit() {
    if (!confirmation) return;
    const formData = confirmation.formData;
    setConfirmation(null);
    startTransition(async () => {
      try {
        await recordPlatformPayment(formData);
        setOk(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  return (
    <form action={handleSubmit} className="fields" style={{ maxWidth: 560 }}>
      {resellerUserId ? (
        <input type="hidden" name="reseller_user_id" value={resellerUserId} />
      ) : (
        <label>
          Vendeur
          <select
            name="reseller_user_id"
            required
            value={selectedResellerId}
            onChange={(event) => setSelectedResellerId(event.target.value)}
          >
            <option value="" disabled>
              Choisir…
            </option>
            {resellers.map((r) => (
              <option key={r.userId} value={r.userId}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="fields two-cols">
        <label>
          Motif
          <select
            name="kind"
            value={kind}
            onChange={(e) => onKindChange(e.target.value as PlatformPaymentKind)}
            required
          >
            {PLATFORM_PAYMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {PLATFORM_PAYMENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Montant (FCFA)
          <input
            name="amount"
            type="number"
            min={1}
            step={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
      </div>

      <div className="fields two-cols">
        <label>
          Date
          <input name="occurred_on" type="date" defaultValue={today} required />
        </label>
        <label>
          Note {kind === "other" ? "(obligatoire)" : "(optionnel)"}
          <input name="note" type="text" placeholder="Réf. MoMo, WhatsApp…" />
        </label>
      </div>

      {kind !== "other" && <input type="hidden" name="apply_plan" value="true" />}
      {kind === "pro_monthly" && <input type="hidden" name="plan" value="pro" />}
      {kind === "business_monthly" && <input type="hidden" name="plan" value="business" />}
      {kind === "extra_accounts" && (
        <>
          <input type="hidden" name="plan" value="pro" />
          <label>
            Comptes supplémentaires à ajouter
            <input
              name="extra_provider_accounts"
              type="number"
              min={1}
              value={extras}
              onChange={(e) => setExtras(e.target.value)}
            />
          </label>
        </>
      )}

      {kind === "extra_accounts" && (
        <p style={{ margin: 0, fontSize: 12, color: canAddExtras ? "var(--sr-mint-300)" : "var(--sr-warning)" }}>
          {canAddExtras
            ? "Les comptes seront ajoutés au pack Pro actuel sans modifier son échéance."
            : "Sélectionnez un vendeur ayant un pack Pro actif. Les extras ne peuvent pas activer ou renouveler un pack."}
        </p>
      )}

      {kind === "pro_monthly" || kind === "business_monthly" ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--sr-fg-subtle)" }}>
          Le paiement activera ou renouvellera automatiquement le pack pour 30 jours et lèvera toute suspension.
        </p>
      ) : null}

      <button type="submit" className="primary" disabled={pending || (kind === "extra_accounts" && !canAddExtras)}>
        {pending
          ? "Activation en cours…"
          : kind === "pro_monthly" || kind === "business_monthly"
            ? `Encaisser et ${defaultPlan === "free" ? "activer" : "renouveler"} 30 jours`
            : "Enregistrer l’encaissement"}
      </button>
      {ok && (
        <p style={{ margin: 0, color: "var(--sr-mint-300)", fontSize: 13 }}>
          Paiement enregistré et abonnement mis à jour.
        </p>
      )}
      {error && (
        <p style={{ margin: 0, color: "var(--sr-danger)", fontSize: 13 }}>{error}</p>
      )}
      {confirmation && (
        <ConfirmationModal
          confirmation={confirmation}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmSubmit}
        />
      )}
    </form>
  );
}

function ConfirmationModal({
  confirmation,
  onCancel,
  onConfirm,
}: {
  confirmation: Confirmation;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(0,0,0,.72)",
        backdropFilter: "blur(5px)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-confirm-title"
        style={{
          width: "min(440px, 100%)",
          padding: 22,
          borderRadius: 14,
          border: "1px solid var(--sr-border)",
          background: "var(--sr-surface)",
          boxShadow: "0 24px 80px rgba(0,0,0,.55)",
        }}
      >
        <div style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 10, background: "rgba(41,220,133,.12)", color: "var(--sr-mint-300)", fontSize: 20, marginBottom: 16 }}>✓</div>
        <h3 id="payment-confirm-title" style={{ margin: 0, fontSize: 19 }}>Confirmer l’encaissement</h3>
        <p style={{ margin: "7px 0 18px", color: "var(--sr-fg-subtle)", fontSize: 13 }}>
          Vérifiez les informations avant de valider cette opération financière.
        </p>
        <div style={{ padding: 14, borderRadius: 9, background: "var(--sr-bg)", border: "1px solid var(--sr-border-subtle)", display: "grid", gap: 10 }}>
          <ModalRow label="Vendeur" value={confirmation.reseller} />
          <ModalRow label="Motif" value={confirmation.kind} />
          <ModalRow label="Montant" value={confirmation.amount} accent />
        </div>
        {confirmation.detail && <p style={{ margin: "14px 0 0", color: "var(--sr-mint-300)", fontSize: 12 }}>{confirmation.detail}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button type="button" className="secondary" onClick={onCancel}>Annuler</button>
          <button type="button" onClick={onConfirm}>Confirmer l’encaissement</button>
        </div>
      </div>
    </div>
  );
}

function ModalRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 13 }}>
      <span style={{ color: "var(--sr-fg-subtle)" }}>{label}</span>
      <strong style={{ color: accent ? "var(--sr-mint-300)" : "var(--sr-fg-strong)", textAlign: "right" }}>{value}</strong>
    </div>
  );
}

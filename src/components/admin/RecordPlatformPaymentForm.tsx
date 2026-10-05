"use client";

import { recordPlatformPayment } from "@/app/actions/admin";
import {
  PLATFORM_PAYMENT_KIND_LABELS,
  PLATFORM_PAYMENT_KINDS,
  suggestedAmount,
  type PlatformPaymentKind,
} from "@/lib/platform-payments";
import { extrasMonthlyFcfa } from "@/lib/plans";
import { todayDateOnly } from "@/lib/dates";
import { useMemo, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type ResellerOption = { userId: string; label: string; plan: string; activePro?: boolean; extras?: number };

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
  const [amount, setAmount] = useState(String(suggestedAmount("pro_monthly", defaultExtras)));
  const [extras, setExtras] = useState(String(defaultExtras || 0));
  const [renewedExtras, setRenewedExtras] = useState(String(defaultExtras || 0));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [selectedResellerId, setSelectedResellerId] = useState(resellerUserId ?? "");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const today = useMemo(() => todayDateOnly(), []);
  const canAddExtras = resellerUserId
    ? defaultActivePro
    : Boolean(resellers.find((item) => item.userId === selectedResellerId)?.activePro);

  const currentExtras = resellerUserId
    ? defaultExtras
    : Number(resellers.find((item) => item.userId === selectedResellerId)?.extras ?? 0);

  function refreshAmount(nextKind: PlatformPaymentKind, nextExtras: string) {
    const def = suggestedAmount(nextKind, Number(nextExtras) || 0);
    if (def > 0) setAmount(String(def));
  }

  function onKindChange(next: PlatformPaymentKind) {
    setKind(next);
    let nextExtras = next === "pro_monthly" ? renewedExtras : extras;
    if (next === "extra_accounts" && (!extras || extras === "0")) {
      nextExtras = "1";
      setExtras("1");
    }
    refreshAmount(next, nextExtras);
  }

  function onResellerChange(userId: string) {
    setSelectedResellerId(userId);
    const kept = String(resellers.find((item) => item.userId === userId)?.extras ?? 0);
    setRenewedExtras(kept);
    if (kind === "pro_monthly") refreshAmount(kind, kept);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setOk(false);
    setReceiptId(null);
    const selectedReseller = resellerUserId
      ? "ce vendeur"
      : resellers.find((item) => item.userId === String(formData.get("reseller_user_id")))?.label ?? "ce vendeur";
    const selectedKind = PLATFORM_PAYMENT_KIND_LABELS[kind];
    const selectedAmount = Number(formData.get("amount") ?? 0).toLocaleString("fr-FR");
    const kept = Number(renewedExtras) || 0;
    const activationText = kind === "pro_monthly"
      ? kept > 0
        ? `Le pack sera activé ou prolongé de 30 jours avec ${kept} extra(s).`
        : "Le pack sera activé ou prolongé de 30 jours, sans extra."
      : kind === "business_monthly"
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
        const result = await recordPlatformPayment(formData);
        setReceiptId(result.paymentId);
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
            onChange={(event) => onResellerChange(event.target.value)}
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
      {kind === "pro_monthly" && (
        <>
          <input type="hidden" name="plan" value="pro" />
          <label>
            Comptes extras renouvelés
            <input
              name="extra_provider_accounts"
              type="number"
              min={0}
              value={renewedExtras}
              onChange={(e) => { setRenewedExtras(e.target.value); refreshAmount(kind, e.target.value); }}
            />
          </label>
          <p style={{ margin: 0, fontSize: 12, color: "var(--sr-fg-subtle)" }}>
            {currentExtras > 0
              ? `Le vendeur a ${currentExtras} extra(s). Les extras sont mensuels : seuls ceux payés avec ce renouvellement sont conservés (${extrasMonthlyFcfa(Number(renewedExtras) || 0).toLocaleString("fr-FR")} FCFA inclus dans le montant).`
              : "Aucun extra en cours. Indiquez un nombre pour en ajouter avec ce renouvellement."}
          </p>
        </>
      )}
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
              onChange={(e) => { setExtras(e.target.value); refreshAmount(kind, e.target.value); }}
            />
          </label>
        </>
      )}

      {kind === "extra_accounts" && (
        <p style={{ margin: 0, fontSize: 12, color: canAddExtras ? "var(--sr-mint-300)" : "var(--sr-warning)" }}>
          {canAddExtras
            ? "Les comptes seront ajoutés au pack Pro actuel jusqu'à son échéance, puis à renouveler chaque mois avec le pack."
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
            ? defaultPlan === "free"
              ? "Encaisser et activer 30 jours"
              : "Encaisser et renouveler 30 jours"
            : "Enregistrer l’encaissement"}
      </button>
      {ok && (
        <div className="payment-success"><span>Paiement enregistré et abonnement mis à jour.</span>{receiptId && <a className="secondary" href={`/admin/finances/recu/${receiptId}`} target="_blank" rel="noreferrer">Voir le reçu</a>}</div>
      )}
      {error && (
        <p style={{ margin: 0, color: "var(--sr-danger)", fontSize: 13 }}>{error}</p>
      )}
      {confirmation && (
        <ConfirmDialog
          open
          title="Confirmer l’encaissement"
          description="Vérifiez les informations avant de valider cette opération financière."
          rows={[
            { label: "Vendeur", value: confirmation.reseller },
            { label: "Motif", value: confirmation.kind },
            { label: "Montant", value: confirmation.amount, accent: true },
          ]}
          detail={confirmation.detail}
          confirmLabel="Confirmer l’encaissement"
          pending={pending}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmSubmit}
        />
      )}
    </form>
  );
}

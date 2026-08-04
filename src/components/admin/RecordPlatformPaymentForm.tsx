"use client";

import { recordPlatformPayment } from "@/app/actions/admin";
import {
  PLATFORM_PAYMENT_KIND_LABELS,
  PLATFORM_PAYMENT_KINDS,
  defaultAmountForKind,
  type PlatformPaymentKind,
} from "@/lib/platform-payments";
import { useMemo, useState, useTransition } from "react";

type ResellerOption = { userId: string; label: string };

type Props = {
  /** If set, vendeur is fixed (fiche). If omitted, show select (Finances). */
  resellerUserId?: string;
  resellers?: ResellerOption[];
  defaultPlan?: string;
  defaultExtras?: number;
};

export function RecordPlatformPaymentForm({
  resellerUserId,
  resellers = [],
  defaultPlan = "pro",
  defaultExtras = 0,
}: Props) {
  const [kind, setKind] = useState<PlatformPaymentKind>("pro_monthly");
  const [amount, setAmount] = useState(String(defaultAmountForKind("pro_monthly")));
  const [applyPlan, setApplyPlan] = useState(true);
  const [plan, setPlan] = useState(
    defaultPlan === "business" || defaultPlan === "pro" ? defaultPlan : "pro"
  );
  const [extras, setExtras] = useState(String(defaultExtras || 0));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  function onKindChange(next: PlatformPaymentKind) {
    setKind(next);
    const def = defaultAmountForKind(next);
    if (def > 0) setAmount(String(def));
    if (next === "pro_monthly") setPlan("pro");
    if (next === "business_monthly") setPlan("business");
    if (next === "extra_accounts") {
      setPlan("pro");
      if (!extras || extras === "0") setExtras("1");
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setOk(false);
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
          <select name="reseller_user_id" required defaultValue="">
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

      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          name="apply_plan"
          value="true"
          checked={applyPlan}
          onChange={(e) => setApplyPlan(e.target.checked)}
        />
        Appliquer aussi le plan (et lever la suspension)
      </label>

      {applyPlan && (
        <div className="fields two-cols">
          <label>
            Plan
            <select name="plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="free">free</option>
              <option value="pro">pro</option>
              <option value="business">business</option>
            </select>
          </label>
          {(plan === "pro" || kind === "extra_accounts") && (
            <label>
              {kind === "extra_accounts" ? "Extras à ajouter" : "Extras (total Pro)"}
              <input
                name="extra_provider_accounts"
                type="number"
                min={kind === "extra_accounts" ? 1 : 0}
                value={extras}
                onChange={(e) => setExtras(e.target.value)}
              />
            </label>
          )}
        </div>
      )}

      <button type="submit" className="primary" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer l’encaissement"}
      </button>
      {ok && (
        <p style={{ margin: 0, color: "var(--sr-mint-300)", fontSize: 13 }}>Enregistré.</p>
      )}
      {error && (
        <p style={{ margin: 0, color: "var(--sr-danger)", fontSize: 13 }}>{error}</p>
      )}
    </form>
  );
}

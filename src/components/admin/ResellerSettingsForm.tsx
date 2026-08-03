"use client";

import { updateResellerPlanRole } from "@/app/actions/admin";
import { useState, useTransition } from "react";

type Props = {
  userId: string;
  plan: string;
  role: string;
  extraProviderAccounts?: number;
  isSelf: boolean;
};

export function ResellerSettingsForm({
  userId,
  plan,
  role,
  extraProviderAccounts = 0,
  isSelf,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(
    plan === "pro" || plan === "business" ? plan : "free"
  );

  async function handleSubmit(formData: FormData) {
    setErrorMsg(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await updateResellerPlanRole(formData);
        setSuccess(true);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  return (
    <form action={handleSubmit} className="fields" style={{ maxWidth: 520 }}>
      <input type="hidden" name="user_id" value={userId} />
      <div className="fields two-cols">
        <label>
          Plan
          <select
            name="plan"
            value={currentPlan}
            onChange={(e) => setCurrentPlan(e.target.value)}
            required
          >
            <option value="free">free</option>
            <option value="pro">pro</option>
            <option value="business">business</option>
          </select>
        </label>
        <label>
          Rôle
          <select name="role" defaultValue={role === "admin" ? "admin" : "reseller"} required>
            <option value="reseller">reseller</option>
            <option value="admin">admin</option>
          </select>
        </label>
      </div>
      {currentPlan === "pro" && (
        <label>
          Comptes extras (Pro)
          <input
            name="extra_provider_accounts"
            type="number"
            min={0}
            defaultValue={extraProviderAccounts}
          />
        </label>
      )}
      {isSelf && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--sr-fg-subtle)" }}>
          Attention : c’est votre compte. Vous ne pouvez pas retirer votre rôle admin.
        </p>
      )}
      {errorMsg && (
        <p style={{ margin: 0, color: "var(--sr-danger)", fontSize: 13 }}>{errorMsg}</p>
      )}
      {success && (
        <p style={{ margin: 0, color: "var(--sr-mint-400)", fontSize: 13 }}>
          Réglages enregistrés.
        </p>
      )}
      <button type="submit" disabled={isPending}>
        {isPending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

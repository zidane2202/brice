"use client";

import { updateResellerPlanRole } from "@/app/actions/admin";
import { useState, useTransition } from "react";

type Props = {
  userId: string;
  role: string;
  isSelf: boolean;
};

export function ResellerSettingsForm({
  userId,
  role,
  isSelf,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
      <input type="hidden" name="plan" value="__keep__" />
      <label>
        Rôle du compte
        <select name="role" defaultValue={role === "admin" ? "admin" : "reseller"} required>
          <option value="reseller">Vendeur</option>
          <option value="admin">Administrateur</option>
        </select>
      </label>
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
          Rôle enregistré.
        </p>
      )}
      <button type="submit" disabled={isPending}>
        {isPending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

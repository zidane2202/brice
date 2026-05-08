"use client";

import { resetPassword } from "@/app/actions/auth";
import { PasswordInput } from "@/components/PasswordInput";
import { useActionState } from "react";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(resetPassword, undefined);

  return (
    <div className="auth-card">
      <div className="auth-header">
        <p className="eyebrow">Sécurité</p>
        <h1>Nouveau mot de passe</h1>
      </div>
      <form action={action} className="auth-form">
        {state?.error && <p className="auth-error">{state.error}</p>}
        <label>
          Nouveau mot de passe
          <PasswordInput name="password" placeholder="8 caractères minimum" required minLength={8} />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Mise à jour..." : "Mettre à jour"}
        </button>
      </form>
    </div>
  );
}

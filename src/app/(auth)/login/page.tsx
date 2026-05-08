"use client";

import { login } from "@/app/actions/auth";
import Link from "next/link";
import { useActionState } from "react";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="auth-card">
      <div className="auth-header">
        <p className="eyebrow">Bienvenue</p>
        <h1>Connexion</h1>
      </div>
      <form action={action} className="auth-form">
        {state?.error && <p className="auth-error">{state.error}</p>}
        <label>
          Email
          <input name="email" type="email" placeholder="vous@email.com" required />
        </label>
        <label>
          Mot de passe
          <input name="password" type="password" placeholder="••••••••" required />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Connexion..." : "Se connecter"}
        </button>
      </form>
      <p className="auth-footer">
        Pas encore de compte ?{" "}
        <Link href="/signup">Créer un compte</Link>
      </p>
    </div>
  );
}

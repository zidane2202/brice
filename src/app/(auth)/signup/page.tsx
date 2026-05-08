"use client";

import { signup } from "@/app/actions/auth";
import Link from "next/link";
import { useActionState } from "react";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <div className="auth-card">
      <div className="auth-header">
        <p className="eyebrow">Nouveau compte</p>
        <h1>Inscription</h1>
      </div>
      <form action={action} className="auth-form">
        {state?.error && <p className="auth-error">{state.error}</p>}
        <label>
          Email
          <input name="email" type="email" placeholder="vous@email.com" required />
        </label>
        <label>
          Mot de passe
          <input name="password" type="password" placeholder="8 caractères minimum" required minLength={8} />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Création..." : "Créer mon compte"}
        </button>
      </form>
      <p className="auth-footer">
        Déjà un compte ?{" "}
        <Link href="/login">Se connecter</Link>
      </p>
    </div>
  );
}

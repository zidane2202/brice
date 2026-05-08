"use client";

import { signup } from "@/app/actions/auth";
import { PasswordInput } from "@/components/PasswordInput";
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <label>
            Prénom
            <input name="first_name" type="text" placeholder="Brice" required />
          </label>
          <label>
            Nom
            <input name="last_name" type="text" placeholder="Mbarga" required />
          </label>
        </div>
        <label>
          Téléphone
          <input name="phone" type="tel" placeholder="+237 6 00 00 00 00" required />
        </label>
        <label>
          Ville
          <input name="city" type="text" placeholder="Yaoundé" required />
        </label>
        <label>
          Email
          <input name="email" type="email" placeholder="brice@gmail.com" required />
        </label>
        <label>
          Mot de passe
          <PasswordInput name="password" placeholder="8 caractères minimum" required minLength={8} />
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

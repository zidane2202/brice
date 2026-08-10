"use client";

import { forgotPassword } from "@/app/actions/auth";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPassword, undefined);
  const [linkError, setLinkError] = useState(false);

  useEffect(() => {
    setLinkError(new URLSearchParams(window.location.search).get("error") === "reset");
  }, []);

  return (
    <div className="auth-card">
      <div className="auth-header">
        <p className="eyebrow">Récupération</p>
        <h1>Mot de passe oublié</h1>
      </div>
      {state?.success ? (
        <div className="auth-form">
          <p style={{ color: "var(--accent)", textAlign: "center", padding: "1rem 0" }}>
            Email envoyé ! Vérifiez votre boîte mail et cliquez sur le lien.
          </p>
          <Link href="/login" className="btn-link" style={{ textAlign: "center", display: "block" }}>
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <form action={action} className="auth-form">
          {(linkError || state?.error) && (
            <p className="auth-error">
              {state?.error || "Lien invalide ou expiré. Demandez un nouveau lien ci-dessous."}
            </p>
          )}
          <label>
            Email
            <input name="email" type="email" placeholder="brice@gmail.com" required />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? "Envoi..." : "Envoyer le lien"}
          </button>
        </form>
      )}
      <p className="auth-footer">
        <Link href="/login">← Retour à la connexion</Link>
      </p>
    </div>
  );
}

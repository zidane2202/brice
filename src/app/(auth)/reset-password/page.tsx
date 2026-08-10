"use client";

import { resetPassword } from "@/app/actions/auth";
import { PasswordInput } from "@/components/PasswordInput";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useActionState, useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSessionReady(Boolean(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setSessionReady(Boolean(session));
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="auth-card">
      <div className="auth-header">
        <p className="eyebrow">Sécurité</p>
        <h1>Nouveau mot de passe</h1>
      </div>
      {sessionReady === false ? (
        <p className="auth-error">
          Lien invalide ou expiré. Demandez un nouveau lien depuis Mot de passe oublié.
        </p>
      ) : (
        <form action={action} className="auth-form">
          {state?.error && <p className="auth-error">{state.error}</p>}
          <label>
            Nouveau mot de passe
            <PasswordInput name="password" placeholder="8 caractères minimum" required minLength={8} />
          </label>
          <button type="submit" disabled={pending || sessionReady !== true}>
            {pending ? "Mise à jour..." : "Mettre à jour"}
          </button>
        </form>
      )}
    </div>
  );
}

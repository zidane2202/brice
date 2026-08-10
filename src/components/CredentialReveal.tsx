"use client";

import { revealAccountCredentials } from "@/app/actions/accounts";
import { useState, useTransition } from "react";

export function CredentialReveal({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const [creds, setCreds] = useState<{ email: string | null; password: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reveal() {
    startTransition(async () => {
      try {
        const data = await revealAccountCredentials(accountId);
        setCreds(data);
        setOpen(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible d'afficher les identifiants.");
      }
    });
  }

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="section-head">
        <div>
          <p className="eyebrow">Accès fournisseur</p>
          <h2>Identifiants du compte</h2>
        </div>
      </div>
      {!open ? (
        <button type="button" className="secondary" onClick={reveal} disabled={pending}>
          {pending ? "Chargement…" : "Afficher les identifiants"}
        </button>
      ) : (
        <div className="fields two-cols">
          <label>
            E-mail du compte
            <input readOnly value={creds?.email || "—"} />
          </label>
          <label>
            Mot de passe
            <input readOnly value={creds?.password || "—"} />
          </label>
          <div>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setOpen(false);
                setCreds(null);
              }}
            >
              Masquer
            </button>
          </div>
        </div>
      )}
      {error ? <p style={{ color: "var(--sr-danger)", marginTop: 10, fontSize: 13 }}>{error}</p> : null}
    </div>
  );
}

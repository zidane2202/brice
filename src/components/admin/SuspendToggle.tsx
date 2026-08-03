"use client";

import { setResellerSuspended } from "@/app/actions/admin";
import { useState, useTransition } from "react";

type Props = {
  userId: string;
  suspended: boolean;
};

export function SuspendToggle({ userId, suspended }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    const fd = new FormData();
    fd.set("user_id", userId);
    fd.set("suspended", suspended ? "false" : "true");
    startTransition(async () => {
      try {
        await setResellerSuspended(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <button
        type="button"
        className="secondary"
        onClick={toggle}
        disabled={pending}
        style={{
          fontSize: 12,
          padding: "6px 10px",
          color: suspended ? "var(--sr-mint-300)" : "var(--sr-danger)",
          borderColor: suspended ? "var(--sr-success-border)" : "var(--sr-danger-border)",
        }}
      >
        {pending ? "…" : suspended ? "Réactiver" : "Suspendre"}
      </button>
      {error && (
        <span style={{ fontSize: 11, color: "var(--sr-danger)" }}>{error}</span>
      )}
    </div>
  );
}

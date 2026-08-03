import { supportWhatsAppHref } from "@/lib/support";

export function SuspendedGate() {
  const href = supportWhatsAppHref(
    "Bonjour, mon compte SubResell est suspendu. Pouvez-vous m'aider ?"
  );

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--sr-bg)",
        color: "var(--sr-fg)",
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>
          Compte suspendu
        </p>
        <h1 style={{ fontSize: "1.6rem", marginBottom: 12 }}>Accès temporairement bloqué</h1>
        <p style={{ color: "var(--sr-fg-muted)", marginBottom: 28, lineHeight: 1.55 }}>
          Votre compte vendeur est suspendu. Contactez l&apos;administrateur pour régulariser
          votre situation et retrouver l&apos;accès à l&apos;application.
        </p>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="primary"
          style={{ display: "inline-flex", textDecoration: "none" }}
        >
          Contacter le support
        </a>
      </div>
    </div>
  );
}

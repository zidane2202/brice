"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="panel" style={{ maxWidth: 560, margin: "60px auto", textAlign: "center", padding: 32 }}><p className="dash-eyebrow">Un problème est survenu</p><h1>Cette page n’a pas pu être chargée.</h1><p style={{ color: "var(--sr-fg-subtle)" }}>Vos données ne sont pas perdues. Réessayez ou revenez au tableau de bord.</p><div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}><button type="button" onClick={reset}>Réessayer</button><a href="/dashboard" className="secondary" style={{ display: "inline-flex", alignItems: "center", padding: "0 14px", textDecoration: "none" }}>Tableau de bord</a></div></div>;
}

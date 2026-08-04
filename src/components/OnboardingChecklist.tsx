"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function OnboardingChecklist({ hasProfile, accounts, clients }: { hasProfile: boolean; accounts: number; clients: number }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => setHidden(localStorage.getItem("subresell-onboarding-hidden") === "1"), []);
  if (hidden || (hasProfile && accounts > 0 && clients > 0)) return null;
  const steps = [
    { done: hasProfile, label: "Compléter le profil et le logo", href: "/profil" },
    { done: accounts > 0, label: "Ajouter un compte fournisseur", href: "/abonnements" },
    { done: clients > 0, label: "Enregistrer le premier client", href: "/clients" },
    { done: false, label: "Activer les notifications et installer l’application", href: "/profil#section-notifications" },
  ];
  return <div className="panel" style={{ marginBottom: 20, borderColor: "var(--sr-success-border)", background: "linear-gradient(135deg,rgba(41,220,133,.08),var(--sr-surface))" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><div><p className="eyebrow">Bien démarrer</p><h2 style={{ marginTop: 4 }}>Configurez votre espace</h2></div><button type="button" className="secondary" onClick={() => { localStorage.setItem("subresell-onboarding-hidden", "1"); setHidden(true); }} style={{ minHeight: 28, height: 28 }}>Masquer</button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 8, marginTop: 14 }}>{steps.map((step, index) => <Link key={step.label} href={step.href} style={{ display: "flex", gap: 10, padding: 12, borderRadius: 8, border: "1px solid var(--sr-border-subtle)", textDecoration: "none", color: "var(--sr-fg)", background: "var(--sr-bg)" }}><span style={{ width: 20, height: 20, display: "grid", placeItems: "center", borderRadius: 99, background: step.done ? "var(--sr-success)" : "var(--sr-surface-2)", color: step.done ? "#001a0c" : "var(--sr-fg-subtle)", fontSize: 10 }}>{step.done ? "✓" : index + 1}</span><span style={{ fontSize: 12, lineHeight: 1.4 }}>{step.label}</span></Link>)}</div></div>;
}

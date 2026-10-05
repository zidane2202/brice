import { Icon } from "@/components/Icon";
import { daysUntil } from "@/lib/dates";
import { PLAN_PRICES_FCFA } from "@/lib/plans";
import { supportWhatsAppHref } from "@/lib/support";

export function TrialBanner({ endsOn }: { endsOn: string }) {
  const days = daysUntil(endsOn);
  const date = new Date(`${endsOn}T00:00:00`).toLocaleDateString("fr-FR");
  const remaining = days <= 0 ? "Dernier jour d'essai" : days === 1 ? "Encore 1 jour d'essai" : `Encore ${days} jours d'essai`;
  const href = supportWhatsAppHref(`Bonjour, je souhaite passer au plan Pro SubResell (${PLAN_PRICES_FCFA.pro.toLocaleString("fr-FR")} FCFA / 30 jours).`);

  return (
    <div
      role="status"
      style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "0 0 18px", padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(41,220,133,.35)", background: "rgba(41,220,133,.08)", fontSize: 13 }}
    >
      <Icon name="zap" size={16} />
      <span style={{ flex: 1, minWidth: 220 }}>
        <strong>{remaining}</strong> {`· Toutes les fonctionnalités Pro jusqu'au ${date}. Ensuite, votre compte passe en lecture seule jusqu'à votre passage à Pro ou Business.`}
      </span>
      <a className="btn-link" href={href} target="_blank" rel="noreferrer">Passer à Pro →</a>
    </div>
  );
}

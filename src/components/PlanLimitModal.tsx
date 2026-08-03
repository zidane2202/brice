"use client";

import { PLAN_PRICES_FCFA } from "@/lib/plans";
import { Icon } from "@/components/Icon";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "free-upgrade" | "pro-extras";
  message?: string;
};

const SUPPORT_WA =
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "") || "";

function waHref(text: string) {
  const q = encodeURIComponent(text);
  if (!SUPPORT_WA) return `https://wa.me/?text=${q}`;
  return `https://wa.me/${SUPPORT_WA}?text=${q}`;
}

export function PlanLimitModal({ open, onClose, mode, message }: Props) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{ maxWidth: 420, width: "100%", margin: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>Limite de plan atteinte</h2>
        <p style={{ color: "var(--sr-fg-subtle)", fontSize: 13 }}>
          {message ??
            (mode === "free-upgrade"
              ? "Passez en Pro pour continuer à grandir."
              : "Ajoutez des comptes extras ou passez Business.")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          {mode === "free-upgrade" ? (
            <a
              className="btn-link"
              href={waHref(
                `Bonjour, je souhaite passer au plan Pro SubResell (${PLAN_PRICES_FCFA.pro} FCFA/mois).`
              )}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                borderRadius: 8,
                background: "var(--sr-mint-500)",
                color: "var(--sr-mint-ink)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <Icon name="zap" size={14} /> Passer en Pro — {PLAN_PRICES_FCFA.pro.toLocaleString("fr-FR")} FCFA/mois
            </a>
          ) : (
            <>
              <a
                href={waHref(
                  `Bonjour, je veux ajouter 1 compte extra Pro (+${PLAN_PRICES_FCFA.extraAccount} FCFA/mois).`
                )}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--sr-border-subtle)",
                  textDecoration: "none",
                  color: "var(--sr-fg)",
                }}
              >
                +1 compte — {PLAN_PRICES_FCFA.extraAccount.toLocaleString("fr-FR")} FCFA/mois
              </a>
              <a
                href={waHref(
                  `Bonjour, je veux le pack +3 comptes Pro (+${PLAN_PRICES_FCFA.extraPack3} FCFA/mois).`
                )}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--sr-border-subtle)",
                  textDecoration: "none",
                  color: "var(--sr-fg)",
                }}
              >
                +3 comptes — {PLAN_PRICES_FCFA.extraPack3.toLocaleString("fr-FR")} FCFA/mois
              </a>
              <a
                href={waHref(
                  `Bonjour, je souhaite passer au plan Business SubResell.`
                )}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--sr-border-subtle)",
                  textDecoration: "none",
                  color: "var(--sr-fg)",
                }}
              >
                Passer Business
              </a>
            </>
          )}
        </div>

        <button type="button" className="secondary" onClick={onClose} style={{ marginTop: 16 }}>
          Fermer
        </button>
      </div>
    </div>
  );
}

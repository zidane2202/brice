"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { PLAN_EXPIRED_EVENT } from "@/lib/plan-expired-client";
import { PLAN_EXPIRED_PARAM, PLAN_EXPIRED_VALUE, PLAN_PRICES_FCFA } from "@/lib/plans";
import { supportWhatsAppHref } from "@/lib/support";

type Props = { plan: "free" | "pro" | "business"; renewsOn: string };

const PLAN_LABEL = { pro: "Pro", business: "Business" } as const;

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR");
}

function isActionForm(form: HTMLFormElement, submitter: HTMLElement | null) {
  const action = submitter?.getAttribute("formaction") ?? form.getAttribute("action") ?? "";
  return action.startsWith("javascript:");
}

export function PlanExpiredGuard({ plan, renewsOn }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.planExpired = "1";

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.closest("[data-readonly-ok]")) return;
      if (!isActionForm(form, event.submitter)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(true);
    };
    const onBlocked = () => setOpen(true);

    document.addEventListener("submit", onSubmit, true);
    window.addEventListener(PLAN_EXPIRED_EVENT, onBlocked);
    return () => {
      delete root.dataset.planExpired;
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener(PLAN_EXPIRED_EVENT, onBlocked);
    };
  }, []);

  useEffect(() => {
    if (searchParams.get(PLAN_EXPIRED_PARAM) !== PLAN_EXPIRED_VALUE) return;
    setOpen(true);
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete(PLAN_EXPIRED_PARAM);
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const trial = plan === "free";
  const paidPlan = trial ? "pro" : plan;
  const label = PLAN_LABEL[paidPlan];
  const expiredOn = formatDate(renewsOn);
  const price = PLAN_PRICES_FCFA[paidPlan].toLocaleString("fr-FR");
  const renewHref = supportWhatsAppHref(
    trial
      ? `Bonjour, mon essai SubResell est terminé. Je souhaite passer au plan Pro (${price} FCFA / 30 jours).`
      : `Bonjour, je souhaite renouveler mon pack ${label} SubResell (${price} FCFA / 30 jours).`
  );
  const upgradeHref = supportWhatsAppHref("Bonjour, je souhaite passer au plan Business SubResell.");
  const bannerTitle = trial ? `Essai gratuit terminé le ${expiredOn}.` : `Pack ${label} expiré le ${expiredOn}.`;
  const modalTitle = trial ? "Votre essai gratuit est terminé" : "Votre pack a expiré";
  const modalText = trial
    ? `Votre essai gratuit de 7 jours s'est terminé le ${expiredOn}. Pour continuer à utiliser la plateforme, passez à l'offre Pro ou Business.`
    : `Votre pack ${label} a expiré le ${expiredOn}. Pour continuer à utiliser la plateforme, renouvelez votre pack ou passez à l'offre supérieure.`;
  const primaryLabel = trial ? `Passer à Pro (${price} FCFA / 30 jours)` : `Renouveler mon pack ${label} (${price} FCFA / 30 jours)`;

  return (
    <>
      <div
        role="status"
        style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "0 0 18px", padding: "12px 16px", borderRadius: 10, border: "1px solid var(--sr-danger-border)", background: "var(--sr-danger-bg)", color: "var(--sr-fg)", fontSize: 13 }}
      >
        <Icon name="alert" size={16} />
        <span style={{ flex: 1, minWidth: 220 }}>
          <strong>{bannerTitle}</strong> Votre compte est en lecture seule : vous pouvez consulter vos données, mais plus les modifier.
        </span>
        <button type="button" className="primary" onClick={() => setOpen(true)} data-readonly-ok>
          {trial ? "Passer à Pro" : "Renouveler"}
        </button>
      </div>

      {open && (
        <ModalPortal>
        <div
          role="presentation"
          style={{ position: "fixed", inset: 0, zIndex: 1300, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.72)", backdropFilter: "blur(5px)" }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-expired-title"
            style={{ width: "min(440px, 100%)", padding: 22, borderRadius: 14, border: "1px solid var(--sr-danger-border)", background: "var(--sr-surface)", boxShadow: "0 24px 80px rgba(0,0,0,.55)" }}
          >
            <div style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 10, background: "var(--sr-danger-bg)", color: "var(--sr-danger)", marginBottom: 16 }}>
              <Icon name="alert" size={20} />
            </div>
            <h3 id="plan-expired-title" style={{ margin: 0, fontSize: 19 }}>{modalTitle}</h3>
            <p style={{ margin: "7px 0 18px", color: "var(--sr-fg-subtle)", fontSize: 13, lineHeight: 1.45 }}>
              {modalText}
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <a className="primary" href={renewHref} target="_blank" rel="noreferrer" style={{ display: "inline-flex", justifyContent: "center", gap: 8, textDecoration: "none" }}>
                <Icon name={trial ? "zap" : "refresh"} size={14} /> {primaryLabel}
              </a>
              {plan !== "business" && (
                <a className="secondary" href={upgradeHref} target="_blank" rel="noreferrer" style={{ display: "inline-flex", justifyContent: "center", gap: 8, textDecoration: "none" }}>
                  <Icon name="zap" size={14} /> {`Passer à Business (${PLAN_PRICES_FCFA.business.toLocaleString("fr-FR")} FCFA / 30 jours)`}
                </a>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" className="secondary" onClick={() => setOpen(false)}>
                Continuer en lecture seule
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}

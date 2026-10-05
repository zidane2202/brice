export const PLAN_EXPIRED_EVENT = "subresell:plan-expired";

export function isPlanReadOnly(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.planExpired === "1";
}

export function openPlanExpired() {
  window.dispatchEvent(new Event(PLAN_EXPIRED_EVENT));
}

/** Ouvre le pop-up de renouvellement si le compte est en lecture seule ; renvoie true quand l'action doit s'arrêter. */
export function blockIfPlanExpired(): boolean {
  if (!isPlanReadOnly()) return false;
  openPlanExpired();
  return true;
}

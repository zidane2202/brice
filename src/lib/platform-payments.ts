import { PLAN_PRICES_FCFA } from "./plans.ts";

export const PLATFORM_PAYMENT_KINDS = [
  "pro_monthly",
  "business_monthly",
  "extra_accounts",
  "other",
] as const;

export type PlatformPaymentKind = (typeof PLATFORM_PAYMENT_KINDS)[number];

export const PLATFORM_PAYMENT_KIND_LABELS: Record<PlatformPaymentKind, string> = {
  pro_monthly: "Pro (mensuel)",
  business_monthly: "Business (mensuel)",
  extra_accounts: "Extras comptes",
  other: "Autre",
};

export function defaultAmountForKind(kind: PlatformPaymentKind): number {
  if (kind === "pro_monthly") return PLAN_PRICES_FCFA.pro;
  if (kind === "business_monthly") return PLAN_PRICES_FCFA.business;
  if (kind === "extra_accounts") return PLAN_PRICES_FCFA.extraAccount;
  return 0;
}

export function suggestedPlanForKind(
  kind: PlatformPaymentKind
): { plan: "pro" | "business" | "free"; extras?: number } | null {
  if (kind === "pro_monthly") return { plan: "pro", extras: 0 };
  if (kind === "business_monthly") return { plan: "business", extras: 0 };
  if (kind === "extra_accounts") return { plan: "pro" };
  return null;
}

export function isPlatformPaymentKind(v: string): v is PlatformPaymentKind {
  return (PLATFORM_PAYMENT_KINDS as readonly string[]).includes(v);
}

export function planStateAfterReverse(payment: {
  applied_plan: string | null;
  previous_plan?: string | null;
  previous_extras?: number | null;
  previous_plan_renews_on?: string | null;
  previous_suspended?: boolean | null;
}): {
  plan: string;
  extras: number;
  plan_renews_on: string | null;
  suspended: boolean;
} | null {
  if (!payment.applied_plan) return null;
  if (payment.previous_plan == null && payment.previous_extras == null && payment.previous_plan_renews_on == null) {
    return null;
  }
  return {
    plan: payment.previous_plan ?? "free",
    extras: Math.max(0, Number(payment.previous_extras ?? 0)),
    plan_renews_on: payment.previous_plan_renews_on ?? null,
    suspended: Boolean(payment.previous_suspended),
  };
}

export function resolveAppliedExtras(input: {
  kind: PlatformPaymentKind;
  applyPlan: boolean;
  currentExtras: number;
  requestedExtras: number;
  targetPlan: string;
}): number {
  const current = Math.max(0, input.currentExtras);
  if (!input.applyPlan) return current;
  if (input.kind === "extra_accounts") {
    const add = input.requestedExtras > 0 ? input.requestedExtras : 1;
    return current + add;
  }
  if (input.targetPlan === "pro") return current;
  return 0;
}

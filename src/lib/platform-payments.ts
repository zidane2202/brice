import { PLAN_PRICES_FCFA } from "@/lib/plans";

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

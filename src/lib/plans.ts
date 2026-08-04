import { addMonths } from "@/lib/dates";

export type PlanId = "free" | "pro" | "business";

export const PLAN_PRICES_FCFA = {
  free: 0,
  pro: 10_000,
  business: 22_500,
  extraAccount: 2_000,
  extraPack3: 5_000,
} as const;

export const PLAN_LIMITS = {
  free: {
    maxAccounts: 2,
    clientsPerAccount: 3,
    branding: false,
    fullCompta: false,
    push: false,
  },
  pro: {
    maxAccounts: 15,
    clientsPerAccount: 5,
    branding: true,
    fullCompta: true,
    push: true,
  },
  business: {
    maxAccounts: 500,
    clientsPerAccount: 50,
    branding: true,
    fullCompta: true,
    push: true,
  },
} as const;

export function normalizePlan(plan: string | null | undefined): PlanId {
  if (plan === "pro" || plan === "business") return plan;
  return "free";
}

export function accountCap(plan: PlanId, extraProviderAccounts = 0): number {
  const base = PLAN_LIMITS[plan].maxAccounts;
  if (plan === "pro") return base + Math.max(0, extraProviderAccounts);
  return base;
}

export function clientsPerAccount(plan: PlanId): number {
  return PLAN_LIMITS[plan].clientsPerAccount;
}

export function canUseBranding(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].branding;
}

export function canUseFullCompta(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].fullCompta;
}

export function canUsePush(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].push;
}

/** Estimated SaaS MRR for one reseller (extras billed at unit rate). */
export function estimateMrrFcfa(
  plan: string | null | undefined,
  extraProviderAccounts = 0,
  suspended = false
): number {
  if (suspended) return 0;
  const id = normalizePlan(plan);
  if (id === "free") return 0;
  if (id === "business") return PLAN_PRICES_FCFA.business;
  return PLAN_PRICES_FCFA.pro + Math.max(0, extraProviderAccounts) * PLAN_PRICES_FCFA.extraAccount;
}

/** Next SaaS renewal: +months from max(anchor, current renewal). */
export function extendPlanRenewal(
  currentRenewsOn: string | null | undefined,
  anchorDate: string,
  months = 1
): string {
  const base =
    currentRenewsOn && currentRenewsOn > anchorDate ? currentRenewsOn : anchorDate;
  return addMonths(base, months);
}

/** Prefixed errors so UI can open upgrade modal */
export const PLAN_LIMIT_ACCOUNT = "PLAN_LIMIT_ACCOUNT";
export const PLAN_LIMIT_SLOTS = "PLAN_LIMIT_SLOTS";
export const PLAN_LIMIT_BRANDING = "PLAN_LIMIT_BRANDING";
export const PLAN_LIMIT_COMPTA = "PLAN_LIMIT_COMPTA";

export function planLimitError(code: string, message: string): Error {
  return new Error(`${code}:${message}`);
}

export function parsePlanLimitError(
  message: string
): { code: string; message: string } | null {
  const codes = [
    PLAN_LIMIT_ACCOUNT,
    PLAN_LIMIT_SLOTS,
    PLAN_LIMIT_BRANDING,
    PLAN_LIMIT_COMPTA,
  ];
  for (const code of codes) {
    if (message.startsWith(`${code}:`)) {
      return { code, message: message.slice(code.length + 1) };
    }
  }
  return null;
}

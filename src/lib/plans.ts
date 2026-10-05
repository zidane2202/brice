import { addDays, todayDateOnly } from "./dates.ts";

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

type PlanProfile = {
  plan?: string | null;
  role?: string | null;
  extra_provider_accounts?: number | null;
  plan_renews_on?: string | null;
  created_at?: string | null;
} | null | undefined;

export const ADMIN_UNLIMITED = 100_000;
export const TRIAL_DAYS = 7;

export function isAdminProfile(profile: PlanProfile) {
  return profile?.role === "admin";
}

/** Fin de l'essai gratuit (dernier jour inclus) : `plan_renews_on`, à défaut inscription + 7 jours. */
export function trialEndsOn(profile: PlanProfile): string | null {
  if (!profile || normalizePlan(profile.plan) !== "free") return null;
  if (profile.plan_renews_on) return profile.plan_renews_on;
  if (!profile.created_at) return null;
  return addDays(todayDateOnly(new Date(profile.created_at)), TRIAL_DAYS);
}

/** Free = essai : fonctionnalités Pro pendant 7 jours. */
export function isTrialActive(profile: PlanProfile, today = todayDateOnly()): boolean {
  const end = trialEndsOn(profile);
  return Boolean(end && end >= today);
}

/** Les admins ont tous les droits ; un essai en cours donne les droits Pro. */
export function effectivePlan(profile: PlanProfile, today = todayDateOnly()): PlanId {
  if (isAdminProfile(profile)) return "business";
  const plan = normalizePlan(profile?.plan);
  return plan === "free" && isTrialActive(profile, today) ? "pro" : plan;
}

export function accountCapFor(profile: PlanProfile, today = todayDateOnly()): number {
  if (isAdminProfile(profile)) return ADMIN_UNLIMITED;
  const plan = effectivePlan(profile, today);
  const extras = normalizePlan(profile?.plan) === "pro" ? Number(profile?.extra_provider_accounts ?? 0) : 0;
  return accountCap(plan, extras);
}

export function clientsPerAccountFor(profile: PlanProfile, today = todayDateOnly()): number {
  if (isAdminProfile(profile)) return ADMIN_UNLIMITED;
  return clientsPerAccount(effectivePlan(profile, today));
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

/** Coût mensuel des extras : packs de 3 d'abord, le reste à l'unité. */
export function extrasMonthlyFcfa(extraProviderAccounts: number): number {
  const count = Math.max(0, Math.floor(extraProviderAccounts || 0));
  return Math.floor(count / 3) * PLAN_PRICES_FCFA.extraPack3 + (count % 3) * PLAN_PRICES_FCFA.extraAccount;
}

/** Montant mensuel dû par le vendeur : pack + extras (Pro uniquement). */
export function monthlyDueFcfa(plan: string | null | undefined, extraProviderAccounts = 0): number {
  const id = normalizePlan(plan);
  if (id === "free") return 0;
  if (id === "business") return PLAN_PRICES_FCFA.business;
  return PLAN_PRICES_FCFA.pro + extrasMonthlyFcfa(extraProviderAccounts);
}

export function estimateMrrFcfa(
  plan: string | null | undefined,
  extraProviderAccounts = 0,
  suspended = false
): number {
  return suspended ? 0 : monthlyDueFcfa(plan, extraProviderAccounts);
}

/** Next SaaS renewal: +30-day periods from max(anchor, current renewal). */
export function extendPlanRenewal(
  currentRenewsOn: string | null | undefined,
  anchorDate: string,
  periods = 1
): string {
  const base =
    currentRenewsOn && currentRenewsOn > anchorDate ? currentRenewsOn : anchorDate;
  return addDays(base, periods * 30);
}

/** A new paid pack always starts for exactly 30 days from activation. */
export function activatePlanFor30Days(activationDate: string): string {
  return addDays(activationDate, 30);
}

/** Pack échu ou essai terminé : le vendeur passe en lecture seule jusqu'au passage à Pro ou Business. */
export function isPlanExpired(profile: PlanProfile, today: string): boolean {
  if (!profile || isAdminProfile(profile)) return false;
  if (normalizePlan(profile.plan) === "free") {
    const end = trialEndsOn(profile);
    return Boolean(end && end < today);
  }
  return Boolean(profile.plan_renews_on && profile.plan_renews_on < today);
}

export const PLAN_EXPIRED = "PLAN_EXPIRED";
export const PLAN_EXPIRED_PARAM = "pack";
export const PLAN_EXPIRED_VALUE = "expire";

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

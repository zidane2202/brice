import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { todayDateOnly } from "@/lib/dates";
import { isPlanExpired, PLAN_EXPIRED_PARAM, PLAN_EXPIRED_VALUE } from "@/lib/plans";
import { getUser, getUserProfile } from "@/lib/supabase-server";

export async function requireUser() {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");
  return user;
}

/** Vendeur non suspendu ; un pack expiré garde l'accès en lecture seule. */
export async function requireSeller() {
  const user = await requireUser();
  const profile = await getUserProfile();
  if (profile?.suspended && profile.role !== "admin") {
    throw new Error("Compte suspendu");
  }
  return { user, profile, planExpired: isPlanExpired(profile, todayDateOnly()) };
}

async function planExpiredRedirectTarget() {
  const referer = (await headers()).get("referer");
  let url: URL;
  try {
    url = new URL(referer ?? "/dashboard", "http://local");
  } catch {
    url = new URL("/dashboard", "http://local");
  }
  url.searchParams.set(PLAN_EXPIRED_PARAM, PLAN_EXPIRED_VALUE);
  return `${url.pathname}${url.search}`;
}

/** Vendeur autorisé à modifier ses données : un pack expiré renvoie vers le pop-up de renouvellement. */
export async function requireActiveSeller() {
  const { user, profile, planExpired } = await requireSeller();
  if (planExpired) redirect(await planExpiredRedirectTarget());
  return { user, profile };
}

export async function requireAdmin() {
  const user = await requireUser();
  const profile = await getUserProfile();
  if (profile?.role !== "admin") throw new Error("Accès refusé");
  return { user, profile };
}

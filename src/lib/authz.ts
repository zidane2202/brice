import { getUser, getUserProfile } from "@/lib/supabase-server";

export async function requireUser() {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");
  return user;
}

export async function requireActiveSeller() {
  const user = await requireUser();
  const profile = await getUserProfile();
  if (profile?.suspended) {
    throw new Error("Compte suspendu");
  }
  return { user, profile };
}

export async function requireAdmin() {
  const user = await requireUser();
  const profile = await getUserProfile();
  if (profile?.role !== "admin") throw new Error("Accès refusé");
  if (profile.suspended) throw new Error("Compte suspendu");
  return { user, profile };
}

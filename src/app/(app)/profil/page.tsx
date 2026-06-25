import { ProfilView } from "@/components/profil/ProfilView";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function getStats(userId: string) {
  const supabase = createSupabaseAdmin();
  const [clientsRes, accountsRes, subsRes] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("provider_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase.from("client_subscriptions").select("price, status").eq("user_id", userId),
  ]);

  const lifetimeRevenue = (subsRes.data ?? []).reduce((s, sub) => s + (sub.price ?? 0), 0);
  const total = subsRes.data?.length ?? 0;
  const cancelled = (subsRes.data ?? []).filter((s) => s.status === "cancelled").length;
  const paymentRate = total > 0 ? Math.round(((total - cancelled) / total) * 100) : 100;

  return {
    clientsCount: clientsRes.count ?? 0,
    activeAccounts: accountsRes.count ?? 0,
    lifetimeRevenue,
    paymentRate,
  };
}

export default async function ProfilPage() {
  const user = await getUser();
  if (!user) return null;

  const supabase = createSupabaseAdmin();
  const [{ data: profile }, stats] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    getStats(user.id),
  ]);

  return (
    <ProfilView
      profile={profile}
      email={user.email ?? ""}
      createdAt={user.created_at}
      stats={stats}
    />
  );
}

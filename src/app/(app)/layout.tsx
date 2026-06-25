import { PushManager } from "@/components/PushManager";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser, getUserProfile } from "@/lib/supabase-server";

async function getSidebarStats(userId: string) {
  const supabase = createSupabaseAdmin();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];

  const [subsRes, accountsRes, clientsRes] = await Promise.all([
    supabase
      .from("client_subscriptions")
      .select("price, start_date")
      .eq("user_id", userId)
      .gte("start_date", firstOfPrevMonth),
    supabase
      .from("provider_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const subs = subsRes.data ?? [];
  const monthlyRevenue = subs
    .filter((s) => s.start_date >= firstOfMonth)
    .reduce((sum, s) => sum + (s.price ?? 0), 0);
  const prevRevenue = subs
    .filter((s) => s.start_date >= firstOfPrevMonth && s.start_date < firstOfMonth)
    .reduce((sum, s) => sum + (s.price ?? 0), 0);

  const delta = prevRevenue > 0 ? Math.round(((monthlyRevenue - prevRevenue) / prevRevenue) * 100) : null;

  return {
    monthlyRevenue,
    delta,
    accountsCount: accountsRes.count ?? 0,
    clientsCount: clientsRes.count ?? 0,
  };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, user] = await Promise.all([getUserProfile(), getUser()]);
  const isAdmin = profile?.role === "admin";
  const userMeta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const userName = userMeta?.full_name ?? userMeta?.name ?? null;
  const profileName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
  const displayName = profileName || userName || null;

  const stats = user ? await getSidebarStats(user.id) : null;

  return (
    <div className="app-shell">
      <Sidebar
        isAdmin={isAdmin}
        userName={displayName}
        userEmail={user?.email ?? null}
        monthlyRevenue={stats?.monthlyRevenue ?? null}
        revenueDelta={stats?.delta ?? null}
        accountsCount={stats?.accountsCount ?? 0}
        clientsCount={stats?.clientsCount ?? 0}
      />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: "100vh" }}>
        <TopBar />
        <main className="app-main">{children}</main>
      </div>
      <PushManager />
    </div>
  );
}

import { PushManager } from "@/components/PushManager";
import { Sidebar } from "@/components/Sidebar";
import { SupportChat } from "@/components/SupportChat";
import { SuspendedGate } from "@/components/SuspendedGate";
import { TopBar } from "@/components/TopBar";
import { canUsePush, normalizePlan } from "@/lib/plans";
import { addDays, firstOfMonthDateOnly, todayDateOnly } from "@/lib/dates";
import { sumSellerPeriod } from "@/lib/ledger-sql";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser, getUserProfile } from "@/lib/supabase-server";

async function getSidebarStats(userId: string) {
  const supabase = createSupabaseAdmin();
  const today = todayDateOnly();
  const firstOfMonth = firstOfMonthDateOnly();
  const firstOfPrevMonth = firstOfMonthDateOnly(new Date(), 1);
  const prevTo = addDays(firstOfMonth, -1);

  const [monthKpis, prevKpis, accountsRes, clientsRes] = await Promise.all([
    sumSellerPeriod(supabase, userId, firstOfMonth, today),
    sumSellerPeriod(supabase, userId, firstOfPrevMonth, prevTo),
    supabase
      .from("provider_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const monthlyRevenue = monthKpis.income;
  const prevRevenue = prevKpis.income;
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

  if (profile?.suspended && profile.role !== "admin") {
    return <SuspendedGate />;
  }

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
        companyName={profile?.company_name ?? null}
        logoUrl={profile?.logo_url ?? null}
      />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: "100vh" }}>
        <TopBar />
        <main id="app-content" className="app-main">{children}</main>
      </div>
      <PushManager enabled={canUsePush(normalizePlan(profile?.plan))} />
      <SupportChat />
    </div>
  );
}

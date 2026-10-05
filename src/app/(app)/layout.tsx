import { Suspense } from "react";
import { PlanExpiredGuard } from "@/components/PlanExpiredGuard";
import { PushManager } from "@/components/PushManager";
import { Sidebar } from "@/components/Sidebar";
import { SupportChat } from "@/components/SupportChat";
import { SuspendedGate } from "@/components/SuspendedGate";
import { TopBar } from "@/components/TopBar";
import { canUsePush, effectivePlan, isPlanExpired, isTrialActive, normalizePlan, trialEndsOn } from "@/lib/plans";
import { TrialBanner } from "@/components/TrialBanner";
import { addDays, firstOfMonthDateOnly, todayDateOnly } from "@/lib/dates";
import { sumSellerPeriod } from "@/lib/ledger-sql";
import { occupiesSlot } from "@/lib/slots";
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
      .eq("status", "active")
      .gte("end_date", today),
    supabase
      .from("client_subscriptions")
      .select("client_id, status, end_date, grace_until, client:clients!inner(archived_at)")
      .eq("user_id", userId)
      .in("status", ["active", "grace"])
      .is("client.archived_at", null),
  ]);
  const activeClients = new Set(
    (clientsRes.data ?? []).filter((sub) => occupiesSlot(sub, today)).map((sub) => sub.client_id)
  );

  const monthlyRevenue = monthKpis.income;
  const prevRevenue = prevKpis.income;
  const delta = prevRevenue > 0 ? Math.round(((monthlyRevenue - prevRevenue) / prevRevenue) * 100) : null;

  return {
    monthlyRevenue,
    delta,
    accountsCount: accountsRes.count ?? 0,
    clientsCount: activeClients.size,
  };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, user] = await Promise.all([getUserProfile(), getUser()]);
  const isAdmin = profile?.role === "admin";
  const userMeta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const userName = userMeta?.full_name ?? userMeta?.name ?? null;
  const profileName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
  const displayName = profileName || userName || null;

  if (profile?.suspended && !isAdmin) {
    return <SuspendedGate />;
  }

  const stats = user ? await getSidebarStats(user.id) : null;
  const today = todayDateOnly();
  const planExpired = isPlanExpired(profile, today);
  const trialEnd = trialEndsOn(profile);
  const expiredOn = trialEnd ?? profile?.plan_renews_on ?? null;

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
        <main id="app-content" className="app-main">
          {planExpired && expiredOn && (
            <Suspense fallback={null}>
              <PlanExpiredGuard plan={normalizePlan(profile?.plan)} renewsOn={expiredOn} />
            </Suspense>
          )}
          {trialEnd && isTrialActive(profile, today) && <TrialBanner endsOn={trialEnd} />}
          {children}
        </main>
      </div>
      <PushManager enabled={canUsePush(effectivePlan(profile, today)) && !planExpired} />
      <SupportChat />
    </div>
  );
}

import { AbonnementsView } from "@/components/abonnements/AbonnementsView";
import { todayDateOnly } from "@/lib/dates";
import { sumSellerBalance } from "@/lib/ledger-sql";
import { clientsPerAccountFor, effectivePlan } from "@/lib/plans";
import { accountOffersSlots, countOccupiedSlots, currentSlotSubscription, paidBeyondAccount } from "@/lib/slots";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { ProviderAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getAccounts(userId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("provider_accounts")
    .select(`id, service_name, label, max_slots, start_date, end_date, duration_months, cost, status, created_at,
      account_slots(id, client_subscriptions(id, status, end_date, grace_until))`)
    .eq("user_id", userId)
    .order("end_date", { ascending: true });

  if (error) throw new Error(error.message);
  const today = todayDateOnly();
  return (data ?? []).map((a) => {
    const slots =
      (a as {
        account_slots?: { id: string; client_subscriptions?: { id: string; status: string; end_date: string; grace_until: string | null }[] }[];
      }).account_slots ?? [];
    const live = accountOffersSlots(a, today);
    return {
      ...a,
      used_slots: countOccupiedSlots(slots, today),
      beyond_slots: live
        ? slots.filter((slot) => {
            const current = currentSlotSubscription(slot.client_subscriptions, today);
            return current !== null && paidBeyondAccount(current, a, today);
          }).length
        : 0,
    } as unknown as ProviderAccount & { used_slots: number; beyond_slots: number };
  });
}

async function getBalance(userId: string) {
  return sumSellerBalance(createSupabaseAdmin(), userId);
}

export default async function AbonnementsPage() {
  const user = await getUser();
  if (!user) return null;

  const supabase = createSupabaseAdmin();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("plan, role, extra_provider_accounts, plan_renews_on, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const plan = effectivePlan(profile);
  const slotCap = clientsPerAccountFor(profile);

  const [accounts, balance] = await Promise.all([getAccounts(user.id), getBalance(user.id)]);

  // Stable numbering by created_at
  const serviceCount: Record<string, number> = {};
  for (const a of accounts) {
    serviceCount[a.service_name] = (serviceCount[a.service_name] ?? 0) + 1;
  }
  const serviceIndex: Record<string, number> = {};
  const displayNames: Record<string, string> = {};
  for (const a of [...accounts].sort(
    (x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime()
  )) {
    if (serviceCount[a.service_name] > 1) {
      serviceIndex[a.service_name] = (serviceIndex[a.service_name] ?? 0) + 1;
      displayNames[a.id] = `${a.service_name} (${serviceIndex[a.service_name]})`;
    } else {
      displayNames[a.id] = a.service_name;
    }
  }

  return (
    <AbonnementsView
      accounts={accounts}
      displayNames={displayNames}
      balance={balance}
      plan={plan}
      slotCap={slotCap}
    />
  );
}

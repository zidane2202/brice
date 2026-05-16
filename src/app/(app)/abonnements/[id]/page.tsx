import { SlotTable } from "@/components/SlotTable";
import { formatDate, daysUntil } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { AccountSlot, ProviderAccount } from "@/lib/types";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getAccount(id: string, userId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("provider_accounts")
    .select(`
      *,
      account_slots (
        id, slot_number, label,
        active_subscription:client_subscriptions (
          *,
          client:clients (id, first_name, last_name, phone, email)
        )
      )
    `)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  const slots = (data.account_slots ?? []).map((slot: any) => ({
    ...slot,
    active_subscription: Array.isArray(slot.active_subscription)
      ? slot.active_subscription.find((s: any) => s.status === "active" || s.status === "grace") ?? null
      : slot.active_subscription,
  }));

  return { ...data, account_slots: slots } as ProviderAccount & { account_slots: AccountSlot[] };
}

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return null;

  const account = await getAccount(id, user.id);
  if (!account) notFound();

  const daysLeft = daysUntil(account.end_date);
  const usedSlots = account.account_slots?.filter((s) => s.active_subscription) ?? [];

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href="/abonnements">← Mes abonnements</Link></p>
          <h1>{account.service_name}</h1>
          <p style={{ color: "var(--muted)", marginTop: 6 }}>
            {usedSlots.length}/{account.max_slots} profils occupés · Expire le {formatDate(account.end_date)}
            {daysLeft >= 0 ? ` (J-${daysLeft})` : " (expiré)"}
          </p>
        </div>
      </div>

      <div className="panel">
        <h2>Profils</h2>
        <SlotTable slots={account.account_slots ?? []} />
      </div>
    </>
  );
}

import { ClientsView } from "@/components/clients/ClientsView";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { AccountSlot, ClientSubscription, Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getData(userId: string) {
  const supabase = createSupabaseAdmin();

  const [subsResult, slotsResult, invoicesResult] = await Promise.all([
    supabase
      .from("client_subscriptions")
      .select(`
        *,
        client:clients(*),
        slot:account_slots(
          id, slot_number, label,
          account:provider_accounts(id, service_name)
        )
      `)
      .eq("user_id", userId)
      .order("end_date", { ascending: true }),
    supabase
      .from("account_slots")
      .select(`
        id, slot_number, label,
        account:provider_accounts!inner(id, service_name, status, user_id)
      `)
      .eq("provider_accounts.user_id", userId)
      .eq("provider_accounts.status", "active"),
    supabase
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .order("number", { ascending: false }),
  ]);

  if (subsResult.error) throw new Error(subsResult.error.message);
  if (slotsResult.error) throw new Error(slotsResult.error.message);

  const today = new Date().toISOString().slice(0, 10);
  const occupiedSlotIds = new Set(
    (subsResult.data ?? [])
      .filter((s) => s.status === "active" && s.end_date >= today)
      .map((s) => s.slot_id)
  );

  const freeSlots = (slotsResult.data ?? []).filter(
    (slot) => !occupiedSlotIds.has(slot.id)
  );

  return {
    subscriptions: (subsResult.data ?? []) as unknown as ClientSubscription[],
    freeSlots: freeSlots as unknown as (AccountSlot & { account: { id: string; service_name: string } })[],
    invoices: (invoicesResult.data ?? []) as unknown as Invoice[],
  };
}

export default async function ClientsPage() {
  const user = await getUser();
  if (!user) return null;

  const { subscriptions, freeSlots, invoices } = await getData(user.id);

  return <ClientsView subscriptions={subscriptions} freeSlots={freeSlots} invoices={invoices} />;
}

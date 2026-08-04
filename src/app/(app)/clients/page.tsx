import { ClientsView } from "@/components/clients/ClientsView";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { AccountSlot, ClientSubscription, Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getData(userId: string) {
  const supabase = createSupabaseAdmin();

  const [subsResult, slotsResult, invoicesResult, eventsResult] = await Promise.all([
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
    supabase.from("client_events").select("id,client_id,subscription_id,type,title,details,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1000),
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
    subscriptions: ((subsResult.data ?? []) as unknown as ClientSubscription[]).filter((subscription) => !subscription.client?.archived_at),
    freeSlots: freeSlots as unknown as (AccountSlot & { account: { id: string; service_name: string } })[],
    invoices: (invoicesResult.data ?? []) as unknown as Invoice[],
    events: eventsResult.data ?? [],
  };
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ client?: string; filter?: string }> }) {
  const user = await getUser();
  if (!user) return null;
  const { client, filter } = await searchParams;

  const { subscriptions, freeSlots, invoices, events } = await getData(user.id);

  const initialFilter = ["active", "warning", "danger", "grace"].includes(filter ?? "") ? filter as "active" | "warning" | "danger" | "grace" : undefined;
  return <ClientsView subscriptions={subscriptions} freeSlots={freeSlots} invoices={invoices} events={events} initialClientId={client ?? null} initialFilter={initialFilter} />;
}

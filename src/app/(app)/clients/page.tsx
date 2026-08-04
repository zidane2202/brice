import { ClientsView } from "@/components/clients/ClientsView";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { AccountSlot, ClientSubscription, Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
async function getData(userId: string, page: number, filter: string, search: string, sort: string) {
  const supabase = createSupabaseAdmin();

  const today = new Date().toISOString().slice(0, 10); const soon = new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  let subsQuery = supabase
      .from("client_subscriptions")
      .select(`
        *,
        client:clients!inner(*),
        slot:account_slots(
          id, slot_number, label,
          account:provider_accounts(id, service_name)
        )
      `, { count: "exact" })
      .eq("user_id", userId).is("client.archived_at",null);
  if(filter==="grace")subsQuery=subsQuery.eq("status","grace");else if(filter==="warning")subsQuery=subsQuery.eq("status","active").gte("end_date",today).lte("end_date",soon);else if(filter==="danger")subsQuery=subsQuery.or(`status.eq.cancelled,and(status.neq.grace,end_date.lt.${today})`);else subsQuery=subsQuery.eq("status","active").gt("end_date",soon);
  if(search) subsQuery=subsQuery.or(`first_name.ilike.%${search.replaceAll(",","")}%,last_name.ilike.%${search.replaceAll(",","")}%,email.ilike.%${search.replaceAll(",","")}%,phone.ilike.%${search.replaceAll(",","")}%`,{referencedTable:"clients"});
  subsQuery=subsQuery.order(sort==="echeance"?"end_date":"created_at",{ascending:sort==="echeance"}).range((page-1)*PAGE_SIZE,page*PAGE_SIZE-1);
  const [subsResult, slotsResult, summaryResult] = await Promise.all([
    subsQuery,
    supabase
      .from("account_slots")
      .select(`
        id, slot_number, label,
        account:provider_accounts!inner(id, service_name, status, user_id)
      `)
      .eq("provider_accounts.user_id", userId)
      .eq("provider_accounts.status", "active"),
    supabase.rpc("client_list_summary",{p_user:userId}),
  ]);

  if (subsResult.error) throw new Error(subsResult.error.message);
  if (slotsResult.error) throw new Error(slotsResult.error.message);

  const occupiedSlotIds = new Set(
    (subsResult.data ?? [])
      .filter((s) => s.status === "active" && s.end_date >= today)
      .map((s) => s.slot_id)
  );

  const freeSlots = (slotsResult.data ?? []).filter(
    (slot) => !occupiedSlotIds.has(slot.id)
  );

  return {
    subscriptions: ((subsResult.data ?? []) as unknown as ClientSubscription[]),
    freeSlots: freeSlots as unknown as (AccountSlot & { account: { id: string; service_name: string } })[],
    summary: summaryResult.data as {active:number;warning:number;danger:number;grace:number;visible:number;totalRevenue:number;clients:number;acquired:number;topClient:{name:string;total:number}|null},
    totalRows: subsResult.count ?? 0,
  };
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ client?: string; filter?: string; page?:string; q?:string; sort?:string; new?:string }> }) {
  const user = await getUser();
  if (!user) return null;
  const { client, filter, page:pageRaw, q="", sort="recent", new:newClient } = await searchParams; const page=Math.max(1,Number(pageRaw)||1);

  const initialFilter = ["active", "warning", "danger", "grace"].includes(filter ?? "") ? filter as "active" | "warning" | "danger" | "grace" : undefined;
  const { subscriptions, freeSlots, summary, totalRows } = await getData(user.id,page,initialFilter??"active",q,sort);
  const clientIds=Array.from(new Set(subscriptions.map(item=>item.client_id))); const subIds=subscriptions.map(item=>item.id); const supabase=createSupabaseAdmin();
  const [{data:invoices},{data:events}]=await Promise.all([clientIds.length?supabase.from("invoices").select("*").eq("user_id",user.id).in("client_id",clientIds).order("number",{ascending:false}):Promise.resolve({data:[]}),subIds.length?supabase.from("client_events").select("id,client_id,subscription_id,type,title,details,created_at").eq("user_id",user.id).in("client_id",clientIds).order("created_at",{ascending:false}):Promise.resolve({data:[]})]);
  return <ClientsView subscriptions={subscriptions} freeSlots={freeSlots} invoices={(invoices??[]) as unknown as Invoice[]} events={events??[]} initialClientId={client??null} initialFilter={initialFilter} initialQuery={q} initialSort={sort as "recent"|"echeance"|"ltv"} summary={summary} serverPage={page} totalRows={totalRows} pageSize={PAGE_SIZE} initialNewClient={newClient==="1"}/>;
}

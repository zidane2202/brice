import { ClientsView } from "@/components/clients/ClientsView";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { todayDateOnly } from "@/lib/dates";
import { accountOffersSlots, occupiesSlot, withAccountRule } from "@/lib/slots";
import { getUser } from "@/lib/supabase-server";
import type { AccountSlot, ClientSubscription, Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
async function getData(userId: string, page: number, filter: string, search: string, sort: string) {
  const supabase = createSupabaseAdmin();

  const today = todayDateOnly();
  const soon = todayDateOnly(new Date(Date.now() + 3 * 86400000));
  const searchSafe = search.replace(/[%_,().]/g, " ").replaceAll(",", " ").trim();
  const { data: ownAccounts } = await supabase
    .from("provider_accounts")
    .select("status, end_date, account_slots(id)")
    .eq("user_id", userId);
  const deadSlotIds = (ownAccounts ?? [])
    .filter((account) => !accountOffersSlots(account, today))
    .flatMap((account) => (account.account_slots ?? []).map((slot) => slot.id));
  const deadList = deadSlotIds.join(",");
  let subsQuery = supabase
      .from("client_subscriptions")
      .select(`
        *,
        client:clients!inner(*),
        slot:account_slots(
          id, slot_number, label,
          account:provider_accounts(id, service_name, status, end_date)
        )
      `, { count: "exact" })
      .eq("user_id", userId).is("client.archived_at",null);
  if(filter==="danger")subsQuery=subsQuery.or(`status.eq.cancelled,and(status.neq.grace,end_date.lt.${today}),and(status.eq.grace,grace_until.lt.${today})${deadList?`,slot_id.in.(${deadList})`:""}`);
  else{
    if(filter==="grace")subsQuery=subsQuery.eq("status","grace").or(`grace_until.is.null,grace_until.gte.${today}`);else if(filter==="warning")subsQuery=subsQuery.eq("status","active").gte("end_date",today).lte("end_date",soon);else subsQuery=subsQuery.eq("status","active").gt("end_date",soon);
    if(deadList)subsQuery=subsQuery.not("slot_id","in",`(${deadList})`);
  }
  if(searchSafe) subsQuery=subsQuery.or(`first_name.ilike.%${searchSafe}%,last_name.ilike.%${searchSafe}%,email.ilike.%${searchSafe}%,phone.ilike.%${searchSafe}%`,{referencedTable:"clients"});
  subsQuery=subsQuery.order(sort==="echeance"?"end_date":"created_at",{ascending:sort==="echeance"}).range((page-1)*PAGE_SIZE,page*PAGE_SIZE-1);
  const [subsResult, slotsResult, summaryResult, occResult] = await Promise.all([
    subsQuery,
    supabase
      .from("account_slots")
      .select(`
        id, slot_number, label,
        account:provider_accounts!inner(id, service_name, label, status, end_date, user_id)
      `)
      .eq("provider_accounts.user_id", userId)
      .eq("provider_accounts.status", "active")
      .gte("provider_accounts.end_date", today),
    supabase.rpc("client_list_summary",{p_user:userId}),
    supabase
      .from("client_subscriptions")
      .select("slot_id, status, end_date, grace_until")
      .eq("user_id", userId)
      .in("status", ["active", "grace"]),
  ]);

  if (subsResult.error) throw new Error(subsResult.error.message);
  if (slotsResult.error) throw new Error(slotsResult.error.message);

  const occupiedSlotIds = new Set((occResult.data ?? []).filter((s) => occupiesSlot(s, today)).map((s) => s.slot_id));

  const freeSlots = (slotsResult.data ?? []).filter(
    (slot) => !occupiedSlotIds.has(slot.id)
  );

  return {
    subscriptions: ((subsResult.data ?? []) as unknown as ClientSubscription[]).map((sub) => withAccountRule(sub, today)),
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

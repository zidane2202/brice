import { RemindersView, type ReminderRow } from "@/components/relances/RemindersView";
import { todayDateOnly } from "@/lib/dates";
import { daysLeft, reminderCategory, type ReminderTemplate } from "@/lib/reminder-templates";
import { occupiesSlot, withAccountRule } from "@/lib/slots";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type SubRow = {
  id: string;
  client_id: string;
  end_date: string;
  price: number | null;
  status: string;
  grace_until: string | null;
  client: { first_name: string; last_name: string | null; phone: string | null; archived_at: string | null } | null;
  slot: { account?: { service_name?: string; status?: string; end_date?: string } | null } | null;
};

export default async function RemindersPage() {
  const user = await getUser();
  if (!user) return null;
  const db = createSupabaseAdmin();
  const today = todayDateOnly();

  const [{ data: subsData }, { data: invoices }, templatesResult, { data: tracked }, { data: profile }] = await Promise.all([
    db
      .from("client_subscriptions")
      .select("id,client_id,end_date,price,status,grace_until,client:clients(first_name,last_name,phone,archived_at),slot:account_slots(account:provider_accounts(service_name,status,end_date))")
      .eq("user_id", user.id)
      .neq("status", "cancelled")
      .order("end_date", { ascending: false })
      .limit(2000),
    db
      .from("invoices")
      .select("id,subscription_id,client_id,amount,amount_paid,service_name")
      .eq("user_id", user.id)
      .in("status", ["unpaid", "partially_paid"]),
    db.from("reminder_templates").select("id,category,name,body").eq("user_id", user.id).order("created_at"),
    db.from("client_reminders").select("subscription_id,status,sent_at").eq("user_id", user.id),
    db.from("user_profiles").select("first_name,last_name,company_name").eq("user_id", user.id).maybeSingle(),
  ]);

  const subs = ((subsData ?? []) as unknown as SubRow[])
    .filter((sub) => sub.client && !sub.client.archived_at)
    .map((sub) => withAccountRule(sub, today));
  const trackedMap = new Map((tracked ?? []).map((row) => [row.subscription_id as string, row as { status: string; sent_at: string | null }]));
  const currentClients = new Set(subs.filter((sub) => occupiesSlot(sub, today)).map((sub) => sub.client_id));
  const subById = new Map(subs.map((sub) => [sub.id, sub]));

  const rows: ReminderRow[] = [];
  const seenLapsedClients = new Set<string>();
  for (const sub of subs) {
    const category = reminderCategory(sub, today);
    if (!category) continue;
    if (category === "expired" || category === "lapsed") {
      if (currentClients.has(sub.client_id) || seenLapsedClients.has(sub.client_id)) continue;
      seenLapsedClients.add(sub.client_id);
    }
    const reminder = trackedMap.get(sub.id);
    rows.push({
      key: `${category}:${sub.id}`,
      category,
      subscriptionId: sub.id,
      clientId: sub.client_id,
      firstName: sub.client!.first_name,
      lastName: sub.client!.last_name,
      phone: sub.client!.phone,
      service: sub.slot?.account?.service_name ?? "votre abonnement",
      endDate: sub.status === "grace" && sub.grace_until ? sub.grace_until : sub.end_date,
      days: daysLeft(sub.end_date, today),
      price: Number(sub.price ?? 0),
      balance: 0,
      reminderStatus: reminder?.status ?? null,
      sentAt: reminder?.sent_at ?? null,
    });
  }

  for (const invoice of invoices ?? []) {
    const sub = invoice.subscription_id ? subById.get(invoice.subscription_id as string) : undefined;
    const balance = Number(invoice.amount ?? 0) - Number(invoice.amount_paid ?? 0);
    if (!sub || balance <= 0) continue;
    const reminder = trackedMap.get(sub.id);
    rows.push({
      key: `balance:${invoice.id}`,
      category: "balance",
      subscriptionId: sub.id,
      clientId: sub.client_id,
      firstName: sub.client!.first_name,
      lastName: sub.client!.last_name,
      phone: sub.client!.phone,
      service: (invoice.service_name as string | null) ?? sub.slot?.account?.service_name ?? "votre abonnement",
      endDate: sub.end_date,
      days: daysLeft(sub.end_date, today),
      price: Number(invoice.amount ?? 0),
      balance,
      reminderStatus: reminder?.status ?? null,
      sentAt: reminder?.sent_at ?? null,
    });
  }

  rows.sort((a, b) => (a.category === "lapsed" || a.category === "expired" ? b.days - a.days : a.days - b.days));

  const sellerName =
    profile?.company_name?.trim() || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();

  return (
    <RemindersView
      rows={rows}
      customTemplates={(templatesResult.data ?? []) as ReminderTemplate[]}
      templatesUnavailable={Boolean(templatesResult.error)}
      sellerName={sellerName}
    />
  );
}

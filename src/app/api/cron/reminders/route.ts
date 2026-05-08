import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:admin@subresell.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function toDateStr(date: Date) {
  return date.toISOString().split("T")[0];
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const today = toDateStr(new Date());
  const in3Days = toDateStr(new Date(Date.now() + 3 * 86400000));

  const { data: urgentSubs, error } = await supabase
    .from("client_subscriptions")
    .select(`
      id, end_date, user_id,
      client:clients(first_name, last_name),
      slot:account_slots(label, slot_number, account:provider_accounts(service_name))
    `)
    .eq("status", "active")
    .gte("end_date", today)
    .lte("end_date", in3Days)
    .or(`last_notified_on.is.null,last_notified_on.lt.${today}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!urgentSubs || urgentSubs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const byUser = new Map<string, typeof urgentSubs>();
  for (const sub of urgentSubs) {
    const list = byUser.get(sub.user_id) ?? [];
    list.push(sub);
    byUser.set(sub.user_id, list);
  }

  let sent = 0;

  for (const [userId, subs] of byUser) {
    const { data: pushSubs } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", userId);

    if (!pushSubs || pushSubs.length === 0) continue;

    const names = subs.map((s) => {
      const client = s.client as { first_name: string; last_name: string } | null;
      const slot = s.slot as { account?: { service_name: string } } | null;
      return `${client?.first_name ?? ""} ${client?.last_name ?? ""} (${slot?.account?.service_name ?? ""})`.trim();
    });

    const payload = JSON.stringify({
      title: `⚠ ${subs.length} client(s) à relancer`,
      body: names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : ""),
      url: "/clients",
    });

    for (const { subscription } of pushSubs) {
      try {
        await webpush.sendNotification(subscription as Parameters<typeof webpush.sendNotification>[0], payload);
        sent++;
      } catch {}
    }

    await supabase
      .from("client_subscriptions")
      .update({ last_notified_on: today })
      .in("id", subs.map((s) => s.id));
  }

  return NextResponse.json({ sent });
}

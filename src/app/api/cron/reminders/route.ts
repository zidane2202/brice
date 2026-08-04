import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import webpush from "web-push";

function toDateStr(date: Date) {
  return date.toISOString().split("T")[0];
}

async function sendPush(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  payload: { title: string; body: string; url: string }
) {
  const { data: pushSubs } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_id", userId);

  if (!pushSubs?.length) return 0;

  let sent = 0;
  const body = JSON.stringify(payload);
  for (const { id, subscription } of pushSubs) {
    try {
      await webpush.sendNotification(
        subscription as Parameters<typeof webpush.sendNotification>[0],
        body
      );
      sent++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", id);
      }
    }
  }
  return sent;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const supabase = createSupabaseAdmin();
  const today = toDateStr(new Date());
  const in3Days = toDateStr(new Date(Date.now() + 3 * 86400000));

  let clientSent = 0;
  let planRemindSent = 0;
  let autoSuspended = 0;

  // --- Client subscription reminders (existing) ---
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

  if (urgentSubs && urgentSubs.length > 0) {
    const byUser = new Map<string, typeof urgentSubs>();
    for (const sub of urgentSubs) {
      const list = byUser.get(sub.user_id) ?? [];
      list.push(sub);
      byUser.set(sub.user_id, list);
    }

    for (const [userId, subs] of byUser) {
      const names = subs.map((s) => {
        const client = s.client as unknown as { first_name: string; last_name: string } | null;
        const slot = s.slot as unknown as { account?: { service_name: string } } | null;
        return `${client?.first_name ?? ""} ${client?.last_name ?? ""} (${slot?.account?.service_name ?? ""})`.trim();
      });

      clientSent += await sendPush(supabase, userId, {
        title: `⚠ ${subs.length} client(s) à relancer`,
        body: names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : ""),
        url: "/clients",
      });

      await supabase
        .from("client_subscriptions")
        .update({ last_notified_on: today })
        .in(
          "id",
          subs.map((s) => s.id)
        );
    }
  }

  // --- SaaS pack renewal reminders (3 days) ---
  const { data: renewing } = await supabase
    .from("user_profiles")
    .select("user_id, plan, plan_renews_on, plan_renewal_notified_on")
    .in("plan", ["pro", "business"])
    .eq("suspended", false)
    .gte("plan_renews_on", today)
    .lte("plan_renews_on", in3Days);

  for (const row of renewing ?? []) {
    if (row.plan_renewal_notified_on && row.plan_renewal_notified_on >= today) continue;
    const n = await sendPush(supabase, row.user_id, {
      title: "Pack SubResell bientôt à renouveler",
      body: `Votre plan ${row.plan} expire le ${row.plan_renews_on}. Contactez le support pour renouveler.`,
      url: "/profil",
    });
    planRemindSent += n;
    await supabase
      .from("user_profiles")
      .update({ plan_renewal_notified_on: today })
      .eq("user_id", row.user_id);
  }

  // --- Auto-suspend overdue paid packs ---
  const { data: overdue } = await supabase
    .from("user_profiles")
    .select("user_id, plan, plan_renews_on")
    .in("plan", ["pro", "business"])
    .eq("suspended", false)
    .not("plan_renews_on", "is", null)
    .lt("plan_renews_on", today);

  for (const row of overdue ?? []) {
    const { error: susErr } = await supabase
      .from("user_profiles")
      .update({ suspended: true })
      .eq("user_id", row.user_id);
    if (!susErr) {
      autoSuspended++;
      await sendPush(supabase, row.user_id, {
        title: "Compte SubResell suspendu",
        body: "Votre pack a expiré. Contactez le support pour réactiver.",
        url: "/profil",
      });
    }
  }

  return NextResponse.json({
    clientSent,
    planRemindSent,
    autoSuspended,
  });
}

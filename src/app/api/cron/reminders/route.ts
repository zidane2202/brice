import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { todayDateOnly } from "@/lib/dates";
import { notifyUser } from "@/lib/push";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const startedAt = new Date().toISOString();
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const today = todayDateOnly();
  const in3Days = todayDateOnly(new Date(Date.now() + 3 * 86400000));

  let clientSent = 0;
  let planRemindSent = 0;
  let autoSuspended = 0;
  const errors: string[] = [];

  try {
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

    if (error) {
      errors.push(`clients:${error.message}`);
    } else if (urgentSubs && urgentSubs.length > 0) {
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

        clientSent += await notifyUser(supabase, {
          userId,
          type: "client_reminder",
          title: `${subs.length} client(s) à relancer`,
          body: names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : ""),
          url: "/clients",
          dedupKey: `client-reminder-${today}`,
        });

        await supabase
          .from("client_subscriptions")
          .update({ last_notified_on: today })
          .in("id", subs.map((s) => s.id));
      }
    }
  } catch (err) {
    errors.push(`clients:${err instanceof Error ? err.message : "unknown"}`);
  }

  try {
    const { data: renewing } = await supabase
      .from("user_profiles")
      .select("user_id, plan, plan_renews_on, plan_renewal_notified_on")
      .in("plan", ["pro", "business"])
      .eq("suspended", false)
      .gte("plan_renews_on", today)
      .lte("plan_renews_on", in3Days);

    for (const row of renewing ?? []) {
      if (row.plan_renewal_notified_on && row.plan_renewal_notified_on >= today) continue;
      planRemindSent += await notifyUser(supabase, {
        userId: row.user_id,
        type: "plan_expiry",
        title: "Pack SubResell bientôt à renouveler",
        body: `Votre plan ${row.plan} expire le ${row.plan_renews_on}. Contactez le support pour renouveler.`,
        url: "/profil#section-plan",
        dedupKey: `plan-expiry-${row.plan_renews_on}`,
      });
      await supabase
        .from("user_profiles")
        .update({ plan_renewal_notified_on: today })
        .eq("user_id", row.user_id);
    }
  } catch (err) {
    errors.push(`plans:${err instanceof Error ? err.message : "unknown"}`);
  }

  try {
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
        await notifyUser(supabase, {
          userId: row.user_id,
          type: "account_suspended",
          title: "Compte SubResell suspendu",
          body: "Votre pack a expiré. Contactez le support pour le réactiver.",
          url: "/profil#section-plan",
          dedupKey: `suspended-${row.plan_renews_on}`,
        });
        await supabase.from("admin_audit_logs").insert({
          actor_user_id: row.user_id,
          target_user_id: row.user_id,
          action: "account_suspended",
          details: { source: "cron", plan: row.plan, plan_renews_on: row.plan_renews_on },
        });
      }
    }
  } catch (err) {
    errors.push(`suspend:${err instanceof Error ? err.message : "unknown"}`);
  }

  const result = { clientSent, planRemindSent, autoSuspended, errors };
  await supabase.from("system_job_runs").insert({
    job_name: "reminders",
    status: errors.length ? "failed" : "success",
    details: result,
    started_at: startedAt,
  });
  return NextResponse.json(result, { status: errors.length ? 207 : 200 });
}

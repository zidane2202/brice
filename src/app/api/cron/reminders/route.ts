import { NextResponse } from "next/server";
import webpush from "web-push";
import { daysUntil, formatDate } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

function assertCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys are missing.");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function buildReminder(subscription: Subscription) {
  const days = daysUntil(subscription.end_date);
  const isClient = subscription.kind === "client";
  const clientName = subscription.client
    ? `${subscription.client.first_name} ${subscription.client.last_name}`
    : null;
  const title = isClient ? "Relancer un client" : "Renouveler un service";
  const body = isClient
    ? `${clientName} arrive a la fin de ${subscription.service_name} le ${formatDate(subscription.end_date)}.`
    : `${subscription.service_name} arrive a expiration le ${formatDate(subscription.end_date)}.`;

  return {
    title,
    body: `${body} J-${Math.max(days, 0)}.`,
    url: "/",
  };
}

export async function GET(request: Request) {
  if (!assertCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  configureWebPush();

  const supabase = createSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const inThreeDays = new Date();
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  const endLimit = inThreeDays.toISOString().slice(0, 10);

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      kind,
      service_name,
      start_date,
      end_date,
      status,
      client_id,
      created_at,
      last_notified_on,
      client:clients (
        id,
        first_name,
        last_name,
        email,
        phone,
        created_at
      )
    `,
    )
    .eq("status", "active")
    .gte("end_date", today)
    .lte("end_date", endLimit)
    .or(`last_notified_on.is.null,last_notified_on.neq.${today}`);

  if (subscriptionsError) {
    return NextResponse.json(
      { error: subscriptionsError.message },
      { status: 500 },
    );
  }

  const { data: pushSubscriptions, error: pushError } = await supabase
    .from("push_subscriptions")
    .select("id, subscription");

  if (pushError) {
    return NextResponse.json({ error: pushError.message }, { status: 500 });
  }

  const payloads = ((subscriptions ?? []) as unknown as Subscription[]).map(
    buildReminder,
  );
  let sent = 0;

  for (const pushSubscription of pushSubscriptions ?? []) {
    for (const payload of payloads) {
      await webpush
        .sendNotification(
          pushSubscription.subscription,
          JSON.stringify(payload),
        )
        .then(() => {
          sent += 1;
        })
        .catch(async (error) => {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", pushSubscription.id);
          }
        });
    }
  }

  if (subscriptions?.length) {
    await supabase
      .from("subscriptions")
      .update({ last_notified_on: today })
      .in(
        "id",
        subscriptions.map((subscription) => subscription.id),
      );
  }

  return NextResponse.json({
    checked: subscriptions?.length ?? 0,
    sent,
  });
}

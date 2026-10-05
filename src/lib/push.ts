import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

let vapidConfigured = false;

function ensureVapid() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  if (!vapidConfigured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
  }
  return true;
}

export type PushPayload = { title: string; body: string; url: string };

export async function sendPush(supabase: SupabaseClient, userId: string, payload: PushPayload) {
  if (!ensureVapid()) {
    console.warn("[push] VAPID non configuré, push ignoré");
    return 0;
  }
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
      await supabase.from("push_delivery_logs").insert({ user_id: userId, status: "sent" });
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      const expired = status === 404 || status === 410;
      if (expired) await supabase.from("push_subscriptions").delete().eq("id", id);
      await supabase.from("push_delivery_logs").insert({
        user_id: userId,
        status: expired ? "expired" : "failed",
      });
    }
  }
  return sent;
}

export type UserNotification = PushPayload & {
  userId: string;
  type: string;
  dedupKey: string;
};

/** Crée la notification in-app et l'envoie en push sur tous les appareils abonnés. */
export async function notifyUser(supabase: SupabaseClient, n: UserNotification) {
  const { error } = await supabase.from("user_notifications").upsert(
    {
      user_id: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      url: n.url,
      dedup_key: n.dedupKey,
    },
    { onConflict: "user_id,dedup_key" }
  );
  if (error) console.error("[notify] in-app", error.message);
  return sendPush(supabase, n.userId, { title: n.title, body: n.body, url: n.url });
}

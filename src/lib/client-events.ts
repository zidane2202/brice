import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordClientEvent(db: SupabaseClient, input: { userId: string; clientId: string; subscriptionId?: string | null; type: string; title: string; details?: Record<string, unknown> }) {
  const { error } = await db.from("client_events").insert({ user_id: input.userId, client_id: input.clientId, subscription_id: input.subscriptionId ?? null, type: input.type, title: input.title, details: input.details ?? {} });
  if (error) console.error("[client-event]", error.message);
}

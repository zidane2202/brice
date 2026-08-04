"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";

export async function updateReminderStatus(formData: FormData) {
  const user = await getUser(); if (!user) throw new Error("Non authentifié");
  const subscriptionId = String(formData.get("subscription_id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  const message = String(formData.get("message") ?? "").slice(0, 1000);
  const status = String(formData.get("status") ?? "prepared");
  if (!subscriptionId || !clientId || !["prepared","sent","replied","paid"].includes(status)) throw new Error("Relance invalide");
  const db = createSupabaseAdmin();
  const { data: sub } = await db.from("client_subscriptions").select("id").eq("id",subscriptionId).eq("client_id",clientId).eq("user_id",user.id).maybeSingle();
  if (!sub) throw new Error("Abonnement introuvable");
  const { error } = await db.from("client_reminders").upsert({ user_id:user.id,client_id:clientId,subscription_id:subscriptionId,status,message,updated_at:new Date().toISOString(),sent_at:status === "sent" ? new Date().toISOString() : undefined },{ onConflict:"user_id,subscription_id" });
  if (error) throw new Error(error.message); revalidatePath("/relances");
}

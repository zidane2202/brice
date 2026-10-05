"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireActiveSeller } from "@/lib/authz";
import { recordClientEvent } from "@/lib/client-events";
import { isTemplateCategory } from "@/lib/reminder-templates";

export async function updateReminderStatus(formData: FormData) {
  const { user } = await requireActiveSeller();
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

export async function recordReminderSent(input: { subscriptionId: string; clientId: string; message: string; category: string }) {
  const { user } = await requireActiveSeller();
  const message = input.message.trim().slice(0, 1000);
  if (!input.subscriptionId || !input.clientId || !message) throw new Error("Relance invalide");
  const db = createSupabaseAdmin();
  const { data: sub } = await db.from("client_subscriptions").select("id").eq("id", input.subscriptionId).eq("client_id", input.clientId).eq("user_id", user.id).maybeSingle();
  if (!sub) throw new Error("Abonnement introuvable");
  const now = new Date().toISOString();
  const { error } = await db.from("client_reminders").upsert(
    { user_id: user.id, client_id: input.clientId, subscription_id: input.subscriptionId, status: "sent", message, sent_at: now, updated_at: now },
    { onConflict: "user_id,subscription_id" }
  );
  if (error) throw new Error(error.message);
  await recordClientEvent(db, { userId: user.id, clientId: input.clientId, subscriptionId: input.subscriptionId, type: "reminder_sent", title: "Relance WhatsApp envoyée", details: { category: input.category } });
  revalidatePath("/relances");
}

function readTemplate(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "all");
  if (!name || name.length > 60) throw new Error("Donnez un nom au message (60 caractères maximum).");
  if (!body || body.length > 1000) throw new Error("Le message doit contenir entre 1 et 1000 caractères.");
  if (!isTemplateCategory(category)) throw new Error("Catégorie invalide");
  return { name, body, category };
}

export async function saveReminderTemplate(formData: FormData) {
  const { user } = await requireActiveSeller();
  const id = String(formData.get("id") ?? "").trim();
  const values = readTemplate(formData);
  const db = createSupabaseAdmin();
  if (id) {
    const { error } = await db.from("reminder_templates").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
    if (error) throw new Error(error.message);
  } else {
    const { count } = await db.from("reminder_templates").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    if ((count ?? 0) >= 50) throw new Error("Limite de 50 messages personnalisés atteinte.");
    const { error } = await db.from("reminder_templates").insert({ user_id: user.id, ...values });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/relances");
}

export async function deleteReminderTemplate(formData: FormData) {
  const { user } = await requireActiveSeller();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Message introuvable");
  const { error } = await createSupabaseAdmin().from("reminder_templates").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/relances");
}

"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireActiveSeller, requireAdmin } from "@/lib/authz";
import { consumeRateLimit } from "@/lib/rate-limit";

async function ticketAllowed(userId: string, action: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return consumeRateLimit(`${userId}:${ip}`, action, 10, 3600);
}

export async function createSupportTicket(formData: FormData) {
  const { user } = await requireActiveSeller();
  if (!await ticketAllowed(user.id, "support-ticket-create")) {
    throw new Error("Trop de tickets. Réessayez plus tard.");
  }
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 120);
  const body = String(formData.get("body") ?? "").trim().slice(0, 3000);
  const priority = formData.get("priority") === "urgent" ? "urgent" : "normal";
  if (subject.length < 3 || !body) throw new Error("Sujet et message obligatoires");
  const db = createSupabaseAdmin();
  const { data: ticket, error } = await db
    .from("support_tickets")
    .insert({ user_id: user.id, subject, priority })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: messageError } = await db.from("support_messages").insert({
    ticket_id: ticket.id,
    user_id: user.id,
    author_role: "reseller",
    body,
  });
  if (messageError) throw new Error(messageError.message);
  revalidatePath("/support");
}

export async function replyOwnSupportTicket(formData: FormData) {
  const { user } = await requireActiveSeller();
  if (!await ticketAllowed(user.id, "support-ticket-reply")) {
    throw new Error("Trop de réponses. Réessayez plus tard.");
  }
  const ticketId = String(formData.get("ticket_id") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 3000);
  if (!ticketId || !body) throw new Error("Réponse invalide");
  const db = createSupabaseAdmin();
  const { data: ticket } = await db
    .from("support_tickets")
    .select("id, status")
    .eq("id", ticketId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!ticket) throw new Error("Ticket introuvable");
  const { error } = await db.from("support_messages").insert({
    ticket_id: ticketId,
    user_id: user.id,
    author_role: "reseller",
    body,
  });
  if (error) throw new Error(error.message);
  await db
    .from("support_tickets")
    .update({ status: ticket.status === "resolved" ? "open" : ticket.status, updated_at: new Date().toISOString() })
    .eq("id", ticketId);
  revalidatePath("/support");
}

export async function replySupportTicket(formData: FormData) {
  const { user } = await requireAdmin();
  const ticketId = String(formData.get("ticket_id") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 3000);
  const status = String(formData.get("status") ?? "in_progress");
  if (!ticketId || !body || !["open", "in_progress", "resolved"].includes(status)) {
    throw new Error("Réponse invalide");
  }
  const db = createSupabaseAdmin();
  const { data: ticket } = await db.from("support_tickets").select("user_id").eq("id", ticketId).single();
  if (!ticket) throw new Error("Ticket introuvable");
  await db.from("support_messages").insert({
    ticket_id: ticketId,
    user_id: user.id,
    author_role: "admin",
    body,
  });
  await db.from("support_tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", ticketId);
  await db.from("user_notifications").upsert(
    {
      user_id: ticket.user_id,
      type: "support_reply",
      title: "Le support vous a répondu",
      body: body.slice(0, 160),
      url: "/support",
      dedup_key: `support-${ticketId}-${Date.now()}`,
    },
    { onConflict: "user_id,dedup_key" }
  );
  revalidatePath("/admin/support");
}

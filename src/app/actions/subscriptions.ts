"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import { addMonths, toDateInputValue } from "@/lib/dates";

function req(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

export async function renewClientSubscription(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const currentEndDate = req(formData, "end_date");
  const durationMonths = parseInt(req(formData, "duration_months") || "1");
  const isGrace = String(formData.get("status") ?? "") === "grace";
  // En grâce : on repart toujours de la date de fin d'origine, pas d'aujourd'hui
  const baseDate = isGrace || new Date(`${currentEndDate}T00:00:00`) > new Date()
    ? currentEndDate
    : toDateInputValue();
  const newEndDate = addMonths(baseDate, durationMonths);

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("client_subscriptions")
    .update({
      end_date: newEndDate,
      start_date: baseDate,
      status: "active",
      grace_until: null,
      last_notified_on: null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/clients");
}

export async function cancelClientSubscription(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("client_subscriptions")
    .update({ status: "cancelled", grace_until: null })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/clients");
}

export async function setGraceStatus(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const graceUntil = req(formData, "grace_until");
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("client_subscriptions")
    .update({ status: "grace", grace_until: graceUntil })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/abonnements");
  revalidatePath("/clients");
}

export async function removeGraceStatus(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("client_subscriptions")
    .update({ status: "active", grace_until: null })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/abonnements");
  revalidatePath("/clients");
}

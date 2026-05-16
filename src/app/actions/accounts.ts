"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import { addMonths, toDateInputValue } from "@/lib/dates";

function req(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  if (!v) throw new Error(`${key} requis`);
  return v;
}

export async function addProviderAccount(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const serviceName = req(formData, "service_name");
  const startDate = req(formData, "start_date");
  const durationMonths = parseInt(req(formData, "duration_months"));
  const maxSlots = parseInt(req(formData, "max_slots"));
  const cost = formData.get("cost") ? parseFloat(String(formData.get("cost"))) : null;
  const label = String(formData.get("label") ?? "").trim() || null;
  const endDate = addMonths(startDate, durationMonths);

  const supabase = createSupabaseAdmin();

  const { data: account, error } = await supabase
    .from("provider_accounts")
    .insert({
      user_id: user.id,
      service_name: serviceName,
      label,
      start_date: startDate,
      end_date: endDate,
      duration_months: durationMonths,
      max_slots: maxSlots,
      cost,
      status: "active",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const slots = Array.from({ length: maxSlots }, (_, i) => ({
    account_id: account.id,
    slot_number: i + 1,
    label: `Profil ${i + 1}`,
  }));

  const { error: slotError } = await supabase.from("account_slots").insert(slots);
  if (slotError) throw new Error(slotError.message);

  revalidatePath("/abonnements");
}

export async function updateProviderAccountLabel(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const label = String(formData.get("label") ?? "").trim() || null;
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("provider_accounts")
    .update({ label })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/abonnements");
}

export async function renewProviderAccount(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const currentEndDate = req(formData, "end_date");
  const durationMonths = parseInt(req(formData, "duration_months") || "1");
  const baseDate = new Date(`${currentEndDate}T00:00:00`) > new Date()
    ? currentEndDate
    : toDateInputValue();
  const newEndDate = addMonths(baseDate, durationMonths);

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("provider_accounts")
    .update({ end_date: newEndDate, status: "active" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/abonnements");
}

export async function updateProviderAccountStatus(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const status = req(formData, "status");
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("provider_accounts")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/abonnements");
}

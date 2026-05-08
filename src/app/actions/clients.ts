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

function opt(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}

export async function addClientWithSubscription(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const firstName = req(formData, "first_name");
  const lastName = req(formData, "last_name");
  const slotId = req(formData, "slot_id");
  const startDate = req(formData, "start_date");
  const durationMonths = parseInt(req(formData, "duration_months"));
  const price = formData.get("price") ? parseFloat(String(formData.get("price"))) : null;
  const endDate = addMonths(startDate, durationMonths);

  const supabase = createSupabaseAdmin();

  // Verify the slot belongs to an account owned by this user
  const { data: slot } = await supabase
    .from("account_slots")
    .select("id, account_id, provider_accounts(user_id)")
    .eq("id", slotId)
    .single();

  const accountOwner = (slot?.provider_accounts as unknown as { user_id: string } | null)?.user_id;
  if (!slot || accountOwner !== user.id) throw new Error("Slot invalide");

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      user_id: user.id,
      first_name: firstName,
      last_name: lastName,
      email: opt(formData, "email"),
      phone: opt(formData, "phone"),
    })
    .select("id")
    .single();

  if (clientError) throw new Error(clientError.message);

  const { error: subError } = await supabase
    .from("client_subscriptions")
    .insert({
      user_id: user.id,
      slot_id: slotId,
      client_id: client.id,
      start_date: startDate,
      end_date: endDate,
      duration_months: durationMonths,
      price,
      status: "active",
    });

  if (subError) throw new Error(subError.message);
  revalidatePath("/clients");
}

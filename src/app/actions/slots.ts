"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";

export async function updateSlotLabel(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const accountId = String(formData.get("account_id") ?? "");

  const supabase = createSupabaseAdmin();

  const { data: account } = await supabase
    .from("provider_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (!account) throw new Error("Accès refusé");

  const { error } = await supabase
    .from("account_slots")
    .update({ label })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/abonnements/${accountId}`);
}

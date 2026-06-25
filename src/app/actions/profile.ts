"use server";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function updateProfile(_prevState: { error?: string; success?: boolean } | undefined, formData: FormData) {
  const user = await getUser();
  if (!user) return { error: "Non authentifié" };

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("user_profiles")
    .update({
      first_name: firstName || null,
      last_name: lastName || null,
      company_name: companyName || null,
      phone: phone || null,
      city: city || null,
    })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profil");
  return { success: true };
}

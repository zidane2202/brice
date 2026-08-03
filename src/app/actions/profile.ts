"use server";

import {
  LOGO_BUCKET,
  LOGO_MAX_BYTES,
  isAllowedLogoMime,
  logoObjectPath,
} from "@/lib/branding";
import {
  PLAN_LIMIT_BRANDING,
  canUseBranding,
  normalizePlan,
  planLimitError,
} from "@/lib/plans";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

async function requirePlanForBranding(userId: string) {
  const supabase = createSupabaseAdmin();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  const plan = normalizePlan(profile?.plan);
  if (!canUseBranding(plan)) {
    throw planLimitError(
      PLAN_LIMIT_BRANDING,
      "Le logo entreprise est réservé aux plans Pro et Business."
    );
  }
}

export async function updateProfile(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData
) {
  const user = await getUser();
  if (!user) return { error: "Non authentifié" };

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const logoUrlRaw = String(formData.get("logo_url") ?? "").trim();

  if (logoUrlRaw) {
    try {
      await requirePlanForBranding(user.id);
    } catch (e) {
      return { error: e instanceof Error ? e.message.replace(/^PLAN_LIMIT_BRANDING:/, "") : "Plan insuffisant" };
    }
  }

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("user_profiles")
    .update({
      first_name: firstName || null,
      last_name: lastName || null,
      company_name: companyName || null,
      phone: phone || null,
      city: city || null,
      logo_url: logoUrlRaw || null,
    })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profil");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function uploadCompanyLogo(formData: FormData) {
  const user = await getUser();
  if (!user) return { error: "Non authentifié" };

  try {
    await requirePlanForBranding(user.id);
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message.replace(/^PLAN_LIMIT_BRANDING:/, "")
          : "Plan insuffisant",
    };
  }

  const file = formData.get("logo") as File | null;
  if (!file || typeof file === "string" || file.size === 0) {
    return { error: "Aucun fichier sélectionné" };
  }
  if (!isAllowedLogoMime(file.type)) {
    return { error: "Format invalide (PNG, JPG ou WebP)" };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { error: "Fichier trop volumineux (max 2 Mo)" };
  }

  const path = logoObjectPath(user.id, file.type);
  const supabase = createSupabaseAdmin();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (upErr) return { error: upErr.message };

  const { data: pub } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  const logoUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const { error } = await supabase
    .from("user_profiles")
    .update({ logo_url: logoUrl })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profil");
  revalidatePath("/", "layout");
  return { success: true, logoUrl };
}

export async function removeCompanyLogo() {
  const user = await getUser();
  if (!user) return { error: "Non authentifié" };
  const supabase = createSupabaseAdmin();

  await supabase.storage.from(LOGO_BUCKET).remove([
    `${user.id}/logo.png`,
    `${user.id}/logo.jpg`,
    `${user.id}/logo.webp`,
  ]);

  const { error } = await supabase
    .from("user_profiles")
    .update({ logo_url: null })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profil");
  revalidatePath("/", "layout");
  return { success: true };
}

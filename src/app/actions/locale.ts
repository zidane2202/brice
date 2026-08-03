"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { defaultLocale, type AppLocale } from "@/i18n/request";

export async function setLocale(locale: string) {
  const next: AppLocale = locale === "en" || locale === "fr" ? locale : defaultLocale;
  const store = await cookies();
  store.set("locale", next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/");
}

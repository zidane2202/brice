import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

export const locales = ["fr", "en"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "fr";

const catalogs = { fr, en } as const;

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get("locale")?.value;
  const locale: AppLocale = raw === "en" || raw === "fr" ? raw : defaultLocale;

  return {
    locale,
    messages: catalogs[locale],
  };
});

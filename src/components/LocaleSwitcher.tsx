"use client";

import { setLocale } from "@/app/actions/locale";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("LocaleSwitcher");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const next = locale === "fr" ? "en" : "fr";

  function switchLocale() {
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      className={`landing-locale-toggle${className ? ` ${className}` : ""}`}
      onClick={switchLocale}
      disabled={pending}
      aria-label={t("label")}
      title={locale === "fr" ? "Switch to English" : "Passer en français"}
    >
      <span className="landing-locale-toggle-current">{locale === "fr" ? t("fr") : t("en")}</span>
      <span className="landing-locale-toggle-arrow" aria-hidden>
        ↔
      </span>
      <span className="landing-locale-toggle-next">{next === "fr" ? t("fr") : t("en")}</span>
    </button>
  );
}

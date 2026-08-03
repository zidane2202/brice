"use client";

import { setLocale } from "@/app/actions/locale";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("LocaleSwitcher");
  const [pending, startTransition] = useTransition();

  function switchTo(next: "fr" | "en") {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
    });
  }

  return (
    <div
      className={className}
      role="group"
      aria-label={t("label")}
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 3,
        borderRadius: 999,
        border: "1px solid currentColor",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {(["fr", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => switchTo(code)}
          style={{
            border: "none",
            cursor: "pointer",
            padding: "4px 10px",
            borderRadius: 999,
            font: "600 11px/1 var(--font-landing-body, inherit)",
            letterSpacing: "0.06em",
            background: locale === code ? "currentColor" : "transparent",
            color: locale === code ? "var(--landing-switch-on, #fff)" : "inherit",
          }}
        >
          {t(code)}
        </button>
      ))}
    </div>
  );
}

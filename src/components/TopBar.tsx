"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useTranslations } from "next-intl";

type SearchResult = { id: string; type: string; title: string; subtitle: string; href: string };

export function TopBar() {
  const t = useTranslations("TopBar");
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchExpanded(true);
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === "Escape") {
        setOpen(false);
        setSearchExpanded(false);
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    setSearchExpanded(false);
    setOpen(false);
    setQuery("");
  }, [pathname]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
      if (response.ok) setResults((await response.json()).results ?? []);
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  const translatedLabels: Record<string, string> = {
    dashboard: t("dashboard"),
    abonnements: t("subscriptions"),
    clients: t("clients"),
    comptabilite: t("accounting"),
    rapport: t("report"),
    profil: t("profile"),
    aide: t("help"),
    relances: t("reminders"),
    support: t("support"),
    admin: "Admin",
  };
  const crumbs: string[] = [t("workspace")];
  if (first) crumbs.push(translatedLabels[first] ?? first);
  if (segments.length > 1 && segments[1]) {
    crumbs.push(translatedLabels[segments[1]] ?? t("detail"));
  }

  const searchField = (
    <div className="topbar-search">
      <Icon name="search" size={13} className="topbar-search-icon" />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t("search")}
      />
      <span className="topbar-search-kbd">⌘K</span>
      {open && query.trim().length >= 2 && (
        <div className="topbar-search-results">
          {results.length === 0 ? (
            <div className="topbar-search-empty">{t("noResults")}</div>
          ) : (
            results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                type="button"
                className="secondary topbar-search-hit"
                onClick={() => {
                  setOpen(false);
                  setSearchExpanded(false);
                  setQuery("");
                  router.push(result.href);
                }}
              >
                <span className="topbar-search-type">{result.type}</span>
                <span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );

  return (
    <header className={`topbar${searchExpanded ? " topbar--search-open" : ""}`}>
      <div className="topbar-crumbs">
        {crumbs.map((c, i) => (
          <span key={i} className="topbar-crumb">
            <span className={i === crumbs.length - 1 ? "topbar-crumb--current" : ""}>{c}</span>
            {i < crumbs.length - 1 && <Icon name="chevronR" size={12} className="topbar-crumb-sep" />}
          </span>
        ))}
      </div>

      <div className="topbar-spacer" />

      {searchField}

      <button
        type="button"
        className="secondary topbar-search-toggle"
        aria-label={t("openSearch")}
        onClick={() => {
          setSearchExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 20);
        }}
      >
        <Icon name="search" size={14} />
      </button>

      <LocaleSwitcher className="app-locale-toggle" />
      <PwaInstallButton />
      <NotificationCenter />
    </header>
  );
}

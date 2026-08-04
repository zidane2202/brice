"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchResult = { id: string; type: string; title: string; subtitle: string; href: string };

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  abonnements: "Mes abonnements",
  clients: "Mes clients",
  comptabilite: "Comptabilité",
  rapport: "Rapport",
  profil: "Mon profil",
  aide: "Aide",
  admin: "Admin",
};

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); inputRef.current?.focus(); setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
      if (response.ok) setResults((await response.json()).results ?? []);
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  const crumbs: string[] = ["Espace opérateur"];
  if (first) {
    crumbs.push(LABELS[first] ?? first);
  }
  if (segments.length > 1 && segments[1]) {
    crumbs.push(LABELS[segments[1]] ?? "Détail");
  }

  return (
    <header
      className="topbar"
      style={{
        height: 48,
        flex: "0 0 48px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 24px",
        background: "var(--sr-bg)",
        borderBottom: "1px solid var(--sr-border-subtle)",
        position: "sticky",
        top: 0,
        zIndex: 4,
      }}
    >
      <div
        className="topbar-crumbs"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          font: "500 12px/1 var(--font-geist-sans)",
          color: "var(--sr-fg-muted)",
        }}
      >
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: i === crumbs.length - 1 ? "var(--sr-fg)" : "var(--sr-fg-subtle)" }}>{c}</span>
            {i < crumbs.length - 1 && (
              <Icon name="chevronR" size={12} style={{ color: "var(--sr-fg-disabled)" }} />
            )}
          </span>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div className="topbar-search" style={{ position: "relative", width: 280 }}>
        <Icon
          name="search"
          size={13}
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--sr-fg-subtle)",
            pointerEvents: "none",
          }}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher…"
          style={{
            paddingLeft: 32,
            paddingRight: 40,
            height: 30,
            minHeight: 30,
            background: "var(--sr-surface)",
            fontSize: "0.82rem",
          }}
        />
        <span
          style={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: "translateY(-50%)",
            font: "500 10px/1 var(--font-geist-mono)",
            color: "var(--sr-fg-subtle)",
            padding: "3px 5px",
            border: "1px solid var(--sr-border)",
            borderRadius: 4,
          }}
        >
          ⌘K
        </span>
        {open && query.trim().length >= 2 && (
          <div style={{ position: "absolute", top: 36, right: 0, width: 360, maxHeight: 380, overflow: "auto", padding: 6, borderRadius: 10, border: "1px solid var(--sr-border)", background: "var(--sr-surface)", boxShadow: "0 18px 60px rgba(0,0,0,.48)", zIndex: 100 }}>
            {results.length === 0 ? (
              <div style={{ padding: 14, color: "var(--sr-fg-subtle)", fontSize: 12 }}>Aucun résultat.</div>
            ) : results.map((result) => (
              <button key={`${result.type}-${result.id}`} type="button" className="secondary" onClick={() => { setOpen(false); setQuery(""); router.push(result.href); }} style={{ width: "100%", minHeight: 48, height: "auto", padding: "8px 10px", justifyContent: "flex-start", textAlign: "left", background: "transparent", borderColor: "transparent" }}>
                <span style={{ width: 62, color: "var(--sr-mint-300)", fontSize: 9, textTransform: "uppercase" }}>{result.type}</span>
                <span style={{ display: "grid", gap: 3 }}><strong style={{ fontSize: 12 }}>{result.title}</strong><small style={{ color: "var(--sr-fg-subtle)" }}>{result.subtitle}</small></span>
              </button>
            ))}
          </div>
        )}
      </div>

      <PwaInstallButton />

      <NotificationCenter />
    </header>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  abonnements: "Mes abonnements",
  clients: "Mes clients",
  profil: "Mon profil",
  admin: "Admin",
};

export function TopBar() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  const crumbs: string[] = ["Espace opérateur"];
  if (first) {
    crumbs.push(LABELS[first] ?? first);
  }
  if (segments.length > 1 && segments[1] && !LABELS[segments[1]]) {
    crumbs.push("Détail");
  }

  return (
    <header
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

      <div style={{ position: "relative", width: 280 }}>
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
      </div>

      <button
        type="button"
        className="secondary"
        title="Notifications"
        aria-label="Notifications"
        style={{ width: 30, minHeight: 30, height: 30, padding: 0, justifyContent: "center" }}
      >
        <Icon name="bell" size={13} />
      </button>
    </header>
  );
}

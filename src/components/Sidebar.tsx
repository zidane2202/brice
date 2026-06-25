"use client";

import { logout } from "@/app/actions/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";

type IconName = "dashboard" | "seat" | "users" | "settings" | "zap";

type NavItem = { href: string; label: string; icon: IconName; badge?: number };

type Props = {
  isAdmin: boolean;
  userName?: string | null;
  userEmail?: string | null;
  monthlyRevenue?: number | null;
  revenueDelta?: number | null;
  accountsCount?: number;
  clientsCount?: number;
};

function shortFCFA(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "k";
  return String(n);
}

export function Sidebar({
  isAdmin,
  userName,
  userEmail,
  monthlyRevenue,
  revenueDelta,
  accountsCount = 0,
  clientsCount = 0,
}: Props) {
  const pathname = usePathname();
  const displayName = userName || (userEmail ? userEmail.split("@")[0] : "Utilisateur");

  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/abonnements", label: "Mes abonnements", icon: "seat", badge: accountsCount },
    { href: "/clients", label: "Mes clients", icon: "users", badge: clientsCount },
    { href: "/profil", label: "Mon profil", icon: "settings" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: 5,
            background: "linear-gradient(135deg, var(--sr-mint-500), var(--sr-mint-700))",
            color: "var(--sr-mint-ink)",
            font: "700 12px/1 var(--font-geist-sans)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
        >
          S
        </span>
        <p className="eyebrow">subresell</p>
        <span className="beta-badge">Beta</span>
      </div>

      <div className="sidebar-section-label">Espace opérateur</div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${active ? " sidebar-link--active" : ""}`}
            >
              <Icon name={item.icon} size={15} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="sidebar-link-badge">{item.badge}</span>
              )}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div style={{ height: 12 }} />
            <div className="sidebar-section-label">Système</div>
            <Link
              href="/admin/dashboard"
              className={`sidebar-link sidebar-link--admin${pathname.startsWith("/admin") ? " sidebar-link--active" : ""}`}
            >
              <Icon name="zap" size={15} />
              <span style={{ flex: 1 }}>Admin</span>
            </Link>
          </>
        )}
      </nav>

      {monthlyRevenue != null && monthlyRevenue > 0 && (
        <div className="sidebar-mrr">
          <div className="sidebar-mrr-label">Revenu ce mois</div>
          <div className="sidebar-mrr-value">
            {shortFCFA(monthlyRevenue)}
            <span className="sidebar-mrr-value-unit">FCFA</span>
          </div>
          {revenueDelta != null && (
            <div
              style={{
                marginTop: 4,
                font: "500 11px/1.2 var(--font-geist-mono)",
                color: revenueDelta >= 0 ? "var(--sr-success)" : "var(--sr-danger)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Icon name={revenueDelta >= 0 ? "arrowUp" : "arrowDown"} size={11} />
              {revenueDelta >= 0 ? "+" : ""}
              {revenueDelta}%
              <span style={{ color: "var(--sr-fg-subtle)", fontWeight: 400 }}>vs. mois -1</span>
            </div>
          )}
        </div>
      )}

      <div className="sidebar-footer">
        <div className="sidebar-account">
          <Avatar name={displayName} size={28} />
          <div className="sidebar-account-info">
            <div className="sidebar-account-name">{displayName}</div>
            {userEmail && <div className="sidebar-account-email">{userEmail}</div>}
          </div>
          <form action={logout} style={{ margin: 0 }}>
            <button
              type="submit"
              className="sidebar-logout"
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <Icon name="logout" size={13} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

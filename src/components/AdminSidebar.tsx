"use client";

import { logout } from "@/app/actions/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/vendeurs", label: "Vendeurs", icon: "users" },
  { href: "/admin/finances", label: "Finances", icon: "bill" },
  { href: "/admin/support", label: "Support", icon: "alert" },
  { href: "/admin/systeme", label: "Système", icon: "settings" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar sidebar--admin">
      <div className="sidebar-logo">
        <p className="eyebrow">SubResell</p>
        <span className="admin-badge">Admin</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-link${pathname.startsWith(item.href) ? " sidebar-link--active" : ""}`}
          >
            <Icon name={item.icon} size={18} />
            {item.label}
          </Link>
        ))}
        <div className="sidebar-divider" />
        <Link href="/dashboard" className="sidebar-link sidebar-link--muted">
          <Icon name="arrowRight" size={18} style={{ transform: "rotate(180deg)" }} /> App vendeur
        </Link>
      </nav>
      <form action={logout} className="sidebar-footer" style={{ width: "100%", margin: "auto 0 0", paddingTop: 12 }}>
        <button
          type="submit"
          className="admin-sidebar-logout"
          style={{
            width: "100%",
            height: 42,
            minHeight: 42,
            padding: "0 13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 12,
            background: "var(--sr-surface)",
            color: "var(--sr-fg-muted)",
            border: "1px solid var(--sr-border)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <Icon name="logout" size={18} /> Déconnexion
        </button>
      </form>
    </aside>
  );
}

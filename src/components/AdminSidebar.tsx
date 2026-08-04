"use client";

import { logout } from "@/app/actions/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useTranslations } from "next-intl";

export function AdminSidebar() {
  const pathname = usePathname();
  const t = useTranslations("Navigation");
  const translatedNavItems = [
    { href: "/admin/dashboard", label: t("dashboard"), icon: "dashboard" },
    { href: "/admin/vendeurs", label: t("sellers"), icon: "users" },
    { href: "/admin/finances", label: t("finances"), icon: "bill" },
    { href: "/admin/support", label: t("supportShort"), icon: "alert" },
    { href: "/admin/systeme", label: t("system"), icon: "settings" },
  ];

  return (
    <aside className="sidebar sidebar--admin">
      <div className="sidebar-logo">
        <p className="eyebrow">SubResell</p>
        <span className="admin-badge">Admin</span>
        <LocaleSwitcher className="app-locale-toggle admin-locale-toggle" />
      </div>
      <nav className="sidebar-nav">
        {translatedNavItems.map((item) => (
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
          <Icon name="arrowRight" size={18} style={{ transform: "rotate(180deg)" }} /> {t("sellerApp")}
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
          <Icon name="logout" size={18} /> {t("logout")}
        </button>
      </form>
    </aside>
  );
}

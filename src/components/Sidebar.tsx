"use client";

import { logout } from "@/app/actions/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { BrandMark } from "@/components/BrandMark";
import { Icon } from "@/components/Icon";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { APP_VERSION } from "@/lib/version";
import { useTranslations } from "next-intl";

type IconName = "dashboard" | "seat" | "users" | "settings" | "zap" | "bill" | "alert";

type NavItem = { href: string; label: string; icon: IconName; badge?: number; primary?: boolean };

type Props = {
  isAdmin: boolean;
  userName?: string | null;
  userEmail?: string | null;
  monthlyRevenue?: number | null;
  revenueDelta?: number | null;
  accountsCount?: number;
  clientsCount?: number;
  companyName?: string | null;
  logoUrl?: string | null;
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
  companyName,
  logoUrl,
}: Props) {
  const pathname = usePathname();
  const t = useTranslations("Navigation");
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const displayName = userName || (userEmail ? userEmail.split("@")[0] : "Utilisateur");
  const brandName = companyName?.trim() || "subresell";

  useEffect(() => {
    setPendingHref(null);
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("nav-more-open", moreOpen);
    return () => document.body.classList.remove("nav-more-open");
  }, [moreOpen]);

  const navItems: NavItem[] = [
    { href: "/dashboard", label: t("dashboard"), icon: "dashboard", primary: true },
    { href: "/abonnements", label: t("subscriptions"), icon: "seat", badge: accountsCount, primary: true },
    { href: "/clients", label: t("clients"), icon: "users", badge: clientsCount, primary: true },
    { href: "/comptabilite", label: t("accounting"), icon: "bill", primary: true },
    { href: "/clients/archives", label: t("archives"), icon: "users" },
    { href: "/relances", label: t("reminders"), icon: "alert" },
    { href: "/profil", label: t("profile"), icon: "settings" },
    { href: "/aide", label: t("help"), icon: "alert" },
    { href: "/support", label: t("support"), icon: "alert" },
  ];

  const primaryItems = navItems.filter((i) => i.primary);
  const moreItems = navItems.filter((i) => !i.primary);
  const moreActive =
    moreItems.some((i) => pathname.startsWith(i.href)) ||
    pathname.startsWith("/admin") ||
    moreOpen;

  function renderLink(item: NavItem, extraClass = "") {
    const active =
      item.href === "/clients"
        ? pathname === "/clients" ||
          (pathname.startsWith("/clients/") && !pathname.startsWith("/clients/archives"))
        : pathname.startsWith(item.href);
    const pending = pendingHref === item.href && !active;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`sidebar-link${active ? " sidebar-link--active" : ""}${pending ? " sidebar-link--pending" : ""}${extraClass}`}
        onClick={() => {
          if (!active) setPendingHref(item.href);
        }}
      >
        <Icon name={item.icon} size={15} />
        <span className="sidebar-link-label">{item.label}</span>
        {pending && <span className="sidebar-link-loader" aria-hidden />}
        {item.badge != null && item.badge > 0 && (
          <span className="sidebar-link-badge">{item.badge}</span>
        )}
      </Link>
    );
  }

  const footer = (
    <div className="sidebar-footer">
      <div className="sidebar-version">SubResell v{APP_VERSION}</div>
      <div className="sidebar-account">
        <Avatar name={displayName} size={28} />
        <div className="sidebar-account-info">
          <div className="sidebar-account-name">{displayName}</div>
          {userEmail && <div className="sidebar-account-email">{userEmail}</div>}
        </div>
        <form action={logout} style={{ margin: 0 }} data-readonly-ok>
          <button type="submit" className="sidebar-logout" title={t("logout")} aria-label={t("logout")}>
            <Icon name="logout" size={13} />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <aside className={`sidebar${moreOpen ? " sidebar--more-open" : ""}`}>
      <div className="sidebar-logo">
        <BrandMark logoUrl={logoUrl} name={brandName} size={logoUrl ? 40 : 24} />
        {!logoUrl && <p className="eyebrow">{brandName}</p>}
      </div>

      <div className="sidebar-section-label">{t("workspace")}</div>

      <nav className="sidebar-nav sidebar-nav--desktop">
        {navItems.map((item) => renderLink(item))}
        {isAdmin && (
          <>
            <div className="sidebar-section-label">{t("system")}</div>
            <Link
              href="/admin/dashboard"
              className={`sidebar-link sidebar-link--admin${pathname.startsWith("/admin") ? " sidebar-link--active" : ""}`}
              onClick={() => {
                if (!pathname.startsWith("/admin")) setPendingHref("/admin/dashboard");
              }}
            >
              <Icon name="zap" size={15} />
              <span className="sidebar-link-label">Admin</span>
            </Link>
          </>
        )}
      </nav>

      {monthlyRevenue != null && monthlyRevenue > 0 && (
        <div className="sidebar-mrr">
          <div className="sidebar-mrr-label">{t("monthlyRevenue")}</div>
          <div className="sidebar-mrr-value">
            {shortFCFA(monthlyRevenue)}
            <span className="sidebar-mrr-value-unit">FCFA</span>
          </div>
          {revenueDelta != null && (
            <div className="sidebar-mrr-delta" data-up={revenueDelta >= 0 ? "true" : "false"}>
              <Icon name={revenueDelta >= 0 ? "arrowUp" : "arrowDown"} size={11} />
              {revenueDelta >= 0 ? "+" : ""}
              {revenueDelta}%
              <span>vs. mois -1</span>
            </div>
          )}
        </div>
      )}

      {footer}

      {moreOpen && (
        <button
          type="button"
          className="sidebar-more-backdrop"
          aria-label={t("closeMenu")}
          onClick={() => setMoreOpen(false)}
        />
      )}

      <div className="sidebar-more-sheet" hidden={!moreOpen}>
        <div className="sidebar-more-sheet-head">
          <strong>{t("more")}</strong>
          <button type="button" className="secondary sidebar-more-close" onClick={() => setMoreOpen(false)}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <nav className="sidebar-more-list">
          {moreItems.map((item) => renderLink(item, " sidebar-link--sheet"))}
          {isAdmin && (
            <Link
              href="/admin/dashboard"
              className={`sidebar-link sidebar-link--sheet sidebar-link--admin${pathname.startsWith("/admin") ? " sidebar-link--active" : ""}`}
            >
              <Icon name="zap" size={15} />
              <span className="sidebar-link-label">Admin</span>
            </Link>
          )}
          <LocaleSwitcher className="app-locale-toggle admin-locale-toggle-mobile" />
        </nav>
        {footer}
      </div>

      <nav className="sidebar-nav sidebar-nav--mobile" aria-label={t("workspace")}>
        {primaryItems.map((item) => renderLink(item))}
        <button
          type="button"
          className={`sidebar-link sidebar-more-trigger${moreActive || moreOpen ? " sidebar-link--active" : ""}`}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <Icon name="more" size={15} />
          <span className="sidebar-link-label">{t("more")}</span>
        </button>
      </nav>
    </aside>
  );
}

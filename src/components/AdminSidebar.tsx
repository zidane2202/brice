"use client";

import { logout } from "@/app/actions/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useTranslations } from "next-intl";

export function AdminSidebar() {
  const pathname = usePathname();
  const t = useTranslations("Navigation");
  const [moreOpen, setMoreOpen] = useState(false);

  const translatedNavItems = [
    { href: "/admin/dashboard", label: t("dashboard"), icon: "dashboard" as const, primary: true },
    { href: "/admin/vendeurs", label: t("sellers"), icon: "users" as const, primary: true },
    { href: "/admin/finances", label: t("finances"), icon: "bill" as const, primary: true },
    { href: "/admin/support", label: t("supportShort"), icon: "alert" as const, primary: true },
    { href: "/admin/systeme", label: t("system"), icon: "settings" as const, primary: false },
  ];

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("nav-more-open", moreOpen);
    return () => document.body.classList.remove("nav-more-open");
  }, [moreOpen]);

  const primaryItems = translatedNavItems.filter((i) => i.primary);
  const moreItems = translatedNavItems.filter((i) => !i.primary);
  const moreActive = moreItems.some((i) => pathname.startsWith(i.href)) || moreOpen;

  function linkClass(href: string) {
    return `sidebar-link${pathname.startsWith(href) ? " sidebar-link--active" : ""}`;
  }

  const extraLinks = (
    <>
      {moreItems.map((item) => (
        <Link key={item.href} href={item.href} className={`${linkClass(item.href)} sidebar-link--sheet`}>
          <Icon name={item.icon} size={18} />
          <span className="sidebar-link-label">{item.label}</span>
        </Link>
      ))}
      <Link href="/dashboard" className="sidebar-link sidebar-link--sheet sidebar-link--muted">
        <Icon name="arrowRight" size={18} style={{ transform: "rotate(180deg)" }} />
        <span className="sidebar-link-label">{t("sellerApp")}</span>
      </Link>
    </>
  );

  return (
    <aside className={`sidebar sidebar--admin${moreOpen ? " sidebar--more-open" : ""}`}>
      <div className="sidebar-logo">
        <p className="eyebrow">SubResell</p>
        <span className="admin-badge">Admin</span>
        <LocaleSwitcher className="app-locale-toggle admin-locale-toggle" />
      </div>
      <nav className="sidebar-nav sidebar-nav--desktop">
        {translatedNavItems.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(item.href)}>
            <Icon name={item.icon} size={18} />
            <span className="sidebar-link-label">{item.label}</span>
          </Link>
        ))}
        <div className="sidebar-divider" />
        <Link href="/dashboard" className="sidebar-link sidebar-link--muted">
          <Icon name="arrowRight" size={18} style={{ transform: "rotate(180deg)" }} />
          <span className="sidebar-link-label">{t("sellerApp")}</span>
        </Link>
      </nav>
      <form action={logout} className="sidebar-footer sidebar-footer--admin">
        <button type="submit" className="admin-sidebar-logout">
          <Icon name="logout" size={18} /> {t("logout")}
        </button>
      </form>

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
          {extraLinks}
          <LocaleSwitcher className="app-locale-toggle admin-locale-toggle-mobile" />
        </nav>
        <form action={logout} className="sidebar-footer sidebar-footer--admin">
          <button type="submit" className="admin-sidebar-logout">
            <Icon name="logout" size={18} /> {t("logout")}
          </button>
        </form>
      </div>

      <nav className="sidebar-nav sidebar-nav--mobile" aria-label="Admin">
        {primaryItems.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(item.href)}>
            <Icon name={item.icon} size={18} />
            <span className="sidebar-link-label">{item.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`sidebar-link sidebar-more-trigger${moreActive ? " sidebar-link--active" : ""}`}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <Icon name="more" size={18} />
          <span className="sidebar-link-label">{t("more")}</span>
        </button>
      </nav>
    </aside>
  );
}

"use client";

import { logout } from "@/app/actions/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/abonnements", label: "Mes abonnements" },
  { href: "/clients", label: "Mes clients" },
  { href: "/profil", label: "Mon profil" },
];

type Props = { isAdmin: boolean };

export function Sidebar({ isAdmin }: Props) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <p className="eyebrow">SubResell</p>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-link${pathname.startsWith(item.href) ? " sidebar-link--active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
        {isAdmin && (
          <>
            <div className="sidebar-divider" />
            <Link
              href="/admin/dashboard"
              className={`sidebar-link sidebar-link--admin${pathname.startsWith("/admin") ? " sidebar-link--active" : ""}`}
            >
              Admin
            </Link>
          </>
        )}
      </nav>
      <form action={logout} className="sidebar-footer">
        <button type="submit" className="secondary sidebar-logout">
          Déconnexion
        </button>
      </form>
    </aside>
  );
}

"use client";

import { logout } from "@/app/actions/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/vendeurs", label: "Vendeurs" },
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
            {item.label}
          </Link>
        ))}
        <div className="sidebar-divider" />
        <Link href="/dashboard" className="sidebar-link sidebar-link--muted">
          ← App vendeur
        </Link>
      </nav>
      <form action={logout} className="sidebar-footer">
        <button type="submit" className="secondary sidebar-logout">
          Déconnexion
        </button>
      </form>
    </aside>
  );
}

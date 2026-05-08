import { logout } from "@/app/actions/auth";
import { getUserProfile } from "@/lib/supabase-server";
import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/abonnements", label: "Mes abonnements" },
  { href: "/clients", label: "Mes clients" },
];

export async function Sidebar() {
  const profile = await getUserProfile();
  const isAdmin = profile?.role === "admin";

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <p className="eyebrow">SubResell</p>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="sidebar-link">
            {item.label}
          </Link>
        ))}
        {isAdmin && (
          <>
            <div className="sidebar-divider" />
            <Link href="/admin" className="sidebar-link sidebar-link--admin">
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

import { Sidebar } from "@/components/Sidebar";
import { getUserProfile } from "@/lib/supabase-server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getUserProfile();
  const isAdmin = profile?.role === "admin";

  return (
    <div className="app-shell">
      <Sidebar isAdmin={isAdmin} />
      <main className="app-main">{children}</main>
    </div>
  );
}

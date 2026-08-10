import { AdminSidebar } from "@/components/AdminSidebar";
import { requireAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/dashboard");
  }
  return (
    <div className="app-shell">
      <AdminSidebar />
      <main id="app-content" className="app-main">{children}</main>
    </div>
  );
}

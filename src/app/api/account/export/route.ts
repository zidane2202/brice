import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function GET() {
  const auth = await createSupabaseServer();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const db = createSupabaseAdmin();
  const tables = ["user_profiles", "provider_accounts", "clients", "client_subscriptions", "transactions", "invoices"] as const;
  const entries = await Promise.all(tables.map(async (table) => {
    const { data, error } = await db.from(table).select("*").eq("user_id", user.id);
    if (error) throw new Error(error.message);
    if (table === "provider_accounts") {
      return [table, (data ?? []).map(({ account_password: _password, ...row }) => row)] as const;
    }
    return [table, data ?? []] as const;
  }));
  return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), user_email: user.email, data: Object.fromEntries(entries) }, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="subresell-export-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
  });
}

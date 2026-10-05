import { NextResponse } from "next/server";
import { activeSellerOrResponse } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const authz = await activeSellerOrResponse({ write: true });
  if (!authz.ok) return authz.response;
  const user = authz.user;
  const body = await request.json().catch(() => null); const data = body?.data;
  if (!data || typeof data !== "object") return NextResponse.json({ error: "Sauvegarde invalide" }, { status: 400 });
  const allowed = ["user_profiles", "provider_accounts", "account_slots", "clients", "client_subscriptions", "transactions", "invoices", "client_events"];
  const sanitized = Object.fromEntries(allowed.map((table) => [table, Array.isArray(data[table]) ? data[table].slice(0, 5000).map((row: Record<string, unknown>) => { const copy = { ...row }; delete copy.account_password; return copy; }) : []]));
  const db = createSupabaseAdmin();
  const { data: restored, error } = await db.rpc("restore_account_backup_atomic", { p_user: user.id, p_backup: sanitized });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, restored: Number(restored ?? 0) });
}

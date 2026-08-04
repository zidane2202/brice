import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const auth = await createSupabaseServer(); const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await request.json().catch(() => null); const data = body?.data;
  if (!data || typeof data !== "object") return NextResponse.json({ error: "Sauvegarde invalide" }, { status: 400 });
  const db = createSupabaseAdmin();
  const profile = Array.isArray(data.user_profiles) ? data.user_profiles[0] : null;
  if (profile) await db.from("user_profiles").update({ first_name: profile.first_name ?? null, last_name: profile.last_name ?? null, company_name: profile.company_name ?? null, phone: profile.phone ?? null, city: profile.city ?? null }).eq("user_id", user.id);
  const order = ["provider_accounts", "account_slots", "clients", "client_subscriptions", "transactions", "invoices", "client_events"] as const;
  let restored = 0;
  for (const table of order) {
    const rows = Array.isArray(data[table]) ? data[table].slice(0, 5000) : [];
    if (!rows.length) continue;
    const ids = rows.map((row: Record<string, unknown>) => String(row.id ?? "")).filter(Boolean);
    if (table === "account_slots") {
      const { data: foreign } = await db.from("account_slots").select("id,provider_accounts!inner(user_id)").in("id", ids);
      if ((foreign ?? []).some((slot) => (slot.provider_accounts as unknown as { user_id: string }).user_id !== user.id)) return NextResponse.json({ error: "La sauvegarde contient des profils appartenant à un autre compte." }, { status: 403 });
    } else {
      const { data: foreign } = await db.from(table).select("id,user_id").in("id", ids).neq("user_id", user.id);
      if ((foreign ?? []).length) return NextResponse.json({ error: `Conflit de propriété dans ${table}.` }, { status: 403 });
    }
    const sanitized = rows.map((row: Record<string, unknown>) => { const copy = { ...row }; delete copy.account_password; if (table !== "account_slots") copy.user_id = user.id; return copy; });
    const { error } = await db.from(table).upsert(sanitized, { onConflict: "id" });
    if (error) return NextResponse.json({ error: `${table}: ${error.message}`, restored }, { status: 400 });
    restored += sanitized.length;
  }
  return NextResponse.json({ ok: true, restored });
}

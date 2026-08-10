import { NextResponse } from "next/server";
import { activeSellerOrResponse } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const authz = await activeSellerOrResponse();
  if (!authz.ok) return authz.response;
  const { data, error } = await createSupabaseAdmin()
    .from("user_notifications")
    .select("id,type,title,body,url,read_at,created_at")
    .eq("user_id", authz.user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    notifications: data ?? [],
    unread: (data ?? []).filter((item) => !item.read_at).length,
  });
}

export async function PATCH(request: Request) {
  const authz = await activeSellerOrResponse();
  if (!authz.ok) return authz.response;
  const { id, all } = await request.json().catch(() => ({ id: null, all: false }));
  let query = createSupabaseAdmin()
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", authz.user.id)
    .is("read_at", null);
  if (!all) {
    if (typeof id !== "string") return NextResponse.json({ error: "Notification invalide" }, { status: 400 });
    query = query.eq("id", id);
  }
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

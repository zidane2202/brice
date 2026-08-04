import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServer } from "@/lib/supabase-server";

async function currentUser() {
  const auth = await createSupabaseServer();
  return (await auth.auth.getUser()).data.user;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { data, error } = await createSupabaseAdmin().from("user_notifications").select("id,type,title,body,url,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [], unread: (data ?? []).filter((item) => !item.read_at).length });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id, all } = await request.json().catch(() => ({ id: null, all: false }));
  let query = createSupabaseAdmin().from("user_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (!all) {
    if (typeof id !== "string") return NextResponse.json({ error: "Notification invalide" }, { status: 400 });
    query = query.eq("id", id);
  }
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

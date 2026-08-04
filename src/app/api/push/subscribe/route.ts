import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabaseServer = await createSupabaseServer();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!await consumeRateLimit(`${user.id}:${requestIp(request)}`, "push-subscribe", 20, 3600)) {
    return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 });
  }

  const supabase = createSupabaseAdmin();
  const { data: profile } = await supabase.from("user_profiles")
    .select("plan, suspended, plan_renews_on").eq("user_id", user.id).single();
  const today = new Date().toISOString().slice(0, 10);
  if (!profile || !["pro", "business"].includes(profile.plan) || profile.suspended || (profile.plan_renews_on && profile.plan_renews_on < today)) {
    return NextResponse.json({ error: "Les notifications push nécessitent un pack Pro ou Business actif." }, { status: 403 });
  }
  const subscription = await request.json().catch(() => null);
  if (!subscription || typeof subscription.endpoint !== "string" || !subscription.endpoint.startsWith("https://")
    || typeof subscription.keys?.p256dh !== "string" || typeof subscription.keys?.auth !== "string") {
    return NextResponse.json({ error: "Abonnement push invalide" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint: subscription.endpoint, subscription },
      { onConflict: "endpoint" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabaseServer = await createSupabaseServer();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { endpoint } = await request.json().catch(() => ({ endpoint: null }));
  const supabase = createSupabaseAdmin();
  let query = supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  if (endpoint) query = query.eq("endpoint", endpoint);
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

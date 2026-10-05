import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { todayDateOnly } from "@/lib/dates";
import { canUsePush, effectivePlan, isAdminProfile, isPlanExpired } from "@/lib/plans";

export async function POST(request: Request) {
  const supabaseServer = await createSupabaseServer();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!await consumeRateLimit(`${user.id}:${requestIp(request)}`, "push-subscribe", 20, 3600)) {
    return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 });
  }

  const supabase = createSupabaseAdmin();
  const { data: profile } = await supabase.from("user_profiles")
    .select("plan, role, suspended, plan_renews_on, created_at").eq("user_id", user.id).single();
  const today = todayDateOnly();
  const paidActive = profile && canUsePush(effectivePlan(profile, today)) && !profile.suspended && !isPlanExpired(profile, today);
  if (!profile || (!isAdminProfile(profile) && !paidActive)) {
    return NextResponse.json({ error: "Les notifications push nécessitent un pack Pro ou Business actif." }, { status: 403 });
  }
  const subscription = await request.json().catch(() => null);
  if (!subscription || typeof subscription.endpoint !== "string" || !subscription.endpoint.startsWith("https://")
    || typeof subscription.keys?.p256dh !== "string" || typeof subscription.keys?.auth !== "string") {
    return NextResponse.json({ error: "Abonnement push invalide" }, { status: 400 });
  }

  const { error } = await supabase.rpc("upsert_push_subscription", {
    p_user: user.id,
    p_endpoint: subscription.endpoint,
    p_subscription: subscription,
  });

  if (error) {
    const message = error.message || "Abonnement push impossible";
    const status = /déjà lié/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabaseServer = await createSupabaseServer();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!await consumeRateLimit(`${user.id}:${requestIp(request)}`, "push-unsubscribe", 30, 3600)) {
    return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({ endpoint: null, all: false }));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
  const all = body.all === true;
  if (!endpoint && !all) {
    return NextResponse.json({ error: "endpoint requis (ou all=true)" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  let query = supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  if (endpoint) query = query.eq("endpoint", endpoint);
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

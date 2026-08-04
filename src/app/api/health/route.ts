import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const started = Date.now();
  const { error } = await createSupabaseAdmin().from("user_profiles").select("id", { head: true, count: "exact" }).limit(1);
  return NextResponse.json({ status: error ? "degraded" : "ok", database: error ? "unavailable" : "ok", timestamp: new Date().toISOString(), response_ms: Date.now() - started }, { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}

import { createSupabaseServer } from "@/lib/supabase-server";
import { safeAuthNextPath } from "@/lib/auth-next";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeAuthNextPath(url.searchParams.get("next"), "/reset-password");
  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/forgot-password?error=reset`, url.origin));
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}

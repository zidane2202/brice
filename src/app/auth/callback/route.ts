// Supabase Auth → Redirect URLs (obligatoire pour le reset mot de passe):
//   https://subresel.vercel.app/auth/callback
//   http://localhost:3000/auth/callback
import { createServerClient } from "@supabase/ssr";
import { safeAuthNextPath } from "@/lib/auth-next";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const OTP_TYPES = new Set(["recovery", "signup", "invite", "magiclink", "email"]);
type OtpType = "recovery" | "signup" | "invite" | "magiclink" | "email";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeRaw = url.searchParams.get("type");
  const type = typeRaw && OTP_TYPES.has(typeRaw) ? (typeRaw as OtpType) : null;
  const fallback = type === "recovery" ? "/reset-password" : "/dashboard";
  const next = safeAuthNextPath(url.searchParams.get("next"), fallback);
  const fail = () => NextResponse.redirect(new URL("/forgot-password?error=reset", url.origin));

  if (!code && !(tokenHash && type)) return fail();

  const cookieStore = await cookies();
  const redirect = NextResponse.redirect(new URL(next, url.origin));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            redirect.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ type: type!, token_hash: tokenHash! });

  if (error) return fail();
  return redirect;
}

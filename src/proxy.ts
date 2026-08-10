import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
  return to;
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isAuthPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth/callback");
  const isLanding = pathname === "/";
  const isPublicInvoice = pathname.startsWith("/facture/");
  const isPublic = isAuthPublic || isLanding || isPublicInvoice;
  const isAdmin = pathname.startsWith("/admin");

  if (!user && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    return copyCookies(supabaseResponse, NextResponse.redirect(new URL("/login", request.url)));
  }

  // Recovery links create a session first; keep the reset form reachable.
  if (
    user &&
    isAuthPublic &&
    !pathname.startsWith("/reset-password") &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/forgot-password")
  ) {
    return copyCookies(supabaseResponse, NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  if (isAdmin && user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, suspended")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin" || profile?.suspended) {
      return copyCookies(supabaseResponse, NextResponse.redirect(new URL("/dashboard", request.url)));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|pwa-icon-192|pwa-icon-512|sw.js|offline.html|api/cron|api/health|api/invoices|api/push|api/support).*)",
  ],
};

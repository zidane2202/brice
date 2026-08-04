import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServer } from "@/lib/supabase-server";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const auth = await createSupabaseServer();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!await consumeRateLimit(`${user.id}:${requestIp(request)}`, "global-search", 60, 60)) {
    return NextResponse.json({ error: "Trop de recherches" }, { status: 429 });
  }
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  const escaped = q.replace(/[%_,()]/g, " ");
  const supabase = createSupabaseAdmin();
  const [clients, accounts, invoices] = await Promise.all([
    supabase.from("clients").select("id,first_name,last_name,phone,email").eq("user_id", user.id)
      .or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`).limit(6),
    supabase.from("provider_accounts").select("id,service_name,label").eq("user_id", user.id)
      .or(`service_name.ilike.%${escaped}%,label.ilike.%${escaped}%`).limit(4),
    supabase.from("invoices").select("id,code,number,client_name,service_name").eq("user_id", user.id)
      .or(`client_name.ilike.%${escaped}%,service_name.ilike.%${escaped}%`).limit(4),
  ]);
  const results = [
    ...(clients.data ?? []).map((x) => ({ id: x.id, type: "client", title: [x.first_name, x.last_name].filter(Boolean).join(" "), subtitle: x.phone || x.email || "Client", href: `/clients?client=${x.id}` })),
    ...(accounts.data ?? []).map((x) => ({ id: x.id, type: "compte", title: x.service_name, subtitle: x.label || "Compte fournisseur", href: `/abonnements/${x.id}` })),
    ...(invoices.data ?? []).map((x) => ({ id: x.id, type: "facture", title: `Facture n° ${String(x.number).padStart(4, "0")}`, subtitle: `${x.client_name} · ${x.service_name}`, href: `/facture/${x.code}` })),
  ];
  return NextResponse.json({ results });
}

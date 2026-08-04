import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const auth = await createSupabaseServer(); const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { invoiceId } = await params; const db = createSupabaseAdmin();
  const { data: invoice } = await db.from("invoices").select("receipt_url").eq("id", invoiceId).eq("user_id", user.id).maybeSingle();
  if (!invoice?.receipt_url) return NextResponse.json({ error: "Justificatif introuvable" }, { status: 404 });
  const { data, error } = await db.storage.from("receipts").createSignedUrl(invoice.receipt_url, 60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}

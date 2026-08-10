import { NextResponse } from "next/server";
import { activeSellerOrResponse } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const authz = await activeSellerOrResponse();
  if (!authz.ok) return authz.response;
  const { invoiceId } = await params;
  const db = createSupabaseAdmin();
  const { data: invoice } = await db
    .from("invoices")
    .select("receipt_url")
    .eq("id", invoiceId)
    .eq("user_id", authz.user.id)
    .maybeSingle();
  if (!invoice?.receipt_url) return NextResponse.json({ error: "Justificatif introuvable" }, { status: 404 });
  const { data, error } = await db.storage.from("receipts").createSignedUrl(invoice.receipt_url, 60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-f0-9]{12,64}$/i.test(code)) return new Response("Facture introuvable", { status: 404 });
  const db = createSupabaseAdmin();
  const { data: invoice } = await db.from("invoices").select("*").eq("code", code).maybeSingle();
  if (!invoice) return new Response("Facture introuvable", { status: 404 });
  const { data: profile } = await db.from("user_profiles").select("company_name,first_name,last_name").eq("user_id", invoice.user_id).maybeSingle();
  const brand = profile?.company_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "SubResell";
  const pdf = await PDFDocument.create(); const page = pdf.addPage([595, 842]); const regular = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const draw = (text: string, x: number, y: number, size = 11, strong = false, color = rgb(.12,.13,.15)) => page.drawText(text, { x, y, size, font: strong ? bold : regular, color });
  draw(brand, 48, 790, 11, true, rgb(.1,.55,.35)); draw("FACTURE", 48, 748, 28, true); draw(`N° ${String(invoice.number).padStart(4, "0")}`, 48, 725, 10);
  draw(`Émise le ${new Date(invoice.created_at).toLocaleDateString("fr-FR")}`, 395, 790, 10); draw(`Statut : ${(invoice.status || "paid") === "paid" ? "Payée" : invoice.status === "refunded" ? "Remboursée" : "Annulée"}`, 395, 770, 10, true);
  page.drawLine({ start: { x: 48, y: 700 }, end: { x: 547, y: 700 }, thickness: 1, color: rgb(.85,.86,.88) });
  draw("CLIENT", 48, 670, 9, true, rgb(.45,.47,.5)); draw(invoice.client_name, 48, 648, 13, true); if (invoice.client_phone) draw(invoice.client_phone, 48, 630, 10); if (invoice.client_email) draw(invoice.client_email, 48, 613, 10);
  draw("DESCRIPTION", 48, 550, 9, true, rgb(.45,.47,.5)); draw("PÉRIODE", 280, 550, 9, true, rgb(.45,.47,.5)); draw("MONTANT", 455, 550, 9, true, rgb(.45,.47,.5));
  draw(`Abonnement ${invoice.service_name}`, 48, 520, 11); draw(`${new Date(invoice.period_start).toLocaleDateString("fr-FR")} - ${new Date(invoice.period_end).toLocaleDateString("fr-FR")}`, 280, 520, 10); draw(`${Number(invoice.amount).toLocaleString("fr-FR")} FCFA`, 455, 520, 11, true);
  page.drawLine({ start: { x: 48, y: 480 }, end: { x: 547, y: 480 }, thickness: 1, color: rgb(.85,.86,.88) }); draw("TOTAL", 380, 445, 12, true); draw(`${Number(invoice.amount).toLocaleString("fr-FR")} FCFA`, 455, 445, 16, true);
  if (invoice.payment_rail) draw(`Réglé via ${invoice.payment_rail}`, 48, 445, 10); if (invoice.payment_reference) draw(`Référence paiement : ${invoice.payment_reference}`, 48, 425, 9);
  const invoiceUrl = `${new URL(request.url).origin}/facture/${code}`; const qr = await QRCode.toDataURL(invoiceUrl, { width: 180, margin: 1 }); const qrImage = await pdf.embedPng(Buffer.from(qr.split(",")[1], "base64")); page.drawImage(qrImage, { x: 48, y: 80, width: 90, height: 90 }); draw("Vérifier la facture", 48, 62, 9);
  draw("Merci pour votre confiance.", 390, 62, 9); const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="facture-${String(invoice.number).padStart(4, "0")}.pdf"`, "Cache-Control": "private, no-store" } });
}

import { InvoiceActions } from "@/components/InvoiceActions";
import { ProviderGlyph } from "@/components/ProviderGlyph";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { formatDate } from "@/lib/dates";
import { getProviderTheme, hexToRgba } from "@/lib/providers";
import type { Invoice } from "@/lib/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getInvoice(code: string): Promise<Invoice | null> {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase.from("invoices").select("*").eq("code", code).maybeSingle();
  return (data as Invoice | null) ?? null;
}

export default async function InvoicePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invoice = await getInvoice(code);
  if (!invoice) return notFound();

  const fmt = (n: number) => n.toLocaleString("en-US").replace(/,/g, " ");
  const kindLabel = invoice.kind === "new" ? "Nouvel abonnement" : "Renouvellement";
  const theme = getProviderTheme(invoice.service_name);
  const brand = theme.bg;
  const brandTint = hexToRgba(brand, 0.06);
  const brandTintStrong = hexToRgba(brand, 0.12);

  return (
    <div className="invoice-page">
      <InvoiceActions invoice={invoice} />

      <div
        className="invoice-sheet"
        style={{ borderTop: `6px solid ${brand}` }}
      >
        <header className="invoice-header">
          <div>
            <div className="invoice-eyebrow" style={{ color: brand }}>
              {invoice.reseller_name ?? "subresell"}
            </div>
            <h1 className="invoice-title">Facture</h1>
            <div className="invoice-number">
              N° {String(invoice.number).padStart(4, "0")}
            </div>
          </div>
          <div className="invoice-date">
            <div className="invoice-label">Émise le</div>
            <div className="invoice-value">{formatDate(invoice.created_at)}</div>
          </div>
        </header>

        <section className="invoice-parties">
          <div>
            <div className="invoice-label">De</div>
            <div className="invoice-party-name">{invoice.reseller_name ?? "Revendeur"}</div>
          </div>
          <div>
            <div className="invoice-label">Pour</div>
            <div className="invoice-party-name">{invoice.client_name}</div>
            {invoice.client_phone && <div className="invoice-party-detail">{invoice.client_phone}</div>}
            {invoice.client_email && <div className="invoice-party-detail">{invoice.client_email}</div>}
          </div>
        </section>

        <section className="invoice-line">
          <div
            className="invoice-line-head"
            style={{
              background: `linear-gradient(90deg, ${brandTintStrong}, ${brandTint} 70%, transparent)`,
              borderLeft: `3px solid ${brand}`,
              padding: "14px 16px",
              borderRadius: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <ProviderGlyph name={invoice.service_name} size={44} />
              <div>
                <div className="invoice-service-name" style={{ color: brand }}>
                  {invoice.service_name}
                </div>
                <div className="invoice-service-meta">
                  {invoice.service_slot ?? "Profil"} · {kindLabel}
                </div>
              </div>
            </div>
          </div>

          <table className="invoice-table">
            <colgroup>
              <col className="col-desc" />
              <col className="col-period" />
              <col className="col-amount" />
            </colgroup>
            <thead>
              <tr>
                <th>Description</th>
                <th>Période</th>
                <th className="num">Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Abonnement {invoice.service_name}
                  {invoice.service_slot ? ` — ${invoice.service_slot}` : ""}
                </td>
                <td>
                  {formatDate(invoice.period_start)} → {formatDate(invoice.period_end)}
                </td>
                <td className="num">{fmt(invoice.amount)} FCFA</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="invoice-total">
          <div className="invoice-total-row">
            <span>Total</span>
            <span className="invoice-total-amount">{fmt(invoice.amount)} FCFA</span>
          </div>
          {invoice.payment_rail && (
            <div className="invoice-payment">Réglé via {invoice.payment_rail}</div>
          )}
        </section>

        <footer className="invoice-footer">
          <div>Merci pour votre confiance.</div>
          <div className="invoice-footer-code">Réf. {invoice.code}</div>
        </footer>
      </div>
    </div>
  );
}

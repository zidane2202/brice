import type { SupabaseClient } from "@supabase/supabase-js";

/** Rang de la facture chez ce client (1 = sa première), le numéro officiel restant unique par vendeur. */
export async function clientInvoiceRank(
  db: SupabaseClient,
  invoice: { user_id: string; client_id: string | null; number: number }
): Promise<number | null> {
  if (!invoice.client_id) return null;
  const { count, error } = await db
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", invoice.user_id)
    .eq("client_id", invoice.client_id)
    .lte("number", invoice.number);
  return error || !count ? null : count;
}

export function clientInvoiceLabel(rank: number) {
  return rank === 1 ? "1re facture de ce client" : `${rank}e facture de ce client`;
}

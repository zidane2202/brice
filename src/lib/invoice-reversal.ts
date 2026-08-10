export type ReversibleInvoice = {
  id: string;
  amount: number;
  kind: string;
  status: string;
  subscription_id: string | null;
};

export type ReversibleTx = {
  amount: number;
  source: string;
  subscription_id: string | null;
  invoice_id?: string | null;
};

export function expectedInvoiceKind(source: string) {
  return source === "profile_renewal" ? "renewal" : "new";
}

export function pickInvoiceToCancel(invoices: ReversibleInvoice[], tx: ReversibleTx) {
  if (tx.invoice_id) {
    return invoices.find((invoice) => invoice.id === tx.invoice_id) ?? null;
  }
  if (!tx.subscription_id) return null;
  const kind = expectedInvoiceKind(tx.source);
  const matches = invoices.filter(
    (invoice) =>
      invoice.subscription_id === tx.subscription_id &&
      invoice.status === "paid" &&
      invoice.kind === kind &&
      Number(invoice.amount) === Number(tx.amount),
  );
  return matches.at(-1) ?? null;
}

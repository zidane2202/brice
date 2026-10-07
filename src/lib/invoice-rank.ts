/** Rang de la facture chez ce client (1 = sa première) ; le numéro officiel reste unique par vendeur. */
export function clientInvoiceLabel(rank: number) {
  return rank === 1 ? "1re facture de ce client" : `${rank}e facture de ce client`;
}

# Plan d'implémentation — Crédit client + P&L réel

**Spec :** `2026-08-11-compta-credit-pnl-design.md`

---

## Phase 1 — Schema + migration SQL

**Fichier :** `supabase/compta-credit-migration.sql` (NEW)

1. Étendre `invoices_status_check` : ajouter `'unpaid'`, `'partially_paid'`
2. Ajouter `invoices.amount_paid` (numeric, default 0)
3. Rétro-compat : `UPDATE invoices SET amount_paid = amount WHERE status = 'paid' AND amount_paid = 0`
4. Étendre `transactions_source_check` : ajouter `'invoice_payment'`

**Vérification :** coller dans Supabase, vérifier pas d'erreur.

---

## Phase 2 — Types TS

**Fichier :** `src/lib/types.ts`

1. `Invoice.status` → `"unpaid" | "partially_paid" | "paid" | "cancelled" | "refunded"`
2. `Invoice.amount_paid: number`
3. `TransactionSource` → ajouter `"invoice_payment"`

---

## Phase 3 — Lib compta / invoices

### 3a. `src/lib/invoices.ts`
- `createInvoice` accepte `amountPaid?: number`
- Si `amountPaid` fourni et < amount → `status = amountPaid > 0 ? 'partially_paid' : 'unpaid'`
- Sinon (défaut) → `status = 'paid'`, `amount_paid = amount`

### 3b. `src/lib/comptabilite.ts`
- Ajouter `computeProfit(txs, from, to): number`
- Ajouter label source `invoice_payment: "Encaissement facture"`

### 3c. `src/lib/invoice-reversal.ts`
- Pas de changement structurel, mais `pickInvoiceToCancel` doit aussi matcher `partially_paid` (pas juste `paid`)

---

## Phase 4 — Server actions

### 4a. `src/app/actions/comptabilite.ts` — nouvelle action `recordInvoicePayment`
- Inputs : `invoice_id`, `amount`, optionnel `payment_rail`
- Valider ownership, montant > 0, pas de dépassement
- Insérer transaction `source='invoice_payment'`
- Mettre à jour `invoices.amount_paid` + dériver statut
- revalidatePath

### 4b. `src/app/actions/comptabilite.ts` — adapter `reverseTransaction`
- Si `original.source === 'invoice_payment'` :
  - Décrémenter `amount_paid` sur la facture liée
  - Recalculer statut (pas cancel)
- Sinon : comportement existant inchangé

### 4c. `src/app/actions/clients.ts` — `addClientWithSubscription`
- Lire `amount_received` depuis formData (défaut = price)
- Si `amount_received < price` :
  - Créer facture avec `amountPaid = amount_received`
  - Transaction montant = `amount_received`, source = `'invoice_payment'` (si partiel) ou `'new_profile'` (si total)
- Si `amount_received == 0` : facture `unpaid`, pas de transaction income

### 4d. `src/app/actions/subscriptions.ts` — `renewClientSubscription`
- Même pattern : lire `amount_received` (défaut = prix abo)
- Adapter création facture + transaction

---

## Phase 5 — UI KPI (P&L)

### 5a. `src/components/comptabilite/ComptaKpis.tsx`
- Accepter prop `profit: number`
- 5e KpiCard : "Bénéfice réel"

### 5b. `src/components/comptabilite/ComptaView.tsx`
- Prop `profit`
- Passer à `ComptaKpis`

### 5c. `src/app/(app)/comptabilite/page.tsx`
- Calculer `profit` via `computeProfit(txs, from, to)`
- Passer à `ComptaView`

### 5d. `src/app/(app)/comptabilite/rapport/page.tsx`
- Même chose pour le rapport imprimable

---

## Phase 6 — UI Client (badge + encaisser)

### 6a. `src/components/clients/ClientDrawer.tsx`
- Badge facture avec les 5 statuts (couleurs)
- Bouton/formulaire "Encaisser" sur factures `unpaid` / `partially_paid`
- Input montant pré-rempli = `invoice.amount - invoice.amount_paid`
- Appelle `recordInvoicePayment`

### 6b. Formulaire de vente (si existant)
- Champ optionnel "Montant reçu" (défaut = prix)

---

## Phase 7 — Tests + vérification

1. `tsc --noEmit` (zéro erreur)
2. Tests unitaires existants passent
3. Test manuel : créer vente à crédit, encaisser partiellement, vérifier KPI
4. Vérifier reversal d'un encaissement partiel

---

## Ordre d'exécution

```
Phase 1 (SQL) → Phase 2 (types) → Phase 3 (libs) → Phase 4 (actions) → Phase 5 (KPI UI) → Phase 6 (client UI) → Phase 7 (tests)
```

Chaque phase est indépendante une fois la précédente terminée. Phases 5 et 6 peuvent être parallélisées.

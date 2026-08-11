# Design — Crédit client + P&L réel

**Date :** 2026-08-11  
**Scope :** SubResell comptabilité v2  
**Décisions validées :** approche 1 (facture = source de vérité), acompte partiel, abo actif immédiat, statuts `unpaid/partially_paid/paid`, 5 KPI cartes.

---

## 1. Crédit client (paiement partiel)

### 1.1 Schema — `invoices`

```sql
-- Étendre le check statut
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('unpaid','partially_paid','paid','cancelled','refunded'));

-- Nouveau champ : montant encaissé cumulé
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) NOT NULL DEFAULT 0;

-- Rétro-compat : factures existantes (toutes "paid") → amount_paid = amount
UPDATE public.invoices SET amount_paid = amount WHERE status = 'paid' AND amount_paid = 0;
```

### 1.2 Schema — `transactions`

```sql
-- Ajouter 'invoice_payment' comme source valide
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_source_check
  CHECK (source IN (
    'new_profile','profile_renewal','account_renewal',
    'manual_expense','reversal','invoice_payment'
  ));
```

### 1.3 Flux "vente" modifié

Lors de `addClientWithSubscription` :
1. Le formulaire expose un champ **"Montant reçu"** (défaut = prix total).
2. Si montant reçu < prix :
   - Facture créée avec `status = 'unpaid'` (si 0) ou `'partially_paid'` (si > 0), `amount_paid = montant_reçu`.
   - Transaction `income` créée seulement pour le montant effectivement reçu (pas le total).
   - `source = 'invoice_payment'`, `invoice_id` lié.
3. Si montant reçu == prix (cas actuel) :
   - Facture `status = 'paid'`, `amount_paid = amount`.
   - Transaction `income` inchangée (`source = 'new_profile'`).
4. L'abonnement s'active **immédiatement** dans tous les cas.

### 1.4 Flux "encaisser" (nouvelle action)

Nouveau server action : `recordInvoicePayment(formData)`

Inputs : `invoice_id`, `amount` (montant encaissé), optionnel `payment_rail`, `payment_reference`.

Logique :
1. Charger `invoice` (vérifier ownership via `user_id`).
2. Valider : `amount > 0`, `invoice.amount_paid + amount <= invoice.amount`.
3. Insérer `transactions` :
   - `kind = 'income'`
   - `source = 'invoice_payment'`
   - `affects_balance = true`
   - `amount = montant encaissé`
   - `invoice_id`, `client_id`, `subscription_id` (depuis la facture)
   - `label = "Encaissement facture N° XXXX"`
4. Mettre à jour `invoices` :
   - `amount_paid += montant`
   - `status` = dérivé :
     - `amount_paid == 0` → `'unpaid'`
     - `0 < amount_paid < amount` → `'partially_paid'`
     - `amount_paid >= amount` → `'paid'`
5. `revalidatePath` clients, comptabilité, dashboard.

### 1.5 Flux "renouvellement" modifié

`renewClientSubscription` : même logique — si le vendeur saisit un montant reçu < prix, on part en `partially_paid`.

### 1.6 Annulation / reversal adapté

Dans `reverseTransaction()` :
- Si `original.source === 'invoice_payment'` :
  - Décrémenter `invoices.amount_paid` du montant annulé.
  - Recalculer `invoices.status` (unpaid / partially_paid / paid).
  - Ne PAS mettre la facture en `cancelled` (juste le paiement partiel est annulé).
- Si `original.source` est `new_profile` / `profile_renewal` (vente initiale annulée) :
  - Continuer à mettre `invoices.status = 'cancelled'` (la facture entière est annulée).

### 1.7 UI — ClientDrawer / Journal

- Badge facture : `Impayée` (rouge), `Partiel` (orange), `Payée` (vert), `Annulée` (gris).
- Action "Encaisser" visible sur factures `unpaid` / `partially_paid` :
  - Input montant (pré-rempli avec le reste dû).
  - Bouton submit → `recordInvoicePayment`.
- Journal compta : les encaissements apparaissent avec source "Encaissement facture".

### 1.8 Types TS

```typescript
// types.ts — Invoice.status étendu
status: "unpaid" | "partially_paid" | "paid" | "cancelled" | "refunded";

// Nouveau champ
amount_paid: number;

// TransactionSource étendu
export type TransactionSource =
  | "new_profile"
  | "profile_renewal"
  | "account_renewal"
  | "manual_expense"
  | "reversal"
  | "invoice_payment";
```

---

## 2. P&L réel (bénéfice vs marge caisse)

### 2.1 Définitions

| KPI | Formule | Filtre |
|-----|---------|--------|
| Solde caisse | Σ(income) − Σ(outflow) si `affects_balance` | all time |
| Recettes (période) | Σ(income) sur période | `affects_balance = true` |
| Dépenses caisse (période) | Σ(outflow) sur période | `affects_balance = true` |
| Marge caisse (période) | Recettes − Dépenses caisse | — |
| **Bénéfice réel (période)** | Σ(income) − Σ(outflow) **toutes sorties** | période, pas de filtre `affects_balance` |

### 2.2 Implémentation

Nouveau helper dans `src/lib/comptabilite.ts` :

```typescript
export function computeProfit(
  txs: Pick<Transaction, "kind" | "amount" | "occurred_on">[],
  from: string,
  to: string
): number {
  let income = 0;
  let expenses = 0;
  for (const t of txs) {
    if (t.occurred_on < from || t.occurred_on > to) continue;
    const amt = Number(t.amount ?? 0);
    if (t.kind === "income") income += amt;
    else expenses += amt;
  }
  return income - expenses;
}
```

### 2.3 UI — 5 cartes KPI

```
┌──────────────┬──────────┬──────────────────┬──────────────┬─────────────────┐
│ Solde caisse │ Recettes │ Dépenses (caisse)│ Marge caisse │ Bénéfice réel   │
│   tone=info  │ tone=suc │   tone=warning   │ tone=suc/dng │  tone=suc/dng   │
│   (all time) │ (période)│    (période)     │  (période)   │   (période)     │
└──────────────┴──────────┴──────────────────┴──────────────┴─────────────────┘
```

### 2.4 Fichiers impactés

- `src/components/comptabilite/ComptaKpis.tsx` — 5e carte
- `src/components/comptabilite/ComptaView.tsx` — prop `profit`
- `src/app/(app)/comptabilite/page.tsx` — calcul `computeProfit`
- `src/app/(app)/comptabilite/rapport/page.tsx` — idem

---

## 3. Fichiers impactés (résumé)

| Fichier | Changement |
|---------|------------|
| `supabase/schema.sql` | status check, `amount_paid`, source check |
| `supabase/compta-credit-migration.sql` (NEW) | migration idempotente |
| `src/lib/types.ts` | Invoice + TransactionSource |
| `src/lib/invoices.ts` | `amount_paid`, status initial |
| `src/lib/comptabilite.ts` | `computeProfit`, labels source |
| `src/lib/invoice-reversal.ts` | adapter pour partial |
| `src/app/actions/clients.ts` | vente avec acompte |
| `src/app/actions/subscriptions.ts` | renouvellement avec acompte |
| `src/app/actions/comptabilite.ts` | `recordInvoicePayment` + reverse adapté |
| `src/components/comptabilite/ComptaKpis.tsx` | 5 cartes |
| `src/components/comptabilite/ComptaView.tsx` | prop profit |
| `src/components/clients/ClientDrawer.tsx` | badge + encaisser |
| `src/app/(app)/comptabilite/page.tsx` | profit KPI |
| `src/app/(app)/comptabilite/rapport/page.tsx` | profit KPI |

---

## 4. Hors scope v1

- Lien grâce ↔ crédit (pas pour maintenant)
- Frais MoMo auto-déduits
- Période libre (custom range)
- PDF natif (on garde print)

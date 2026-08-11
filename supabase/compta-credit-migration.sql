-- Comptabilité v2 : crédit client + encaissements partiels
-- À coller APRÈS audit4-hardening.sql

BEGIN;

-- 1. Étendre les statuts de facture
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('unpaid','partially_paid','paid','cancelled','refunded'));

-- 2. Montant encaissé cumulé
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) NOT NULL DEFAULT 0;

-- 3. Rétro-compat : factures existantes déjà payées
UPDATE public.invoices SET amount_paid = amount WHERE status = 'paid' AND amount_paid = 0;

-- 4. Nouvelle source de transaction : encaissement facture
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_source_check
  CHECK (source IN (
    'new_profile',
    'profile_renewal',
    'account_renewal',
    'manual_expense',
    'reversal',
    'invoice_payment'
  ));

COMMIT;

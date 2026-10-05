-- Règle des places : un abonnement expiré libère sa place (sauf grâce en cours).
-- Les ventes expirées gardent le statut 'active' pour l'historique : un index unique sur
-- (slot_id) where status in ('active','grace') bloquerait la revente d'une place libérée.
-- À exécuter une fois dans Supabase (SQL Editor). Idempotent.
drop index if exists public.client_subscriptions_one_active_slot_idx;

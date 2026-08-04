# Cycle de vie pack SaaS — Design Spec

**Date:** 2026-08-04  
**Statut:** Validé (implémentation)

## Objectif

Gérer l’échéance du **pack SubResell** (Pro/Business), distinct des rappels clients/comptes provider déjà en place.

1. Date `plan_renews_on`
2. Rappel push ~3 jours avant
3. Auto-suspend si dépassé sans renouvellement

## Données

```sql
alter table public.user_profiles
  add column if not exists plan_renews_on date;
alter table public.user_profiles
  add column if not exists plan_renewal_notified_on date;
```

- Free → `plan_renews_on` null  
- Paiement / activation Pro|Business → prolonger d’1 mois depuis `max(occurred_on, plan_renews_on actuel)`  
- `plan_renewal_notified_on` anti-spam rappel

## Cron (`/api/cron/reminders`)

En plus des clients :
- Rappel packs dont `plan_renews_on` ∈ [today, today+3] et plan payant et non suspendu
- Suspendre packs dont `plan_renews_on` < today, plan payant, non encore suspendu

## UI

Afficher échéance sur Finances + fiche vendeur.  
Pas de paiement gateway (manuel via journal).

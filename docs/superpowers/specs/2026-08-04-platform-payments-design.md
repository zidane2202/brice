# Journal d’encaissements plateforme — Design Spec

**Date:** 2026-08-04  
**Statut:** Validé  
**Suite de:** Admin Finances (MRR estimé). Paiement gateway = hors scope.

## Objectif

Enregistrer le **cash réel** reçu (WhatsApp / manuel) pour Pro, Business, extras, etc.  
Piloter sur `/admin/finances` + saisir depuis la fiche vendeur.

## Décisions

| Sujet | Choix |
|--|--|
| Nature | Encaissements **manuels** seulement (pas d’événements auto plan_change) |
| Saisie | **Les deux** : fiche vendeur + Finances |
| Appliquer le plan | Case **Appliquer aussi le plan** (défaut cochée) → update plan/extras + `suspended = false` |
| Motifs | Liste fixe + note libre (`other` → note obligatoire) |
| Stockage | Table dédiée `platform_payments` (pas `transactions` vendeur) |

## Hors scope

- MoMo / Wave / gateway
- Facture PDF plateforme
- Proration / annuel auto
- Cycle de vie échéance SaaS (chantier suivant)

## Schéma

```sql
create table if not exists public.platform_payments (
  id uuid primary key default gen_random_uuid(),
  reseller_user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  kind text not null check (kind in (
    'pro_monthly',
    'business_monthly',
    'extra_accounts',
    'other'
  )),
  note text,
  occurred_on date not null default (current_date),
  recorded_by uuid not null references auth.users(id),
  applied_plan text,
  applied_extras int,
  created_at timestamptz not null default now()
);

create index if not exists platform_payments_occurred_idx
  on public.platform_payments(occurred_on desc);
create index if not exists platform_payments_reseller_idx
  on public.platform_payments(reseller_user_id, occurred_on desc);
```

Accès : **service role / admin actions uniquement** (pas de RLS vendeur).

## UI

### `/admin/finances`
- KPI **Encaissé ce mois** (somme `platform_payments` du mois)
- Formulaire rapide (select vendeur + champs)
- Tableau journal (date, vendeur, kind, montant, note, admin)

### `/admin/vendeurs/[id]`
- Même formulaire (vendeur prérempli)
- Mini-historique des paiements de ce vendeur

### Formulaire
- `kind`, `amount` (prérempli depuis `PLAN_PRICES_FCFA` selon kind), `occurred_on`, `note`
- Checkbox `apply_plan` (défaut true) + si cochée : `plan` + `extra_provider_accounts` (si pro)

## Actions

`recordPlatformPayment(formData)` — admin only :
1. Insert `platform_payments`
2. Si `apply_plan` : update `user_profiles` plan/extras + `suspended = false`
3. Revalidate finances + fiche vendeur

## Tests manuels

1. Enregistrer Pro mensuel sur fiche → plan Pro, ligne journal, KPI mois
2. Extra accounts sans apply_plan → journal seul, plan inchangé
3. `other` sans note → erreur
4. Non-admin → refus

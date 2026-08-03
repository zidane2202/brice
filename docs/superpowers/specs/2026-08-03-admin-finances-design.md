# Admin Finances — Design Spec

**Date:** 2026-08-03  
**Statut:** Validé — implémentation en cours

## Objectif

Page `/admin/finances` pour piloter les packs SubResell côté plateforme :

1. **Catalogue** lecture seule (prix / limites depuis `src/lib/plans.ts`)
2. **Attribution / suspension** des packs aux vendeurs
3. **Vue revenus** : répartition Free / Pro / Business + MRR estimé + extras

## Décisions figées

| Sujet | Choix |
|--|--|
| Catalogue | **A** : pas d’édition des prix en admin (source = code) |
| Activation pack | Déjà sur `/admin/vendeurs/[id]` ; aussi depuis Finances (actions rapides) |
| Suspension | Flag `user_profiles.suspended` (bool). Plan + extras **conservés** |
| Effet suspendu | Connexion OK → page bloquante « compte suspendu, contactez l’admin » (pas l’app vendeur) |
| Paiement | Manuel (WhatsApp / admin). Pas de gateway en V1 |

## Hors scope V1

- Édition des prix en UI
- Historique de paiements / factures SaaS
- Proration, annuel auto
- MoMo / Wave

## Données

```sql
alter table public.user_profiles
  add column if not exists suspended boolean not null default false;
```

MRR estimé (formule) :

- Free → 0
- Pro → `10_000 + extra_provider_accounts * 2_000`  
  (pack ×3 déjà stocké comme `extra = 3` → 6 000 extras ; ok pour V1)
- Business → `22_500` (milieu de fourchette 20–25k, aligné `PLAN_PRICES_FCFA.business`)
- Suspendus → **exclus du MRR** (mais visibles dans un filtre / compteur)

## UI `/admin/finances`

Style = shell admin existant (dark).

1. **KPIs** : MRR estimé · # Pro · # Business · # Free · # Suspendus  
2. **Catalogue** : 3 packs + extras (prix/limites, lecture seule)  
3. **Table vendeurs** : email, plan, extras, MRR ligne, statut actif/suspendu  
   - Actions : changer plan / extras (lien fiche ou form inline)  
   - Boutons **Suspendre** / **Réactiver**  
4. Lien sidebar Admin : **Finances**

## Page bloquante vendeur

Si `suspended === true` et rôle reseller :

- Middleware / layout `(app)` : ne pas rendre le shell app  
- Afficher écran plein : message + contact WhatsApp admin / support  
- Admin (`/admin/*`) non bloqué même si son profil a `suspended` (edge case)

## Fichiers

| Fichier | Rôle |
|--|--|
| `src/app/admin/finances/page.tsx` | Page |
| `src/app/actions/admin.ts` | `setResellerSuspended`, réutiliser update plan |
| `src/components/AdminSidebar.tsx` | Lien Finances |
| `src/app/(app)/layout.tsx` | Gate suspended |
| `src/components/SuspendedGate.tsx` | Écran bloquant |
| `supabase/schema.sql` | colonne `suspended` |
| `src/lib/plans.ts` | helper `estimateMrrFcfa(plan, extras)` |

## Tests manuels

1. Admin → Finances : KPIs + catalogue visibles  
2. Suspendre un vendeur → login OK → page suspendue  
3. Réactiver → accès app  
4. Changer Pro + extras → MRR ligne / total cohérents  
5. Build OK  

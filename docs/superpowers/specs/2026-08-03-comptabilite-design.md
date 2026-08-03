# Module Comptabilité — Design Spec

**Date:** 2026-08-03  
**Stack:** Next.js 16 + TypeScript + Tailwind CSS + Supabase  
**Approche:** Étendre la table `transactions` existante (pas de ledger séparé)

---

## 1. Objectif

Ajouter un module **Comptabilité** pour chaque revendeur, avec :

1. **Vue d’ensemble** — solde, recettes, dépenses, marge sur une période
2. **Journal** — historique filtrable de toutes les écritures
3. **Dépenses manuelles** — charges hors renouvellement de comptes (toujours débitées du solde)
4. **Exports** — CSV + PDF pour la période filtrée

Le dashboard existant garde ses KPIs légers ; le détail comptable vit dans `/comptabilite`.

---

## 2. Architecture

| Élément | Choix |
|---------|--------|
| Route | `/comptabilite` dans le layout `(app)` |
| Accès | Revendeur authentifié (même gate que dashboard / clients) |
| Source de vérité | Table `transactions` |
| Nav | Entrée « Comptabilité » dans `Sidebar` + label dans `TopBar` |
| Mutations | Server Actions (`src/app/actions/comptabilite.ts`) |
| Style | Réutilise `panel`, `stats-grid`, variables `--sr-*` |

### Hors V1

- Édition / suppression des écritures automatiques (ventes, renouvellements)
- Apports manuels (`manual_income`)
- TVA / impôts
- Multi-devises
- Catégories personnalisables (CRUD)

---

## 3. Schéma de données

### Migrations sur `transactions`

```sql
-- Élargir les sources autorisées
alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in (
    'new_profile',
    'profile_renewal',
    'account_renewal',
    'manual_expense'
  ));

-- Catégorie de dépense (nullable pour les écritures auto historiques)
alter table public.transactions add column if not exists category text;

alter table public.transactions drop constraint if exists transactions_category_check;
alter table public.transactions add constraint transactions_category_check
  check (
    category is null or category in (
      'account_renewal',
      'data',
      'ads',
      'momo_fees',
      'rent',
      'other'
    )
  );
```

### Mapping catégorie ↔ libellé UI

| `category` | Libellé |
|------------|---------|
| `account_renewal` | Renouvellement compte |
| `data` | Data / Internet |
| `ads` | Publicité |
| `momo_fees` | Frais MoMo / paiement |
| `rent` | Loyer |
| `other` | Autre |

Les renouvellements de comptes existants (`source = account_renewal`) peuvent recevoir `category = 'account_renewal'` à l’écriture (backfill optionnel hors V1 critique).

### Types TypeScript (`src/lib/types.ts`)

- Étendre `TransactionSource` avec `"manual_expense"`
- Ajouter `ExpenseCategory` et `category: ExpenseCategory | null` sur `Transaction`

---

## 4. Interface

### Page `/comptabilite`

Trois blocs verticaux :

1. **KPIs** (`ComptaKpis`) — Solde global · Recettes période · Dépenses période · Marge période  
2. **Formulaire** (`AddExpenseForm`) — montant FCFA, catégorie, note, date  
3. **Journal** (`ComptaJournal`) — tableau + filtres + Export CSV / PDF

### Filtres période

- Défaut : mois calendaire en cours
- Contrôle : sélecteur mois/année (ou `date_from` / `date_to` simples)

### Journal — colonnes

Date · Libellé · Catégorie · Type (entrée / sortie) · Montant · Source

Filtres journal : type (`income` / `outflow` / tous) · catégorie · recherche texte sur `label`

### Formulaire dépense

| Champ | Règle |
|-------|--------|
| Montant | Obligatoire, > 0 |
| Catégorie | Liste fixe ci-dessus |
| Note / libellé | Obligatoire si catégorie = `other` ; sinon optionnel (sinon libellé dérivé de la catégorie) |
| Date | Défaut = aujourd’hui ; stockée via `created_at` ou colonne dédiée si besoin de backdate (V1 : utiliser un champ `occurred_on date` si backdate requis — **décision : `occurred_on date not null default current_date`** pour permettre une date différente de `created_at`) |

Ajout colonne :

```sql
alter table public.transactions
  add column if not exists occurred_on date not null default (current_date);
```

Les écritures auto existantes : `occurred_on = created_at::date` (backfill SQL à la migration). Filtres période et exports utilisent `occurred_on`.

---

## 5. Flux données

### Lecture (page serveur)

1. `getUser()` ; redirect login si absent
2. Charger transactions user (filtres période sur `occurred_on`)
3. Calculer :
   - **Solde** = Σ (`income` − `outflow`) où `affects_balance = true` (toutes dates)
   - **Recettes période** = Σ `amount` où `kind = income` et `occurred_on` dans période
   - **Dépenses période** = Σ `amount` où `kind = outflow` et `affects_balance = true` et `occurred_on` dans période
   - **Marge** = recettes − dépenses

### Écriture — `addManualExpense`

Insert :

```ts
{
  kind: "outflow",
  source: "manual_expense",
  category,
  label, // note ou libellé catégorie
  amount,
  funded_by: "balance",
  affects_balance: true,
  occurred_on,
}
```

**Erreurs :**

- Montant invalide / catégorie invalide / note manquante si `other`
- Solde insuffisant → message explicite (même logique que `renewProviderAccount`)
- `revalidatePath("/comptabilite")` et chemins qui affichent le solde (layout / dashboard)

### Exports

| Format | Comportement |
|--------|----------------|
| CSV | Téléchargement du journal **filtré** (période + filtres UI) ; colonnes alignées sur le tableau |
| PDF | Rapport période : en-tête (revendeur / période) + KPIs + liste des écritures ; généré côté serveur ou via route dédiée + print CSS |

Implémentation V1 (figée) :

- **CSV** : helper `buildComptaCsv(...)` côté client ou serveur ; bouton qui déclenche un téléchargement blob (`text/csv`) du journal actuellement filtré (pas de route API dédiée).
- **PDF** : page `/comptabilite/rapport` print-friendly (mêmes filtres en query string) ; bouton « Exporter PDF » ouvre la page ; l’utilisateur imprime / enregistre en PDF via le navigateur. Pas de lib PDF serveur en V1.

---

## 6. Fichiers impactés

| Fichier | Rôle |
|---------|------|
| `supabase/schema.sql` | Migrations `source`, `category`, `occurred_on` |
| `src/lib/types.ts` | Types étendus |
| `src/lib/comptabilite.ts` (nouveau) | Catégories, labels, helpers KPIs / CSV |
| `src/app/actions/comptabilite.ts` (nouveau) | `addManualExpense` |
| `src/app/(app)/comptabilite/page.tsx` (nouveau) | Page serveur |
| `src/components/comptabilite/*` (nouveau) | KPIs, form, journal, export |
| `src/app/(app)/comptabilite/rapport/page.tsx` (nouveau) | Rapport print / PDF |
| `src/components/Sidebar.tsx` | Lien nav |
| `src/components/TopBar.tsx` | Label route |
| `src/app/actions/accounts.ts` | Optionnel : poser `category` / `occurred_on` sur renouvellements |

---

## 7. Gestion des erreurs & edge cases

- Solde insuffisant à la saisie de dépense → pas d’insert
- Période sans transactions → KPIs à 0, journal vide (état vide clair)
- Catégorie `other` sans note → rejet validation
- Exports avec filtres vides → fichier avec en-têtes seulement + KPIs à 0
- RLS / admin client : même pattern que dashboard (`createSupabaseAdmin` + filtre `user_id`)

---

## 8. Tests (manuel V1)

1. Build `npm run build` OK
2. Ajouter dépense catégorie fixe → apparaît journal, solde diminue
3. Ajouter dépense `other` sans note → erreur
4. Dépenser plus que le solde → erreur
5. Filtrer mois / type / catégorie → journal et KPIs cohérents
6. Export CSV ouvre un fichier cohérent
7. Rapport PDF / print affiche KPIs + lignes de la période
8. Vente / renouvellement existants restent visibles dans le journal

---

## 9. Ordre de livraison suggéré

1. Migration schéma + types
2. Page + KPIs + journal (lecture)
3. Formulaire dépense + solde
4. Nav Sidebar / TopBar
5. Export CSV + page rapport PDF
6. Build + smoke test manuel

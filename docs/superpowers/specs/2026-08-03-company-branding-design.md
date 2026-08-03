# Marque entreprise (reçu + sidebar) + favicon app — Design Spec

**Date:** 2026-08-03  
**Stack:** Next.js 16 + TypeScript + Supabase (Postgres + Storage)  
**Chantier:** 1 / 4 (ensuite : dashboard admin, fiche vendeur, actions admin)

---

## 1. Objectif

Pour chaque revendeur :

1. Afficher **nom d’entreprise** + **logo** sur la facture (`/facture/[code]`) et dans la **sidebar** opérateur
2. Résoudre le logo en live depuis le profil (pas de snapshot à l’émission)
3. Fournir un **favicon navigateur** = le **S** subresell (marque produit), indépendant du logo entreprise

---

## 2. Décisions produit

| Sujet | Choix |
|-------|--------|
| Source logo | Upload Storage **prioritaire**, sinon URL manuelle |
| Emplacements marque | Facture + sidebar opérateur |
| Favicon | Asset app **S** (pas le logo entreprise) |
| Factures anciennes | Suivent le profil **actuel** (live) |
| Admin chrome | Reste « subresell » + S (pas de marque vendeur) |

---

## 3. Architecture

### Schéma

```sql
alter table public.user_profiles
  add column if not exists logo_url text;
```

`company_name` existe déjà.

### Storage

- Bucket public : `logos`
- Chemin objet : `{user_id}/logo.{ext}` (png | jpg | jpeg | webp)
- Taille max upload : 2 Mo
- Policies :
  - `SELECT` public (ou authenticated) pour lecture URL publique
  - `INSERT` / `UPDATE` / `DELETE` : seul le owner (`auth.uid() = user_id` du préfixe path)

### Résolution affichage

```
effectiveLogo = profile.logo_url (non vide) ? profile.logo_url : null
effectiveName = profile.company_name?.trim() || reseller_name snapshot || "subresell"
```

Sur facture : charger `user_profiles` via `invoice.user_id` ; fallback `invoice.reseller_name` pour le nom si profil sans `company_name`.

Sur sidebar : props depuis `(app)/layout.tsx` (déjà charge le profil).

---

## 4. Interface

### Profil — bloc « Marque »

- Aperçu logo (ou placeholder S)
- Input file (accept `image/png,image/jpeg,image/webp`)
- Champ `logo_url` (URL manuelle) — utilisé si pas d’upload / pour coller un CDN
- Bouton « Retirer le logo »
- `company_name` existant avec hint : apparaît sur factures et sidebar

### Sidebar opérateur

- Remplacer le span « S » par `<img>` 24×24 si `logo_url`
- Eyebrow : `company_name` sinon `subresell`
- Badge Beta conservé

### Facture

- Header : logo (si dispo) à côté / au-dessus du nom entreprise
- Parties « De » : même nom entreprise
- Pas de changement du thème couleur service (ProviderGlyph inchangé)

### Favicon

- Ajouter `src/app/icon.tsx` (ImageResponse ou SVG) générant le **S** mint sur fond dégradé — onglet navigateur
- Optionnel : `apple-icon` même motif

---

## 5. Flux données

### Lecture

- `(app)/layout.tsx` : passer `companyName` + `logoUrl` à `Sidebar`
- `/facture/[code]` : en plus de l’invoice, `select` profil `user_id` → logo + company_name

### Écriture

| Action | Comportement |
|--------|----------------|
| `updateProfile` | Inclut `logo_url` texte (trim, vide → null) ; revalidate `/profil`, layout paths |
| `uploadCompanyLogo(formData)` | Valide type/taille → upload Storage → public URL → update `logo_url` |
| `removeCompanyLogo()` | Delete objet Storage si path connu + `logo_url = null` |

Règle priorité : un upload réussi **écrase** l’URL manuelle précédente.

### Erreurs

- Non-image / > 2 Mo → `{ error: "..." }` sans toucher la DB
- Échec Storage → pas de mise à jour `logo_url`
- Image cassée au rendu → `onError` fallback vers S / initiales

---

## 6. Fichiers impactés

| Fichier | Rôle |
|---------|------|
| `supabase/schema.sql` | `logo_url` + notes bucket policies |
| `src/lib/types.ts` | `logo_url` sur profil |
| `src/app/actions/profile.ts` | update + upload + remove |
| `src/components/profil/ProfilView.tsx` | UI marque |
| `src/components/Sidebar.tsx` | Logo + nom |
| `src/app/(app)/layout.tsx` | Passer props marque |
| `src/app/facture/[code]/page.tsx` | Logo + nom live |
| `src/app/icon.tsx` (nouveau) | Favicon S |
| `src/components/AdminSidebar.tsx` | Inchangé (marque app) |

---

## 7. Hors V1

- Crop / éditeur d’image
- Snapshot logo figé sur `invoices`
- Logo dans TopBar
- Watermark PDF
- Multi-entreprises par user

---

## 8. Tests manuels

1. Définir `company_name` → sidebar + facture affichent le nom
2. Upload logo → sidebar + facture affichent l’image
3. Retirer logo → retour au S / texte
4. URL manuelle seule → affichée
5. Favicon onglet = S subresell
6. Admin sidebar inchangé
7. `npm run build` OK

---

## 9. Suite roadmap

Après ce chantier (implémenté + merge) :

2. Dashboard admin riche (A)  
3. Fiche vendeur `/admin/vendeurs/[id]` (B)  
4. Actions admin plan/rôle/suspension (D)

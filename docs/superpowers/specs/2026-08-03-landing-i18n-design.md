# Landing SubResell + i18n (next-intl) — Design Spec

**Date:** 2026-08-03  
**Stack:** Next.js 16 App Router, next-intl, Tailwind / CSS vars existants

## Objectif

1. Landing marketing publique sur `/` (visiteurs)
2. Utilisateurs connectés sur `/` → redirect `/dashboard`
3. i18n **FR / EN** via **next-intl** (landing d’abord, puis app)
4. Contact WhatsApp (`NEXT_PUBLIC_SUPPORT_WHATSAPP` déjà en place)
5. Pricing aligné sur `src/lib/plans.ts`

## Hors ce chantier

- Chatbot / RAG / passage humain → **Support** (après)
- Admin Finances (catalogue packs, MRR) → chantier dédié
- Blog → **non prévu**
- Paiement en ligne → plus tard (manuel WhatsApp / admin)

## Architecture

### Routing & auth

- `proxy.ts` : `/` (et évent. `/en`, `/fr` si préfixe) **publique**
- Non connecté + `/` → landing
- Connecté + `/` → `/dashboard`
- Auth pages restent publiques : login, signup, forgot/reset password

### i18n (option A — next-intl)

- Locales : `fr` (défaut), `en`
- Messages : `messages/fr.json`, `messages/en.json`
- Switcher FR/EN (cookie + navigation)
- **V1a** : landing 100 % traduite
- **V1b** : shell app (Sidebar, TopBar, labels plan)
- **V1c** : reste des écrans progressivement

### Pricing source

Affichage depuis constantes `PLAN_PRICES_FCFA` / `PLAN_LIMITS` (`src/lib/plans.ts`) pour éviter le drift.

## UI landing (clair / marketing)

Ordre des sections :

1. **Nav** — marque subresell, switcher FR/EN, Connexion, CTA Free  
2. **Hero** — marque dominante, 1 headline, 1 sous-texte, CTA « Commencer gratis » + « Voir les tarifs » ; fond atmosphérique full-bleed (pas de cards / overlays promo)  
3. **Produit** — un job : comptes provider, clients, factures, solde  
4. **Pricing** — Free / Pro (10 000 FCFA) / Business ; extras Pro (+2 000 / compte, +5 000 / 3)  
5. **Contact** — bouton Nous contacter → WhatsApp  
6. **Footer** — login/signup, Beta  

Motion : 2–3 animations sobres (entrée hero, hover CTA, reveal pricing).

Typo expressive (pas Inter/Roboto/Arial système seul) ; direction visuelle claire **sans** thème violet générique ni cream/terracotta cliché.

## Fichiers (indicatif)

| Fichier | Rôle |
|---------|------|
| `src/app/page.tsx` | Landing ou redirect si session |
| `src/proxy.ts` | `/` public |
| `src/components/landing/*` | Sections |
| `messages/fr.json`, `messages/en.json` | Copy |
| next-intl config / provider | Locale |

## Tests manuels

1. Déconnecté → `/` = landing FR  
2. Switch EN → copy anglaise  
3. CTA → `/signup`  
4. Contact → WhatsApp  
5. Connecté → `/` redirige dashboard  
6. Build OK  

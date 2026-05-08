# Subscription Reseller SaaS — Design Spec

**Date:** 2026-05-08  
**Stack:** Next.js 16 + TypeScript + Tailwind CSS + Supabase  
**Contexte:** App SaaS multi-tenant destinée aux revendeurs d'abonnements streaming (Netflix, Spotify, etc.). Chaque revendeur gère ses comptes provider, les profils/slots dans ces comptes, et les clients assignés à chaque slot. Le propriétaire de l'app dispose d'un panel admin global.

---

## 1. Base de données

### Schéma

```sql
-- Supabase Auth gère auth.users nativement

-- Profil utilisateur (revendeur ou admin)
create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'reseller' check (role in ('reseller', 'admin')),
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

-- Comptes provider achetés par le revendeur (ex: "Mon compte Netflix Premium")
create table public.provider_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_name text not null,
  max_slots int not null default 5,
  start_date date not null,
  end_date date not null,
  duration_months int not null default 1,
  cost numeric(10,2),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- Slots/profils dans un compte provider
create table public.account_slots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.provider_accounts(id) on delete cascade,
  slot_number int not null,
  label text not null default '',
  created_at timestamptz not null default now(),
  unique(account_id, slot_number)
);

-- Clients du revendeur
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

-- Abonnements vendus : un client loue un slot
create table public.client_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_id uuid not null references public.account_slots(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  duration_months int not null default 1,
  price numeric(10,2),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  last_notified_on date,
  created_at timestamptz not null default now()
);

-- Tokens push par utilisateur
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
```

### Row Level Security

Chaque table avec `user_id` a une policy RLS : `user_id = auth.uid()`. Les Server Actions utilisent le `service_role_key` qui bypass le RLS — la vérification du `user_id` est faite explicitement dans chaque action.

### Migration

Les tables existantes (`subscriptions` ancienne, `clients` sans `user_id`) sont remplacées par ce nouveau schéma. Pas de migration de données (projet en dev).

---

## 2. Authentification & Middleware

### Supabase Auth
- Méthode : email + mot de passe
- `/signup` → crée un compte Supabase Auth + insère un `user_profile` avec `role=reseller` via un trigger ou une Server Action post-signup
- `/login` → session Supabase gérée par cookies (SSR)
- Le compte admin est créé manuellement en base (`role=admin`)

### Middleware Next.js (`middleware.ts`)
- Vérifie la session Supabase sur chaque requête
- Routes publiques : `/login`, `/signup`
- Routes `/admin/*` : vérifient `role=admin`, redirigent vers `/dashboard` sinon
- Toutes autres routes → redirigent vers `/login` si non connecté

---

## 3. Navigation & Layout

### Structure de fichiers
```
src/app/
  (auth)/
    login/page.tsx
    signup/page.tsx
  (app)/
    layout.tsx          ← shell avec sidebar
    dashboard/page.tsx
    abonnements/
      page.tsx          ← liste des comptes provider
      [id]/page.tsx     ← détail d'un compte + slots
    clients/
      page.tsx          ← liste clients + subscriptions
  admin/
    layout.tsx          ← vérifie role=admin
    page.tsx            ← liste revendeurs
    revendeurs/[id]/page.tsx
```

### Sidebar
```
Logo / Nom app
─────────────
Dashboard
Mes abonnements
Mes clients
─────────────
[admin seulement]
Admin
  └ Revendeurs
─────────────
[avatar utilisateur]
Déconnexion
```

---

## 4. Pages & Fonctionnalités

### Dashboard (`/dashboard`)
- **Stats cards (4) :** clients actifs, revenus du mois, abonnements expirant ≤ 3 jours, slots occupés/total
- **Tableau urgences :** client · service · slot · date de fin · téléphone — pour relancer
- **Graphique revenus :** barres sur 6 mois (somme des `price` des subscriptions actives par mois)

### Mes abonnements (`/abonnements`)
- Liste des `provider_accounts` avec : service, durée, dates, coût, taux de remplissage (X/Y slots)
- Clic sur un compte → page détail : tableau des slots (libre ou client assigné + dates + statut)
- Formulaire "Nouveau compte" : service, nb slots, durée (1-12 mois), coût, date de début
- Actions par compte : renouveler (+N mois), désactiver
- Actions par slot : voir le client assigné, libérer le slot

### Mes clients (`/clients`)
- Liste de tous les clients avec leur abonnement actif en cours
- Colonnes : nom · téléphone · service · slot · date de fin · prix · statut · actions
- Formulaire "Nouveau client" : infos client + sélection d'un slot libre (dropdown groupé par service) + durée + prix
- Actions : renouveler (prolonge de N mois), annuler

### Admin (`/admin`)
- Liste tous les `user_profiles` avec `role=reseller` : email, date inscription, nb clients actifs, plan
- Fiche revendeur : stats globales (clients, revenus, comptes)
- Action : désactiver un compte (passe `plan=suspended` ou flag dédié)

---

## 5. Notifications Push

- Cron job quotidien : `GET /api/cron/reminders` (protégé par `CRON_SECRET`)
- Logique : cherche les `client_subscriptions` actifs où `end_date` est entre aujourd'hui et aujourd'hui+3 jours ET `last_notified_on != today`
- Pour chaque revendeur concerné : regroupe ses abonnements urgents et envoie une notification push groupée
- Met à jour `last_notified_on = today`
- Les `push_subscriptions` sont liés au `user_id` → chaque revendeur reçoit uniquement ses alertes
- Le `PushManager` composant demande la permission à la première visite (déjà implémenté, à adapter pour lier au `user_id`)

---

## 6. Variables d'environnement

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=       ← nouveau (pour Supabase Auth côté client)
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
CRON_SECRET=
```

---

## 7. Ce qui est hors scope (pour l'instant)

- Intégration Stripe / facturation des revendeurs
- Email de rappel (en complément du push)
- Application mobile
- Tableau de bord analytique avancé (rétention, churn)

# Subscription Reseller SaaS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer l'app de gestion d'abonnements en SaaS multi-tenant avec auth, sidebar, dashboard, gestion des comptes provider/slots/clients et panel admin.

**Architecture:** Supabase Auth pour l'authentification avec sessions cookie-based via `@supabase/ssr`. Chaque revendeur a ses données isolées par `user_id` + RLS. Le panel admin utilise le service role key. Les Server Actions Next.js gèrent toutes les mutations.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Supabase (Auth + Postgres + RLS), `@supabase/ssr`, web-push

---

## File Map

**Supprimer :**
- `src/app/page.tsx` → remplacé par `(app)/dashboard/page.tsx`
- `src/app/actions.ts` → remplacé par `src/app/actions/*.ts`
- `src/components/SubscriptionTable.tsx` → remplacé par nouveaux composants

**Créer :**
```
src/
  middleware.ts
  lib/
    supabase-browser.ts       ← client navigateur (anon key)
    supabase-server.ts        ← client serveur (cookies session)
    supabase-admin.ts         ← (existant, garder)
    types.ts                  ← remplacer entièrement
    dates.ts                  ← (existant, adapter)
  app/
    (auth)/
      layout.tsx
      login/page.tsx
      signup/page.tsx
    (app)/
      layout.tsx              ← shell + sidebar
      dashboard/page.tsx
      abonnements/
        page.tsx
        [id]/page.tsx
      clients/page.tsx
    admin/
      layout.tsx
      page.tsx
      revendeurs/[id]/page.tsx
    actions/
      auth.ts
      accounts.ts
      slots.ts
      clients.ts
      subscriptions.ts
    api/
      push/subscribe/route.ts ← adapter user_id
      cron/reminders/route.ts ← adapter nouveau schéma
  components/
    Sidebar.tsx
    StatsCard.tsx
    RevenueChart.tsx
    AccountCard.tsx
    SlotTable.tsx
    ClientTable.tsx
    UrgencyTable.tsx
supabase/
  schema.sql                  ← remplacer entièrement
```

---

## Phase 1 — Fondations (Schéma + Auth + Layout)

### Task 1: Nouveau schéma Supabase

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Remplacer le contenu de `supabase/schema.sql`**

```sql
create extension if not exists pgcrypto;

-- Profil utilisateur lié à auth.users
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'reseller' check (role in ('reseller', 'admin')),
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  unique(user_id)
);

-- Comptes provider (ex: "Mon Netflix Premium")
create table if not exists public.provider_accounts (
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
create table if not exists public.account_slots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.provider_accounts(id) on delete cascade,
  slot_number int not null,
  label text not null default '',
  unique(account_id, slot_number)
);

-- Clients du revendeur
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

-- Abonnements vendus : un client loue un slot
create table if not exists public.client_subscriptions (
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

-- Tokens push liés à un utilisateur
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

-- Index
create index if not exists provider_accounts_user_id_idx on public.provider_accounts(user_id);
create index if not exists client_subscriptions_user_id_end_date_idx on public.client_subscriptions(user_id, end_date);
create index if not exists client_subscriptions_slot_id_idx on public.client_subscriptions(slot_id);

-- RLS
alter table public.user_profiles enable row level security;
alter table public.provider_accounts enable row level security;
alter table public.account_slots enable row level security;
alter table public.clients enable row level security;
alter table public.client_subscriptions enable row level security;
alter table public.push_subscriptions enable row level security;

-- Policies (service role bypass automatique)
create policy "users see own profile" on public.user_profiles
  for all using (auth.uid() = user_id);

create policy "users see own accounts" on public.provider_accounts
  for all using (auth.uid() = user_id);

create policy "users see own slots" on public.account_slots
  for all using (
    exists (
      select 1 from public.provider_accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
  );

create policy "users see own clients" on public.clients
  for all using (auth.uid() = user_id);

create policy "users see own subscriptions" on public.client_subscriptions
  for all using (auth.uid() = user_id);

create policy "users see own push subs" on public.push_subscriptions
  for all using (auth.uid() = user_id);

-- Trigger: crée user_profile automatiquement à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (user_id)
  values (new.id);
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 2: Exécuter ce SQL dans le SQL Editor de Supabase**

  Coller et exécuter dans Supabase → SQL Editor. Vérifier que toutes les tables sont créées dans Table Editor.

- [ ] **Step 3: Ajouter `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans `.env.local`**

  Récupérer la clé dans Supabase → Settings → API → `anon public`. Ajouter :
  ```
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  ```

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql .env.local
git commit -m "feat: new multi-tenant schema with RLS and auth trigger"
```

---

### Task 2: Installer `@supabase/ssr` et mettre à jour les types

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/supabase-browser.ts`
- Create: `src/lib/supabase-server.ts`

- [ ] **Step 1: Installer le package**

```bash
npm install @supabase/ssr
```

Expected output: `added 1 package`

- [ ] **Step 2: Remplacer `src/lib/types.ts`**

```typescript
export type UserRole = "reseller" | "admin";

export type UserProfile = {
  id: string;
  user_id: string;
  role: UserRole;
  plan: string;
  created_at: string;
};

export type ProviderAccount = {
  id: string;
  user_id: string;
  service_name: string;
  max_slots: number;
  start_date: string;
  end_date: string;
  duration_months: number;
  cost: number | null;
  status: "active" | "inactive";
  created_at: string;
  slots?: AccountSlot[];
};

export type AccountSlot = {
  id: string;
  account_id: string;
  slot_number: number;
  label: string;
  active_subscription?: ClientSubscription | null;
};

export type Client = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export type ClientSubscription = {
  id: string;
  user_id: string;
  slot_id: string;
  client_id: string;
  start_date: string;
  end_date: string;
  duration_months: number;
  price: number | null;
  status: "active" | "cancelled";
  last_notified_on: string | null;
  created_at: string;
  client?: Client | null;
  slot?: AccountSlot & { account?: ProviderAccount } | null;
};
```

- [ ] **Step 3: Créer `src/lib/supabase-browser.ts`**

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Créer `src/lib/supabase-server.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

export async function getUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return data;
}
```

- [ ] **Step 5: Vérifier que `src/lib/supabase-admin.ts` exporte bien `createSupabaseAdmin`**

  Le fichier existant doit utiliser `SUPABASE_SERVICE_ROLE_KEY`. Ouvrir et vérifier — si ok, ne pas toucher.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/supabase-browser.ts src/lib/supabase-server.ts package.json package-lock.json
git commit -m "feat: add Supabase SSR clients and new types"
```

---

### Task 3: Middleware de protection des routes

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Créer `src/middleware.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isAdmin = pathname.startsWith("/admin");

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isAdmin && user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron|api/push).*)"],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add route protection middleware"
```

---

### Task 4: Pages d'authentification

**Files:**
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/signup/page.tsx`
- Create: `src/app/actions/auth.ts`

- [ ] **Step 1: Créer `src/app/actions/auth.ts`**

```typescript
"use server";

import { createSupabaseServer } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const supabase = await createSupabaseServer();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createSupabaseServer();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Créer `src/app/(auth)/layout.tsx`**

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Créer `src/app/(auth)/login/page.tsx`**

```typescript
"use client";

import { login } from "@/app/actions/auth";
import Link from "next/link";
import { useActionState } from "react";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="auth-card">
      <div className="auth-header">
        <p className="eyebrow">Bienvenue</p>
        <h1>Connexion</h1>
      </div>
      <form action={action} className="auth-form">
        {state?.error && <p className="auth-error">{state.error}</p>}
        <label>
          Email
          <input name="email" type="email" placeholder="vous@email.com" required />
        </label>
        <label>
          Mot de passe
          <input name="password" type="password" placeholder="••••••••" required />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Connexion..." : "Se connecter"}
        </button>
      </form>
      <p className="auth-footer">
        Pas encore de compte ?{" "}
        <Link href="/signup">Créer un compte</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Créer `src/app/(auth)/signup/page.tsx`**

```typescript
"use client";

import { signup } from "@/app/actions/auth";
import Link from "next/link";
import { useActionState } from "react";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <div className="auth-card">
      <div className="auth-header">
        <p className="eyebrow">Nouveau compte</p>
        <h1>Inscription</h1>
      </div>
      <form action={action} className="auth-form">
        {state?.error && <p className="auth-error">{state.error}</p>}
        <label>
          Email
          <input name="email" type="email" placeholder="vous@email.com" required />
        </label>
        <label>
          Mot de passe
          <input name="password" type="password" placeholder="8 caractères minimum" required minLength={8} />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Création..." : "Créer mon compte"}
        </button>
      </form>
      <p className="auth-footer">
        Déjà un compte ?{" "}
        <Link href="/login">Se connecter</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Ajouter les styles auth dans `src/app/globals.css`**

Ajouter à la fin du fichier :

```css
/* Auth */
.auth-shell {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px;
  background: var(--background);
}

.auth-card {
  display: grid;
  gap: 24px;
  width: min(420px, 100%);
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
  padding: 32px;
}

.auth-header {
  display: grid;
  gap: 6px;
}

.auth-header h1 {
  font-size: 1.8rem;
}

.auth-form {
  display: grid;
  gap: 16px;
}

.auth-error {
  border-radius: 8px;
  background: #fef3f2;
  color: var(--danger);
  padding: 10px 14px;
  font-size: 0.9rem;
}

.auth-footer {
  color: var(--muted);
  font-size: 0.9rem;
  text-align: center;
}

.auth-footer a {
  color: var(--primary);
  font-weight: 700;
  text-decoration: none;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/auth.ts src/app/"(auth)"/ src/app/globals.css
git commit -m "feat: auth pages (login, signup, logout)"
```

---

### Task 5: Layout app avec sidebar

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/Sidebar.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Créer `src/components/Sidebar.tsx`**

```typescript
import { logout } from "@/app/actions/auth";
import { getUserProfile } from "@/lib/supabase-server";
import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/abonnements", label: "Mes abonnements" },
  { href: "/clients", label: "Mes clients" },
];

export async function Sidebar() {
  const profile = await getUserProfile();
  const isAdmin = profile?.role === "admin";

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <p className="eyebrow">SubResell</p>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="sidebar-link">
            {item.label}
          </Link>
        ))}
        {isAdmin && (
          <>
            <div className="sidebar-divider" />
            <Link href="/admin" className="sidebar-link sidebar-link--admin">
              Admin
            </Link>
          </>
        )}
      </nav>
      <form action={logout} className="sidebar-footer">
        <button type="submit" className="secondary sidebar-logout">
          Déconnexion
        </button>
      </form>
    </aside>
  );
}
```

- [ ] **Step 2: Créer `src/app/(app)/layout.tsx`**

```typescript
import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Ajouter les styles sidebar dans `src/app/globals.css`**

Ajouter à la fin :

```css
/* App shell */
.app-shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 100vh;
}

.app-main {
  display: grid;
  align-content: start;
  gap: 24px;
  padding: 28px;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 0;
  border-right: 1px solid var(--line);
  background: var(--panel);
  padding: 20px 0;
  position: sticky;
  top: 0;
  height: 100vh;
}

.sidebar-logo {
  padding: 0 20px 20px;
  border-bottom: 1px solid var(--line);
}

.sidebar-nav {
  display: grid;
  align-content: start;
  gap: 2px;
  padding: 12px 8px;
}

.sidebar-link {
  display: block;
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--foreground);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s;
}

.sidebar-link:hover {
  background: var(--background);
}

.sidebar-link--admin {
  color: var(--primary);
}

.sidebar-divider {
  height: 1px;
  background: var(--line);
  margin: 8px 4px;
}

.sidebar-footer {
  padding: 12px 8px 0;
  border-top: 1px solid var(--line);
}

.sidebar-logout {
  width: 100%;
}

/* Page header */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-header h1 {
  font-size: 1.6rem;
}

@media (max-width: 768px) {
  .app-shell {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: static;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--line);
  }
}
```

- [ ] **Step 4: Créer `src/app/(app)/dashboard/page.tsx` (placeholder)**

```typescript
export default function DashboardPage() {
  return <h1>Dashboard</h1>;
}
```

- [ ] **Step 5: Remplacer `src/app/page.tsx` par un redirect**

Ne pas supprimer — remplacer le contenu pour que `/` redirige vers `/dashboard` :

```typescript
import { redirect } from "next/navigation";
export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 6: Démarrer le serveur et vérifier le layout**

```bash
npm run dev
```

Ouvrir `http://localhost:3000` → doit rediriger vers `/login`. Se connecter avec un compte de test → doit afficher la sidebar + "Dashboard".

- [ ] **Step 7: Commit**

```bash
git add src/components/Sidebar.tsx src/app/"(app)"/ src/app/globals.css
git commit -m "feat: app layout with sidebar and route groups"
```

---

## Phase 2 — Mes abonnements (comptes provider + slots)

### Task 6: Actions comptes provider

**Files:**
- Create: `src/app/actions/accounts.ts`
- Create: `src/app/actions/slots.ts`

- [ ] **Step 1: Créer `src/app/actions/accounts.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import { addMonths, toDateInputValue } from "@/lib/dates";

function req(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  if (!v) throw new Error(`${key} requis`);
  return v;
}

export async function addProviderAccount(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const serviceName = req(formData, "service_name");
  const startDate = req(formData, "start_date");
  const durationMonths = parseInt(req(formData, "duration_months"));
  const maxSlots = parseInt(req(formData, "max_slots"));
  const cost = formData.get("cost") ? parseFloat(String(formData.get("cost"))) : null;
  const endDate = addMonths(startDate, durationMonths);

  const supabase = createSupabaseAdmin();

  const { data: account, error } = await supabase
    .from("provider_accounts")
    .insert({
      user_id: user.id,
      service_name: serviceName,
      start_date: startDate,
      end_date: endDate,
      duration_months: durationMonths,
      max_slots: maxSlots,
      cost,
      status: "active",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Créer les slots automatiquement
  const slots = Array.from({ length: maxSlots }, (_, i) => ({
    account_id: account.id,
    slot_number: i + 1,
    label: `Profil ${i + 1}`,
  }));

  const { error: slotError } = await supabase.from("account_slots").insert(slots);
  if (slotError) throw new Error(slotError.message);

  revalidatePath("/abonnements");
}

export async function renewProviderAccount(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const currentEndDate = req(formData, "end_date");
  const durationMonths = parseInt(req(formData, "duration_months") || "1");
  const baseDate = new Date(`${currentEndDate}T00:00:00`) > new Date()
    ? currentEndDate
    : toDateInputValue();
  const newEndDate = addMonths(baseDate, durationMonths);

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("provider_accounts")
    .update({ end_date: newEndDate, status: "active" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/abonnements");
}

export async function updateProviderAccountStatus(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const status = req(formData, "status");
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("provider_accounts")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/abonnements");
}
```

- [ ] **Step 2: Mettre à jour `src/lib/dates.ts` — ajouter `addMonths`**

Ouvrir `src/lib/dates.ts` et ajouter cette fonction (garder l'existant) :

```typescript
export function addMonths(dateStr: string, months: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return toDateInputValue(date);
}
```

Adapter `toDateInputValue` pour accepter un paramètre optionnel :

```typescript
export function toDateInputValue(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}
```

- [ ] **Step 3: Créer `src/app/actions/slots.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";

export async function updateSlotLabel(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const accountId = String(formData.get("account_id") ?? "");

  const supabase = createSupabaseAdmin();

  // Vérifier que le slot appartient à un compte de cet utilisateur
  const { data: account } = await supabase
    .from("provider_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (!account) throw new Error("Accès refusé");

  const { error } = await supabase
    .from("account_slots")
    .update({ label })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/abonnements/${accountId}`);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/accounts.ts src/app/actions/slots.ts src/lib/dates.ts
git commit -m "feat: provider account and slot server actions"
```

---

### Task 7: Page Mes abonnements

**Files:**
- Create: `src/app/(app)/abonnements/page.tsx`
- Create: `src/components/AccountCard.tsx`

- [ ] **Step 1: Créer `src/components/AccountCard.tsx`**

```typescript
import { renewProviderAccount, updateProviderAccountStatus } from "@/app/actions/accounts";
import { formatDate, daysUntil } from "@/lib/dates";
import type { ProviderAccount } from "@/lib/types";
import Link from "next/link";

type Props = { account: ProviderAccount & { used_slots: number } };

export function AccountCard({ account }: Props) {
  const daysLeft = daysUntil(account.end_date);
  const isUrgent = daysLeft >= 0 && daysLeft <= 3;
  const isExpired = daysLeft < 0;

  return (
    <div className={`account-card${isUrgent ? " account-card--urgent" : ""}${isExpired ? " account-card--expired" : ""}`}>
      <div className="account-card-header">
        <div>
          <p className="eyebrow">{account.service_name}</p>
          <strong className="account-slots-count">
            {account.used_slots}/{account.max_slots} slots
          </strong>
        </div>
        <span className={`status ${account.status}`}>
          {account.status === "active" ? "Actif" : "Inactif"}
        </span>
      </div>
      <div className="account-card-dates">
        <span>Du {formatDate(account.start_date)}</span>
        <span>au <strong>{formatDate(account.end_date)}</strong></span>
        {isUrgent && <span className="urgent-label">⚠ Expire dans {daysLeft}j</span>}
        {isExpired && <span className="expired-label">Expiré</span>}
      </div>
      {account.cost && <p className="account-cost">Coût : {account.cost} FCFA</p>}
      <div className="actions">
        <Link href={`/abonnements/${account.id}`} className="btn-link">
          Voir les slots →
        </Link>
        <form action={renewProviderAccount}>
          <input type="hidden" name="id" value={account.id} />
          <input type="hidden" name="end_date" value={account.end_date} />
          <input type="hidden" name="duration_months" value="1" />
          <button type="submit">Renouveler +1 mois</button>
        </form>
        <form action={updateProviderAccountStatus}>
          <input type="hidden" name="id" value={account.id} />
          <input type="hidden" name="status" value={account.status === "active" ? "inactive" : "active"} />
          <button type="submit" className="secondary">
            {account.status === "active" ? "Désactiver" : "Réactiver"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Créer `src/app/(app)/abonnements/page.tsx`**

```typescript
import { addProviderAccount } from "@/app/actions/accounts";
import { AccountCard } from "@/components/AccountCard";
import { toDateInputValue } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { ProviderAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getAccounts(userId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("provider_accounts")
    .select(`id, service_name, max_slots, start_date, end_date, duration_months, cost, status, created_at,
      account_slots(id)`)
    .eq("user_id", userId)
    .order("end_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({
    ...a,
    used_slots: (a.account_slots as { id: string }[]).filter(Boolean).length,
  }));
}

export default async function AbonnementsPage() {
  const user = await getUser();
  if (!user) return null;

  const accounts = await getAccounts(user.id);
  const today = toDateInputValue();

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Vos comptes</p>
          <h1>Mes abonnements</h1>
        </div>
      </div>

      <div className="panel">
        <div>
          <p className="eyebrow">Ajouter</p>
          <h2>Nouveau compte provider</h2>
        </div>
        <form action={addProviderAccount} className="fields">
          <div className="fields two-cols">
            <label>
              Service
              <input name="service_name" placeholder="Netflix, Spotify..." required />
            </label>
            <label>
              Nombre de slots (profils)
              <input name="max_slots" type="number" min="1" max="20" defaultValue="5" required />
            </label>
          </div>
          <div className="fields two-cols">
            <label>
              Date de début
              <input name="start_date" type="date" defaultValue={today} required />
            </label>
            <label>
              Durée (mois)
              <input name="duration_months" type="number" min="1" max="12" defaultValue="1" required />
            </label>
          </div>
          <label>
            Coût payé (FCFA)
            <input name="cost" type="number" placeholder="Ex: 5000" />
          </label>
          <button type="submit">Ajouter le compte</button>
        </form>
      </div>

      <div>
        <p className="eyebrow">Liste ({accounts.length})</p>
        <div className="accounts-grid">
          {accounts.length === 0
            ? <p className="empty">Aucun compte provider. Ajoutez-en un ci-dessus.</p>
            : accounts.map((account) => (
                <AccountCard key={account.id} account={account as ProviderAccount & { used_slots: number }} />
              ))
          }
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Ajouter les styles des cards dans `src/app/globals.css`**

```css
/* Account cards */
.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 12px;
}

.account-card {
  display: grid;
  gap: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  padding: 18px;
}

.account-card--urgent { border-color: #f97316; background: #fff7ed; }
.account-card--expired { border-color: var(--danger); background: #fef3f2; }

.account-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.account-slots-count { font-size: 1.3rem; }

.account-card-dates {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--muted);
  font-size: 0.88rem;
}

.account-cost { color: var(--muted); font-size: 0.88rem; }

.urgent-label { color: #c2410c; font-weight: 700; }
.expired-label { color: var(--danger); font-weight: 700; }

.btn-link {
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
  background: var(--soft);
  color: var(--primary-strong);
  font-size: 0.88rem;
  font-weight: 700;
  padding: 8px 14px;
  text-decoration: none;
}
```

- [ ] **Step 4: Vérifier dans le navigateur**

  Naviguer vers `/abonnements`, créer un compte test. Vérifier que la carte apparaît.

- [ ] **Step 5: Commit**

```bash
git add src/app/"(app)"/abonnements/page.tsx src/components/AccountCard.tsx src/app/globals.css
git commit -m "feat: provider accounts list page"
```

---

### Task 8: Page détail d'un compte (slots)

**Files:**
- Create: `src/app/(app)/abonnements/[id]/page.tsx`
- Create: `src/components/SlotTable.tsx`

- [ ] **Step 1: Créer `src/components/SlotTable.tsx`**

```typescript
import type { AccountSlot } from "@/lib/types";
import { formatDate, daysUntil } from "@/lib/dates";

type Props = { slots: AccountSlot[] };

export function SlotTable({ slots }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Slot</th>
            <th>Client</th>
            <th>Service / Début</th>
            <th>Fin</th>
            <th>Prix</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => {
            const sub = slot.active_subscription;
            const daysLeft = sub ? daysUntil(sub.end_date) : null;
            const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
            return (
              <tr key={slot.id} className={isUrgent ? "urgent-row" : ""}>
                <td><strong>{slot.label || `Profil ${slot.slot_number}`}</strong></td>
                <td>
                  {sub?.client
                    ? <><strong>{sub.client.first_name} {sub.client.last_name}</strong><span>{sub.client.phone}</span></>
                    : <span className="slot-free">Libre</span>
                  }
                </td>
                <td>{sub ? formatDate(sub.start_date) : "—"}</td>
                <td>
                  {sub
                    ? <><strong>{formatDate(sub.end_date)}</strong><span>{daysLeft !== null && daysLeft >= 0 ? `J-${daysLeft}` : daysLeft !== null ? "Expiré" : ""}</span></>
                    : "—"
                  }
                </td>
                <td>{sub?.price ? `${sub.price} FCFA` : "—"}</td>
                <td>
                  {sub
                    ? <span className={`status ${sub.status}`}>{sub.status === "active" ? "Actif" : "Annulé"}</span>
                    : <span className="status slot-free-badge">Libre</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Créer `src/app/(app)/abonnements/[id]/page.tsx`**

```typescript
import { SlotTable } from "@/components/SlotTable";
import { formatDate, daysUntil } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { AccountSlot, ProviderAccount } from "@/lib/types";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getAccount(id: string, userId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("provider_accounts")
    .select(`
      *,
      account_slots (
        id, slot_number, label,
        active_subscription:client_subscriptions (
          id, start_date, end_date, duration_months, price, status,
          client:clients (id, first_name, last_name, phone, email)
        )
      )
    `)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  // Ne garder que l'abonnement actif par slot
  const slots = (data.account_slots ?? []).map((slot: AccountSlot & { active_subscription: unknown[] }) => ({
    ...slot,
    active_subscription: Array.isArray(slot.active_subscription)
      ? slot.active_subscription.find((s: { status: string }) => s.status === "active") ?? null
      : slot.active_subscription,
  }));

  return { ...data, account_slots: slots } as ProviderAccount & { account_slots: AccountSlot[] };
}

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return null;

  const account = await getAccount(id, user.id);
  if (!account) notFound();

  const daysLeft = daysUntil(account.end_date);
  const usedSlots = account.account_slots?.filter((s) => s.active_subscription) ?? [];

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href="/abonnements">← Mes abonnements</Link></p>
          <h1>{account.service_name}</h1>
          <p style={{ color: "var(--muted)", marginTop: 6 }}>
            {usedSlots.length}/{account.max_slots} slots occupés · Expire le {formatDate(account.end_date)}
            {daysLeft >= 0 ? ` (J-${daysLeft})` : " (expiré)"}
          </p>
        </div>
      </div>

      <div className="panel">
        <h2>Slots / Profils</h2>
        <SlotTable slots={account.account_slots ?? []} />
      </div>
    </>
  );
}
```

- [ ] **Step 3: Ajouter styles dans `src/app/globals.css`**

```css
.slot-free { color: var(--primary); font-weight: 600; }
.slot-free-badge { background: var(--soft); color: var(--primary); }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/"(app)"/abonnements/"[id]"/page.tsx src/components/SlotTable.tsx src/app/globals.css
git commit -m "feat: account detail page with slots"
```

---

## Phase 3 — Mes clients

### Task 9: Actions clients et subscriptions

**Files:**
- Create: `src/app/actions/clients.ts`
- Create: `src/app/actions/subscriptions.ts`

- [ ] **Step 1: Créer `src/app/actions/clients.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import { addMonths, toDateInputValue } from "@/lib/dates";

function req(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  if (!v) throw new Error(`${key} requis`);
  return v;
}

function opt(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}

export async function addClientWithSubscription(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const firstName = req(formData, "first_name");
  const lastName = req(formData, "last_name");
  const slotId = req(formData, "slot_id");
  const startDate = req(formData, "start_date");
  const durationMonths = parseInt(req(formData, "duration_months"));
  const price = formData.get("price") ? parseFloat(String(formData.get("price"))) : null;
  const endDate = addMonths(startDate, durationMonths);

  const supabase = createSupabaseAdmin();

  // Vérifier que le slot appartient à un compte de cet utilisateur
  const { data: slot } = await supabase
    .from("account_slots")
    .select("id, account_id, provider_accounts(user_id)")
    .eq("id", slotId)
    .single();

  const accountOwner = (slot?.provider_accounts as { user_id: string } | null)?.user_id;
  if (!slot || accountOwner !== user.id) throw new Error("Slot invalide");

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      user_id: user.id,
      first_name: firstName,
      last_name: lastName,
      email: opt(formData, "email"),
      phone: opt(formData, "phone"),
    })
    .select("id")
    .single();

  if (clientError) throw new Error(clientError.message);

  const { error: subError } = await supabase
    .from("client_subscriptions")
    .insert({
      user_id: user.id,
      slot_id: slotId,
      client_id: client.id,
      start_date: startDate,
      end_date: endDate,
      duration_months: durationMonths,
      price,
      status: "active",
    });

  if (subError) throw new Error(subError.message);
  revalidatePath("/clients");
}
```

- [ ] **Step 2: Créer `src/app/actions/subscriptions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import { addMonths, toDateInputValue } from "@/lib/dates";

function req(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

export async function renewClientSubscription(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const currentEndDate = req(formData, "end_date");
  const durationMonths = parseInt(req(formData, "duration_months") || "1");
  const baseDate = new Date(`${currentEndDate}T00:00:00`) > new Date()
    ? currentEndDate
    : toDateInputValue();
  const newEndDate = addMonths(baseDate, durationMonths);

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("client_subscriptions")
    .update({
      end_date: newEndDate,
      start_date: toDateInputValue(),
      status: "active",
      last_notified_on: null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/clients");
}

export async function cancelClientSubscription(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("client_subscriptions")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/clients");
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/clients.ts src/app/actions/subscriptions.ts
git commit -m "feat: client and subscription server actions"
```

---

### Task 10: Page Mes clients

**Files:**
- Create: `src/app/(app)/clients/page.tsx`
- Create: `src/components/ClientTable.tsx`

- [ ] **Step 1: Créer `src/components/ClientTable.tsx`**

```typescript
import { renewClientSubscription, cancelClientSubscription } from "@/app/actions/subscriptions";
import { formatDate, daysUntil } from "@/lib/dates";
import type { ClientSubscription } from "@/lib/types";

type Props = { subscriptions: ClientSubscription[] };

export function ClientTable({ subscriptions }: Props) {
  if (subscriptions.length === 0) {
    return <p className="empty">Aucun client actif pour le moment.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Service / Slot</th>
            <th>Début</th>
            <th>Fin</th>
            <th>Prix</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => {
            const daysLeft = daysUntil(sub.end_date);
            const isUrgent = daysLeft >= 0 && daysLeft <= 3;
            const serviceName = sub.slot?.account?.service_name ?? "—";
            const slotLabel = sub.slot?.label || `Profil ${sub.slot?.slot_number ?? ""}`;

            return (
              <tr key={sub.id} className={isUrgent ? "urgent-row" : ""}>
                <td>
                  <strong>{sub.client?.first_name} {sub.client?.last_name}</strong>
                  {sub.client?.phone && <span>{sub.client.phone}</span>}
                </td>
                <td>
                  <strong>{serviceName}</strong>
                  <span>{slotLabel}</span>
                </td>
                <td>{formatDate(sub.start_date)}</td>
                <td>
                  <strong>{formatDate(sub.end_date)}</strong>
                  <span>{daysLeft >= 0 ? `J-${daysLeft}` : "Expiré"}</span>
                </td>
                <td>{sub.price ? `${sub.price} FCFA` : "—"}</td>
                <td>
                  <span className={`status ${sub.status}`}>
                    {sub.status === "active" ? "Actif" : "Annulé"}
                  </span>
                </td>
                <td>
                  <div className="actions">
                    <form action={renewClientSubscription}>
                      <input type="hidden" name="id" value={sub.id} />
                      <input type="hidden" name="end_date" value={sub.end_date} />
                      <input type="hidden" name="duration_months" value="1" />
                      <button type="submit">Renouveler</button>
                    </form>
                    {sub.status === "active" && (
                      <form action={cancelClientSubscription}>
                        <input type="hidden" name="id" value={sub.id} />
                        <button type="submit" className="secondary">Annuler</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Créer `src/app/(app)/clients/page.tsx`**

```typescript
import { addClientWithSubscription } from "@/app/actions/clients";
import { ClientTable } from "@/components/ClientTable";
import { toDateInputValue } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { ClientSubscription, AccountSlot } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getData(userId: string) {
  const supabase = createSupabaseAdmin();

  const [subsResult, slotsResult] = await Promise.all([
    supabase
      .from("client_subscriptions")
      .select(`
        *,
        client:clients(*),
        slot:account_slots(
          id, slot_number, label,
          account:provider_accounts(id, service_name)
        )
      `)
      .eq("user_id", userId)
      .order("end_date", { ascending: true }),
    supabase
      .from("account_slots")
      .select(`
        id, slot_number, label,
        account:provider_accounts!inner(id, service_name, status, user_id)
      `)
      .eq("provider_accounts.user_id", userId)
      .eq("provider_accounts.status", "active"),
  ]);

  if (subsResult.error) throw new Error(subsResult.error.message);
  if (slotsResult.error) throw new Error(slotsResult.error.message);

  // Slots libres = pas d'abonnement actif
  const occupiedSlotIds = new Set(
    (subsResult.data ?? [])
      .filter((s) => s.status === "active")
      .map((s) => s.slot_id)
  );

  const freeSlots = (slotsResult.data ?? []).filter(
    (slot) => !occupiedSlotIds.has(slot.id)
  );

  return {
    subscriptions: (subsResult.data ?? []) as unknown as ClientSubscription[],
    freeSlots: freeSlots as unknown as (AccountSlot & { account: { id: string; service_name: string } })[],
  };
}

export default async function ClientsPage() {
  const user = await getUser();
  if (!user) return null;

  const { subscriptions, freeSlots } = await getData(user.id);
  const activeSubscriptions = subscriptions.filter((s) => s.status === "active");
  const today = toDateInputValue();

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Vos clients</p>
          <h1>Mes clients</h1>
        </div>
      </div>

      <div className="panel">
        <div>
          <p className="eyebrow">Ajouter</p>
          <h2>Nouveau client</h2>
        </div>
        <form action={addClientWithSubscription} className="fields">
          <div className="fields two-cols">
            <label>
              Prénom
              <input name="first_name" placeholder="Prénom" required />
            </label>
            <label>
              Nom
              <input name="last_name" placeholder="Nom" required />
            </label>
          </div>
          <div className="fields two-cols">
            <label>
              Téléphone
              <input name="phone" type="tel" placeholder="+237..." />
            </label>
            <label>
              Email
              <input name="email" type="email" placeholder="client@mail.com" />
            </label>
          </div>
          <div className="fields two-cols">
            <label>
              Slot (profil libre)
              <select name="slot_id" required className="select-input">
                <option value="">— Choisir un slot —</option>
                {freeSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.account?.service_name} — {slot.label || `Profil ${slot.slot_number}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prix (FCFA)
              <input name="price" type="number" placeholder="Ex: 2000" />
            </label>
          </div>
          <div className="fields two-cols">
            <label>
              Date de début
              <input name="start_date" type="date" defaultValue={today} required />
            </label>
            <label>
              Durée (mois)
              <input name="duration_months" type="number" min="1" max="12" defaultValue="1" required />
            </label>
          </div>
          <button type="submit">Ajouter le client</button>
        </form>
      </div>

      <div className="panel">
        <h2>Clients actifs ({activeSubscriptions.length})</h2>
        <ClientTable subscriptions={activeSubscriptions} />
      </div>
    </>
  );
}
```

- [ ] **Step 3: Ajouter le style select dans `src/app/globals.css`**

```css
.select-input {
  min-height: 42px;
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: white;
  color: var(--foreground);
  padding: 0 12px;
  font: inherit;
}
```

- [ ] **Step 4: Vérifier dans le navigateur**

  Naviguer vers `/clients`, créer un client test en sélectionnant un slot libre.

- [ ] **Step 5: Commit**

```bash
git add src/app/"(app)"/clients/page.tsx src/components/ClientTable.tsx src/app/globals.css
git commit -m "feat: clients page with add form and active table"
```

---

## Phase 4 — Dashboard

### Task 11: Dashboard avec stats et urgences

**Files:**
- Create: `src/app/(app)/dashboard/page.tsx` (remplace le placeholder)
- Create: `src/components/StatsCard.tsx`
- Create: `src/components/UrgencyTable.tsx`
- Create: `src/components/RevenueChart.tsx`

- [ ] **Step 1: Créer `src/components/StatsCard.tsx`**

```typescript
type Props = { label: string; value: string | number; accent?: boolean };

export function StatsCard({ label, value, accent }: Props) {
  return (
    <div className={`stats-card${accent ? " stats-card--accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
```

- [ ] **Step 2: Créer `src/components/UrgencyTable.tsx`**

```typescript
import { renewClientSubscription } from "@/app/actions/subscriptions";
import { formatDate, daysUntil } from "@/lib/dates";
import type { ClientSubscription } from "@/lib/types";

type Props = { subscriptions: ClientSubscription[] };

export function UrgencyTable({ subscriptions }: Props) {
  if (subscriptions.length === 0) {
    return <p className="empty">Aucun abonnement à relancer dans les 3 prochains jours.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Service / Slot</th>
            <th>Téléphone</th>
            <th>Fin</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => {
            const daysLeft = daysUntil(sub.end_date);
            const serviceName = sub.slot?.account?.service_name ?? "—";
            const slotLabel = sub.slot?.label || `Profil ${sub.slot?.slot_number ?? ""}`;

            return (
              <tr key={sub.id} className="urgent-row">
                <td><strong>{sub.client?.first_name} {sub.client?.last_name}</strong></td>
                <td><strong>{serviceName}</strong><span>{slotLabel}</span></td>
                <td>{sub.client?.phone ?? "—"}</td>
                <td>
                  <strong>{formatDate(sub.end_date)}</strong>
                  <span>{daysLeft >= 0 ? `J-${daysLeft}` : "Expiré"}</span>
                </td>
                <td>
                  <form action={renewClientSubscription}>
                    <input type="hidden" name="id" value={sub.id} />
                    <input type="hidden" name="end_date" value={sub.end_date} />
                    <input type="hidden" name="duration_months" value="1" />
                    <button type="submit">Renouveler</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Créer `src/components/RevenueChart.tsx`**

```typescript
"use client";

type MonthData = { month: string; revenue: number };
type Props = { data: MonthData[] };

export function RevenueChart({ data }: Props) {
  const max = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="revenue-chart">
      {data.map((d) => (
        <div key={d.month} className="revenue-bar-wrap">
          <span className="revenue-value">{d.revenue > 0 ? d.revenue.toLocaleString() : ""}</span>
          <div
            className="revenue-bar"
            style={{ height: `${(d.revenue / max) * 100}%` }}
          />
          <span className="revenue-month">{d.month}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Remplacer `src/app/(app)/dashboard/page.tsx`**

```typescript
import { StatsCard } from "@/components/StatsCard";
import { UrgencyTable } from "@/components/UrgencyTable";
import { RevenueChart } from "@/components/RevenueChart";
import { daysUntil } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { ClientSubscription, ProviderAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getDashboardData(userId: string) {
  const supabase = createSupabaseAdmin();

  const [subsResult, accountsResult] = await Promise.all([
    supabase
      .from("client_subscriptions")
      .select(`
        id, start_date, end_date, price, status,
        client:clients(id, first_name, last_name, phone),
        slot:account_slots(
          id, slot_number, label,
          account:provider_accounts(id, service_name)
        )
      `)
      .eq("user_id", userId)
      .order("end_date", { ascending: true }),
    supabase
      .from("provider_accounts")
      .select("id, max_slots, account_slots(id)")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  const subscriptions = (subsResult.data ?? []) as unknown as ClientSubscription[];
  const accounts = (accountsResult.data ?? []) as unknown as (ProviderAccount & { account_slots: { id: string }[] })[];

  const activeClients = subscriptions.filter((s) => s.status === "active");
  const urgent = activeClients.filter((s) => {
    const d = daysUntil(s.end_date);
    return d >= 0 && d <= 3;
  });
  const expired = activeClients.filter((s) => daysUntil(s.end_date) < 0);

  const totalSlots = accounts.reduce((sum, a) => sum + a.max_slots, 0);
  const usedSlots = activeClients.length;

  // Revenus des 6 derniers mois
  const now = new Date();
  const monthData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const month = d.toLocaleDateString("fr-FR", { month: "short" });
    const revenue = activeClients
      .filter((s) => {
        const sd = new Date(s.start_date);
        return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth();
      })
      .reduce((sum, s) => sum + (s.price ?? 0), 0);
    return { month, revenue };
  });

  const monthlyRevenue = activeClients
    .filter((s) => {
      const sd = new Date(s.start_date);
      return sd.getFullYear() === now.getFullYear() && sd.getMonth() === now.getMonth();
    })
    .reduce((sum, s) => sum + (s.price ?? 0), 0);

  return { activeClients, urgent, expired, totalSlots, usedSlots, monthData, monthlyRevenue };
}

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) return null;

  const { activeClients, urgent, expired, totalSlots, usedSlots, monthData, monthlyRevenue } =
    await getDashboardData(user.id);

  return (
    <>
      <div>
        <p className="eyebrow">Aperçu</p>
        <h1>Dashboard</h1>
      </div>

      <div className="stats-grid">
        <StatsCard label="Clients actifs" value={activeClients.length} />
        <StatsCard label="Revenus du mois (FCFA)" value={monthlyRevenue.toLocaleString()} accent />
        <StatsCard label="À relancer (≤ 3j)" value={urgent.length} accent={urgent.length > 0} />
        <StatsCard label="Slots occupés" value={`${usedSlots}/${totalSlots}`} />
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Priorité</p>
            <h2>Clients à relancer</h2>
          </div>
          <span>{urgent.length} rappel(s)</span>
        </div>
        <UrgencyTable subscriptions={urgent} />
      </div>

      <div className="panel">
        <div>
          <p className="eyebrow">Finances</p>
          <h2>Revenus sur 6 mois</h2>
        </div>
        <RevenueChart data={monthData} />
      </div>
    </>
  );
}
```

- [ ] **Step 5: Ajouter les styles dans `src/app/globals.css`**

```css
/* Stats grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.stats-card {
  display: grid;
  gap: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  padding: 18px;
}

.stats-card span {
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 700;
}

.stats-card strong {
  font-size: 2rem;
}

.stats-card--accent {
  border-color: var(--primary);
  background: var(--soft);
}

/* Revenue chart */
.revenue-chart {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  height: 160px;
  padding-top: 24px;
}

.revenue-bar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  height: 100%;
  justify-content: flex-end;
}

.revenue-value {
  color: var(--muted);
  font-size: 0.7rem;
  text-align: center;
}

.revenue-bar {
  width: 100%;
  min-height: 4px;
  border-radius: 4px 4px 0 0;
  background: var(--primary);
  transition: height 0.3s;
}

.revenue-month {
  color: var(--muted);
  font-size: 0.75rem;
  text-transform: capitalize;
}

@media (max-width: 768px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
```

- [ ] **Step 6: Vérifier le dashboard dans le navigateur**

  Naviguer vers `/dashboard`. Vérifier que les 4 stats s'affichent, le tableau urgences, et le graphique.

- [ ] **Step 7: Commit**

```bash
git add src/app/"(app)"/dashboard/page.tsx src/components/StatsCard.tsx src/components/UrgencyTable.tsx src/components/RevenueChart.tsx src/app/globals.css
git commit -m "feat: dashboard with stats, urgency table, and revenue chart"
```

---

## Phase 5 — Admin

### Task 12: Panel admin

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/revendeurs/[id]/page.tsx`

- [ ] **Step 1: Créer `src/app/admin/layout.tsx`**

```typescript
import { Sidebar } from "@/components/Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Créer `src/app/admin/page.tsx`**

```typescript
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getResellers() {
  const supabase = createSupabaseAdmin();

  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select("user_id, role, plan, created_at")
    .eq("role", "reseller")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const userIds = (profiles ?? []).map((p) => p.user_id);
  if (userIds.length === 0) return [];

  // Récupérer les emails depuis auth.users via admin API
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const emailMap = new Map(
    (authUsers?.users ?? []).map((u) => [u.id, u.email])
  );

  // Compter les clients actifs par revendeur
  const { data: subCounts } = await supabase
    .from("client_subscriptions")
    .select("user_id")
    .eq("status", "active")
    .in("user_id", userIds);

  const countMap = new Map<string, number>();
  (subCounts ?? []).forEach((s) => {
    countMap.set(s.user_id, (countMap.get(s.user_id) ?? 0) + 1);
  });

  return (profiles ?? []).map((p) => ({
    ...p,
    email: emailMap.get(p.user_id) ?? "—",
    active_clients: countMap.get(p.user_id) ?? 0,
  }));
}

export default async function AdminPage() {
  const resellers = await getResellers();

  return (
    <>
      <div>
        <p className="eyebrow">Administration</p>
        <h1>Revendeurs ({resellers.length})</h1>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Plan</th>
                <th>Clients actifs</th>
                <th>Inscrit le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {resellers.length === 0 && (
                <tr><td colSpan={5} className="empty">Aucun revendeur inscrit.</td></tr>
              )}
              {resellers.map((r) => (
                <tr key={r.user_id}>
                  <td><strong>{r.email}</strong></td>
                  <td><span className="status active">{r.plan}</span></td>
                  <td>{r.active_clients}</td>
                  <td>{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                  <td>
                    <Link href={`/admin/revendeurs/${r.user_id}`} className="btn-link">
                      Voir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Créer `src/app/admin/revendeurs/[id]/page.tsx`**

```typescript
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { StatsCard } from "@/components/StatsCard";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getResellerStats(userId: string) {
  const supabase = createSupabaseAdmin();

  const [profileResult, accountsResult, subsResult, authResult] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", userId).single(),
    supabase.from("provider_accounts").select("id, service_name, status").eq("user_id", userId),
    supabase.from("client_subscriptions").select("id, status, price").eq("user_id", userId),
    supabase.auth.admin.getUserById(userId),
  ]);

  if (!profileResult.data) return null;

  const activeClients = (subsResult.data ?? []).filter((s) => s.status === "active").length;
  const totalRevenue = (subsResult.data ?? [])
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (s.price ?? 0), 0);

  return {
    profile: profileResult.data,
    email: authResult.data?.user?.email ?? "—",
    accounts: accountsResult.data ?? [],
    activeClients,
    totalRevenue,
    totalSubscriptions: subsResult.data?.length ?? 0,
  };
}

export default async function ResellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getResellerStats(id);
  if (!data) notFound();

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href="/admin">← Admin</Link></p>
          <h1>{data.email}</h1>
          <p style={{ color: "var(--muted)", marginTop: 6 }}>Plan : {data.profile.plan}</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatsCard label="Clients actifs" value={data.activeClients} />
        <StatsCard label="Revenus total (FCFA)" value={data.totalRevenue.toLocaleString()} accent />
        <StatsCard label="Total abonnements" value={data.totalSubscriptions} />
        <StatsCard label="Comptes provider" value={data.accounts.length} />
      </div>

      <div className="panel">
        <h2>Comptes provider</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Service</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {data.accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.service_name}</td>
                  <td><span className={`status ${a.status}`}>{a.status === "active" ? "Actif" : "Inactif"}</span></td>
                </tr>
              ))}
              {data.accounts.length === 0 && (
                <tr><td colSpan={2} className="empty">Aucun compte.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Vérifier l'admin**

  Se connecter avec le compte admin (créé manuellement en base avec `role=admin`). Naviguer vers `/admin`. Vérifier la liste des revendeurs.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/
git commit -m "feat: admin panel with resellers list and detail page"
```

---

## Phase 6 — Notifications

### Task 13: Mettre à jour le cron et le PushManager

**Files:**
- Modify: `src/app/api/push/subscribe/route.ts`
- Modify: `src/app/api/cron/reminders/route.ts`
- Modify: `src/components/PushManager.tsx`

- [ ] **Step 1: Mettre à jour `src/app/api/push/subscribe/route.ts`**

Remplacer le contenu :

```typescript
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabaseServer = await createSupabaseServer();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const subscription = await request.json();
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint: subscription.endpoint, subscription },
      { onConflict: "endpoint" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Mettre à jour `src/app/api/cron/reminders/route.ts`**

Remplacer le contenu :

```typescript
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:admin@subresell.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function toDateStr(date: Date) {
  return date.toISOString().split("T")[0];
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const today = toDateStr(new Date());
  const in3Days = toDateStr(new Date(Date.now() + 3 * 86400000));

  // Abonnements actifs qui expirent dans 0-3 jours, pas encore notifiés aujourd'hui
  const { data: urgentSubs, error } = await supabase
    .from("client_subscriptions")
    .select(`
      id, end_date, user_id,
      client:clients(first_name, last_name),
      slot:account_slots(label, slot_number, account:provider_accounts(service_name))
    `)
    .eq("status", "active")
    .gte("end_date", today)
    .lte("end_date", in3Days)
    .or(`last_notified_on.is.null,last_notified_on.lt.${today}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!urgentSubs || urgentSubs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Regrouper par user_id
  const byUser = new Map<string, typeof urgentSubs>();
  for (const sub of urgentSubs) {
    const list = byUser.get(sub.user_id) ?? [];
    list.push(sub);
    byUser.set(sub.user_id, list);
  }

  let sent = 0;

  for (const [userId, subs] of byUser) {
    const { data: pushSubs } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", userId);

    if (!pushSubs || pushSubs.length === 0) continue;

    const names = subs.map((s) => {
      const client = s.client as { first_name: string; last_name: string } | null;
      const slot = s.slot as { account?: { service_name: string } } | null;
      return `${client?.first_name ?? ""} ${client?.last_name ?? ""} (${slot?.account?.service_name ?? ""})`.trim();
    });

    const payload = JSON.stringify({
      title: `⚠ ${subs.length} client(s) à relancer`,
      body: names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : ""),
      url: "/clients",
    });

    for (const { subscription } of pushSubs) {
      try {
        await webpush.sendNotification(subscription as Parameters<typeof webpush.sendNotification>[0], payload);
        sent++;
      } catch {}
    }

    // Marquer comme notifiés aujourd'hui
    await supabase
      .from("client_subscriptions")
      .update({ last_notified_on: today })
      .in("id", subs.map((s) => s.id));
  }

  return NextResponse.json({ sent });
}
```

- [ ] **Step 3: Vérifier `src/components/PushManager.tsx`**

  Ouvrir et vérifier que le composant fait un POST vers `/api/push/subscribe`. Si le corps envoyé est bien l'objet `PushSubscription`, aucun changement nécessaire. La route API s'occupe maintenant d'associer au `user_id` via la session.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/push/subscribe/route.ts src/app/api/cron/reminders/route.ts
git commit -m "feat: update push notifications for multi-tenant with user_id"
```

---

## Phase 7 — Nettoyage final

### Task 14: Supprimer les anciens fichiers et vérifier le build

**Files:**
- Delete: `src/app/actions.ts`
- Delete: `src/components/SubscriptionTable.tsx`
- Delete: `src/components/PushManager.tsx` (remplacé, plus utilisé)
- Modify: `src/app/layout.tsx` (retirer les imports supprimés)

- [ ] **Step 1: Supprimer les anciens fichiers**

```bash
rm src/app/actions.ts
rm src/components/SubscriptionTable.tsx
rm src/components/PushManager.tsx
```

- [ ] **Step 2: Vérifier `src/app/layout.tsx`**

  Ouvrir le fichier. S'assurer qu'il ne référence pas `PushManager` ou d'anciens imports. Le layout racine ne doit contenir que les métadonnées et la police. Exemple :

```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SubResell",
  description: "Gestion d'abonnements revendeurs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Lancer le build TypeScript**

```bash
npm run build
```

Corriger toutes les erreurs TypeScript avant de continuer. Les erreurs fréquentes :
- Import manquant : ajouter l'import
- Type `unknown` sur les résultats Supabase : ajouter `as unknown as MonType`
- `params` non awaité dans les pages dynamic : `const { id } = await params`

- [ ] **Step 4: Tester le flux complet**

  1. Ouvrir `http://localhost:3000` → redirige vers `/login`
  2. Créer un compte → redirige vers `/dashboard`
  3. Aller dans "Mes abonnements" → ajouter un compte Netflix 5 slots
  4. Aller dans "Mes clients" → ajouter un client sur un slot libre
  5. Vérifier que le dashboard affiche les bonnes stats
  6. Créer un second compte → vérifier l'isolation des données

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat: complete SaaS subscription reseller app"
```

---

## Résumé des variables d'environnement requises

```env
NEXT_PUBLIC_SUPABASE_URL=           # Supabase → Settings → API → URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # Supabase → Settings → API → anon public
SUPABASE_SERVICE_ROLE_KEY=          # Supabase → Settings → API → service_role
NEXT_PUBLIC_VAPID_PUBLIC_KEY=       # généré avec: npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=
CRON_SECRET=                        # chaîne aléatoire, ex: openssl rand -hex 32
```

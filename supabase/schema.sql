create extension if not exists pgcrypto;

-- Profil utilisateur lié à auth.users
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'reseller' check (role in ('reseller', 'admin')),
  plan text not null default 'free',
  first_name text,
  last_name text,
  company_name text,
  phone text,
  city text,
  created_at timestamptz not null default now(),
  unique(user_id)
);

alter table public.user_profiles add column if not exists company_name text;

-- Comptes provider (ex: "Mon Netflix Premium")
create table if not exists public.provider_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_name text not null,
  label text,
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
  last_name text,
  email text,
  phone text,
  payment_rail text,
  notes text,
  pin_code text,
  created_at timestamptz not null default now()
);

-- Migration: add columns if table already exists
alter table public.clients add column if not exists payment_rail text;
alter table public.clients add column if not exists notes text;
alter table public.clients add column if not exists pin_code text;
alter table public.clients alter column last_name drop not null;

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

-- Factures générées à chaque vente ou renouvellement de profil
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  number int not null,
  code text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  subscription_id uuid references public.client_subscriptions(id) on delete set null,
  amount numeric(10,2) not null,
  service_name text not null,
  service_slot text,
  period_start date not null,
  period_end date not null,
  kind text not null check (kind in ('new', 'renewal')),
  client_name text not null,
  client_phone text,
  client_email text,
  payment_rail text,
  reseller_name text,
  created_at timestamptz not null default now()
);

create unique index if not exists invoices_user_number_idx on public.invoices(user_id, number);
create index if not exists invoices_user_created_idx on public.invoices(user_id, created_at desc);
create index if not exists invoices_client_idx on public.invoices(client_id);

-- Historique des transactions financières (entrées / sorties)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income', 'outflow')),
  source text not null check (source in ('new_profile', 'profile_renewal', 'account_renewal')),
  funded_by text check (funded_by in ('balance', 'personal')),
  affects_balance boolean not null default true,
  amount numeric(10,2) not null,
  client_id uuid references public.clients(id) on delete set null,
  subscription_id uuid references public.client_subscriptions(id) on delete set null,
  account_id uuid references public.provider_accounts(id) on delete set null,
  label text not null default '',
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
create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists account_slots_account_id_idx on public.account_slots(account_id);
create index if not exists client_subscriptions_user_id_status_idx on public.client_subscriptions(user_id, status);
create index if not exists client_subscriptions_client_id_idx on public.client_subscriptions(client_id);
create index if not exists transactions_user_id_created_idx on public.transactions(user_id, created_at desc);

-- RLS
alter table public.user_profiles enable row level security;
alter table public.provider_accounts enable row level security;
alter table public.account_slots enable row level security;
alter table public.clients enable row level security;
alter table public.client_subscriptions enable row level security;
alter table public.transactions enable row level security;
alter table public.invoices enable row level security;
alter table public.push_subscriptions enable row level security;

-- Policies (service role bypass automatique)
drop policy if exists "users see own profile" on public.user_profiles;
create policy "users see own profile" on public.user_profiles
  for all using (auth.uid() = user_id);

drop policy if exists "users see own accounts" on public.provider_accounts;
create policy "users see own accounts" on public.provider_accounts
  for all using (auth.uid() = user_id);

drop policy if exists "users see own slots" on public.account_slots;
create policy "users see own slots" on public.account_slots
  for all using (
    exists (
      select 1 from public.provider_accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
  );

drop policy if exists "users see own clients" on public.clients;
create policy "users see own clients" on public.clients
  for all using (auth.uid() = user_id);

drop policy if exists "users see own subscriptions" on public.client_subscriptions;
create policy "users see own subscriptions" on public.client_subscriptions
  for all using (auth.uid() = user_id);

drop policy if exists "users see own transactions" on public.transactions;
create policy "users see own transactions" on public.transactions
  for all using (auth.uid() = user_id);

drop policy if exists "users see own invoices" on public.invoices;
create policy "users see own invoices" on public.invoices
  for all using (auth.uid() = user_id);

drop policy if exists "users see own push subs" on public.push_subscriptions;
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

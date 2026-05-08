create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('provider', 'client')),
  service_name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  client_id uuid references public.clients(id) on delete cascade,
  last_notified_on date,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_status_end_date_idx
  on public.subscriptions (status, end_date);

create index if not exists subscriptions_client_id_idx
  on public.subscriptions (client_id);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;
alter table public.subscriptions enable row level security;
alter table public.push_subscriptions enable row level security;

-- This app uses SUPABASE_SERVICE_ROLE_KEY from Next.js server routes/actions.
-- Do not expose the service role key in the browser.

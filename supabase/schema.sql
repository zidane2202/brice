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
alter table public.user_profiles add column if not exists logo_url text;
alter table public.user_profiles add column if not exists extra_provider_accounts int not null default 0;
alter table public.user_profiles add column if not exists suspended boolean not null default false;
alter table public.user_profiles add column if not exists plan_renews_on date;
alter table public.user_profiles add column if not exists plan_renewal_notified_on date;

-- Encaissements plateforme (cash reçu manuellement : Pro / Business / extras)
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

-- Journal immuable des opérations administratives sensibles
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id),
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_target_idx
  on public.admin_audit_logs(target_user_id, created_at desc);

-- Storage (créer aussi dans le dashboard Supabase) :
-- Bucket public: logos
-- Path: {user_id}/logo.{ext}
-- Policies: owner-only write ; public read

-- Comptes provider (ex: "Mon Netflix Premium")
create table if not exists public.provider_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_name text not null,
  label text,
  account_email text,
  account_password text,
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
alter table public.provider_accounts add column if not exists account_email text;
alter table public.provider_accounts add column if not exists account_password text;

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
  source text not null check (source in ('new_profile', 'profile_renewal', 'account_renewal', 'manual_expense')),
  funded_by text check (funded_by in ('balance', 'personal')),
  affects_balance boolean not null default true,
  amount numeric(10,2) not null,
  client_id uuid references public.clients(id) on delete set null,
  subscription_id uuid references public.client_subscriptions(id) on delete set null,
  account_id uuid references public.provider_accounts(id) on delete set null,
  label text not null default '',
  category text,
  occurred_on date not null default (current_date),
  created_at timestamptz not null default now()
);

-- Comptabilité: sources, catégorie, date d'opération (migrations idempotentes)
alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in (
    'new_profile',
    'profile_renewal',
    'account_renewal',
    'manual_expense'
  ));

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

alter table public.transactions
  add column if not exists occurred_on date;

update public.transactions
set occurred_on = (created_at at time zone 'utc')::date
where occurred_on is null;

alter table public.transactions
  alter column occurred_on set default (current_date);

alter table public.transactions
  alter column occurred_on set not null;

create index if not exists transactions_user_occurred_idx
  on public.transactions(user_id, occurred_on desc);

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
alter table public.admin_audit_logs enable row level security;

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

-- Correctifs de sécurité et de cohérence (idempotents)
alter table public.client_subscriptions add column if not exists grace_until date;
alter table public.client_subscriptions drop constraint if exists client_subscriptions_status_check;
alter table public.client_subscriptions add constraint client_subscriptions_status_check
  check (status in ('active', 'cancelled', 'grace'));

create table if not exists public.rate_limits (
  key text primary key check (length(key) <= 200),
  hits integer not null default 0,
  window_started_at timestamptz not null default now()
);
alter table public.rate_limits enable row level security;

create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare allowed boolean;
begin
  if length(p_key) > 200 or p_limit < 1 or p_window_seconds < 1 then return false; end if;
  insert into public.rate_limits(key, hits, window_started_at)
  values (p_key, 1, now())
  on conflict (key) do update set
    hits = case when rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1 else rate_limits.hits + 1 end,
    window_started_at = case when rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then now() else rate_limits.window_started_at end
  returning hits <= p_limit into allowed;
  return allowed;
end;
$$;
revoke all on function public.consume_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

create table if not exists public.invoice_counters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_number integer not null default 0
);
alter table public.invoice_counters enable row level security;
create or replace function public.next_invoice_number(p_user_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.invoice_counters(user_id, last_number)
  values (p_user_id, coalesce((select max(number) from public.invoices where user_id = p_user_id), 0) + 1)
  on conflict (user_id) do update set last_number = invoice_counters.last_number + 1
  returning last_number into n;
  return n;
end;
$$;
revoke all on function public.next_invoice_number(uuid) from public;
grant execute on function public.next_invoice_number(uuid) to service_role;

create or replace function public.prevent_audit_log_changes()
returns trigger language plpgsql as $$
begin
  raise exception 'Les journaux d audit sont immuables';
end;
$$;
drop trigger if exists admin_audit_logs_immutable on public.admin_audit_logs;
create trigger admin_audit_logs_immutable before update or delete on public.admin_audit_logs
for each row execute function public.prevent_audit_log_changes();

create or replace function public.record_platform_payment_atomic(
  p_actor uuid, p_reseller uuid, p_amount numeric, p_kind text, p_note text,
  p_occurred_on date, p_apply_plan boolean, p_plan text, p_extras integer, p_renews_on date
) returns uuid language plpgsql security definer set search_path = public as $$
declare payment_id uuid;
begin
  if not exists (select 1 from user_profiles where user_id = p_actor and role = 'admin') then raise exception 'Accès refusé'; end if;
  if exists (select 1 from platform_payments where reseller_user_id=p_reseller and kind=p_kind and amount=p_amount and created_at >= now()-interval '2 minutes') then
    raise exception 'Un encaissement identique vient déjà d être enregistré';
  end if;
  if p_apply_plan then
    update user_profiles set plan=p_plan, extra_provider_accounts=case when p_plan='pro' then p_extras else 0 end,
      suspended=false, plan_renews_on=p_renews_on, plan_renewal_notified_on=null where user_id=p_reseller;
    if not found then raise exception 'Vendeur introuvable'; end if;
  end if;
  insert into platform_payments(reseller_user_id,amount,kind,note,occurred_on,recorded_by,applied_plan,applied_extras)
  values(p_reseller,p_amount,p_kind,nullif(p_note,''),p_occurred_on,p_actor,case when p_apply_plan then p_plan end,case when p_apply_plan then p_extras end)
  returning id into payment_id;
  insert into admin_audit_logs(actor_user_id,target_user_id,action,details)
  values(p_actor,p_reseller,'platform_payment_recorded',jsonb_build_object('amount',p_amount,'kind',p_kind,'occurredOn',p_occurred_on,'appliedPlan',case when p_apply_plan then p_plan end,'appliedExtras',case when p_apply_plan then p_extras end,'note',nullif(p_note,'')));
  return payment_id;
end;
$$;
revoke all on function public.record_platform_payment_atomic(uuid,uuid,numeric,text,text,date,boolean,text,integer,date) from public;
grant execute on function public.record_platform_payment_atomic(uuid,uuid,numeric,text,text,date,boolean,text,integer,date) to service_role;

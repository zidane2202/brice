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

create table if not exists public.platform_payment_reversals (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.platform_payments(id) on delete restrict,
  reseller_user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  reason text not null check (length(reason) between 3 and 300),
  reversed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists platform_payment_reversals_reseller_idx on public.platform_payment_reversals(reseller_user_id, created_at desc);
alter table public.platform_payment_reversals enable row level security;

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
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;

-- Les justificatifs sont privés et chaque vendeur reste limité à son dossier.
drop policy if exists "owners read own receipts" on storage.objects;
create policy "owners read own receipts" on storage.objects for select to authenticated
using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "owners upload own receipts" on storage.objects;
create policy "owners upload own receipts" on storage.objects for insert to authenticated
with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "owners update own receipts" on storage.objects;
create policy "owners update own receipts" on storage.objects for update to authenticated
using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "owners delete own receipts" on storage.objects;
create policy "owners delete own receipts" on storage.objects for delete to authenticated
using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

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
alter table public.invoices add column if not exists status text not null default 'paid';
alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check check (status in ('paid','cancelled','refunded'));
alter table public.invoices add column if not exists payment_reference text;
alter table public.invoices add column if not exists receipt_url text;

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
    'manual_expense',
    'reversal'
  ));
alter table public.transactions add column if not exists reversed_transaction_id uuid references public.transactions(id) on delete restrict;
alter table public.transactions add column if not exists reversal_reason text;
create unique index if not exists transactions_one_reversal_idx on public.transactions(reversed_transaction_id) where reversed_transaction_id is not null;

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
alter table public.clients add column if not exists archived_at timestamptz;

create table if not exists public.client_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  subscription_id uuid references public.client_subscriptions(id) on delete set null,
  type text not null,
  title text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists client_events_client_created_idx on public.client_events(client_id, created_at desc);
alter table public.client_events enable row level security;
drop policy if exists "users see own client events" on public.client_events;
create policy "users see own client events" on public.client_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.client_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  subscription_id uuid not null references public.client_subscriptions(id) on delete cascade,
  status text not null default 'prepared' check (status in ('prepared','sent','replied','paid')),
  message text not null,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, subscription_id)
);
create index if not exists client_reminders_user_status_idx on public.client_reminders(user_id,status,updated_at desc);
alter table public.client_reminders enable row level security;
drop policy if exists "users manage own reminders" on public.client_reminders;
create policy "users manage own reminders" on public.client_reminders for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check(length(subject) between 3 and 120), status text not null default 'open' check(status in ('open','in_progress','resolved')),
  priority text not null default 'normal' check(priority in ('normal','urgent')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, author_role text not null check(author_role in ('reseller','admin')),
  body text not null check(length(body) between 1 and 3000), created_at timestamptz not null default now()
);
create index if not exists support_tickets_status_idx on public.support_tickets(status,updated_at desc);
alter table public.support_tickets enable row level security; alter table public.support_messages enable row level security;
drop policy if exists "users see own tickets" on public.support_tickets; create policy "users see own tickets" on public.support_tickets for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "users see own ticket messages" on public.support_messages; create policy "users see own ticket messages" on public.support_messages for all using(exists(select 1 from support_tickets t where t.id=ticket_id and t.user_id=auth.uid())) with check(exists(select 1 from support_tickets t where t.id=ticket_id and t.user_id=auth.uid()));

create table if not exists public.system_job_runs(id uuid primary key default gen_random_uuid(),job_name text not null,status text not null check(status in ('success','failed')),details jsonb not null default '{}'::jsonb,started_at timestamptz not null,finished_at timestamptz not null default now());
create index if not exists system_job_runs_job_idx on public.system_job_runs(job_name,finished_at desc);alter table public.system_job_runs enable row level security;
create table if not exists public.push_delivery_logs(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete set null,status text not null check(status in ('sent','failed','expired')),created_at timestamptz not null default now());
create index if not exists push_delivery_logs_created_idx on public.push_delivery_logs(created_at desc);alter table public.push_delivery_logs enable row level security;
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

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  url text not null default '/dashboard',
  dedup_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, dedup_key)
);
create index if not exists user_notifications_user_created_idx on public.user_notifications(user_id, created_at desc);
alter table public.user_notifications enable row level security;
drop policy if exists "users see own notifications" on public.user_notifications;
create policy "users see own notifications" on public.user_notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
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

-- Conserve l'identifiant historique après suppression d'un vendeur sans modifier le journal.
alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_target_user_id_fkey;

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

-- Fusion atomique : toutes les références sont déplacées ou rien ne change.
create or replace function public.merge_clients_atomic(p_user uuid, p_source uuid, p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare source_row clients%rowtype; target_row clients%rowtype; merged_notes text;
begin
  if p_source = p_target then raise exception 'Sélection de fusion invalide'; end if;
  select * into source_row from clients where id = p_source and user_id = p_user for update;
  select * into target_row from clients where id = p_target and user_id = p_user for update;
  if source_row.id is null or target_row.id is null then raise exception 'Client introuvable'; end if;
  merged_notes := concat_ws(E'\n\n', nullif(target_row.notes, ''),
    case when nullif(source_row.notes, '') is not null then
      'Fusion de ' || trim(concat_ws(' ', source_row.first_name, source_row.last_name)) || ' : ' || source_row.notes end);
  update client_subscriptions set client_id = p_target where client_id = p_source and user_id = p_user;
  update transactions set client_id = p_target where client_id = p_source and user_id = p_user;
  update invoices set client_id = p_target where client_id = p_source and user_id = p_user;
  update client_events set client_id = p_target where client_id = p_source and user_id = p_user;
  update clients set notes = nullif(merged_notes, '') where id = p_target and user_id = p_user;
  delete from clients where id = p_source and user_id = p_user;
  insert into client_events(user_id, client_id, type, title, details)
  values (p_user, p_target, 'clients_merged', 'Doublon fusionné',
    jsonb_build_object('sourceName', trim(concat_ws(' ', source_row.first_name, source_row.last_name))));
end;
$$;
revoke all on function public.merge_clients_atomic(uuid,uuid,uuid) from public;
grant execute on function public.merge_clients_atomic(uuid,uuid,uuid) to service_role;

-- Restauration atomique d'une sauvegarde appartenant au compte connecté.
create or replace function public.restore_account_backup_atomic(p_user uuid, p_backup jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare restored integer := 0; affected integer;
begin
  if jsonb_typeof(p_backup) <> 'object' then raise exception 'Sauvegarde invalide'; end if;
  update user_profiles p set
    first_name = coalesce(x.first_name, p.first_name), last_name = coalesce(x.last_name, p.last_name),
    company_name = coalesce(x.company_name, p.company_name), phone = coalesce(x.phone, p.phone), city = coalesce(x.city, p.city)
  from jsonb_to_record(coalesce((p_backup->'user_profiles')->0, '{}'::jsonb))
    as x(first_name text,last_name text,company_name text,phone text,city text)
  where p.user_id = p_user;

  insert into provider_accounts(id,user_id,service_name,label,account_email,max_slots,start_date,end_date,duration_months,cost,status,created_at)
  select id,p_user,service_name,label,account_email,max_slots,start_date,end_date,duration_months,cost,status,created_at
  from jsonb_populate_recordset(null::provider_accounts, coalesce(p_backup->'provider_accounts','[]'::jsonb))
  on conflict(id) do update set service_name=excluded.service_name,label=excluded.label,account_email=excluded.account_email,max_slots=excluded.max_slots,start_date=excluded.start_date,end_date=excluded.end_date,duration_months=excluded.duration_months,cost=excluded.cost,status=excluded.status
  where provider_accounts.user_id=p_user;
  get diagnostics affected = row_count; restored := restored + affected;

  if exists(select 1 from jsonb_populate_recordset(null::account_slots,coalesce(p_backup->'account_slots','[]'::jsonb)) s left join provider_accounts a on a.id=s.account_id and a.user_id=p_user where a.id is null) then raise exception 'Profil rattaché à un autre compte'; end if;
  insert into account_slots(id,account_id,slot_number,label)
  select id,account_id,slot_number,label from jsonb_populate_recordset(null::account_slots,coalesce(p_backup->'account_slots','[]'::jsonb))
  on conflict(id) do update set account_id=excluded.account_id,slot_number=excluded.slot_number,label=excluded.label;
  get diagnostics affected = row_count; restored := restored + affected;

  insert into clients(id,user_id,first_name,last_name,email,phone,payment_rail,notes,pin_code,created_at,archived_at)
  select id,p_user,first_name,last_name,email,phone,payment_rail,notes,pin_code,created_at,archived_at from jsonb_populate_recordset(null::clients,coalesce(p_backup->'clients','[]'::jsonb))
  on conflict(id) do update set first_name=excluded.first_name,last_name=excluded.last_name,email=excluded.email,phone=excluded.phone,payment_rail=excluded.payment_rail,notes=excluded.notes,pin_code=excluded.pin_code,archived_at=excluded.archived_at where clients.user_id=p_user;
  get diagnostics affected = row_count; restored := restored + affected;

  insert into client_subscriptions select id,p_user,slot_id,client_id,start_date,end_date,duration_months,price,status,last_notified_on,created_at,grace_until from jsonb_populate_recordset(null::client_subscriptions,coalesce(p_backup->'client_subscriptions','[]'::jsonb))
  on conflict(id) do update set slot_id=excluded.slot_id,client_id=excluded.client_id,start_date=excluded.start_date,end_date=excluded.end_date,duration_months=excluded.duration_months,price=excluded.price,status=excluded.status,last_notified_on=excluded.last_notified_on,grace_until=excluded.grace_until where client_subscriptions.user_id=p_user;
  get diagnostics affected = row_count; restored := restored + affected;

  insert into transactions select id,p_user,kind,source,funded_by,affects_balance,amount,client_id,subscription_id,account_id,label,category,occurred_on,created_at,reversed_transaction_id,reversal_reason from jsonb_populate_recordset(null::transactions,coalesce(p_backup->'transactions','[]'::jsonb))
  on conflict(id) do update set kind=excluded.kind,source=excluded.source,funded_by=excluded.funded_by,affects_balance=excluded.affects_balance,amount=excluded.amount,client_id=excluded.client_id,subscription_id=excluded.subscription_id,account_id=excluded.account_id,label=excluded.label,category=excluded.category,occurred_on=excluded.occurred_on,reversed_transaction_id=excluded.reversed_transaction_id,reversal_reason=excluded.reversal_reason where transactions.user_id=p_user;
  get diagnostics affected = row_count; restored := restored + affected;

  insert into invoices select id,p_user,number,code,client_id,subscription_id,amount,service_name,service_slot,period_start,period_end,kind,client_name,client_phone,client_email,payment_rail,reseller_name,created_at,status,payment_reference,receipt_url from jsonb_populate_recordset(null::invoices,coalesce(p_backup->'invoices','[]'::jsonb))
  on conflict(id) do update set amount=excluded.amount,service_name=excluded.service_name,service_slot=excluded.service_slot,period_start=excluded.period_start,period_end=excluded.period_end,kind=excluded.kind,client_name=excluded.client_name,client_phone=excluded.client_phone,client_email=excluded.client_email,payment_rail=excluded.payment_rail,reseller_name=excluded.reseller_name,status=excluded.status,payment_reference=excluded.payment_reference,receipt_url=excluded.receipt_url where invoices.user_id=p_user;
  get diagnostics affected = row_count; restored := restored + affected;

  insert into client_events(id,user_id,client_id,subscription_id,type,title,details,created_at)
  select id,p_user,client_id,subscription_id,type,title,details,created_at from jsonb_populate_recordset(null::client_events,coalesce(p_backup->'client_events','[]'::jsonb))
  on conflict(id) do update set client_id=excluded.client_id,subscription_id=excluded.subscription_id,type=excluded.type,title=excluded.title,details=excluded.details where client_events.user_id=p_user;
  get diagnostics affected = row_count; restored := restored + affected;
  return restored;
end;
$$;
revoke all on function public.restore_account_backup_atomic(uuid,jsonb) from public;
grant execute on function public.restore_account_backup_atomic(uuid,jsonb) to service_role;

create or replace function public.client_list_summary(p_user uuid)
returns jsonb language sql stable security definer set search_path=public as $$
with base as (
  select s.*,c.first_name,c.last_name,c.created_at client_created
  from client_subscriptions s join clients c on c.id=s.client_id
  where s.user_id=p_user and c.archived_at is null
), totals as (
  select count(*) filter(where status='active' and end_date>current_date+3)::int active,
    count(*) filter(where status='active' and end_date between current_date and current_date+3)::int warning,
    count(*) filter(where status='cancelled' or (status<>'grace' and end_date<current_date))::int danger,
    count(*) filter(where status='grace')::int grace,
    coalesce(sum(price),0) revenue,
    count(distinct client_id)::int clients,
    count(distinct client_id) filter(where date_trunc('month',client_created)=date_trunc('month',current_date))::int acquired
  from base
), top_client as (
  select client_id,trim(concat_ws(' ',first_name,last_name)) name,coalesce(sum(price),0) total from base group by client_id,first_name,last_name order by total desc limit 1
)
select jsonb_build_object('active',t.active,'warning',t.warning,'danger',t.danger,'grace',t.grace,'visible',t.active+t.warning+t.grace,
  'totalRevenue',t.revenue,'clients',t.clients,'acquired',t.acquired,'topClient',coalesce((select jsonb_build_object('name',name,'total',total) from top_client),'null'::jsonb)) from totals t;
$$;
revoke all on function public.client_list_summary(uuid) from public;grant execute on function public.client_list_summary(uuid) to service_role;

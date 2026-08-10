-- Coller dans le SQL Editor Supabase (idempotent). Audit #4.
-- Prérequis: audit2-hardening.sql + audit3-hardening.sql (ou coller celui-ci après audit2 :
--   il remplace restore + ajoute index/push/creds/notifs).

-- Slot: un seul abo active/grace par profil
create unique index if not exists client_subscriptions_one_active_slot_idx
  on public.client_subscriptions(slot_id)
  where status in ('active', 'grace') and slot_id is not null;

-- Creds: le client browser ne lit plus account_password
revoke all on table public.provider_accounts from anon, authenticated;
grant select (
  id, user_id, service_name, label, account_email, max_slots,
  start_date, end_date, duration_months, cost, status, created_at
) on table public.provider_accounts to authenticated;
grant insert, update, delete on table public.provider_accounts to authenticated;

-- Notifications: lecture seule côté client (updates via service_role API)
drop policy if exists "users see own notifications" on public.user_notifications;
drop policy if exists "users select own notifications" on public.user_notifications;
drop policy if exists "users mark own notifications read" on public.user_notifications;
create policy "users select own notifications" on public.user_notifications
  for select using (auth.uid() = user_id);

-- Push upsert atomique (anti-race)
create or replace function public.upsert_push_subscription(p_user uuid, p_endpoint text, p_subscription jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if p_endpoint is null or length(p_endpoint) < 12 or p_subscription is null then
    raise exception 'Abonnement push invalide';
  end if;
  select user_id into owner from public.push_subscriptions where endpoint = p_endpoint for update;
  if owner is not null and owner <> p_user then
    raise exception 'Cet appareil est déjà lié à un autre compte.';
  end if;
  insert into public.push_subscriptions(user_id, endpoint, subscription)
  values (p_user, p_endpoint, p_subscription)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        subscription = excluded.subscription
    where push_subscriptions.user_id = p_user;
end;
$$;
revoke all on function public.upsert_push_subscription(uuid, text, jsonb) from public;
grant execute on function public.upsert_push_subscription(uuid, text, jsonb) to service_role;

-- Restore: FK complètes + invoice_id + client_events
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
  if exists(
    select 1 from jsonb_populate_recordset(null::account_slots,coalesce(p_backup->'account_slots','[]'::jsonb)) s
    join account_slots existing on existing.id = s.id
    join provider_accounts owner on owner.id = existing.account_id
    where owner.user_id <> p_user
  ) then raise exception 'Profil déjà possédé par un autre compte'; end if;
  insert into account_slots(id,account_id,slot_number,label)
  select id,account_id,slot_number,label from jsonb_populate_recordset(null::account_slots,coalesce(p_backup->'account_slots','[]'::jsonb))
  on conflict(id) do update set account_id=excluded.account_id,slot_number=excluded.slot_number,label=excluded.label
  where exists (select 1 from provider_accounts a where a.id = account_slots.account_id and a.user_id = p_user);
  get diagnostics affected = row_count; restored := restored + affected;

  insert into clients(id,user_id,first_name,last_name,email,phone,payment_rail,notes,pin_code,created_at,archived_at)
  select id,p_user,first_name,last_name,email,phone,payment_rail,notes,pin_code,created_at,archived_at from jsonb_populate_recordset(null::clients,coalesce(p_backup->'clients','[]'::jsonb))
  on conflict(id) do update set first_name=excluded.first_name,last_name=excluded.last_name,email=excluded.email,phone=excluded.phone,payment_rail=excluded.payment_rail,notes=excluded.notes,pin_code=excluded.pin_code,archived_at=excluded.archived_at where clients.user_id=p_user;
  get diagnostics affected = row_count; restored := restored + affected;

  if exists(
    select 1 from jsonb_populate_recordset(null::client_subscriptions, coalesce(p_backup->'client_subscriptions','[]'::jsonb)) s
    left join clients c on c.id = s.client_id and c.user_id = p_user
    where s.client_id is not null and c.id is null
  ) then raise exception 'Abonnement rattaché à un client étranger'; end if;
  if exists(
    select 1 from jsonb_populate_recordset(null::client_subscriptions, coalesce(p_backup->'client_subscriptions','[]'::jsonb)) s
    left join account_slots sl on sl.id = s.slot_id
    left join provider_accounts a on a.id = sl.account_id and a.user_id = p_user
    where s.slot_id is not null and a.id is null
  ) then raise exception 'Abonnement rattaché à un profil étranger'; end if;

  insert into client_subscriptions select id,p_user,slot_id,client_id,start_date,end_date,duration_months,price,status,last_notified_on,created_at,grace_until from jsonb_populate_recordset(null::client_subscriptions,coalesce(p_backup->'client_subscriptions','[]'::jsonb))
  on conflict(id) do update set slot_id=excluded.slot_id,client_id=excluded.client_id,start_date=excluded.start_date,end_date=excluded.end_date,duration_months=excluded.duration_months,price=excluded.price,status=excluded.status,last_notified_on=excluded.last_notified_on,grace_until=excluded.grace_until where client_subscriptions.user_id=p_user;
  get diagnostics affected = row_count; restored := restored + affected;

  if exists(
    select 1 from jsonb_populate_recordset(null::transactions, coalesce(p_backup->'transactions','[]'::jsonb)) t
    left join clients c on c.id = t.client_id and c.user_id = p_user
    where t.client_id is not null and c.id is null
  ) then raise exception 'Transaction rattachée à un client étranger'; end if;
  if exists(
    select 1 from jsonb_populate_recordset(null::transactions, coalesce(p_backup->'transactions','[]'::jsonb)) t
    left join provider_accounts a on a.id = t.account_id and a.user_id = p_user
    where t.account_id is not null and a.id is null
  ) then raise exception 'Transaction rattachée à un compte étranger'; end if;
  if exists(
    select 1 from jsonb_populate_recordset(null::transactions, coalesce(p_backup->'transactions','[]'::jsonb)) t
    left join client_subscriptions s on s.id = t.subscription_id and s.user_id = p_user
    where t.subscription_id is not null and s.id is null
  ) then raise exception 'Transaction rattachée à un abonnement étranger'; end if;
  if exists(
    select 1 from jsonb_populate_recordset(null::transactions, coalesce(p_backup->'transactions','[]'::jsonb)) t
    left join transactions orig on orig.id = t.reversed_transaction_id and orig.user_id = p_user
    where t.reversed_transaction_id is not null and orig.id is null
  ) then raise exception 'Annulation rattachée à une transaction étrangère'; end if;
  if exists(
    select 1 from jsonb_populate_recordset(null::transactions, coalesce(p_backup->'transactions','[]'::jsonb)) t
    join transactions existing on existing.id = t.id
    where existing.user_id <> p_user
  ) then raise exception 'Transaction déjà possédée par un autre compte'; end if;

  insert into transactions(id,user_id,kind,source,funded_by,affects_balance,amount,client_id,subscription_id,account_id,label,category,occurred_on,created_at,reversed_transaction_id,reversal_reason)
  select id,p_user,kind,source,funded_by,affects_balance,amount,client_id,subscription_id,account_id,label,category,occurred_on,created_at,reversed_transaction_id,reversal_reason
  from jsonb_populate_recordset(null::transactions,coalesce(p_backup->'transactions','[]'::jsonb))
  on conflict(id) do update set kind=excluded.kind,source=excluded.source,funded_by=excluded.funded_by,affects_balance=excluded.affects_balance,amount=excluded.amount,client_id=excluded.client_id,subscription_id=excluded.subscription_id,account_id=excluded.account_id,label=excluded.label,category=excluded.category,occurred_on=excluded.occurred_on,reversed_transaction_id=excluded.reversed_transaction_id,reversal_reason=excluded.reversal_reason where transactions.user_id=p_user;
  get diagnostics affected = row_count; restored := restored + affected;

  if exists(
    select 1 from jsonb_populate_recordset(null::invoices, coalesce(p_backup->'invoices','[]'::jsonb)) i
    left join clients c on c.id = i.client_id and c.user_id = p_user
    where i.client_id is not null and c.id is null
  ) then raise exception 'Facture rattachée à un client étranger'; end if;
  if exists(
    select 1 from jsonb_populate_recordset(null::invoices, coalesce(p_backup->'invoices','[]'::jsonb)) i
    left join client_subscriptions s on s.id = i.subscription_id and s.user_id = p_user
    where i.subscription_id is not null and s.id is null
  ) then raise exception 'Facture rattachée à un abonnement étranger'; end if;

  insert into invoices select id,p_user,number,code,client_id,subscription_id,amount,service_name,service_slot,period_start,period_end,kind,client_name,client_phone,client_email,payment_rail,reseller_name,created_at,status,payment_reference,receipt_url from jsonb_populate_recordset(null::invoices,coalesce(p_backup->'invoices','[]'::jsonb))
  on conflict(id) do update set amount=excluded.amount,service_name=excluded.service_name,service_slot=excluded.service_slot,period_start=excluded.period_start,period_end=excluded.period_end,kind=excluded.kind,client_name=excluded.client_name,client_phone=excluded.client_phone,client_email=excluded.client_email,payment_rail=excluded.payment_rail,reseller_name=excluded.reseller_name,status=excluded.status,payment_reference=excluded.payment_reference,receipt_url=excluded.receipt_url where invoices.user_id=p_user;
  get diagnostics affected = row_count; restored := restored + affected;

  -- Relie invoice_id après insert factures (colonne peut être absente du JSON populate)
  update transactions t
  set invoice_id = x.invoice_id
  from (
    select (row->>'id')::uuid as id, nullif(row->>'invoice_id','')::uuid as invoice_id
    from jsonb_array_elements(coalesce(p_backup->'transactions','[]'::jsonb)) as row
  ) x
  where t.id = x.id and t.user_id = p_user and x.invoice_id is not null
    and exists (select 1 from invoices i where i.id = x.invoice_id and i.user_id = p_user);

  if exists(
    select 1 from jsonb_populate_recordset(null::client_events, coalesce(p_backup->'client_events','[]'::jsonb)) e
    left join clients c on c.id = e.client_id and c.user_id = p_user
    where e.client_id is not null and c.id is null
  ) then raise exception 'Événement rattaché à un client étranger'; end if;

  insert into client_events(id,user_id,client_id,subscription_id,type,title,details,created_at)
  select id,p_user,client_id,subscription_id,type,title,details,created_at
  from jsonb_populate_recordset(null::client_events, coalesce(p_backup->'client_events','[]'::jsonb))
  on conflict(id) do update set client_id=excluded.client_id,subscription_id=excluded.subscription_id,type=excluded.type,title=excluded.title,details=excluded.details
  where client_events.user_id=p_user;
  get diagnostics affected = row_count; restored := restored + affected;

  return restored;
end;
$$;

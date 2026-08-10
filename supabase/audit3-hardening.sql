-- Coller dans le SQL Editor Supabase (idempotent). Audit #3 P0.
-- Prérequis: audit2-hardening.sql déjà exécuté.

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

  insert into invoices select id,p_user,number,code,client_id,subscription_id,amount,service_name,service_slot,period_start,period_end,kind,client_name,client_phone,client_email,payment_rail,reseller_name,created_at,status,payment_reference,receipt_url from jsonb_populate_recordset(null::invoices,coalesce(p_backup->'invoices','[]'::jsonb))
  on conflict(id) do update set amount=excluded.amount,service_name=excluded.service_name,service_slot=excluded.service_slot,period_start=excluded.period_start,period_end=excluded.period_end,kind=excluded.kind,client_name=excluded.client_name,client_phone=excluded.client_phone,client_email=excluded.client_email,payment_rail=excluded.payment_rail,reseller_name=excluded.reseller_name,status=excluded.status,payment_reference=excluded.payment_reference,receipt_url=excluded.receipt_url where invoices.user_id=p_user;
  get diagnostics affected = row_count; restored := restored + affected;

  return restored;
end;
$$;

create or replace function public.reverse_platform_payment_atomic(p_actor uuid, p_payment uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare pay platform_payments%rowtype;
declare cur_plan text;
begin
  if not exists (select 1 from user_profiles where user_id = p_actor and role = 'admin') then raise exception 'Accès refusé'; end if;
  if length(trim(p_reason)) < 3 or length(trim(p_reason)) > 300 then raise exception 'Le motif doit contenir entre 3 et 300 caractères.'; end if;
  select * into pay from platform_payments where id = p_payment;
  if not found then raise exception 'Encaissement introuvable.'; end if;

  if pay.applied_plan is not null then
    if exists (
      select 1 from platform_payments p
      left join platform_payment_reversals r on r.payment_id = p.id
      where p.reseller_user_id = pay.reseller_user_id
        and p.applied_plan is not null
        and r.id is null
        and p.created_at > pay.created_at
    ) then
      raise exception 'Annulez d abord l encaissement pack le plus récent.';
    end if;
    select plan into cur_plan from user_profiles where user_id = pay.reseller_user_id;
    if cur_plan is distinct from pay.applied_plan then
      raise exception 'Le pack actuel ne correspond plus à cet encaissement.';
    end if;
  end if;

  insert into platform_payment_reversals(payment_id, reseller_user_id, amount, reason, reversed_by)
  values (pay.id, pay.reseller_user_id, pay.amount, trim(p_reason), p_actor);
  if pay.applied_plan is not null and pay.previous_plan is not null then
    update user_profiles set
      plan = pay.previous_plan,
      extra_provider_accounts = coalesce(pay.previous_extras, 0),
      plan_renews_on = pay.previous_plan_renews_on,
      suspended = coalesce(pay.previous_suspended, false),
      plan_renewal_notified_on = null
    where user_id = pay.reseller_user_id;
  end if;
  insert into admin_audit_logs(actor_user_id,target_user_id,action,details)
  values(p_actor,pay.reseller_user_id,'platform_payment_reversed',jsonb_build_object('paymentId',pay.id,'amount',pay.amount,'kind',pay.kind,'reason',trim(p_reason),'planRolledBack',pay.previous_plan));
end;
$$;
revoke all on function public.reverse_platform_payment_atomic(uuid,uuid,text) from public;
grant execute on function public.reverse_platform_payment_atomic(uuid,uuid,text) to service_role;

-- Coller dans le SQL Editor Supabase (idempotent). Audit #2.

alter table public.platform_payments add column if not exists previous_plan text;
alter table public.platform_payments add column if not exists previous_extras int;
alter table public.platform_payments add column if not exists previous_plan_renews_on date;
alter table public.platform_payments add column if not exists previous_suspended boolean;

alter table public.transactions add column if not exists invoice_id uuid references public.invoices(id) on delete set null;

create or replace function public.record_platform_payment_atomic(
  p_actor uuid, p_reseller uuid, p_amount numeric, p_kind text, p_note text,
  p_occurred_on date, p_apply_plan boolean, p_plan text, p_extras integer, p_renews_on date
) returns uuid language plpgsql security definer set search_path = public as $$
declare payment_id uuid;
declare prev_plan text;
declare prev_extras int;
declare prev_renews date;
declare prev_suspended boolean;
begin
  if not exists (select 1 from user_profiles where user_id = p_actor and role = 'admin') then raise exception 'Accès refusé'; end if;
  if exists (select 1 from platform_payments where reseller_user_id=p_reseller and kind=p_kind and amount=p_amount and created_at >= now()-interval '2 minutes') then
    raise exception 'Un encaissement identique vient déjà d être enregistré';
  end if;
  select plan, extra_provider_accounts, plan_renews_on, suspended
    into prev_plan, prev_extras, prev_renews, prev_suspended
  from user_profiles where user_id = p_reseller;
  if not found then raise exception 'Vendeur introuvable'; end if;
  if p_apply_plan then
    update user_profiles set plan=p_plan, extra_provider_accounts=case when p_plan='pro' then p_extras else 0 end,
      suspended=false, plan_renews_on=p_renews_on, plan_renewal_notified_on=null where user_id=p_reseller;
  end if;
  insert into platform_payments(
    reseller_user_id,amount,kind,note,occurred_on,recorded_by,applied_plan,applied_extras,
    previous_plan,previous_extras,previous_plan_renews_on,previous_suspended
  )
  values(
    p_reseller,p_amount,p_kind,nullif(p_note,''),p_occurred_on,p_actor,
    case when p_apply_plan then p_plan end,case when p_apply_plan then p_extras end,
    case when p_apply_plan then prev_plan end,case when p_apply_plan then prev_extras end,
    case when p_apply_plan then prev_renews end,case when p_apply_plan then prev_suspended end
  )
  returning id into payment_id;
  insert into admin_audit_logs(actor_user_id,target_user_id,action,details)
  values(p_actor,p_reseller,'platform_payment_recorded',jsonb_build_object('amount',p_amount,'kind',p_kind,'occurredOn',p_occurred_on,'appliedPlan',case when p_apply_plan then p_plan end,'appliedExtras',case when p_apply_plan then p_extras end,'note',nullif(p_note,'')));
  return payment_id;
end;
$$;
revoke all on function public.record_platform_payment_atomic(uuid,uuid,numeric,text,text,date,boolean,text,integer,date) from public;
grant execute on function public.record_platform_payment_atomic(uuid,uuid,numeric,text,text,date,boolean,text,integer,date) to service_role;

create or replace function public.reverse_platform_payment_atomic(p_actor uuid, p_payment uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare pay platform_payments%rowtype;
begin
  if not exists (select 1 from user_profiles where user_id = p_actor and role = 'admin') then raise exception 'Accès refusé'; end if;
  if length(trim(p_reason)) < 3 or length(trim(p_reason)) > 300 then raise exception 'Le motif doit contenir entre 3 et 300 caractères.'; end if;
  select * into pay from platform_payments where id = p_payment;
  if not found then raise exception 'Encaissement introuvable.'; end if;
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

  insert into client_subscriptions select id,p_user,slot_id,client_id,start_date,end_date,duration_months,price,status,last_notified_on,created_at,grace_until from jsonb_populate_recordset(null::client_subscriptions,coalesce(p_backup->'client_subscriptions','[]'::jsonb))
  on conflict(id) do update set slot_id=excluded.slot_id,client_id=excluded.client_id,start_date=excluded.start_date,end_date=excluded.end_date,duration_months=excluded.duration_months,price=excluded.price,status=excluded.status,last_notified_on=excluded.last_notified_on,grace_until=excluded.grace_until where client_subscriptions.user_id=p_user;
  get diagnostics affected = row_count; restored := restored + affected;

  insert into transactions select id,p_user,kind,source,funded_by,affects_balance,amount,client_id,subscription_id,account_id,label,category,occurred_on,created_at,reversed_transaction_id,reversal_reason from jsonb_populate_recordset(null::transactions,coalesce(p_backup->'transactions','[]'::jsonb))
  on conflict(id) do update set kind=excluded.kind,source=excluded.source,funded_by=excluded.funded_by,affects_balance=excluded.affects_balance,amount=excluded.amount,client_id=excluded.client_id,subscription_id=excluded.subscription_id,account_id=excluded.account_id,label=excluded.label,category=excluded.category,occurred_on=excluded.occurred_on,reversed_transaction_id=excluded.reversed_transaction_id,reversal_reason=excluded.reversal_reason where transactions.user_id=p_user;
  get diagnostics affected = row_count; restored := restored + affected;

  insert into invoices select id,p_user,number,code,client_id,subscription_id,amount,service_name,service_slot,period_start,period_end,kind,client_name,client_phone,client_email,payment_rail,reseller_name,created_at,status,payment_reference,receipt_url from jsonb_populate_recordset(null::invoices,coalesce(p_backup->'invoices','[]'::jsonb))
  on conflict(id) do update set amount=excluded.amount,service_name=excluded.service_name,service_slot=excluded.service_slot,period_start=excluded.period_start,period_end=excluded.period_end,kind=excluded.kind,client_name=excluded.client_name,client_phone=excluded.client_phone,client_email=excluded.client_email,payment_rail=excluded.payment_rail,reseller_name=excluded.reseller_name,status=excluded.status,payment_reference=excluded.payment_reference,receipt_url=excluded.receipt_url where invoices.user_id=p_user;
  get diagnostics affected = row_count; restored := restored + affected;

  return restored;
end;
$$;

create or replace function public.seller_ledger_balance(p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when kind='income' then amount else -amount end), 0)
  from transactions
  where user_id = p_user and coalesce(affects_balance, true);
$$;
revoke all on function public.seller_ledger_balance(uuid) from public;
grant execute on function public.seller_ledger_balance(uuid) to service_role;

create or replace function public.seller_period_kpis(p_user uuid, p_from date, p_to date)
returns table(income numeric, expenses numeric) language sql stable security definer set search_path = public as $$
  select
    coalesce(sum(case when kind='income' then amount else 0 end), 0),
    coalesce(sum(case when kind='outflow' and coalesce(affects_balance, true) then amount else 0 end), 0)
  from transactions
  where user_id = p_user and occurred_on between p_from and p_to;
$$;
revoke all on function public.seller_period_kpis(uuid, date, date) from public;
grant execute on function public.seller_period_kpis(uuid, date, date) to service_role;

create or replace function public.platform_cash_between(p_from date, p_to date)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select sum(amount) from platform_payments where occurred_on between p_from and p_to), 0)
    - coalesce((
      select sum(r.amount) from platform_payment_reversals r
      join platform_payments p on p.id = r.payment_id
      where p.occurred_on between p_from and p_to
    ), 0);
$$;
revoke all on function public.platform_cash_between(date, date) from public;
grant execute on function public.platform_cash_between(date, date) to service_role;

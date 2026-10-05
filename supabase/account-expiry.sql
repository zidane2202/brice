-- Coller dans le SQL Editor Supabase (idempotent).
-- Compte fournisseur échu ou désactivé ⇒ tous ses clients comptent comme expirés (aucune grâce).
-- Les dates des clients ne sont pas modifiées : ils redeviennent actifs si le compte est renouvelé.

create or replace function public.client_list_summary(p_user uuid)
returns jsonb language sql stable security definer set search_path=public as $$
with base as (
  select s.*,c.first_name,c.last_name,c.created_at client_created,
    coalesce(pa.status='active' and pa.end_date>=current_date, true) account_live
  from public.client_subscriptions s join public.clients c on c.id=s.client_id
  left join public.account_slots sl on sl.id=s.slot_id
  left join public.provider_accounts pa on pa.id=sl.account_id
  where s.user_id=p_user and c.archived_at is null
), totals as (
  select count(*) filter(where account_live and status='active' and end_date>current_date+3)::int active,
    count(*) filter(where account_live and status='active' and end_date between current_date and current_date+3)::int warning,
    count(*) filter(where status='cancelled' or not account_live or (status='active' and end_date<current_date) or (status='grace' and grace_until<current_date))::int danger,
    count(*) filter(where account_live and status='grace' and (grace_until is null or grace_until>=current_date))::int grace,
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
revoke all on function public.client_list_summary(uuid) from public;
grant execute on function public.client_list_summary(uuid) to service_role;

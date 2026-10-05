-- Une place = un seul client actif ou en grâce. À exécuter une fois dans Supabase (SQL Editor).
begin;

-- 1. Places revendues alors que l'ancien client n'était pas libéré : on garde la vente la plus récente.
with ranked as (
  select id,
         row_number() over (partition by slot_id order by end_date desc, created_at desc) as rank
  from public.client_subscriptions
  where status in ('active', 'grace') and slot_id is not null
)
update public.client_subscriptions s
set status = 'cancelled', grace_until = null
from ranked r
where s.id = r.id and r.rank > 1;

-- 2. Empêche toute nouvelle double occupation.
create unique index if not exists client_subscriptions_one_active_slot_idx
  on public.client_subscriptions(slot_id)
  where status in ('active', 'grace') and slot_id is not null;

commit;

-- Vérification : doit renvoyer 0 ligne.
select slot_id, count(*) from public.client_subscriptions
where status in ('active', 'grace') group by slot_id having count(*) > 1;

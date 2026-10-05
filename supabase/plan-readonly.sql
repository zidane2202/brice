-- Pack expiré = lecture seule (plus de suspension automatique).
-- Lève les suspensions posées par le cron ; les suspensions manuelles d'un admin restent en place.
with last_suspension_event as (
  select distinct on (target_user_id)
    target_user_id,
    action,
    details
  from public.admin_audit_logs
  where action in ('account_suspended', 'account_unsuspended')
  order by target_user_id, created_at desc
)
update public.user_profiles p
set suspended = false
from last_suspension_event e
where e.target_user_id = p.user_id
  and p.suspended = true
  and p.role <> 'admin'
  and e.action = 'account_suspended'
  and e.details ->> 'source' = 'cron';

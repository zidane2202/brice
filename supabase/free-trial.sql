-- Plan Free = essai de 7 jours avec les fonctionnalités Pro, puis lecture seule.
-- La fin d'essai (dernier jour inclus) est stockée dans plan_renews_on.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (user_id, plan_renews_on)
  values (new.id, (now() at time zone 'Africa/Lagos')::date + 7);
  return new;
end;
$$;

-- Comptes Free existants sans date : 7 jours d'essai à partir d'aujourd'hui.
update public.user_profiles
set plan_renews_on = (now() at time zone 'Africa/Lagos')::date + 7,
    plan_renewal_notified_on = null
where coalesce(plan, 'free') not in ('pro', 'business')
  and role <> 'admin'
  and plan_renews_on is null;

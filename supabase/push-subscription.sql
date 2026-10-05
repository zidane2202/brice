-- Coller dans le SQL Editor Supabase (idempotent). Notifications push.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "users see own push subs" on public.push_subscriptions;
create policy "users see own push subs" on public.push_subscriptions
  for all using (auth.uid() = user_id);

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

notify pgrst, 'reload schema';

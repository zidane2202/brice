-- Coller dans le SQL Editor Supabase (idempotent).
-- Verrouille packs / journal plateforme / tickets.

alter table public.platform_payments enable row level security;
revoke all on public.platform_payments from anon, authenticated;
revoke all on public.platform_payment_reversals from anon, authenticated;
revoke all on public.admin_audit_logs from anon, authenticated;

alter table public.user_profiles drop constraint if exists user_profiles_plan_check;
alter table public.user_profiles add constraint user_profiles_plan_check
  check (plan in ('free', 'pro', 'business'));

drop policy if exists "users see own profile" on public.user_profiles;
drop policy if exists "users read own profile" on public.user_profiles;
drop policy if exists "users update own profile" on public.user_profiles;
create policy "users read own profile" on public.user_profiles
  for select using (auth.uid() = user_id);
create policy "users update own profile" on public.user_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.protect_user_profile_privs()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  new.role := old.role;
  new.plan := old.plan;
  new.extra_provider_accounts := old.extra_provider_accounts;
  new.suspended := old.suspended;
  new.plan_renews_on := old.plan_renews_on;
  new.plan_renewal_notified_on := old.plan_renewal_notified_on;
  return new;
end;
$$;

drop trigger if exists user_profiles_protect_privs on public.user_profiles;
create trigger user_profiles_protect_privs
  before update on public.user_profiles
  for each row execute function public.protect_user_profile_privs();

drop policy if exists "users see own tickets" on public.support_tickets;
drop policy if exists "users read own tickets" on public.support_tickets;
create policy "users read own tickets" on public.support_tickets
  for select using (auth.uid() = user_id);

drop policy if exists "users see own ticket messages" on public.support_messages;
drop policy if exists "users read own ticket messages" on public.support_messages;
drop policy if exists "users insert own reseller messages" on public.support_messages;
create policy "users read own ticket messages" on public.support_messages
  for select using (
    exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
  );

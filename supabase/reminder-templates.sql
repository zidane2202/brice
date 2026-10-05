-- Messages de relance personnalisés. À exécuter une fois dans Supabase (SQL Editor). Idempotent.
create table if not exists public.reminder_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('all','today','soon3','soon7','grace','expired','lapsed','balance')),
  name text not null check (length(name) between 1 and 60),
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reminder_templates_user_idx on public.reminder_templates(user_id, created_at);
alter table public.reminder_templates enable row level security;
drop policy if exists "users manage own reminder templates" on public.reminder_templates;
create policy "users manage own reminder templates" on public.reminder_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

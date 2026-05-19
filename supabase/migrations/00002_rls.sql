-- Row-Level-Security: every user only sees and writes their own rows.

alter table public.tickers enable row level security;
alter table public.portfolio_positions enable row level security;
alter table public.screening_runs enable row level security;
alter table public.evaluations enable row level security;
alter table public.recommendations enable row level security;
alter table public.email_recipients enable row level security;
alter table public.alerts_sent enable row level security;
alter table public.user_secrets enable row level security;

-- Helper macro: same four policies on every user-scoped table
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'tickers','portfolio_positions','screening_runs','evaluations',
      'recommendations','email_recipients','alerts_sent'
    ])
  loop
    execute format('drop policy if exists %I_select_own on public.%I', t, t);
    execute format('create policy %I_select_own on public.%I for select using (auth.uid() = user_id)', t, t);

    execute format('drop policy if exists %I_insert_own on public.%I', t, t);
    execute format('create policy %I_insert_own on public.%I for insert with check (auth.uid() = user_id)', t, t);

    execute format('drop policy if exists %I_update_own on public.%I', t, t);
    execute format('create policy %I_update_own on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);

    execute format('drop policy if exists %I_delete_own on public.%I', t, t);
    execute format('create policy %I_delete_own on public.%I for delete using (auth.uid() = user_id)', t, t);
  end loop;
end$$;

-- user_secrets keyed on user_id (PK), policies match
drop policy if exists user_secrets_select_own on public.user_secrets;
create policy user_secrets_select_own on public.user_secrets
  for select using (auth.uid() = user_id);
drop policy if exists user_secrets_insert_own on public.user_secrets;
create policy user_secrets_insert_own on public.user_secrets
  for insert with check (auth.uid() = user_id);
drop policy if exists user_secrets_update_own on public.user_secrets;
create policy user_secrets_update_own on public.user_secrets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists user_secrets_delete_own on public.user_secrets;
create policy user_secrets_delete_own on public.user_secrets
  for delete using (auth.uid() = user_id);

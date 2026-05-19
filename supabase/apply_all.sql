-- Consolidated SQL — paste this entire file into Supabase SQL Editor and run.
-- Combines migrations 00001 + 00002 + 00003. Safe to re-run (uses IF NOT EXISTS, drop+create policies).

-- ============================================================
-- 00001_init.sql
-- ============================================================

-- Buy & Sell Tool — Initial schema
-- All user-scoped tables carry user_id and rely on RLS (00002_rls.sql) for isolation.

create extension if not exists "pgcrypto";

-- ───────────────────────────── tickers ─────────────────────────────
create table if not exists public.tickers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  exchange text,
  name text,
  active boolean not null default true,
  group_tag text,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);
create index if not exists idx_tickers_user_active on public.tickers(user_id, active);

-- ──────────────────────── portfolio_positions ─────────────────────
create table if not exists public.portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  shares numeric(18,4) not null check (shares > 0),
  cost_basis numeric(18,4) not null check (cost_basis >= 0),
  currency text not null default 'USD',
  bought_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_portfolio_user on public.portfolio_positions(user_id);
create index if not exists idx_portfolio_user_symbol on public.portfolio_positions(user_id, symbol);

-- ────────────────────────── screening_runs ────────────────────────
create table if not exists public.screening_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  trigger text not null,
  tickers_total int,
  tickers_ok int,
  tickers_failed int,
  fear_greed_value int,
  fear_greed_label text,
  claude_input_tokens int,
  claude_output_tokens int,
  claude_cached_tokens int,
  duration_ms int,
  status text not null default 'running'
    check (status in ('running','done','failed'))
);
create index if not exists idx_runs_user_started on public.screening_runs(user_id, started_at desc);

-- ───────────────────────────── evaluations ─────────────────────────
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.screening_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  current_price numeric(18,4),
  -- Technicals
  rsi numeric,
  macd numeric,
  macd_signal numeric,
  macd_histogram numeric,
  macd_crossover text,
  bb_position numeric,
  sma50 numeric,
  sma200 numeric,
  atr numeric,
  fib_support numeric,
  fib_resistance numeric,
  stop_loss numeric,
  -- Scores
  score_technical numeric,
  score_fundamental numeric,
  score_sentiment numeric,
  score_total numeric,
  -- Claude output
  signal text,
  conviction numeric,
  thesis text,
  risks text[],
  catalysts text[],
  target_price numeric,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_eval_user_symbol_created on public.evaluations(user_id, symbol, created_at desc);
create index if not exists idx_eval_run on public.evaluations(run_id);

-- ─────────────────────────── recommendations ──────────────────────
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.screening_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  action text not null check (action in ('BUY','STRONG_BUY','HOLD','SELL','ADD')),
  context text not null check (context in ('watchlist','portfolio')),
  position_id uuid references public.portfolio_positions(id) on delete set null,
  rationale text,
  target_price numeric,
  stop_loss numeric,
  created_at timestamptz not null default now()
);
create index if not exists idx_rec_user_created on public.recommendations(user_id, created_at desc);
create index if not exists idx_rec_run on public.recommendations(run_id);

-- ─────────────────────────── email_recipients ─────────────────────
create table if not exists public.email_recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  receives_strong_buy boolean not null default true,
  receives_daily_report boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, email)
);
create index if not exists idx_recipients_user_active on public.email_recipients(user_id, active);

-- ─────────────────────────── alerts_sent ─────────────────────────
create table if not exists public.alerts_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  signal text not null,
  sent_at timestamptz not null default now(),
  dedup_key text not null,
  unique (user_id, dedup_key)
);
create index if not exists idx_alerts_user_sent on public.alerts_sent(user_id, sent_at desc);

-- ─────────────────────────── user_secrets ─────────────────────────
-- Storage for per-user API keys / SMTP creds (Supabase Vault preferred for production)
create table if not exists public.user_secrets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alphavantage_key text,
  google_sheets_id text,
  smtp_host text,
  smtp_port int,
  smtp_user text,
  smtp_password text,
  smtp_from_address text,
  smtp_from_name text,
  updated_at timestamptz not null default now()
);

-- ────────────────────────── updated_at trigger ────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_portfolio_updated_at on public.portfolio_positions;
create trigger trg_portfolio_updated_at
  before update on public.portfolio_positions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_secrets_updated_at on public.user_secrets;
create trigger trg_user_secrets_updated_at
  before update on public.user_secrets
  for each row execute function public.set_updated_at();


-- ============================================================
-- 00002_rls.sql
-- ============================================================

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


-- ============================================================
-- 00003_seed_rpc.sql
-- ============================================================

-- RPC: seed the default ticker universe for a freshly onboarded user.
-- The web app calls supabase.rpc('seed_default_universe') after first sign-in.

create or replace function public.seed_default_universe()
returns int
language plpgsql
security invoker
as $$
declare
  uid uuid := auth.uid();
  inserted_count int := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  with src as (
    select * from (values
      ('AAPL','NASDAQ','Apple Inc.','sp500_top60'),
      ('MSFT','NASDAQ','Microsoft Corp.','sp500_top60'),
      ('NVDA','NASDAQ','NVIDIA Corp.','sp500_top60'),
      ('GOOGL','NASDAQ','Alphabet Inc. (A)','sp500_top60'),
      ('AMZN','NASDAQ','Amazon.com Inc.','sp500_top60'),
      ('META','NASDAQ','Meta Platforms','sp500_top60'),
      ('TSLA','NASDAQ','Tesla Inc.','sp500_top60'),
      ('BRK.B','NYSE','Berkshire Hathaway (B)','sp500_top60'),
      ('AVGO','NASDAQ','Broadcom Inc.','sp500_top60'),
      ('JPM','NYSE','JPMorgan Chase & Co.','sp500_top60'),
      ('V','NYSE','Visa Inc.','sp500_top60'),
      ('UNH','NYSE','UnitedHealth Group','sp500_top60'),
      ('XOM','NYSE','Exxon Mobil Corp.','sp500_top60'),
      ('WMT','NYSE','Walmart Inc.','sp500_top60'),
      ('LLY','NYSE','Eli Lilly & Co.','sp500_top60'),
      ('JNJ','NYSE','Johnson & Johnson','sp500_top60'),
      ('MA','NYSE','Mastercard Inc.','sp500_top60'),
      ('PG','NYSE','Procter & Gamble','sp500_top60'),
      ('ORCL','NYSE','Oracle Corp.','sp500_top60'),
      ('HD','NYSE','Home Depot Inc.','sp500_top60'),
      ('COST','NASDAQ','Costco Wholesale','sp500_top60'),
      ('CVX','NYSE','Chevron Corp.','sp500_top60'),
      ('ABBV','NYSE','AbbVie Inc.','sp500_top60'),
      ('MRK','NYSE','Merck & Co.','sp500_top60'),
      ('BAC','NYSE','Bank of America','sp500_top60'),
      ('KO','NYSE','Coca-Cola Co.','sp500_top60'),
      ('PEP','NASDAQ','PepsiCo Inc.','sp500_top60'),
      ('NFLX','NASDAQ','Netflix Inc.','sp500_top60'),
      ('TMO','NYSE','Thermo Fisher Scientific','sp500_top60'),
      ('ADBE','NASDAQ','Adobe Inc.','sp500_top60'),
      ('ABT','NYSE','Abbott Laboratories','sp500_top60'),
      ('CRM','NYSE','Salesforce Inc.','sp500_top60'),
      ('DIS','NYSE','Walt Disney Co.','sp500_top60'),
      ('CSCO','NASDAQ','Cisco Systems','sp500_top60'),
      ('MCD','NYSE','McDonald''s Corp.','sp500_top60'),
      ('ACN','NYSE','Accenture plc','sp500_top60'),
      ('WFC','NYSE','Wells Fargo & Co.','sp500_top60'),
      ('INTC','NASDAQ','Intel Corp.','sp500_top60'),
      ('TMUS','NASDAQ','T-Mobile US','sp500_top60'),
      ('LIN','NYSE','Linde plc','sp500_top60'),
      ('DHR','NYSE','Danaher Corp.','sp500_top60'),
      ('AMD','NASDAQ','Advanced Micro Devices','sp500_top60'),
      ('TXN','NASDAQ','Texas Instruments','sp500_top60'),
      ('PFE','NYSE','Pfizer Inc.','sp500_top60'),
      ('UNP','NYSE','Union Pacific Corp.','sp500_top60'),
      ('IBM','NYSE','IBM Corp.','sp500_top60'),
      ('CAT','NYSE','Caterpillar Inc.','sp500_top60'),
      ('QCOM','NASDAQ','Qualcomm Inc.','sp500_top60'),
      ('BA','NYSE','Boeing Co.','sp500_top60'),
      ('HON','NASDAQ','Honeywell International','sp500_top60'),
      ('GS','NYSE','Goldman Sachs Group','sp500_top60'),
      ('NKE','NYSE','Nike Inc.','sp500_top60'),
      ('GE','NYSE','GE Aerospace','sp500_top60'),
      ('PYPL','NASDAQ','PayPal Holdings','sp500_top60'),
      ('BLK','NYSE','BlackRock Inc.','sp500_top60'),
      ('SBUX','NASDAQ','Starbucks Corp.','sp500_top60'),
      ('AMAT','NASDAQ','Applied Materials','sp500_top60'),
      ('NOW','NYSE','ServiceNow Inc.','sp500_top60'),
      ('AXP','NYSE','American Express Co.','sp500_top60'),
      ('PLTR','NYSE','Palantir Technologies','sp500_top60'),
      ('BKNG','NASDAQ','Booking Holdings','sp500_top60'),
      ('SAP.DE','XETRA','SAP SE','dax40'),
      ('SIE.DE','XETRA','Siemens AG','dax40'),
      ('ALV.DE','XETRA','Allianz SE','dax40'),
      ('DTE.DE','XETRA','Deutsche Telekom AG','dax40'),
      ('MUV2.DE','XETRA','Munich Re','dax40'),
      ('AIR.DE','XETRA','Airbus SE','dax40'),
      ('BAS.DE','XETRA','BASF SE','dax40'),
      ('BMW.DE','XETRA','BMW AG','dax40'),
      ('MBG.DE','XETRA','Mercedes-Benz Group','dax40'),
      ('VOW3.DE','XETRA','Volkswagen AG (Pref)','dax40'),
      ('DBK.DE','XETRA','Deutsche Bank AG','dax40'),
      ('DB1.DE','XETRA','Deutsche Boerse AG','dax40'),
      ('BAYN.DE','XETRA','Bayer AG','dax40'),
      ('IFX.DE','XETRA','Infineon Technologies','dax40'),
      ('ADS.DE','XETRA','Adidas AG','dax40'),
      ('EOAN.DE','XETRA','E.ON SE','dax40'),
      ('RWE.DE','XETRA','RWE AG','dax40'),
      ('HEN3.DE','XETRA','Henkel AG (Pref)','dax40'),
      ('MRK.DE','XETRA','Merck KGaA','dax40'),
      ('LIN.DE','XETRA','Linde plc','dax40'),
      ('FRE.DE','XETRA','Fresenius SE','dax40'),
      ('CBK.DE','XETRA','Commerzbank AG','dax40'),
      ('PAH3.DE','XETRA','Porsche SE','dax40'),
      ('P911.DE','XETRA','Porsche AG','dax40'),
      ('BEI.DE','XETRA','Beiersdorf AG','dax40'),
      ('CON.DE','XETRA','Continental AG','dax40'),
      ('HEI.DE','XETRA','Heidelberg Materials','dax40'),
      ('MTX.DE','XETRA','MTU Aero Engines','dax40'),
      ('QIA.DE','XETRA','Qiagen N.V.','dax40'),
      ('RHM.DE','XETRA','Rheinmetall AG','dax40'),
      ('SHL.DE','XETRA','Siemens Healthineers','dax40'),
      ('ENR.DE','XETRA','Siemens Energy','dax40'),
      ('SY1.DE','XETRA','Symrise AG','dax40'),
      ('VNA.DE','XETRA','Vonovia SE','dax40'),
      ('ZAL.DE','XETRA','Zalando SE','dax40'),
      ('HNR1.DE','XETRA','Hannover Rueck SE','dax40'),
      ('DTG.DE','XETRA','Daimler Truck Holding','dax40'),
      ('SRT3.DE','XETRA','Sartorius AG (Pref)','dax40'),
      ('BNR.DE','XETRA','Brenntag SE','dax40')
    ) as t(symbol, exchange, name, group_tag)
  )
  insert into public.tickers (user_id, symbol, exchange, name, group_tag, active)
  select uid, symbol, exchange, name, group_tag, true from src
  on conflict (user_id, symbol) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant execute on function public.seed_default_universe() to authenticated;



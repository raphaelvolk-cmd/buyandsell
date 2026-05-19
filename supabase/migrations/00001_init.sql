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

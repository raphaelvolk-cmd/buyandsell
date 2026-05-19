# Buy & Sell Stock Tool

Multi-source stock screening with Claude-API evaluation, manual portfolio tracking, and email alerts. Cloud-PWA on Next.js + Supabase + Vercel Cron.

See `../CLAUDE\ 2026-04\ Claude\ Code/buy-sell-tool` plan reference: `~/.claude/plans/neues-buy-und-sell-reflective-nygaard.md`.

## Workspaces

- `apps/web` — Next.js PWA (Dashboard, Watchlist, Portfolio, Settings)
- `packages/indicators` — RSI, MACD, Bollinger, ATR, Fibonacci, Scoring, Prefilter (TS-Port von analyze.py)
- `packages/datasources` — Yahoo, AlphaVantage, Google Sheets, CNN Fear & Greed
- `packages/claude` — Sonnet 4.6 evaluator with prompt caching + tool-use
- `packages/email` — Strong-buy push + daily report via nodemailer
- `packages/db` — Supabase typed client
- `supabase/migrations` — Schema + RLS + seed

## Dev (Windows, no execution policy change required)

```cmd
set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
pnpm install
pnpm test
pnpm dev
```

## Status

MVP scaffold. See plan file for rollout phases and verification checklist.

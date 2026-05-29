# Buy & Sell Tool — Zusammenfassung

## Was gebaut wurde

Ein produktives, dauerhaft laufendes Stock-Screening-Tool als **Cloud-PWA**, das mehrmals täglich Aktien analysiert, mit Claude API bewertet und Buy/Sell-Empfehlungen ableitet. Folgt dem HUB Cloud-PWA-Default-Stack (wie Reisekosten-Pilot).

- **Live unter:** https://buyandsell-taupe.vercel.app
- **Repo:** https://github.com/raphaelvolk-cmd/buyandsell

---

## Technischer Stack

| Komponente | Wert |
|---|---|
| **Frontend** | Next.js 15 (App Router) + React Server Components + TypeScript |
| **DB + Auth** | Supabase Frankfurt (Postgres + RLS + Magic-Link via Email) |
| **Hosting** | Vercel Hobby (Free), Region fra1 |
| **AI** | Anthropic Claude Sonnet 4.6 mit Prompt-Caching + Tool-Use |
| **Marktdaten** | Yahoo Finance (Chart + quoteSummary mit Cookie/Crumb-Auth) |
| **Sentiment** | CNN Fear & Greed Index |
| **Email** | nodemailer + React Email (SMTP konfigurierbar) |
| **Cron** | Vercel Cron Jobs (2× täglich Mo-Fr) |

---

## Datenquellen (aktiv)

| Quelle | Daten | Status |
|---|---|---|
| **Yahoo Finance Chart** | 6 Monate OHLCV | ✅ aktiv |
| **Yahoo Finance Quote Summary** | Fundamentals (P/E, Revenue Growth, Debt/Equity, Margins, 52w-Range) | ✅ aktiv (mit Crumb-Auth) |
| **CNN Fear & Greed** | Marktstimmungs-Index 0-100 | ✅ aktiv |
| **Claude Sonnet 4.6** | Bewertung pro Ticker (Thesis, Risks, Catalysts, Target/Stop) | ✅ aktiv |
| AlphaVantage | News Sentiment | 🟡 Code da, noch nicht verdrahtet (V1) |
| Google Sheet (GOOGLEFINANCE) | Backup-Quotes | 🟡 Code da, noch nicht verdrahtet (V1) |

---

## Scoring-Logik (1:1 Port aus stock-analyzer Python)

**Tech-Score (40 %)** — gewichteter Mittelwert über:
- RSI(14), MACD-Crossover + Histogram, Bollinger-Position (20, 2σ), MA-Cross (50/200), Volume-Ratio

**Fundamental-Score (40 %)** — gewichteter Mittelwert über:
- P/E (forward bevorzugt), Revenue Growth, Debt/Equity, Profit Margins, 52w-Position

**Sentiment-Score (20 %)** — Contrarian aus F&G:
- ≤20 → 5.0 / ≤35 → 4.0 / ≤55 → 3.0 / ≤75 → 2.0 / >75 → 1.0

**Total = Tech × 0.4 + Fund × 0.4 + Sent × 0.2**

**Signal aus Score (deterministisch):**
- ≥ 4.0 STRONG BUY · ≥ 3.5 BUY · ≥ 2.5 HOLD · ≥ 2.0 SELL · < 2.0 STRONG SELL

Claude liefert zusätzlich Thesis/Risks/Catalysts und eine zweite Signal-Einschätzung (im Detail-Drawer sichtbar).

---

## UI

**Dashboard (`/`):**
- F&G Gauge (SVG mit Farbgradient + Nadel)
- 6 Summary-Cards (Aktive Tickers, Strong Buys, Buys, Sells, Portfolio, Letzter Run)
- "Neues Screening" Button
- Top-Pick-Card (wenn höchster Score ≥ 3.5)
- Tabelle "Alle Ergebnisse sortiert nach Score"

**Watchlist (`/watchlist`):**
- Sortierbar (Symbol/Kurs/Signal/Score/RSI)
- Filter nach Signal-Typ + Search
- Click-to-expand Detail-Drawer mit allen Indikatoren + Claude-Analyse

**Portfolio (`/portfolio`):** Position-CRUD + automatische HOLD/SELL/ADD-Empfehlung pro Run
**Universe (`/universe`):** Ticker-Liste ein/aus, Custom hinzufügen
**Runs (`/runs`):** Audit-Trail mit Token-Verbrauch
**Settings (`/settings`):** Email-Empfänger + SMTP + Sign-out

Dark Mode, lila Accents, Inter-Schrift, mobil installierbar als PWA.

---

## Automatisierung

**Vercel Crons (registered, verifiziert):**
- `21:00 UTC` Mo-Fr → Screening (= 23:00 deutscher Sommerzeit)
- `22:30 UTC` Mo-Fr → Tagesreport-Mail (= 00:30 deutscher Sommerzeit)

Wochenende keine Runs.

**Manueller Trigger** vom Dashboard via "Neues Screening"-Button.

---

## Architektur-Highlights

- **Master/Worker Sub-Batching** (10 Tickers/Batch) via Next.js `after()` — umgeht Vercel Hobby 60 s Limit
- **Atomic Self-Finalization** mit `status='running'` Guard — race-safe wenn parallele Worker fertig werden
- **Prefilter regelbasiert** vor Claude-Calls (RSI < 35, MACD-Crossover, BB-Extremes, Portfolio-Always) — reduziert Token-Verbrauch um 40-50 %
- **Yahoo Cookie+Crumb-Auth** mit Session-Caching pro Function-Instance (für quoteSummary seit 2024 nötig)
- **RLS auf allen User-Tabellen** — Mandantentrennung garantiert
- **Auto-Seed beim First-Sign-In**: 99 Default-Tickers + User-Email als Default-Recipient

---

## DB-Schema (Supabase)

8 Tabellen, alle mit RLS:
- `tickers` (Universum pro User)
- `portfolio_positions` (manuelle Positionen)
- `screening_runs` (Run-Metadaten + Token-Counters)
- `evaluations` (pro Ticker pro Run: Indikatoren + Scores + Claude-Output)
- `recommendations` (BUY/SELL/HOLD/ADD entkoppelt)
- `email_recipients` (Empfänger-Liste)
- `alerts_sent` (Dedup für Strong-Buy-Push)
- `user_secrets` (SMTP-Credentials pro User, verschlüsselt)

---

## Aktueller Stand (Hard-Limits Vercel Hobby)

- **20 aktive Tickers** für zuverlässige 1-Klick-Runs (Run dauert ~40 s, sicher unter 60 s Function-Limit)
- **30 möglich**, sporadisch hängt der letzte Batch
- **100 erfordert Vercel Pro** (~20 USD/Monat) für 300 s Function-Limit

Universum kann jederzeit über `/universe` umgeschaltet werden.

---

## Was getestet wurde

- ✅ Yahoo OHLCV + Fundamentals (Cookie/Crumb)
- ✅ CNN F&G
- ✅ Claude Tool-Use mit Prompt-Caching (Cache-Hit-Rate > 95 %)
- ✅ Magic-Link-Login (Supabase Email)
- ✅ Auto-Seed beim First-Sign-In (99 Tickers)
- ✅ Manueller Screening-Run (41 s für 20 Tickers, 0 failed)
- ✅ Alle 7 PWA-Routen HTTP 200
- ✅ RLS-Isolation
- ✅ Cron-Registration in Vercel (2 Crons aktiv)
- ✅ Score-Berechnung identisch zur Python-Referenz

---

## Was als nächstes käme (optional)

1. **AlphaVantage News-Sentiment** im Cron-Loop verdrahten (Bulk-Call, 1 API-Call pro Run)
2. **Google Sheet GOOGLEFINANCE-Backup** für Quotes (Yahoo-Ausfall-Resilienz)
3. **Round-Robin Cursor** für volle 100-Ticker-Coverage über mehrere Runs (Hobby-tauglich)
4. **Backtest-Modus** via gespeicherte `evaluations.raw_payload`
5. **Sektor-Spalte** (von Yahoo `assetProfile` Modul abrufen + in `tickers` cachen)
6. **Disable_signup=true** + Email-Whitelist (Single-User-Härtung)
7. **Vercel Pro Upgrade** für volle 100-Ticker single-pass

---

## Kosten-Realität (laufend)

| Service | Tier | Kosten/Monat |
|---|---|---|
| Supabase | Free | **0 €** |
| Vercel | Hobby | **0 €** |
| Anthropic | Pay-per-use, ~$0.05/Run mit Caching | **~5 €** bei 1 Run/Werktag, 20 Tickers |
| **Aktuell gesamt** | | **~5 €/Monat** |

Bei vollem Setup (Vercel Pro + 100 Tickers + 3 Runs/Tag): ~50 €/Monat.

---

## Wichtige Pfade

- **Repo:** `<workdir>/buy-sell-tool/`
- **Scoring-Logik:** `packages/indicators/src/scoring.ts`
- **Datenquellen:** `packages/datasources/src/{yahoo,cnn-fear-greed,alphavantage,google-sheet}.ts`
- **Claude-Bewertung:** `packages/claude/src/evaluate.ts`
- **Orchestrator:** `apps/web/lib/screening/orchestrator.ts`
- **Cron-Endpoints:** `apps/web/app/api/cron/{screen,screen/batch,report}/route.ts`
- **Plan-Datei:** `C:\Users\volkr\.claude\plans\neues-buy-und-sell-reflective-nygaard.md`

---

## Setup-Daten

- **Supabase-Projekt:** `hwdctwteigimyuexzoio` (Frankfurt)
- **Vercel-Projekt:** `raphaelvolk-8868s-projects/buyandsell`
- **GitHub:** `raphaelvolk-cmd/buyandsell` (main branch)
- **Login-Email:** raphael.volk@googlemail.com

Erster automatischer Production-Run feuert am Werktag um **23:00 deutscher Sommerzeit**.

# Deployment Walkthrough

Schritt-fuer-Schritt-Anleitung, wie du das Tool live bekommst.
**Du klickst die Account-Schritte, ich uebernehme die CLIs.**

Bitte arbeite die folgenden Phasen der Reihe nach durch und schick mir am Ende
die ausgefuellten Werte aus **"Was ich am Ende von dir brauche"** (unten).

---

## Phase 1 · Supabase-Projekt anlegen (~5 Min)

1. Account auf [supabase.com](https://supabase.com) erstellen oder einloggen.
2. **New project** klicken.
3. Eintragen:
   - **Name:** `buy-sell-tool` (oder was du willst)
   - **Database password:** generieren + **sicher abspeichern** (Passwortmanager)
   - **Region:** `Central EU (Frankfurt)` — wichtig fuer DSGVO
   - **Pricing plan:** Free reicht fuer MVP (500 MB DB)
4. Warte 2 Min, bis das Projekt provisioniert ist.
5. Im linken Menue **Settings (Zahnrad-Icon) → API** oeffnen und drei Werte kopieren:
   - **`Project URL`** — die HTTPS-Adresse deines Supabase-Projekts (z.B. `https://abcdwxyz.supabase.co`).
     *Wozu:* Frontend + Server-Code reden mit dieser URL.
   - **`anon` / `public` Key** — langer JWT-String, beginnt mit `eyJ...`.
     *Wozu:* Sicher fuer den Browser. Nur RLS-konforme Zugriffe moeglich.
   - **`service_role` Key** — auch ein JWT, daneben steht **"secret"** oder ein Augen-Icon zum Aufdecken.
     *Wozu:* Vollzugriff auf die DB unter Umgehung von RLS — **NIE im Browser oder in Git verwenden**.
     Nur Server-Routes (z.B. Cron-Endpoint) und die Vercel-Env nutzen ihn.

   > Falls Supabase bei dir die neue UI mit *"Publishable / Secret Keys"* statt *"anon / service_role"* zeigt: das sind die gleichen Konzepte unter neuem Namen — `publishable` = `anon`, `secret` = `service_role`.

6. Im linken Menue **Settings → General** kopieren:
   - **`Reference ID`** (auch *Project ref* genannt, 16-20 Zeichen alphanumerisch).
     *Wozu:* `supabase link --project-ref XYZ` braucht das, damit die CLI die Migrations
     zum richtigen Projekt schickt.

> **Auth-Setup ist Out-of-the-Box** — Magic-Link via Email funktioniert ohne weitere Konfiguration.
> Supabase versendet die Login-Links automatisch ueber ihren eingebauten SMTP-Server (Free).

---

## Phase 2 · Anthropic API-Key holen (~2 Min)

1. [console.anthropic.com](https://console.anthropic.com) -> API Keys.
2. **Create Key** -> Name "buy-sell-tool" -> Key kopieren (`sk-ant-...`).
3. Workspace credit pruefen: du brauchst Pay-as-you-go aktiv. Erwartete
   Kosten **~30 $/Monat** bei 3 Runs/Tag mit vollem Universum.

---

## Phase 3 · SMTP fuer Versand (optional, fuer Email-Alerts) (~5 Min)

Wenn du **keine** Email-Alerts brauchst (nur Dashboard), kannst du diesen Schritt
ueberspringen. Sonst eine der drei Optionen:

| Provider | Aufwand | Anmerkung |
|---|---|---|
| **Office 365 / Outlook.com** | App-Password erzeugen | Host `smtp.office365.com`, Port `587`, STARTTLS. Funktioniert mit deinem HUB-Mail-Konto. App-Password unter [account.microsoft.com/security → App passwords](https://account.microsoft.com/security). |
| **Gmail** | App-Password erzeugen | Host `smtp.gmail.com`, Port `587`. App-Password unter [myaccount.google.com → Security → App passwords](https://myaccount.google.com/apppasswords). |
| **Resend** ([resend.com](https://resend.com)) | API-Key generieren | Eigener Anbieter, 3.000 mails/Monat free, eigener Domain-Sender. Saubere Loesung wenn du Marketing-mails von Transactional trennen willst. |

Folgendes kopieren:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_ADDRESS`

---

## Phase 4 · GitHub-Repo (~1 Min)

Zwei Wege — egal welcher:

**Option A · GitHub-Web** (am einfachsten)
1. [github.com/new](https://github.com/new)
2. Name `buy-sell-tool`, **Private**, kein README/`.gitignore`/Lizenz vorbelegen.
3. Create -> repo URL kopieren (z.B. `git@github.com:dein-user/buy-sell-tool.git`).

**Option B · `gh` CLI** (ich kann das fuer dich machen, sobald du `gh auth login` einmal durchgeklickt hast)
1. Sag mir Bescheid wenn du das willst — ich installiere `gh` und du klickst nur die Browser-Auth-Seite einmal an.

---

## Phase 5 · Vercel-Account & Pro abonnieren (~3 Min)

1. [vercel.com](https://vercel.com) -> Login mit deinem GitHub-Account (wichtig: gleicher
   Account wie das Repo, sonst muessen wir spaeter ein Team-Setup machen).
2. **Settings → Billing → Upgrade to Pro** ($20/Monat). **Pflicht**, weil Hobby nur
   2 Cron-Jobs/Tag erlaubt und wir 4 brauchen (3× Screening + 1× Report).

Du musst das Projekt **NICHT manuell anlegen** — `vercel link` macht das automatisch
wenn ich dran bin.

---

## Was ich am Ende von dir brauche

Schick mir die folgenden Werte (am besten als Liste). Ich packe sie sicher in Vercel-Env-Vars und Supabase-CLI-Configs — keine Werte landen in Git.

```
SUPABASE_PROJECT_REF   = (Phase 1.6 — z.B. abcdwxyz)
SUPABASE_URL           = (Phase 1.5)
SUPABASE_ANON_KEY      = (Phase 1.5)
SUPABASE_SERVICE_ROLE  = (Phase 1.5)
SUPABASE_DB_PASSWORD   = (Phase 1.3 — Database password)

ANTHROPIC_API_KEY      = (Phase 2)

SMTP_HOST              = (Phase 3, optional)
SMTP_PORT              = (Phase 3, optional)
SMTP_USER              = (Phase 3, optional)
SMTP_PASSWORD          = (Phase 3, optional)
SMTP_FROM_ADDRESS      = (Phase 3, optional)
SMTP_FROM_NAME         = "Buy & Sell Tool"  (optional)

GITHUB_REPO_URL        = (Phase 4 — git@github.com:.../buy-sell-tool.git)
EMAIL_TO_RECEIVE_ALERTS = (an welche Adressen sollen Buy-Reports gehen? Komma-getrennt)
```

Anthropic Key + SMTP Password kannst du auch direkt durch `vercel env add` tippen,
wenn du sie nicht im Chat haben willst — sag mir nur Bescheid, dann lasse ich
die Werte offen und du tippst sie ein, sobald die CLI fragt.

---

## Was ich danach automatisch mache

1. **Migrations anwenden** — entweder
   - **schnell (Web):** du oeffnest [SQL Editor in Supabase](https://supabase.com/dashboard/project/_/sql/new), pastest den Inhalt von [`supabase/apply_all.sql`](supabase/apply_all.sql) (alle 3 Migrations konsolidiert, 337 Zeilen) und klickst **Run**. Erledigt in 30 Sek, kein CLI-Login noetig.
   - **vollstaendig (CLI):** ich mache `supabase login` (du klickst Browser-Auth einmal), `supabase link --project-ref $REF`, `supabase db push`. Du tippst DB-Password an einer Stelle.
2. **GitHub:** `git remote add origin $REPO_URL` + `git push -u origin master`
3. **Vercel:** `vercel login` (einmal Browser-Click), `vercel link`, alle Env-Vars setzen (du tippst sensitive Werte), `vercel --prod`
4. Smoke-Test: einmal die Cron-URL mit `curl` + `CRON_SECRET` aufrufen, in Supabase pruefen ob ein Screening-Run angelegt wurde
5. Du loggst dich mit Magic-Link auf deine Email ein und siehst dein erstes Dashboard

Geplante Live-Zeit: **~15 Min** nachdem du mir die Werte gibst.

---

## Spaeter: Multi-User / Entra OAuth

Wenn Kollegen mit ihren HUB-Microsoft-Accounts mitnutzen sollen, ist das ein 30-Min-Upgrade:
- Azure Portal -> App Registration -> Client-ID + Secret + Tenant-ID
- Supabase Dashboard -> Authentication -> Providers -> Azure aktivieren
- Login-Seite: Button "Mit Microsoft anmelden" zusaetzlich zu Magic-Link
- RLS bleibt unveraendert.

Das ist kein Bestandteil dieses MVP-Deployments — du kannst jederzeit nachruesten.

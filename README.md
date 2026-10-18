# YHQ Test

Mobile-first web app for preparing for the Uzbekistan driving licence theory exam. Freemium: users verify their phone, try demo tickets for free, then buy a subscription for the full question bank.

- **Languages:** Uzbek (Latin), Uzbek (Cyrillic), Russian
- **Test modes:** exam simulation (timer, pass mark), tickets, topics, mistakes review (spaced repetition), marathon, adaptive practice
- **Learning tools:** progress dashboard, bookmarks and notes, AI "explain this rule" button, signs and rules library, leaderboard, shareable result cards
- **Payments:** Click, Payme and Uzum, with promo codes, campaigns and referral rewards
- **Admin panel:** content, bulk import, users, payments, plans, promo codes, campaigns, message templates, translations, settings

> **Content notice.** The bundled 40 questions, sign descriptions and rule articles (P-1…P-8) are **samples written for this demo**, not the official exam. Load the official or properly licensed question bank yourself (Admin → Bulk import), and make sure you have the right to use it.

Status of every feature, and what has been verified, is tracked in [PROGRESS.md](PROGRESS.md).

---

## Contents

1. [Stack](#stack)
2. [Quick start with Docker](#quick-start-with-docker)
3. [Local database without Docker](#local-database-without-docker)
4. [Seed data and admin login](#seed-data-and-admin-login)
5. [Scripts](#scripts)
6. [Environment variables](#environment-variables)
7. [Project structure](#project-structure)
8. [Content: question bank and exam format](#content-question-bank-and-exam-format)
9. [Providers](#providers)
10. [Reminders cron job](#reminders-cron-job)
11. [Security and privacy](#security-and-privacy)
12. [Going-live checklist](#going-live-checklist)

---

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 15 (App Router, server actions), React 19, TypeScript |
| Styling | Tailwind CSS 3, no UI library (about 105 kB of JavaScript per page) |
| Database | PostgreSQL + Prisma 6 |
| Cache / rate limits | Redis (falls back to an in-memory store in development) |
| AI | Anthropic Claude via `@anthropic-ai/sdk` (optional) |
| Tests | Node test runner via `tsx` (`npm test`) |

Requirements: **Node.js 22.9+** (tested on 24; the seed script uses `--env-file-if-exists`) and **PostgreSQL 14+**.

---

## Quick start with Docker

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma db push
npm run db:seed
npm run dev
```

`docker compose up -d` starts PostgreSQL 16 on port 5432 and Redis 7 on port 6379. The default `DATABASE_URL` and `REDIS_URL` in `.env.example` already point at them.

Open http://localhost:3000. In development the SMS code is printed in the server terminal and also shown on the code screen, so you can log in with any +998 number.

---

## Local database without Docker

If Docker isn't available, the project can run a throwaway PostgreSQL itself through the [`embedded-postgres`](https://www.npmjs.com/package/embedded-postgres) package, which ships PostgreSQL binaries for your platform. It's installed with `--no-save` so it stays out of `package.json`; a later plain `npm install` removes it, so run the install line again if `npm run db:local` says it's missing.

```bash
npm install --no-save embedded-postgres
npm run db:local
```

Keep that terminal open (Ctrl+C stops the database). In a second terminal:

```bash
cp .env.example .env
```

Set the database line in `.env` to what the script prints:

```
DATABASE_URL="postgresql://yhq:yhq@localhost:5433/yhq_dev"
```

Then push the schema, seed, and start the app:

```bash
npx prisma db push
npm run db:seed
npm run dev
```

Notes:

- **Data folder:** the data lives in `.localdb/`, which is git-ignored. Delete that folder to start over.
- **Encoding:** the script creates the database as **UTF-8** on purpose. On Windows the server default is often WIN1251, which can't store emoji (topic icons) and makes `prisma db push` fail with *"character … has no equivalent in encoding WIN1251"*.
- **Windows path length:** if `npm install` fails with `spawn cmd.exe ENOENT`, the project path is too long for Windows. Move the project to a shorter path, such as `C:\dev\yhq-test`.
- **Port and folder:** override them with `LOCAL_DB_PORT` and `LOCAL_DB_DIR`.
- **Redis:** without `REDIS_URL` the app uses an in-memory store. That's fine for development; codes and rate limits reset when the server restarts.

---

## Seed data and admin login

`npm run db:seed` is safe to run repeatedly: it updates existing rows instead of duplicating them. It creates:

| Data | Details |
|---|---|
| Categories | A, B, C, D, BE, CE |
| Topics | 8: signs, priority, speed, parking, overtaking, pedestrians, safety, lights |
| Questions | 40 **sample** questions in category B, in 4 tickets of 10; tickets 1–2 are the free demo. Sample images are in `public/signs/` and `public/placeholders/`. |
| Plans | 1 week 29 000, 1 month 79 000, 3 months 179 000 ("Best value"), until-pass 249 000 so'm |
| Exam templates | Per category: 20 questions, 25 min, 90%. **Placeholder values; see below.** Plus a 10-question ticket template for B. |
| Library | 16 sample road signs, 8 placeholder rule articles |
| Message templates | 72 (8 messages × SMS/email/push × 3 languages) |
| Campaigns | Active welcome offer: −20% for 24 h after sign-up |
| Admin user | Phone `ADMIN_PHONE` (default `+998 90 000 00 01`) |

**Demo promo codes:**

| Code | Effect |
|---|---|
| `DEMO20` | −20% |
| `MINUS15K` | −15 000 so'm, minimum order 50 000 |
| `PLUS7` | +7 days with purchase; combines with automatic discounts |
| `TRIAL3` | 3-day free trial, no payment |
| `MONTHONLY` | −30%, only on the 1-month plan |
| `EXPIRED` | always expired (to see the error message) |

**Admin login:** go to `/login`, enter the `ADMIN_PHONE` number and type the code shown on screen (development) or sent by SMS (production). Then open `/admin`. To make another user an admin, use Admin → Users → user → **Make admin**.

**Sandbox payments:** with `PAYMENTS_SANDBOX="true"`, choosing any provider at checkout opens a built-in test page with **Confirm** and **Decline** buttons. No money moves.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` / `npm start` | Production build / run it |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (phone, CSV, transliteration, SMS length, i18n key parity) |
| `npm run db:push` | Apply `prisma/schema.prisma` to the database |
| `npm run db:migrate` | Create a migration (use migrations once in production) |
| `npm run db:seed` | Load demo data (safe to re-run) |
| `npm run db:studio` | Prisma Studio database browser |
| `npm run db:local` | Local PostgreSQL without Docker (see above) |
| `npx tsx scripts/gen-cyrillic.ts` | Regenerate `src/i18n/messages/uz-Cyrl.ts` from `uz.ts` |

---

## Environment variables

Copy `.env.example` to `.env`. Variables marked **prod** are only needed before going live.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `REDIS_URL` | prod | OTP codes and rate limits. Without it an in-memory store is used (single server, resets on restart). |
| `NEXT_PUBLIC_APP_URL` | yes | Public base URL: referral links, payment return URLs, sitemap |
| `SESSION_SECRET` | prod | Long random string used to hash OTP codes |
| `CRON_SECRET` | prod | Bearer token for `/api/cron/reminders` |
| `ADMIN_PHONE` | seed | Phone the seed script makes admin |
| `SMS_PROVIDER` | yes | `mock` (codes in the server log), `eskiz` or `playmobile` |
| `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_FROM` | prod | Eskiz.uz account and approved sender name |
| `PLAYMOBILE_LOGIN`, `PLAYMOBILE_PASSWORD`, `PLAYMOBILE_ORIGINATOR`, `PLAYMOBILE_URL` | prod | PlayMobile account, originator, optional endpoint override |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | prod | Email receipts and reminders. Without `SMTP_HOST`, emails are printed to the server log. |
| `PAYMENTS_SANDBOX` | yes | `true` = built-in payment simulator; `false` = real providers |
| `CLICK_MERCHANT_ID`, `CLICK_SERVICE_ID`, `CLICK_SECRET_KEY` | prod | Click merchant settings; the secret also verifies callbacks |
| `PAYME_MERCHANT_ID`, `PAYME_SECRET_KEY`, `PAYME_TEST_KEY` | prod | Payme merchant ID and keys (the test key is used while sandbox is on) |
| `UZUM_CHECKOUT_URL`, `UZUM_SECRET_KEY` | prod | Uzum checkout URL and callback secret (stub, see below) |
| `ANTHROPIC_API_KEY` | optional | Enables the AI explainer. Without it the stored explanation is shown. |
| `AI_MODEL` | optional | Claude model for the explainer (default `claude-opus-5-5`) |

Admin → Settings shows which integrations are configured, without revealing any values.

---

## Project structure

```
prisma/
  schema.prisma        database schema
  seed.ts              demo data
public/
  signs/, placeholders/  sample images
  sw.js, manifest.webmanifest   PWA (installable, offline fallback)
scripts/
  local-db.mjs         embedded PostgreSQL for development
  gen-cyrillic.ts      Uzbek Latin → Cyrillic message file
src/
  app/(site)/          public and user pages (landing, login, tests, results, pricing, …)
  app/admin/           admin panel; all admin mutations are in admin/actions.ts
  app/api/             auth, tests, payments (+ provider callbacks), promo, AI, cron, exports
  components/          shared UI
  i18n/                locales, messages (uz, uz-Cyrl, ru), server/client helpers
  lib/                 domain logic: otp, session, pricing, promo, payments, tests, stats, srs, sms, notify, importers
tests/unit.test.ts     unit tests
```

**Adding a language:** add `src/i18n/messages/<code>.ts` with the same keys as `uz.ts` (a unit test checks parity), register it in `src/i18n/config.ts` and `src/i18n/translate.ts`, and add content columns if questions need it. Admins can change any interface text without a deploy in Admin → Translations.

---

## Content: question bank and exam format

**Importing questions.** Use Admin → Bulk import. Download the CSV or JSON template there; columns cover category, ticket, topic, the text in three languages, image URL, up to 5 answers, the correct answer number, explanation, rule reference and difficulty.

- **Validation first:** every row is checked and errors are shown row by row before anything is saved.
- **Updating questions:** rows with an existing `external_id` update that question.
- **Cyrillic:** you can leave Cyrillic columns empty; they are transliterated from Uzbek Latin. Review the result: loanwords sometimes need a manual fix.
- **Replacing the samples:** use your own `external_id`s and delete the sample questions (`SAMPLE-B-001…040`) in Admin → Questions, or reuse those IDs to overwrite them.

**Exam format.** The official number of questions, time limit and pass mark were **not verified** for this project. They appear to be set by Cabinet of Ministers Resolution No. 408 (31 May 2018) and the Unified Examination Center. Practice apps commonly use 20 questions with at most 2 mistakes. Set the confirmed values on each category's default template in Admin → Exam templates.

**Tickets.** A ticket is the set of questions sharing a ticket number. Admin → Tickets toggles which tickets are free demos and can regenerate tickets from a ticket template (size and topic mix).

**Library.** Replace the sample signs and the `[NAMUNA]` rule articles with the official traffic rules (YHQ) in Admin → Signs & rules.

---

## Providers

All providers require business contracts. Register before launch; approval can take days.

### SMS: Eskiz.uz or PlayMobile

- **Choose a provider:** set `SMS_PROVIDER` to `eskiz` or `playmobile`, plus that provider's credentials. `mock` prints messages to the server log.
- **Sender name:** Eskiz requires a registered sender name (`ESKIZ_FROM`).
- **Pre-approved texts:** Eskiz also requires pre-approved message texts. Mark approved templates in Admin → Message templates; the page warns when an approved text is edited and needs re-approval.
- **Cost:** keep the OTP message to one SMS segment. Latin text allows 160 characters per segment, Cyrillic only 70. The editor shows the count. Uzbek Cyrillic SMS templates are seeded in Latin for this reason.
- **Verify the requests:** the request formats in `src/lib/sms.ts` follow the providers' public docs. Confirm the endpoints with your provider account.

### Payments: Click, Payme, Uzum

Checkout creates a `Payment` row, then redirects to the provider (or to the sandbox page). The provider confirms through a server-to-server callback, and only then is access granted. Fulfilment is idempotent, so provider retries are safe.

| Provider | Callback URL to register | Authentication |
|---|---|---|
| Click (SHOP API) | `POST https://<your-domain>/api/payments/click`, for both Prepare and Complete | `sign_string` MD5 with `CLICK_SECRET_KEY` |
| Payme (Merchant API, JSON-RPC) | `POST https://<your-domain>/api/payments/payme` | HTTP Basic `Paycom:<key>` (`PAYME_TEST_KEY` in sandbox, `PAYME_SECRET_KEY` live) |
| Uzum | `POST https://<your-domain>/api/payments/uzum` | **Stub:** header `X-Uzum-Secret: <UZUM_SECRET_KEY>` |

- **Click and Payme:** run each provider's sandbox test suite against these endpoints before going live. Payme's suite checks transaction states and timings strictly.
- **Uzum:** the handler is a placeholder. Replace its request shape and signature check with the API from your Uzum merchant contract, and set `UZUM_CHECKOUT_URL`.
- **Amounts:** the final, discounted amount is what's sent to the provider (Payme in tiyin, so so'm × 100). Every payment stores the original price, discount lines and promo code.
- **Promo codes:** a code is redeemed only after a successful payment. A failed or abandoned checkout releases it after 30 minutes.
- **Receipts:** sent by SMS (always) and by email (if the user gave one).

### AI explainer: Anthropic Claude

Set `ANTHROPIC_API_KEY` to enable the "Explain this rule simply" button. `src/app/api/ai/explain/route.ts` calls the Messages API with the question, the correct answer and the stored explanation:

- **Model:** `AI_MODEL`, default `claude-opus-5-5`, at low effort.
- **Language:** the answer comes back in the user's language.
- **Caching:** answers are cached for 30 days per question and language.
- **Rate limits:** 30 per hour for subscribers and 5 per day for free users.
- **Fallback:** without a key, or if a request fails or is refused, the stored explanation is shown.

### Email and push

- **Email:** SMTP via `nodemailer`. Without `SMTP_HOST`, emails go to the server log.
- **Push:** subscriptions and sending are **stubs** (logged only). Real web push needs VAPID keys and the `web-push` package.

---

## Reminders cron job

`GET /api/cron/reminders` sends:

- **Expiry:** access ends within 48 h.
- **Streak:** studied yesterday, not today.
- **Abandoned checkout:** unpaid after 1–24 h; includes a single-use 10% code.
- **Win-back:** access lapsed 7–30 days ago; includes a single-use code at the win-back campaign's percentage.

Each user gets each reminder at most once per window, and only through the channels they allowed in their profile.

Call it hourly from any scheduler:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/reminders
```

Examples: a Linux crontab, a GitHub Actions schedule, or your host's cron feature (for example Vercel Cron). Access expiry itself needs no job: access is always computed from the subscription end date.

---

## Security and privacy

- **Sessions:** a random token in an httpOnly, SameSite=Lax cookie (`Secure` in production). Only a SHA-256 hash of the token is stored in the database.
- **OTP:**
  - Codes are 6 digits, stored hashed, and valid for 5 minutes, with at most 5 wrong attempts.
  - Resend is limited to once a minute; requests are capped at 5 per hour per phone and 20 per hour per IP, plus a verification lockout.
- **Promo codes:** only invalid attempts count toward the limit (10 per 10 min per user and per IP).
- **Admin access:** admin pages and APIs return 404 to non-admins. The last admin can't be demoted, and admins can't change their own role.
- **Uploads:** only PNG, JPEG or WebP, up to 2 MB, stored in `public/uploads/` (SVG is refused because it can carry scripts). Use object storage (S3, R2, Cloudinary) when running more than one server.
- **HTTPS:** HTTP is redirected to HTTPS in production, with HSTS and basic security headers.
- **Input validation:** zod and server-side checks on every API and admin action. CSV exports neutralise spreadsheet formulas.
- **Privacy (Uzbekistan Law on Personal Data):**
  - **Consent:** a checkbox before an SMS is sent; the consent time is stored per user.
  - **Policy pages:** privacy policy and terms at `/privacy` and `/terms`. These are **draft texts**; have a lawyer review them.
  - **Data location:** the law requires citizens' personal data to be stored on servers in Uzbekistan. Choose your hosting accordingly.
  - **Deletion:** there is no self-service account deletion yet; handle deletion requests manually.

---

## Going-live checklist

**Content and legal**
- [ ] Licensed question bank imported; sample questions (`SAMPLE-B-*`) removed
- [ ] Official exam format set on each category's default exam template
- [ ] Rule articles and sign descriptions replaced; no `[NAMUNA]` warning in Admin → Signs & rules
- [ ] Privacy policy and terms reviewed by a lawyer (Admin → Translations → `legal.*`)
- [ ] Support contacts set (Admin → Settings)
- [ ] Prices and plans confirmed (Admin → Plans)

**Infrastructure**
- [ ] Production PostgreSQL on servers in Uzbekistan; move from `db push` to migrations (`npm run db:migrate`)
- [ ] Redis configured (`REDIS_URL`)
- [ ] `NEXT_PUBLIC_APP_URL` set to the real HTTPS domain
- [ ] Strong `SESSION_SECRET` and `CRON_SECRET`
- [ ] Hourly cron calling `/api/cron/reminders`
- [ ] Image uploads moved to object storage if you run more than one server
- [ ] Backups for the database

**Providers**
- [ ] SMS: contract, sender name and template approval; `SMS_PROVIDER` set; test OTP delivered to a real phone
- [ ] Click and Payme: merchant accounts, callback URLs registered, provider sandbox test suites passed
- [ ] Uzum: stub replaced with the real merchant API, or the option hidden
- [ ] `PAYMENTS_SANDBOX="false"`; one real low-value payment end to end, then a refund through the provider
- [ ] SMTP configured; receipt email received
- [ ] Optional: `ANTHROPIC_API_KEY`

**Final checks**
- [ ] `npm run typecheck`, `npm test` and `npm run build` pass
- [ ] Seeded admin phone changed or removed; at least two real admins
- [ ] Demo promo codes (`DEMO20`, `TRIAL3`, …) paused or deleted in Admin → Promo codes
- [ ] Admin → Settings shows every required integration as "configured"

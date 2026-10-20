# YHQ Test — progress log

_Last updated: 2026-10-18 (stage 12: daily limit of two full tests; not committed yet, awaiting review)_

**Status legend**
- ✅ **verified**: exercised in a running app against a real PostgreSQL database, or covered by passing unit tests
- 🔵 **builds**: code written, passes `tsc` and `next build`, but not yet run
- ⬜ **not started**

## Last verification run

| Check | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | ✅ 0 errors |
| Unit tests | `npm test` | ✅ 15/15 pass (stage 12 adds Tashkent day boundaries and the remaining count) |
| Daily-limit DB tests | `npm run test:db` | ✅ 10/10 pass (stage 12) |
| End-to-end | `npm run test:e2e` (against `npm run dev`) | ✅ 11/11 pass (8 auth + 3 daily limit) |
| Production build | `npm run build` | ✅ exit 0, 54 routes (stage 3: `/admin/promo`, `/admin/promo/[id]`; stage 4: `/admin/campaigns`; stage 5: `/admin/users`, `/admin/users/[id]`, `/admin/payments`, `/admin/plans`; stage 6: `/admin/tickets`, `/admin/exam`, `/admin/categories`; stage 7: `/admin/messages`, `/admin/translations`, `/admin/library`, `/admin/settings`) |
| Admin navigation | all 15 admin menu links | ✅ every link returns 200 (no more 404s) |
| Schema + seed | `npx prisma db push` → `npm run db:seed` (run twice) | ✅ 6 categories, 8 topics, 40 questions, 4 tickets, 4 plans, 16 signs, 72 message templates, 6 demo promo codes, admin user. Same counts on the second run, so the seed is safe to re-run. |
| End-to-end in browser | dev server + local PostgreSQL 18, phone-sized viewport | ✅ golden path passed (details below) |

## Golden path tested in the browser (✅)

1. Landing page renders on mobile (dark mode, Uzbek). All sections present; pricing shows "save 36% / 52%".
2. Phone field: mask works; a too-short number shows an error; submitting without consent is blocked.
3. OTP: the mock SMS appears in the server log and the dev code shows on screen; a wrong code is rejected; the right code logs in; the resend countdown runs.
4. Onboarding (name, category B preselected) → dashboard. The welcome SMS is sent and the welcome-offer banner shows a 24 h countdown.
5. Tests page: tickets 1–2 marked "Demo"; exam, adaptive, marathon, topics and tickets 3–4 locked. A locked item opens the paywall ("from 29 000 so'm").
6. Ticket 1 (practice): immediate ✅/❌ feedback with explanation and rule reference; bookmark, note and the AI button (falls back to the stored text without an API key) all work.
7. Result page: 5/10, 50%, fail against the 90% pass mark, time spent, and every wrong answer with yours vs. correct plus explanation. The share-card PNG generates.
8. Pricing: the welcome −20% applies automatically. All promo cases show the right message and total: invalid, expired, wrong plan, below minimum (shows "50 000 so'm"), percent, fixed, free days (stacks with the welcome offer), and free trial (activate button).
9. Click sandbox payment, success → 90 days of access (until 15.01.2027); receipt by SMS and push stub; all locks removed.
10. Failed sandbox payment → marked FAILED, failure page shown.
11. Free trial TRIAL3 → +3 days added after the paid period; a second use is refused; a non-trial code is refused on the trial endpoint.
12. Exam: 20 questions, 25:00 timer, no answer reveal, auto-advance; finishing early warns "19 unanswered" and grades them wrong.
13. Mistakes review serves exactly the missed questions; the dashboard shows readiness, accuracy, streak, topic bars, weak topics and recent tests.
14. Language switch: uz → ru → uz-Cyrl changes the UI and question content, and `<html lang>` updates.
15. Profile shows subscription, referral link, bookmarks and notes; logout works; a returning user logs in with phone + OTP.
16. Admin: analytics shows real figures (users, conversion, revenue, top promo code). Question list and editor work, and a blank Cyrillic field is auto-filled. Bulk import validates row by row (unknown category, bad `correct` index), imports the valid row, and delete works. Payments CSV export works.
17. Access control: a regular user gets 404 on `/admin` and on the admin export API.
18. Library search works in Latin, Cyrillic and Russian, for both signs and rule articles. Leaderboard, privacy, terms, offline page, sitemap, robots, manifest and service worker all return 200.

## Redesign — stage 7: measurement and wrap-up (✅)

- **Lighthouse mobile** (production build, same pages as the baseline): performance 74–82 → **93–97**, accessibility 94–97 → **100** on all 7 pages, best practices 100, SEO 100 on indexable pages (63 on the deliberately noindex ones, previously 54). Total blocking time 500–990 ms → 80–210 ms. Full table in `docs/design-system.md`.
- **Fixes from the audit:** a low-contrast count on the library tabs, and the plan-card heading level on `/pricing` (`PlanCard` takes `headingLevel`).
- **Marked "Tez orada" / not built:**
  - 1v1 duel (card shown, not a link)
  - search covers signs and rules only (not questions)
  - the daily goal is a fixed 20 answers (no setting yet)
  - no real testimonials section (the placeholder was removed)
  - admin pages keep their own layout (they use the tokens but were not redesigned)
- **Final checks:** lint clean, type check clean, unit 16/16, DB 13/13, e2e 22/22.

## Redesign — stage 6: public pages (✅ tested)

- **Public header and footer:** tokens and our icons; the header is for visitors only; compact language picker on phones; the logo never wraps. The offer strip uses our amber style and icon.
- **Landing:**
  - Hero with an original product preview drawn from our own components (readiness card + action tiles), the phone form and a stats row with **real** database counts (questions, topics, tickets).
  - Benefit cards with icon tiles, steps, a try-it question using the test screen's answer states, plans, FAQ with chevrons, and a final CTA.
  - The fake-looking testimonials placeholder (gold stars, grey bars) is removed until real reviews exist.
  - The "three languages (Latin and Cyrillic)" benefit was corrected to two languages.
- **Login:** card plus a privacy note; phone + OTP + consent flow unchanged; colours moved to tokens.
- **Onboarding:** category picker with our icon, a check badge and 48 px+ targets.
- **Pricing:** plan cards, checkout, sandbox and payment result restyled (icons, status tiles, tabular prices).
- **Library:** search field with icon, segmented tabs, signs on a light tile (true colours in dark mode), rule cards.
- **Leaderboard:** podium badges in our colours; the opt-in link now points to Sozlamalar (where the switch lives).
- **Other pages:** legal pages and the offline page.
- **Process note:** a PowerShell bulk replace with single-item lists flattened into character replacements and corrupted two files; both were restored from git and edited properly.
- **Tests:** lint, type check, unit 16/16, DB 13/13, e2e 22/22; screenshots checked with no page errors.

## Redesign — stage 5: Profil, Sozlamalar, Saqlangan, Statistika (✅ tested)

- **Profil (rebuilt):** account header (avatar, name, phone, member since, settings button), subscription card ("I passed" kept), referral link with a copy button, rows to Saqlangan with bookmark and note counts, test history with status icons, payments. The personal form, bookmarks/notes and sign-out now live only in Sozlamalar / Saqlangan (no duplicates).
- **Settings form:** shared `Field` and the new `Switch` (a real checkbox with `role="switch"`); same server action and validation.
- **Statistika:** the sign-in check runs first, then the stats stream behind a same-shape skeleton (`Suspense`).
- **New guard:** `nav.e2e.ts` checks that a forged session gets a server 307 on `/stats`, `/dashboard`, `/profile` and `/tests`.
- **Tests:** lint, type check, unit 16/16, DB 13/13, e2e 22/22; screenshots checked with no page errors.

## Redesign — stage 4: tests hub and lists (✅ tested)

- **`/tests` hub, rebuilt from the shared cards:**
  - Category picker card (stacked on phones).
  - Mode cards: Imtihon with today's remaining full tests and a disabled "Limit" state, Aqlli mashq, Qopqonli savollar, Xatolarim with review badge, Marafon. Locked modes show a lock and open the paywall.
  - Wide cards to `/tests/tickets` and `/tests/topics` with "mastered / total" summaries.
  - Status banners for empty, limit and invalid states.
- **Paywall:** token-styled, bottom sheet on phones and dialog on desktop, icon checklist, focused call-to-action.
- **`ActionCard`:** gained a `locked` state.
- **Lesson learned:** a route-level `loading.tsx` makes Next stream pages, so `requireUser()` redirects become 200 responses with a client-side redirect instead of a server 307. The auth e2e tests caught it, and the file was removed. Skeletons must go inside pages (`Suspense` after the sign-in check), never as a `loading.tsx` above protected pages.
- **Tests:** lint, type check, unit 16/16, DB 13/13, e2e 22/22; screenshots checked for free and subscribed users with no page errors.

## Redesign — stage 3: test and result screens (✅ tested)

- **Test screen:** full screen (app bars and the desktop sidebar padding are hidden).
  - Compact header: exit (the test can be resumed later), title, timer chip, "i / n" button that opens the navigator sheet, bookmark.
  - Slim progress bar.
  - One question per screen with big answer cards (A/B/C letter badges, at least 60 px tall); correct and wrong states carry a ✓/✕ icon and screen-reader text, not just colour.
  - Feedback panel with explanation, rule reference and the AI explainer; notes.
  - Bottom bar: back, next and finish, respecting the safe area.
  - Finishing with unanswered questions opens our own confirm sheet instead of the browser's `confirm()`.
  - All existing behaviour is kept: answer and finish APIs, timer auto-submit, daily-limit message, keyboard shortcuts.
- **Result screen:** pass/fail/practice chip with icon, score ring, time / correct / mistakes tiles, pass mark, daily-limit status, retry / share / card / certificate / home. Mistakes list with your answer (✕) vs the correct one (✓), explanation and rule; images lazy-loaded.
- **Bug fixed:** a hydration mismatch. The notifications sheet formatted dates in the browser, so a user with a dated notification (for example a welcome offer) made React rebuild the page, which also reset the theme. Texts are now formatted on the server. The `<html>` class is no longer rendered by React (the font variable moved to `<body>`), and `ThemeSync` re-applies the saved theme as a safety net.
- **Tests:** `layout.e2e.ts` now fails on any page error (hydration included) and checks dark-by-default plus a remembered light choice. Lint, type check, unit 16/16, DB 13/13, e2e 22/22.

## Redesign — stage 2: home (✅ tested)

- **Hero card:**
  - Readiness ring.
  - "Davom etish": resumes the newest unfinished test that is still valid (not timed out, not fully answered, and full tests only while today's limit allows); otherwise starts Smart Practice (adaptive; free users see the paywall as before).
  - Daily goal bar: 20 answers per Tashkent day.
- **Quick actions (2 columns on phones, 3 on wider screens):**
  - Biletlar → `/tests/tickets`; Mavzulashtirilgan testlar → `/tests/topics`; Qopqonli savollar → `/tests/tricky`
  - Imtihon: shows today's remaining full tests, the paywall for free users, and the limit message when used up
  - Yo'l qoidalari → `/library`
  - Xatolarim: badge with the number due for review
- **Wide cards:** Reyting, and 1v1 duel shown as "Tez orada" (not a link).
- **Promo banner:** only for non-subscribers with an active welcome or seasonal campaign; countdown to the server end time; our own SVG; links to `/pricing`. The old top strip is gone for signed-in users; visitors still see it.
- **New pages:**
  - `/tests/tickets` and `/tests/topics`: progress cards with mastered/total and accuracy, demo and lock badges.
  - `/tests/tricky`: trap questions, made of admin-flagged ones (`Question.isTricky`) plus questions with at least 3 real answers and at least a 35% miss rate. An honest empty state when there's no data.
- **Database (additive):** `TestMode.TRICKY` (practice mode, subscription required like the other premium modes, outside the daily full-test limit).
- **Tests:** `tests/home.db.test.ts` (trap selection, TRICKY gating, resume rules, daily goal); home checks in `nav.e2e.ts`. Lint, type check, unit 16/16, DB 13/13, e2e 21/21.

## Redesign — stage 1: design system and app shell (✅ tested)

- **Plan:** `docs/design-system.md` (approved). Baseline Lighthouse mobile: performance 74–82, accessibility 94–97.
- **Tokens:** dark navy theme by default, light theme on toggle, remembered and applied before first paint. CSS variables plus Tailwind names; the neutral `slate` scale is retuned to navy so existing pages already match; the old orange CTA is retired in favour of brand blue. Inter is self-hosted via `next/font` (Latin, Latin Extended, Cyrillic) with tabular numbers.
- **Components:** `src/components/ui/` and `ProgressRing` (CSS ring fill plus count-up, respects reduced motion).
- **Shell:**
  - Phones: sticky top bar (avatar, streak, search sheet, notifications sheet) and a 4-tab bottom bar (Bosh sahifa, Statistika, Saqlangan, Sozlamalar). The bar is hidden in a running test and on the result screen, and respects the iPhone safe area.
  - Desktop (≥ 1024 px): left sidebar and a centred 1120 px column.
  - Visitors keep the public header and footer.
- **New routes:**
  - `/stats`: readiness, chips, topic accuracy, weak topics, heatmap, recent tests
  - `/saved`: bookmarks and notes
  - `/settings`: language, theme, profile form, links, sign-out
- **Fixes along the way:**
  - `/tests` scrolled sideways on phones.
  - A production `npm start` on localhost was redirected to HTTPS.
- **Tooling:** ESLint 9 with `next/core-web-vitals` is now set up (`npm run lint`, clean); `puppeteer-core` uses the installed Chrome for layout tests.
- **Tests:** unit 16/16 (adds a token contrast test and a CSS-to-token sync test); e2e 20/20, including the new `nav.e2e.ts` (tabs, active state, every link resolves) and `layout.e2e.ts` (no overflow at 360/390/430 px, 48 px tabs, no tab bar in a test).

## Stage 14: Uzbek Cyrillic removed (✅ tested, not committed)

- **Languages:** Uzbek Latin (default) and Russian only. `uz-Cyrl` is gone from the locale list, types, switcher, message files, admin template languages and hreflang. The transliteration code and `scripts/gen-cyrillic.ts` are deleted.
- **Fallback:** an old `lang=uz-Cyrl` cookie renders Uzbek Latin, even with a Russian browser, and the cookie is rewritten to `uz`. `/uz-Cyrl/...` URLs get a 308 redirect without the prefix. Users with `locale = uz-Cyrl` receive Uzbek SMS, email and push.
- **Admin and CSV:** Cyrillic inputs are removed from the question, category, topic, sign, rule, plan and campaign forms. The CSV and JSON templates no longer have `_cy` columns; old files with `_cy` columns still import, and those columns are ignored.
- **Database (confirmed by the owner, 2026-10-19):**
  - The 12 `*Cy` columns are dropped (Category name/desc, Topic name, Question text/explanation, Answer text, RoadSign name/desc, RuleArticle title/body, Plan label, Campaign banner).
  - The 24 `uz-Cyrl` MessageTemplate rows are deleted, and 1 user's locale changed from `uz-Cyrl` to `uz`.
  - Backup first: `backups/uz-cyrl-removed-2026-10-19.json` (git-ignored).
  - Afterwards: 0 `*Cy` columns; all 40 questions, 121 answers, users, tests and subscriptions intact.
- **Tests:** unit 14/14 (a locale test replaces the 2 transliteration tests); e2e 15/15 (adds 4 locale tests); DB 10/10; type check passes; build passes; crawl clean.

## Stage 13: site-wide error check (✅, not committed)

- **Crawl:** every route (15 public, 9 user, 21 admin, plus 3 APIs) as visitor, regular user and admin. No 500s, no server render errors. A browser pass found no console errors, hydration warnings or failed requests.
- **Fixed:**
  - Next's bare English 404 is replaced by a localized, styled page (`src/app/not-found.tsx`) with a link back.
  - `/admin` no longer has an "Admin" tab title for non-admins.
  - Tab titles are localized (dashboard, tests, profile, leaderboard, onboarding, test, results).
- **Added:** `npm run make-admin -- +998…` (`--revoke` removes the role; it refuses to remove the last admin).
- **Note:** non-admins still get 404 on `/admin` on purpose.

## Stage 12: daily limit of two full tests (✅ tested, ⏳ not committed until reviewed)

- **Rule:**
  - A full test is exam mode, always exactly 20 questions; practice modes (tickets, topics, marathon, mistakes, adaptive) are unlimited.
  - At most 2 per user per Asia/Tashkent calendar day, counted from saved results (`finishedAt`), on the day of submission. It resets at 00:00 Tashkent time.
  - Subscription rules are unchanged: exam mode still needs a subscription, and the limit applies on top.
- **No schema change:** counts come from the existing `TestSession` rows. Pre-existing finished 20-question exams from today count too; the one old 10-question exam does not.
- **Server:**
  - `finishSession` runs inside a transaction: advisory lock per user, re-read, validation (20 distinct questions, `totalQ` = 20), count today's finished exams, then a conditional save (`finishedAt IS NULL`).
  - Any failure rolls back, so no attempt is used.
  - It's idempotent: re-submitting returns the saved result.
  - `startTest` refuses a new exam at the limit (`/tests?limit=1`); an unfinished exam can't be continued once the limit is reached.
  - Expired exams that are auto-submitted from the test and results pages respect the limit.
- **API:** `/api/tests/finish` returns `daily {used, remaining, limit, resetsAt}`. 429 `daily_limit` and 422 `invalid_test` carry a translated message. 500 means nothing was saved.
- **UI:**
  - remaining count on the dashboard, the exam card and the exam result page
  - disabled exam card and button at 0, plus a banner
  - TestRunner shows the server's message instead of always navigating to results (that was an existing bug)
- **Admin:** exam templates must have 20 questions.
- **Tests:**
  - `npm test` 15/15; `npm run test:db` 10/10, covering scenarios 1–10 of the brief plus scoring and start
  - `npm run test:e2e` 11/11 (8 auth + 3 limit over HTTP)
  - production build passes
  - With the lock deliberately disabled, the concurrency test failed (6 of 6 accepted), so the lock is what enforces the limit.
- **Browser check (throwaway user, then deleted):**
  - dashboard showed "1 / 2"
  - the exam started with 20 questions
  - after another device used the second attempt, submitting showed the limit message
  - the tests page and dashboard were blocked, the results page showed the limit and hid "retry", and reopening the unfinished exam redirected
- **Limitations:**
  - The lock needs PostgreSQL (already the project's database).
  - Exams submitted after midnight count toward the new day.
  - Early-finished exams (unanswered questions are graded wrong) count, as before.
  - The client-side timer auto-submits at 0; if the limit was used elsewhere meanwhile, that submission is rejected.

## Stage 11: authentication hardening (✅ tested)

Audit of the existing auth (phone OTP + optional email/password, DB sessions). Nothing was rewritten; no data was deleted except the throwaway users the tests created.

**Already sound (kept):** zod validation on every auth route; unique phone and email in the schema; OTP hashed with TTL, attempt limit, resend cooldown and rate limits; only a SHA-256 hash of the session token is stored; httpOnly/SameSite cookie; every API route, server action and user page checks the session and ownership on the server.

**Fixed or added:**
- **Admin pages:** each of the 18 admin pages now calls `requireAdmin()` itself. Before, only `admin/layout.tsx` did, and a crafted RSC request for a single page segment can skip the layout.
- **Client IP spoofing:** `clientIp()` took the *first* `X-Forwarded-For` entry, which the client controls, so per-IP limits (OTP sends, email login, promo codes) could be bypassed by sending a fake header. It now counts `TRUSTED_PROXY_HOPS` (default 1) entries from the end. A test proves a spoofed prefix no longer resets the limit.
- **Sessions:**
  - expired session rows are deleted when presented
  - setting a new password deletes every other session for that user
  - new "Log out of all devices" (Profile → Xavfsizlik)
- **Email login:** constant-time bcrypt for unknown emails (no user enumeration by timing); 429 now shows "Juda ko'p so'rov…" instead of "wrong password"; network errors handled.
- **Profile:** test history (last 20, with total count, mode, date, time, score, linking to results) and "member since" date.
- **Messages:** new `auth.passwordShort` and profile strings in uz / uz-Cyrl / ru (i18n parity test passes). The OTP field refocuses after a wrong code.

**Tests:**
- New `tests/auth.e2e.ts` (`npm run test:e2e`), 8 tests:
  - anonymous visitors are redirected away from protected pages
  - a forged cookie is rejected
  - registration validation (bad phone, no consent, wrong code, no duplicates, only hashes stored)
  - users get 404 on 5 admin URLs; admins get 200
  - expired session → redirect and the row is deleted
  - email login gives a generic error, is case-insensitive and never returns hashes
  - IP rate limit plus the spoofing check
- **Checked in the browser:**
  - **Profile:** shows test history (4 tests).
  - **Logout:** deletes the session row (6 → 5), goes to `/`, and `/profile` then redirects to login.
  - **Registration:** messages "consent required" and "Kod noto'g'ri" shown; onboarding done.
  - **Password change:** `minLength=8` blocks short passwords; saving shows "Saqlandi" and the other-device session is deleted while this browser stays logged in.
  - **Log out of all devices:** 2 → 0 sessions, redirect to `/`.

**Remaining:** the middleware still only checks that the cookie exists (Edge runtime, no DB). That's fine because every page re-checks on the server. Set `TRUSTED_PROXY_HOPS` to match production proxies. The test login rate limit is in memory unless `REDIS_URL` is set.

## Stage 10: git repository (✅)

- Repository initialised on branch `main`; first commit **`d9a235d`** "Initial commit: YHQ Test driving-theory exam prep app" (175 files). **No remote is configured and nothing was pushed.**
- **`.gitignore`** checked and confirmed with `git check-ignore`: `.env` (and every `.env.*` except `.env.example`), `node_modules`, `.next`, `.localdb`, `public/uploads`, plus build caches, logs and OS files.
- **`.gitattributes`** added: LF line endings on every OS (the files were written with LF; without it Windows would convert them to CRLF), and images marked binary.
- **Secret scan before committing:** no API keys, private keys or passwords with values. `.env.example` only has empty values or "change-me".
- **Commit author:** the identity already set up by GitHub Desktop on this machine (javlonbekbusiness-maker).
- **Git isn't on this machine's PATH.** The commit used the copy bundled with GitHub Desktop (`%LOCALAPPDATA%\GitHubDesktop\app-3.5.8\resources\app\git\cmd\git.exe`). You can also open the folder in GitHub Desktop, or install Git for Windows to use `git` in a terminal.
- This PROGRESS.md update was made after the commit, so it's an uncommitted change.

## Stage 9: remaining features played through (✅ tested in the browser)

| Feature | Result |
|---|---|
| **Topic mode** | ✅ "Road signs" served exactly the 8 sign questions (checked in the DB), no timer, practice result; Retry keeps the topic; the header now names the topic ("↔️ Ustunlik va chorrahalar") |
| **Marathon** | ✅ all 40 questions, 40 distinct, random order; resume after a page reload continued at question 4 with earlier answers kept; early finish warned "37 unanswered" |
| **Adaptive practice** | ✅ after the fix below: with "signs" as the weak topic (38% over 8 answers), the session contained all 8 sign questions (was 2 before the fix) plus a mix of the rest |
| **Certificate** | ✅ passed an exam with 19/20 (95%, one unanswered counted wrong); the result page offered "🏅 Sertifikat"; the PNG shows name, 95%, 19/20, date and "not an official document". Another user gets 404 for both the certificate and the result page. |
| **Referral** | ✅ a new user signed up through `/?ref=<Aziza's code>` on the landing form; with the welcome offer paused, every plan showed "Do'st taklifi −10%" (179 000 → 161 100). After the sandbox payment, Aziza got the SMS "Sizga 7 kun bepul qo'shildi" and access 16.11 → 23.11 (a "Referral reward" period). The friend's second quote had no discount, and a second paid purchase gave **no** second reward. |
| **Reminders cron** | ✅ no token / wrong token → 401. With one prepared case of each, the first run sent expiry 1, streak 1, abandoned 1, win-back 1; the second run sent 0 of each (no repeats). Message texts were correct, e.g. "2 kunlik seriyangizni yo'qotmang", single-use codes `BACK…` (10%) and `WIN…` (20%, usage limit 1). Each was sent by SMS + push stub and logged. |
| **Image upload** | ✅ a real PNG uploaded, saved under `/uploads/`, served as `image/png` (same 5 295 bytes) and previewed; SVG and a 3 MB file were stopped in the browser before sending; an SVG disguised as `.png` is refused by the server with a message and nothing written |

Bugs found and fixed in stage 9:
- **Adaptive practice barely favoured weak topics.** All the "unseen" topics together outweighed the one weak topic (2 of 8 sign questions picked). Now half of each session is reserved for weak topics (worst first), and the rest is weighted. The logic moved to `src/lib/adaptive.ts` with 3 unit tests over 20 seeds.
- **The question editor showed a crash page ("Application error") for any validation problem**, including a rejected image, missing answers or a missing correct answer. It now returns to the editor with a clear message; the same checks also run in the browser before sending, so typed content isn't lost.
- **Uploads trusted the browser-declared file type.** An SVG renamed to `.png` was accepted (low risk, since it's served as `image/png` with `nosniff`, but it isn't an image). Uploads are now identified by their file signature (PNG / JPEG / WebP) in `src/lib/image-sniff.ts`, with a unit test. This also covers sign uploads.
- New editor checks: every answer needs both Uzbek and Russian text; ticket number 1–999; image URL format; category must exist.
- Topic sessions now show the topic name instead of the generic "Mavzular bo'yicha".

Test data now in the local DB: new users "Do'st Bek" (+998 90 444 44 44, referred by Aziza, 2 payments) and "Lapsed Lola" (+998 90 777 77 77, expired access); Free Tester has 1 day of access and an old unpaid checkout; 5 of Aziza's answers were moved to 16.10 for the streak test; reminder codes `BACK46B8A8` and `WIN3AA99C` exist. The welcome offer is active again; the test question image was restored to `/signs/stop.svg`, and the uploads folder is empty.

## Stage 8: README and local database script (✅)

- **`README.md`** covers:
  - setup with Docker, and without Docker (embedded PostgreSQL)
  - seed data, demo promo codes and admin login
  - scripts and every environment variable (cross-checked against the code)
  - project structure, importing the question bank and setting the exam format
  - providers: Eskiz / PlayMobile, Click / Payme / Uzum callbacks, Claude, email, push
  - the reminders cron job, security and privacy notes, and a going-live checklist
- **`scripts/local-db.mjs` / `npm run db:local`:** starts PostgreSQL without Docker (`npm install --no-save embedded-postgres` first). Data goes to `.localdb/`. It creates the `yhq_dev` database explicitly as **UTF-8**, which avoids the WIN1251 emoji failure hit in stage 2.
  - ✅ Verified from scratch: on a separate port and an empty folder, the script initialised the cluster, then `prisma db push` and the seed both succeeded with the counts above. The verification data was removed afterwards.
- `.env.example`: added `ADMIN_PHONE`. `.gitignore`: added `.localdb` and `public/uploads`.
- README corrections made while checking it: Node requirement is **22.9+** (the seed uses `--env-file-if-exists`), not 20.

## Stage 7: message templates, translations, library, settings admin (✅ tested in the browser)

Files: `src/app/admin/messages/page.tsx`, `src/app/admin/messages/MessageEditor.tsx`, `src/app/admin/translations/page.tsx`, `src/app/admin/library/page.tsx`, `src/app/admin/settings/page.tsx`, `src/lib/sms-segments.ts` (new, shared by server and browser), `SAMPLE_VARS` / `TEMPLATE_INFO` in `src/lib/template-defaults.ts`, and the Library / Message templates / Translations & settings sections of `src/app/admin/actions.ts`.

**Message templates**
| Feature | Result |
|---|---|
| Grid of 8 messages × SMS/email/push × 3 languages; shows default vs saved, provider-approved ✓, SMS segment count, sends in the last 30 days | ✅ e.g. 11 OTP SMS logged |
| Editor: subject (email), placeholder chips inserted at the cursor, live preview with sample data | ✅ |
| SMS counter: characters, GSM-7 vs UCS-2, segments; warns over 1 segment for OTP, 2 for others | ✅ Cyrillic OTP text: "121 characters · UCS-2 · 2 segments — keep it to 1" |
| Validation: OTP must contain {code}; unknown placeholders; email subject required; length limits | ✅ |
| Provider-approved flag (SMS); editing an approved text warns it needs re-approval | ✅ |
| Save → used for real messages | ✅ a real login code for another user arrived with the edited text |
| Test send to the admin's own phone/email (rate-limited) | ✅ SMS appeared in the log with sample data; email shows "no email on your account" |
| Reset to built-in default | ✅ |

**Translations**
| Feature | Result |
|---|---|
| Language tabs with override counts; search by key or text; section filter; "overridden only" | ✅ |
| Each text shows the shipped value (+ the Uzbek reference) and an override field | ✅ |
| Override goes live immediately, in that language only | ✅ Russian menu showed "Тренировки"; Uzbek unchanged |
| {placeholder} protection | ✅ missing and renamed placeholders rejected; correct ones saved |
| Empty value (or same as shipped) removes the override | ✅ |

**Library (signs & rules)**
| Feature | Result |
|---|---|
| Signs: add / edit / delete, group suggestions, image URL or upload (PNG/JPEG/WebP ≤ 2 MB), auto-Cyrillic | ✅ new sign appeared in the public library search; rename updated the Cyrillic; deleted |
| Image URL validation | ✅ a `javascript:` URL was rejected |
| Rule articles: add / edit / delete, unique number | ✅ duplicate "P-1" rejected; new article shown on the public rules tab; deleted |
| Warning while sample ([NAMUNA]) articles remain | ✅ |
| Upload of a real image file | ✅ via the shared `saveUpload`, tested in the question editor in stage 9 |

**Settings**
| Feature | Result |
|---|---|
| Referral friend discount and referrer days | ✅ the profile then said "15% … 10 kun"; restored to 10% / 7 days |
| Support phone, email, Telegram (footer); Telegram "@" added automatically | ✅ footer updated; restored |
| Validation of every field | ✅ |
| Integrations status (configured / not, never shows secret values) | ✅ |

Bugs found and fixed in stage 7:
- An OTP template without {code} could be saved, which would break every login → blocked.
- Placeholder typos (e.g. {nmae}) would be sent to users as-is → rejected with the list of allowed placeholders.
- Translation overrides could drop or rename {placeholders}, breaking that UI text → rejected.
- Signs could not be edited at all (create only), and there was no image-URL check → edit + validation.
- After a validation error on a *new* sign or article, the form closed → it now stays open.
- Settings were saved unvalidated → every field validated.
- `smsSegments` lived in the SMS provider module, so the browser preview couldn't use it → moved to `src/lib/sms-segments.ts`.

Test data now in the local DB: unchanged. The test sign and article were deleted; templates, overrides and settings were restored.

## Stage 6: tickets, exam templates, categories/topics admin (✅ tested in the browser)

Files: `src/app/admin/tickets/page.tsx`, `src/app/admin/exam/page.tsx`, `src/app/admin/exam/TemplateForm.tsx`, `src/app/admin/categories/page.tsx`, and the Tickets / Categories & topics / Exam templates sections of `src/app/admin/actions.ts`.

**Tickets**
| Feature | Result |
|---|---|
| Category switcher with ticket counts; totals: tickets, free tickets, active questions, questions not in any ticket | ✅ |
| Per ticket: question count (links to the filtered question list), topic breakdown, access | ✅ matched the seed (4 × 10, tickets 1–2 free) |
| Free/demo ↔ paid toggle | ✅ a newly signed-up free user saw tickets 1–3 as "Demo" and ticket 4 locked; toggled back |
| Regenerate from a ticket template (with confirmation), keeping which numbers are free | ✅ with mix `signs: 2, lights: 1` every ticket got 2 sign questions; light questions ran out after 3 tickets, so ticket 4 was filled randomly; tickets 1–2 stayed free |
| Refuses to regenerate when there are fewer questions than one ticket | ✅ a 50-per-ticket template: "40 available, 50 needed… existing tickets were kept" |
| Remove empty ticket | 🔵 button only appears for tickets with 0 questions (none in the test data) |

**Exam templates**
| Feature | Result |
|---|---|
| List with question count, time, pass mark + allowed mistakes, topic mix, default badge | ✅ |
| Warnings: not enough active questions in the category or in a mix topic | ✅ "Only 40 active questions in B", "Not enough questions in: testmix" |
| Create / edit with validation, values kept on error | ✅ time 0, mix larger than the count, unknown topic, malformed mix, pass 150% |
| Kind = Ticket hides the time limit; live "at least X of N correct" hint | ✅ |
| Duplicate → opens the copy for editing | ✅ |
| Make default, and new exams use it | ✅ a 10-question / 12-min / 80% default: the tests page showed "10 savol · 12 daqiqa · o‘tish 80%"; the exam had 10 questions and a 12:00 timer |
| Deleting the default is blocked; other templates delete | ✅ |

**Categories & topics**
| Feature | Result |
|---|---|
| Add category (code, 3-language names, descriptions, order, active) with auto-Cyrillic | ✅ C1 created; Cyrillic filled in automatically ("Кичик юк") |
| Validation: duplicate code, code too long, names required | ✅ |
| Deactivate → hidden from the users' category switcher | ✅ C1 disappeared from `/tests` |
| Delete only when unused (no button for B, which has questions and users) | ✅ |
| Add topic; duplicate / invalid slug errors; slug not editable after creation | ✅ |
| Edit topic names | ✅ |
| Delete topic blocked while it has questions or while an exam template's mix uses it | ✅ both guards; deleted after removing it from the mix |

Bugs found and fixed in stage 6:
- **Regenerating tickets with too few questions wiped every ticket** → refused, existing tickets kept.
- A topic mix larger than the ticket size produced oversized tickets → validated and capped.
- Duplicate category codes / topic slugs crashed → messages.
- Renaming a topic slug silently broke template mixes → slugs are immutable.
- **Auto-generated Cyrillic went stale on edits (all admin forms).** Editing the Uzbek text kept the old Cyrillic, because the form shows the stored Cyrillic so it's never empty. Edit forms now send the previous Uzbek text; Cyrillic that still matches the old auto-version is regenerated, while hand-written Cyrillic is kept. Applied to questions (text, explanation, answers), categories, topics, plans and campaign banners. Verified on topics: Uzbek change → Cyrillic updated; hand-written "Махсус ном" kept after an Uzbek change.
- Inline category fields had no visible labels → captions added.
- "Make default" message talked about exams for ticket templates → reworded.

Test data now in the local DB: B tickets were regenerated with the mix (ticket contents differ from the seed; `npm run db:seed` restores the seed's numbering). Templates are back to the seeded set (the ticket template now has mix `signs: 2, lights: 1` and is the default ticket template). A free test user "Free Tester" (+998 90 555 55 55) was created.

## Stage 5: users, payments, plans admin (✅ tested in the browser)

Files: `src/app/admin/users/page.tsx`, `src/app/admin/users/[id]/page.tsx`, `src/app/admin/payments/page.tsx`, `src/app/admin/plans/page.tsx`, `src/app/admin/ConfirmButton.tsx`, `src/lib/admin-filters.ts`, user/plan actions in `src/app/admin/actions.ts`, payments export in `src/app/api/admin/export/[kind]/route.ts`.

**Users list**
| Feature | Result |
|---|---|
| Totals: users, with active access, admins | ✅ |
| Table: name/email, phone, category, joined, access-until, total paid (count), last active, role | ✅ figures matched the test payments (Aziza 143 200 (1); Admin 85 000 (2) = 63 200 + 21 800) and stacked access dates |
| Search by name, email, ID, or phone (with or without spaces/+998) | ✅ |
| Filters: access (active / none), category, role; pagination | ✅ |

**User detail**
| Feature | Result |
|---|---|
| Access, total paid, readiness/accuracy/answers/tests, referrals | ✅ |
| Access periods with source and current / upcoming / ended status | ✅ the trial period showed as "upcoming" after the paid period |
| Payments (failed and paid), profile, recent messages | ✅ |
| Grant days (custom or +3/+7/+30), stacking after current access | ✅ +7 moved 18.01 → 25.01.2027; invalid days (0) rejected with a message |
| Revoke access, with confirmation | ✅ ended current + upcoming periods; the user's tests page then showed 13 locked items and an upgrade button; a second revoke says "nothing to revoke"; after a revoke, granting starts from today |
| Make admin / remove admin, with confirmation; cancelling changes nothing | ✅ |
| Own account: role change not offered ("another admin must change your role"); server also refuses self-change and demoting the last admin | ✅ UI checked; server guards are in the code (the last-admin case can't be reached through the UI) |

**Payments**
| Feature | Result |
|---|---|
| Totals for the current filter: revenue, discounts, success rate, count | ✅ 228 200 / 58 800 / 75% / 4, checked by hand |
| Filters: search (phone, name, payment ID, provider ref), status, provider, promo code, date range (Tashkent days), combined | ✅ 11 filter combinations tested |
| CSV export uses the same filters | ✅ CSV row count equals page row count for every combination; adds paid_at, name, campaign, bonus days |
| Invalid filter values ignored safely | ✅ |
| Links to user and promo code; provider ref; bonus days shown | ✅ |

**Plans**
| Feature | Result |
|---|---|
| Edit price, duration, order, names in 3 languages (Cyrillic auto-filled), on-sale, "Best value" | ✅ |
| Per-plan stats: price per day, saving vs weekly, active subscribers, sold + revenue | ✅ |
| Validation: price 1 000–10 000 000, duration 1–3650, names required | ✅ |
| Only one "Best value" badge | ✅ featuring "1 month" removed it from "3 months" |
| Can't hide the last active plan | ✅ |
| Public pricing updates immediately | ✅ week 32 000 shown, badge moved, hidden plan disappeared, "save %" recalculated (42% / 56%); then restored to the original values |

Bugs found and fixed in stage 5 (all in the old, previously unused actions):
- Grant / revoke / role / plan actions gave no feedback and silently ignored bad input → messages for every outcome.
- A plan could be saved with price 0, an empty name, or 0 days → validated.
- Several plans could carry "Best value" at once → only one.
- All plans could be switched off (empty pricing page) → blocked.
- Removing the last admin was possible in code → blocked.
- The payments CSV ignored filters → now uses the same filter function as the page.

Test data now in the local DB: Aziza's access was revoked during testing and re-granted for 30 days (until 16.11.2026). Plans are back to the seeded prices and badges.

## Stage 4: campaigns admin (✅ tested in the browser)

Files: `src/app/admin/campaigns/page.tsx`, `src/app/admin/campaigns/CampaignForm.tsx`, campaign actions in `src/app/admin/actions.ts`, `autoDiscount` in `src/lib/pricing.ts`, checkout label in `src/app/(site)/pricing/Checkout.tsx`.

| Feature | Result |
|---|---|
| 7 presets create inactive drafts with discount, dates and banner pre-filled | ✅ Navruz 19–24 Mar 2027, Independence Day 29 Aug – 3 Sep 2027, Black Friday 27 Nov – 1 Dec 2026 (last Friday of Nov), all from Tashkent midnight; welcome 20%/24 h; referral 10%; win-back 20% |
| "Driving school partner" preset | ✅ opens Promo codes → bulk generator pre-filled (15%, `SCHOOL-` prefix, new users only, single-use) |
| Scheduler: start/end in Tashkent time; status live / scheduled / ended / paused | ✅ |
| Banner editor in 3 languages with live preview; Cyrillic auto-filled from Uzbek | ✅ |
| Validation with readable errors, values kept | ✅ missing dates, 95%, end before start, activating a sale with no banner |
| Activate / pause | ✅ pausing removes the site banner and discount immediately |
| Only one active welcome / referral / win-back | ✅ activating a second welcome switched the first off (checked in the DB) |
| Delete | ✅ unused drafts deleted; a campaign with payments is paused instead |
| Per-campaign report: paid / checkouts, conversion, revenue, discount given (+ win-back SMS sent, referral rewards) | ✅ Navruz: 1/1 paid, 21 800 revenue, 7 200 discount, matching the test payment |
| Message template preview for welcome / win-back / referral | 🔵 shown on the edit form; editing templates is a later stage |

**Verified on the public site (live seasonal sale):**
- **Logged-out landing page:** banner with countdown; all 4 plan cards show the old price struck through and "−25%" (29 000 → 21 800, 79 000 → 59 300, 179 000 → 134 300, 249 000 → 186 800).
- **Logged-in pricing page:** same banner and struck-through prices; the checkout summary shows "Aksiya (−25%) −44 700".
- **Languages:** the banner shows correctly in uz, uz-Cyrl (auto-transliterated) and ru.
- **Payment:** a payment made during the sale was attributed to the campaign in the report.

Bugs found and fixed in stage 4:
- **PARTNER campaigns were applied to every visitor automatically**, so activating the driving-school preset would have discounted the whole site. Partner discounts now go only through promo codes; only SEASONAL campaigns are automatic.
- Campaign saves had no validation, and a sale could go live without banner text → validated, with readable errors.
- Two welcome offers could be active at once → only one per type (welcome / referral / win-back).
- Preset dates used the server's local midnight → explicit Tashkent midnight; Black Friday is computed correctly.
- Checkout showed the internal English campaign name to customers ("Aksiya: Navruz sale") → now just "Aksiya" in the user's language.
- The 🇺🇿 flag emoji renders as "UZ" on Windows → replaced.

Test data now in the local DB: "Navruz sale" (paused, dated 17–20 Oct 2026, 1 payment); the original "Welcome offer" is active.

## Stage 3: promo codes admin (✅ tested in the browser)

Files: `src/app/admin/promo/page.tsx`, `src/app/admin/promo/[id]/page.tsx`, `src/app/admin/promo/PromoForm.tsx`, `src/lib/promo-stats.ts`, promo actions in `src/app/admin/actions.ts`.

| Feature | Result |
|---|---|
| Code list with discount, rules summary, uses / limit, paid / checkouts (conversion), revenue, partner, status (active / paused / scheduled / expired / used-up) | ✅ figures matched the stage-2 test payments exactly |
| Summary tiles: redemptions, revenue after discounts, discount given, checkout conversion | ✅ 3 / 206 400 / 51 600 / 67%, checked by hand |
| Create: every type and rule (dates, total + per-user limit, one-time, minimum order, plans, new users only, combinable, partner, note) | ✅ NAVRUZ25 created; at checkout it gave −25% on "1 month" (79 000 → 59 300) and was refused on "1 week" |
| Validation with readable errors, form keeps typed values | ✅ duplicate code, 150%, end before start, too-short code |
| Edit (date round-trip in Tashkent time, value, partner) | ✅ |
| Pause / resume | ✅ a paused code is refused at checkout and works again after resume |
| Delete | ✅ unused code deleted; a code with payments is paused instead (payment records keep their link) |
| Bulk generate | ✅ count validation (0, 6000 rejected); 25 unique single-use codes with prefix, partner and end date; batch banner |
| Batch CSV export | ✅ 25 rows, all unique, prefixed, with partner name |
| Single-use enforcement | ✅ after one paid checkout, the same user gets "already used" and another user gets "limit reached" |
| Partners: add (with validation), delete (codes unlinked, kept), stats | ✅ 26 codes, 1 buyer, 1 purchase, 63 200 revenue, 6 320 commission at 10% |
| Batches table: codes, redeemed %, revenue, View / CSV | ✅ |

Bugs found and fixed in stage 3:
- Promo actions threw raw errors on bad input (crash page) → validation now returns messages.
- Deleting a code that only had a *failed/pending* payment would have hit a foreign-key error → now paused instead.
- Date inputs were parsed in the server's timezone → now explicitly Tashkent time (UTC+5), both ways.
- The partner success message didn't update (a `#partners` anchor in the redirect blocked navigation) → anchor removed.
- Cosmetic `?&msg=` in redirect URLs → fixed.

Notes:
- "Users (checkout)" in partner stats counts distinct buyers who used the partner's codes. Attributing *sign-ups* to a partner (before any purchase) would need the code captured at registration, for example a `/?promo=CODE` link. Not built yet.
- The CSV export writes dates in UTC (ISO); the admin UI shows Tashkent time.
- Discounts are rounded down to whole 100 so'm (25% of 79 000 = 19 750 → 19 700).

## Bugs found and fixed in stage 2
| Bug | Fix |
|---|---|
| Share-card / certificate PNG returned 500 | Multi-part text (`{score}%`) is now a single string (the image renderer requirement) |
| Promo error messages flashed and disappeared | Message is cleared only when the user removes a code |
| "Minimum order" message showed a blank amount | The quote API now returns the code's minimum |
| Promo rate limit counted every plan switch (honest users could get blocked) | Only invalid codes count toward the 10-per-10-min limit; same for the trial endpoint |
| Missed questions were not offered in "Mistakes review" for 10 minutes | They are due immediately |
| CSV export prefixed phone numbers with `'` (formula guard too broad) | Plain numbers pass through; formulas are still neutralized; unit test added |
| Phone-form error overlapped the "2 free tickets" line | Spacing added |
| Seed had 41 questions instead of 40 | Extra question removed |
| Cyrillic category names were wrong ("Мототсикллар", "Б + тиркама") | Hand-written Cyrillic in the seed |
| `tsx` seed ignored `.env` | `db:seed` now uses `--env-file-if-exists=.env` |

## Feature status

### ✅ Verified
Phone + OTP auth, sessions, onboarding, landing, paywall, **all six test modes** (ticket, exam, mistakes, topic, marathon, adaptive), session resume, results, share card, **certificate**, dashboard stats, bookmarks, notes, AI fallback, pricing + discount engine (welcome offer, every promo type and rule), sandbox payment success/failure, free trial, subscription stacking, receipts (SMS mock), **referral discount + referrer reward**, **reminders cron**, 3 languages, profile (with test history), logout/login, **email + password login, password change signing out other devices, log out of all devices, session expiry**, library search, the full admin panel, **image upload**, admin access control, seed script, `npm run db:local`.

### 🔵 Builds, not yet exercised
- Repeat-trial block on a *different* trial code for the same phone or device
- Removing an empty ticket (the button only shows for tickets with no questions)
- Real SMS providers (Eskiz, PlayMobile), real Click / Payme / Uzum callbacks, Claude API with a real key, SMTP email
- Service worker offline caching (it only registers in production builds)

### ⬜ Not started
- ~~Admin pages~~: all done (stages 3–7); every admin menu link works.
- User data deletion on request (privacy law): no "delete user" action yet
- Refunds: there's no refund action; the REFUNDED status exists but nothing sets it
- Partner sign-up attribution (`/?promo=CODE` links)
- Real web push (VAPID + `web-push`); currently logged only

## Known issues / risks
- Official exam format is unverified: the seeded 20 questions / 25 min / 90% are placeholders. Confirm against Cabinet of Ministers Resolution No. 408 or the exam centre.
- The 40 questions, 16 sign descriptions and 8 rule articles (P-1…P-8) are samples marked as such; replace them with licensed content.
- The Payme / Click handlers follow public docs and must pass each provider's sandbox; Uzum is a stub.
- The share-card font has no Cyrillic, so the card text is always Latin.
- The site footer also shows on the test screen (cosmetic).

## Local test database (for resuming)
- **For new setups:** use `npm run db:local` or Docker, as described in the README.
- **The database used during these test sessions:** an older throwaway PostgreSQL in `%TEMP%\yhqpg`, started with `node start.mjs` in that folder, port 5433, database `yhq_utf8` (see `.env`). It holds the test data listed under each stage. It can be deleted once you switch to `npm run db:local` or Docker.
- Seeded admin login: phone `+998 90 000 00 01` (dev code shown on screen).

## Next steps (one small stage each)
1. Test the last 🔵 items that don't need provider accounts: repeat-trial block, production-build service worker. (Email + password login and profile save were verified in stage 11.) Commit after each stage.
2. Consider: user data deletion (privacy law), a refund action, partner sign-up links, real web push.
3. Optional: create a private GitHub repository and push (only when you decide to; nothing is pushed yet).
4. Before launch: work through the README's going-live checklist (licensed content, exam format, provider contracts and sandbox tests).

Test data now in the local DB: promo NAVRUZ25 (30%, partner Avtomaktab №1), batch `b_f61fdf84` (25 SCHOOL1- codes, one used), MINUS15K deleted during testing (re-run `npm run db:seed` to restore it).

## How to resume
```bash
npm install
npm run typecheck
npm test
npm run build
```
Then start the database (see above), run `npx prisma db push` and `npm run db:seed`, then `npm run dev`.

## Shared question pool (licence category removed from the UX) (✅ tested)

Users are never asked for a licence category: one shared pool of all active questions. Details and query timings are in `docs/shared-pool.md`.

**What changed for users**
- The "Toifa" selector is removed from /tests, onboarding (now only name and optional email), settings and the profile form.
- A category saved on an existing profile is ignored. Progress and history are untouched.

**Tickets**
- Tickets of 10 are dealt automatically and deterministically from the whole pool.
- Questions keep their ticket; new questions only form new tickets numbered after the last one.
- The ticket list is paginated (40 per page).

**Topics**
- Search by name (Uzbek or Russian) and pagination (24 per page), with per-topic progress and accuracy.
- Still a single "Mavzulashtirilgan testlar" entry point.

**Exam**
- 20 questions balanced over topics, no repeats.
- Questions answered in the last 3 days are avoided unless the pool runs short.

**Marathon**
- Rounds of 100 questions, not-yet-mastered questions first.

**Admin**
- Category is optional in the question form ("— all") and in CSV import (empty or `all`).
- Admin → Tickets is now one global list with "Create new tickets", which replaces the destructive "Regenerate tickets".
- CSV updates no longer clear a question's ticket when the row has no ticket.

**Performance**
- 4 new indexes.
- `progressBy` and `userStats` aggregate in SQL.
- With 1290 questions, statistics went from 238 ms to 32 ms and smart practice from 238 ms to 16 ms (medians); everything else is under 25 ms.

**Test data**
- `npm run db:seed-bulk` adds 1250 `[TEST]` questions, 30 test topics and 40 bench users; `--remove` deletes them.
- The local DB currently **contains this bulk data**.

**Checks**

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ 0 problems |
| `npm test` | ✅ 18/18 (new: ticket planning, exam selection) |
| `npm run test:db` | ✅ 16/16 (new `tests/pool.db.test.ts`: generation idempotent, edits don't reshuffle, new questions form a new ticket only; TICKET mode global; exam 20 unique, balanced, avoids previous exam) |
| `npm run test:e2e` | ✅ 26/26 (new `tests/pool.e2e.ts`: no category field anywhere; ticket started from the list is unchanged after new questions are added; exam from /tests is unique, balanced and avoids the previous exam; topic search and pagination) |

## Topics page redesign (✅ tested)

Details are in `docs/topics.md`.

**Topics**
- 40 topics taken from the official Traffic Rules headings (Resolution No. 172 of 12.04.2022, read from lex.uz in Uzbek Latin and Russian), in 7 editable groups.
- Descriptions are our own wording.
- The 8 demo topics keep their slugs, so their questions and progress stay attached.

**List (`/tests/topics`)**
- Sticky top bar with back, "Mavzular" and a debounced search that ignores apostrophes and diacritics and matches both Uzbek and Russian names.
- Collapsible group sections.
- Filter chips: Hammasi, Boshlanmagan, Jarayonda, Zaif, Tugatilgan. Sort: tartib bo'yicha, zaiflari birinchi, yangi.
- Cards show the group-coloured icon, the full name, the question count, a progress bar, "X / Y yechilgan" and accuracy.
- A skeleton shows while loading; section rendering uses `content-visibility`.

**Detail (`/tests/topics/[slug]`, new route)**
- Description, source chapter, stats.
- Buttons: Boshlash, Faqat xatolar, Tezkor 10 ta savol. Link to the library.

**Free users**
- Every topic shows a lock chip and "Bepul: 3 savol". The sample size is an admin setting, and 0 makes topics subscriber-only.
- The sample is the topic's first 3 questions; the paywall sheet opens once they are answered.
- The rule is enforced in `startTest` and in `/api/tests/answer` (402).

**Admin**
- New `/admin/topics`: groups and topics (create, rename, reorder, regroup, hide), with counts computed read-only.
- Categories now have their own page.
- New setting: "Free questions per topic".

**Schema** (`db push`, additive)
- `TopicGroup` table.
- `Topic` gets descUz, descRu, ruleRef, libraryHref, groupId, isActive, createdAt.
- `TestSession.isSample`.
- Index `Question(topicId, isActive, sortOrder)`.

**Load times** (1290 questions, 40 topics, a user with 3000 answers)
- Topics page data: 26.7 ms median.
- Detail page: 5.3 ms.
- Full HTML from the dev server: about 0.7 s when run alone.

**Checks**

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm test` | ✅ 20/20 (new: search normalisation, topic status) |
| `npm run test:db` | ✅ 20/20 (new `tests/topics.db.test.ts`: free sample fixed and server-side, setting 0 locks, subscriber variants, hidden/empty topics) |
| `npm run test:e2e` | ✅ 32/32 after replacing the superseded server-side topic search test (new `tests/topics.e2e.ts`: list and groups, search incl. Russian, collapse and filters, free label + sample + paywall + API 402, subscriber without locks, no overflow and 48 px targets at 375 px, response time) |

## Umumiy qoidalar questions added; placeholder data removed (✅ tested)

**Questions**
- Added 17 questions to "Umumiy qoidalar" (`ch-01`) from screenshots the user sent: `prisma/content/umumiy-qoidalar.json`, IDs `UQ-001`–`UQ-020`.
- The three picture questions (9, 13, 15) were left out, because the pictures belong to the other app.
- Every correct answer was checked against the official definitions (point 6, and the chapter 8 rule on the warning triangle) on lex.uz. Russian texts follow the official Russian definitions.
- Explanations are our own wording. Obvious typos from the screenshots were fixed.
- Imported with `npm run questions:import -- <file>`, which uses the normal importer and then deals new tickets. Ten of the questions formed ticket 5; the other 7 wait for a ticket.

**App changes**
- Questions may now have 2–5 answers (was 3–5), for Ha / Yo'q questions. This applies to the importer, the admin form and its client-side check.

**Data**
- Removed the 1,250 `[TEST]` placeholder questions and the 40 bench users (`npm run db:seed-bulk -- --remove`).
- The 40 demo questions are kept.

**Test fix**
- The ticket tests (`tests/pool.db.test.ts`, `tests/pool.e2e.ts`) set aside real questions that are waiting for a ticket while they run.
- Before this fix, one run dealt 6 real questions into throwaway tickets 6–7. They were returned to the waiting pool and the empty tickets were deleted.

## Umumiy qoidalar: 15 more questions (✅ checked)

- Added `UQ-021`–`UQ-040` from the second batch of screenshots.
- Left out:
  - picture questions 24, 29, 30, 31
  - question 28, which duplicates `UQ-020`
- Answers were checked against the definitions in point 6 and Annex 1 on lex.uz, with Russian from the official Russian text.
- The topic now has 32 questions, in tickets 5–7, with 2 waiting for a ticket. There are 71 active questions in total.

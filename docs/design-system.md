# YHQ Test design system — proposal (stage 0)

Status: **proposal, awaiting approval.** Nothing below is implemented yet.

Goal: a modern, card-based mobile app look (dark navy, big rounded cards, bottom tab bar, compact top bar) that is our own — our name, our logo, our icons, our colours — and works equally well on desktop.

## 1. Tokens

Implemented as CSS variables on `:root` (light) and `.dark` (default), mapped into the Tailwind theme, so components use `bg-surface`, `text-muted`, `border-line`, … and never raw hex values. The theme is chosen before first paint by the existing inline script (no flash); dark is the default when nothing is stored.

### Colours

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `bg` | `#0A1020` | `#F3F5FA` | page background |
| `surface` | `#121A2E` | `#FFFFFF` | cards |
| `surface-raised` | `#1A2440` | `#F7F9FD` | icon tiles, inputs, pressed cards, sheets |
| `line` (border) | `#26314F` | `#E2E7F1` | hairlines, card borders |
| `text` | `#EEF2FA` | `#0E1730` | body text |
| `muted` | `#9AA6C2` | `#59657E` | secondary text |
| `brand` | `#1F5BEB` | `#1F5BEB` | primary buttons, active tab, rings (fill) |
| `brand-fg` (text-on-surface) | `#7EA6FF` | `#1A48D0` | links and brand-coloured text |
| `accent` | `#3ACC95` | `#3ACC95` | progress, streak, success fills (decorative) |
| `accent-fg` | `#5FE0AE` | `#077A55` | green text |
| `success` | `#3ACC95` | `#0A8F62` | correct answers, passed |
| `danger` | `#F87171` | `#D92D20` | wrong answers, failed, destructive |
| `warning` | `#FBBF24` | `#B45309` | promo countdown, streak at risk |

Contrast (WCAG AA, checked with the formula, re-verified in stage 1 with a unit test):
- `text` on `surface`: ≈ 15:1 dark, ≈ 16:1 light; `muted` on `surface`: ≈ 7:1 dark, ≈ 5.9:1 light.
- White on `brand` `#1F5BEB`: ≈ 5.7:1 (buttons, active tab).
- `#3ACC95` is too light for text on white (≈ 2:1), so in light mode green text uses `accent-fg`; the bright green is only a fill with dark text (`#052E1F`, ≈ 9:1).
- Correct/wrong states never rely on colour alone: they always carry a ✓ / ✕ icon and a text label.

The current orange "CTA" colour is retired: primary actions become brand blue, green marks progress/success, amber is only for promo countdowns and streak warnings.

### Shape, space, depth, motion

- **Radii:** cards `24px` (`rounded-card`), small cards/tiles `20px`, buttons and inputs `16px`, chips `999px`.
- **Spacing:** Tailwind's 4 px scale; page gutter 16 px (phones) / 24 px (tablet+); card padding 16–20 px; grid gap 12 px (phones) / 16 px.
- **Shadows:** dark mode uses borders + a soft inner highlight instead of heavy shadows; light mode `0 1px 2px rgb(14 23 48 / .06), 0 8px 24px rgb(14 23 48 / .06)`. One elevated level for sheets/modals.
- **Motion:** 150–250 ms ease-out; press feedback `scale(.97)`; progress ring fill and count-up on first view; everything disabled under `prefers-reduced-motion`.
- **Tap targets:** ≥ 48 × 48 px; bottom bar 64 px + `env(safe-area-inset-bottom)`.

### Typography

- **Font:** Inter, self-hosted through `next/font` (files are downloaded at build time and served from our domain; no runtime request to Google). It covers Uzbek Latin including `oʻ gʻ` (U+02BB) and Russian Cyrillic. Fallback: system UI.
- **Numbers:** `font-variant-numeric: tabular-nums` on scores, timers, prices, counters (`.num` utility).
- **Scale:** display 32/38 bold · h1 24/30 bold · h2 20/26 semibold · title 16/22 semibold · body 15/22 · small 13/18 · micro 11/14 uppercase.

## 2. Components (in `src/components/ui/`, one source of truth)

| Component | Purpose / props |
|---|---|
| `AppShell` | Signed-in layout: TopBar + content column + BottomTabBar (mobile) or Sidebar (≥ 1024 px). `hideNav` for the test and result screens. |
| `TopBar` | Avatar (→ profile), streak chip, search button (opens a search sheet over questions/rules), notifications bell (reviews due, active promo, expiring subscription; computed, no new table), theme toggle on desktop. Sticky, compact (56 px). |
| `BottomTabBar` / `Sidebar` | 4 items: Bosh sahifa `/dashboard`, Statistika `/stats`, Saqlangan `/saved`, Sozlamalar `/settings`. Active item highlighted with brand pill + `aria-current`. |
| `PublicHeader` | Lighter header for landing, pricing, library, legal and login. |
| `ActionCard` | Icon tile on top, title, optional subtitle, badge (count) or "Tez orada" state (non-link, `aria-disabled`). |
| `WideCard` | Horizontal card: icon left, title/subtitle, chevron or trailing slot. |
| `HeroCard` | Readiness ring + primary action + daily goal bar. |
| `StatChip` | Small pill with icon + tabular number (streak, accuracy, …). |
| `ProgressRing` | Existing ring, restyled; animated fill, `role="img"` + label. |
| `ProgressBar` | Slim bar for goals, test progress, per-ticket progress. |
| `PromoBanner` | Only with an active SEASONAL/WELCOME campaign; server-computed end time, our own SVG illustration, hidden for subscribers. |
| `Button` | Variants: primary, secondary, ghost, danger, success; sizes md (48 px) / sm (40 px); loading state. |
| `Input`, `Select`, `Checkbox`, `Switch` | Form controls on the tokens. |
| `Sheet` / `Modal` | Bottom sheet on phones, centred dialog on desktop; focus trap, Esc, `aria-modal`. Used for the question navigator, search, confirmations. |
| `Skeleton` | Shimmer blocks with fixed sizes (no layout shift); route `loading.tsx` files use them. |
| `EmptyState` | Icon, title, text, optional action. |
| `SectionHeader`, `Badge`, `ListRow` | Small helpers so pages don't hand-roll styles. |
| `Icon` | Our inline SVG set (Lucide-style 24 px stroke icons, MIT-licensed shapes redrawn/inlined; no icon font, no external request). |

## 3. Navigation and routes

- **Mobile (< 1024 px):** sticky TopBar + BottomTabBar. Hidden inside a running test (`/test/[id]`) and on the result screen (`/results/[id]`).
- **Desktop (≥ 1024 px):** left Sidebar with the same 4 items plus logo; content column max 1120 px; card grids get 3–4 columns.
- **Existing routes are unchanged.** New routes (pages only, no new business logic):

| Route | Content |
|---|---|
| `/stats` | Statistika: readiness, accuracy, streak, activity heatmap, topic bars, recent tests (moved from the dashboard/profile). |
| `/saved` | Saqlangan: bookmarked questions and notes (moved from the profile), with a "practise saved questions" action if bookmarks exist. |
| `/settings` | Sozlamalar: language, theme, category, reminders, leaderboard opt-in, password, log out / log out everywhere. |
| `/tests/topics` | Mavzulashtirilgan testlar: topic cards with progress and accuracy. |
| `/tests/tickets` | Ticket list as cards with progress and best score (the `/tests` hub links to it). |
| `/tests/tricky` | Qopqonli savollar practice (see data below). |

The profile (`/profile`) stays: account, subscription, referral, test history.

## 4. Data needed for the new home cards

| Feature | Source | DB change? |
|---|---|---|
| Readiness ring, streak, accuracy | existing `userStats` | no |
| "Davom etish" | latest unfinished test session of the user; otherwise starts Smart Practice (adaptive mode; free users get the paywall as today) | no |
| Daily goal bar | answers given today (Tashkent day) vs a goal of 20 (a constant now; could become a setting later) | no |
| Xatolarim badge | existing due-review count | no |
| Ticket/topic progress and accuracy | existing session answers | no |
| Qopqonli savollar | questions with the highest wrong-answer rate (minimum number of answers, real data only) **plus admin-flagged ones** | **yes: additive `Question.isTricky Boolean @default(false)` + a checkbox in the admin question editor** |
| Reyting | existing leaderboard | no |
| 1v1 duel | not built | no — shown as "Tez orada", not a link |
| Notifications bell | computed from due reviews, active promo, subscription expiry | no |

## 5. Stages (commit after each; type check, lint, unit and e2e tests after each)

0. Commit the earlier uncommitted work (daily limit, 404 page, make-admin script, Uzbek Cyrillic removal) as their own commits, so the redesign commits stay clean.
1. Tokens, font, `ui/` components, AppShell/TopBar/BottomTabBar/Sidebar, theme toggle; e2e: every tab/card reaches a working route; no horizontal overflow at 360/390/430 px.
2. Home (`/dashboard`).
3. Test screen and result screen.
4. `/tests`, `/tests/topics`, `/tests/tickets`, `/tests/tricky`.
5. `/stats`, `/saved`, `/settings`, `/profile`.
6. Public pages: landing, pricing, library, leaderboard, login (phone + OTP + consent unchanged), onboarding, checkout, legal, 404.
7. Lighthouse after-measurement and final report.

Admin pages keep their layout (internal tool) but pick up the tokens automatically; restyling them fully is out of scope unless requested.

## 6. Baseline (before), Lighthouse 12.6.1, mobile, production build on localhost

| Page | Perf | A11y | Best pr. | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| `/` | 81 | 96 | 100 | 92 | 2.6 s | 0 | 520 ms |
| `/login` | 81 | 96 | 100 | 54* | 2.5 s | 0 | 640 ms |
| `/pricing` | 81 | 94 | 100 | 91 | 2.6 s | 0 | 620 ms |
| `/library` | 82 | 97 | 100 | 92 | 2.9 s | 0 | 500 ms |
| `/dashboard` | 74 | 96 | 100 | 54* | 2.6 s | 0.001 | 990 ms |
| `/tests` | 81 | 96 | 100 | 91 | 2.5 s | 0.001 | 570 ms |
| `/profile` | 76 | 96 | 100 | 54* | 2.8 s | 0.001 | 760 ms |

\* These pages are deliberately `noindex`, which Lighthouse counts against SEO.

Found while measuring: in production mode the middleware redirects every plain-HTTP request to HTTPS, including `localhost`, so `npm start` cannot be opened locally. Proposed fix in stage 1: skip the redirect for `localhost` / `127.0.0.1` (real deployments behind a TLS proxy are unaffected).

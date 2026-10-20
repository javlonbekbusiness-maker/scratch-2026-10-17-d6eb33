# Topics page (Mavzular)

`/tests/topics` is the single "Mavzulashtirilgan testlar" entry point. `/tests/topics/[slug]` is the detail page for one topic.

## Where the topics come from

The topics are the chapters and annex sections of the **Traffic Rules** (Yo'l harakati qoidalari), Cabinet of Ministers Resolution **No. 172 of 12 April 2022**. The headings were read from the official texts on lex.uz:

- Uzbek (Latin): https://lex.uz/docs/-5953883
- Russian: https://lex.uz/ru/docs/5953887

| Source in the rules | Topics |
|---|---|
| Chapters 1–29 and chapter 17¹ | 30 |
| Annex 1, road signs, sections 1–7 | 7 |
| Annex 2, road markings, horizontal and vertical | 2 |
| Annex 3, conditions that prohibit operating a vehicle | 1 |
| **Total** | **40** |

**What comes from the official text**
- Topic names are the official headings, with the chapter number moved to "Rules reference" (for example `7-bob`).
- The official ʻ and ʼ characters are shown as `'`, as everywhere else in the app.

**What is ours**
- The **descriptions** are our own one-line summaries.
- The **7 groups** and the order inside them are our editorial choice and can be edited in admin: Umumiy qoidalar, Yo'l belgilari, Yo'l chiziqlari, Svetofor va tartibga soluvchi ishoralari, Harakatlanish qoidalari, Maxsus holatlar, Xavfsizlik va tibbiy yordam.

**Seed data** lives in `prisma/rule-topics.ts`.
- `npm run db:seed` creates missing groups and topics but never overwrites a topic that already has a group, so admin edits survive re-seeding.
- The 8 earlier demo topics keep their slugs and were moved onto the matching official chapter, so existing questions and progress stay attached:
  - signs → section 1.3
  - priority → chapter 14
  - speed → chapter 11
  - parking → chapter 13
  - overtaking → chapter 12
  - pedestrians → chapter 17
  - safety → chapter 2
  - lights → chapter 7
- Six demo questions moved to a more precise topic: five road-sign questions went to their sign section, and the accident first-aid question went to chapter 3.

## Data model

There is no migration folder; the project uses `prisma db push`. All changes are additive.

- **New table `TopicGroup`:** `slug`, `nameUz`, `nameRu`, `tone` (one colour per group), `sortOrder`, `isActive`.
- **New fields on `Topic`:** `descUz`, `descRu`, `ruleRef`, `libraryHref`, `groupId`, `isActive`, `createdAt`, and the index `(groupId, sortOrder)`. `icon` now holds an icon name from `src/components/ui/Icon.tsx`.
- **New field on `TestSession`:** `isSample` (marks a free user's topic sample).
- **Index change:** `Question(topicId, isActive)` was widened to `Question(topicId, isActive, sortOrder)` so the free sample can be read straight from the index.
- **New setting:** `freeTopicQuestions` (default 3), edited in Admin → Settings.

Question counts are **always computed** with `groupBy` on active questions and are never stored. A topic with 0 published questions, a hidden topic, or a topic in a hidden group is not shown to users.

## Access

**Subscribers** have nothing locked.

**Free users**
- Each topic card shows a small lock chip and "Bepul: N savol".
- The detail page offers "Bepul N ta savolni yechish" and "Hammasini ochish" (links to /pricing).
- The sample is always the topic's **first N questions**, ordered by `sortOrder` and then `id`.
- When the sample is finished, the test screen opens the paywall sheet.

**Enforced on the server**
- `startTest` gives free users only the sample, whatever variant they ask for, and marks the session `isSample`. With N = 0 it refuses.
- `/api/tests/answer` re-checks that the question is in the topic's free sample and returns **402** otherwise.
- The test page only renders sample questions.

## Detail page

- Shows the description, the source in the rules, question count, solved X/Y and the user's accuracy.
- Three start buttons:
  - **Boshlash:** all questions in the topic, in random order.
  - **Faqat xatolar:** the user's open review items in this topic.
  - **Tezkor 10 ta savol:** 10 random questions.
- A link to the related part of `/library`.
- Every topic test uses the normal test screen, so answers feed Xatolarim and statistics.

## List UI

- **Top bar:** sticky under the app header, with back, the title "Mavzular" and the search field.
- **Search:** debounced by 200 ms. It ignores apostrophes (o' g' ʻ ʼ ’), letter case and diacritics (ё = е, й = и), and matches both the Uzbek and the Russian name (`src/lib/search-normalize.ts`).
- **Groups:** collapsible headings (`aria-expanded`); while searching or filtering, all groups are expanded.
- **Filter chips:** Hammasi, Boshlanmagan, Jarayonda, Zaif (started, accuracy below 70%), Tugatilgan (every question answered). Each chip uses `aria-pressed`.
- **Sort:** tartib bo'yicha, zaiflari birinchi, yangi.
- **Cards:** the group's colour icon from our own set, a name that wraps without truncation, the question count, a progress bar, "X / Y yechilgan" and accuracy.
- **Loading:** a skeleton is shown while the data streams, inside the page after the sign-in check.
- **Long lists:** with about 40 topics the whole list is rendered at once. Each group section uses `content-visibility: auto`, so off-screen groups are not laid out until scrolled to. No pagination is needed at this size.

## Admin

- **Admin → Topics** (`/admin/topics`, new) manages groups and topics:
  - Groups: create, rename, change colour, reorder, hide, delete when empty.
  - Topics: create, rename in both languages, edit description, icon, rules reference and library link, move between groups, reorder (↑/↓ or the order field), hide, delete when the topic has no questions.
  - Published and total question counts are shown read-only.
- **Admin → Categories** now only manages licence categories.
- **Admin → Settings** has "Free questions per topic" (0–20).

## Load times

Measured with 1,290 active questions over 40 topics, 14,769 answers in total and a user with 3,000 answers, on local PostgreSQL 18.4. Query numbers are medians in ms from `npm run bench:pool` ([bench-topics.json](bench-topics.json)).

| What | Median | p95 |
|---|---:|---:|
| Topics page data: groups + topics + counts + user progress | 26.7 | 35.4 |
| Topic detail: count + user's mistakes | 5.3 | 9.0 |
| Free sample: first 3 questions of a topic | 3.2 | 5.5 |
| Full `/tests/topics` HTML response, dev server (e2e test, run alone) | 726 | 953 (max of 5) |
| Same, at the end of the full e2e suite (machine busy) | 1570 | 1581 (max of 5) |

The dev-server figure includes Next.js development-mode rendering overhead; a production build is much faster.

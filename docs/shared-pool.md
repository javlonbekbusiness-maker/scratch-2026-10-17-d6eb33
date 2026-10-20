# Shared question pool: design and query timings

Users are never asked for a licence category. All active questions form one pool that every user sees.

## Data model

There is **no migration folder**: the project uses `prisma db push`. All schema changes are additive or relax a constraint, and no data was deleted.

| Change | Why |
|---|---|
| `Question.categoryId` nullable (relation optional) | The category is optional metadata; existing values are kept. |
| `Ticket.categoryId` nullable; `Ticket.number` now **unique** (was unique per category) | Tickets are global. Before applying, the database was checked: tickets 1–4 existed only once each, so there were no duplicates and nothing was lost. |
| New index `Question(isActive, ticketNumber)` | Tickets list and starting a ticket. |
| New index `Question(topicId, isActive)` | Topic tests and per-topic counts. |
| New index `TestSession(userId, finishedAt)` | A user's finished tests, daily limit. |
| New index `SessionAnswer(createdAt)` | Leaderboard window and recently seen questions. |

`User.categoryId`, `TestSession.categoryId` and `ExamTemplate.categoryId` are unchanged. They are simply no longer used to filter questions, and a saved user category is ignored.

## Tickets (`src/lib/tickets.ts`)

- Tickets have 10 questions each and are dealt from active questions that have **no ticket yet**.
- The order is `sha256("yhq-tickets-v1:" + questionId)`, so the same new questions always form the same tickets.
- Only whole tickets are created. Leftovers wait for more questions; they are still used in topic, marathon, exam and smart-practice modes.
- New tickets get numbers after the highest existing one. Questions that already have a ticket are never moved, so completed tickets stay the same.
- Dealing runs after saving a new question in admin, after a CSV import, in `npm run db:seed`, and from Admin → Tickets → "Create new tickets".
- A Postgres advisory lock keeps concurrent runs safe.
- The old destructive "Regenerate tickets" admin action was removed.

## Exam (`src/lib/exam-select.ts`)

- 20 questions, 25 minutes and a 90% pass mark, taken from the first default EXAM template.
- Selection works round-robin across topics in a random topic order, so topics stay balanced (they differ by at most one question).
- No question repeats within one exam.
- Questions the user answered in the last 3 days (up to 600) are used only if the pool runs short.

## Other modes

- **Marathon:** rounds of 100 questions; questions the user has not answered correctly yet come first.
- **Smart practice, mistakes, traps, statistics and leaderboard:** use the whole pool.
- `progressBy` and `userStats` now aggregate in SQL instead of loading every answer into JS. The output is checked identical for all 47 users in the local database.

## Query timings

**Setup**
- Machine: local embedded PostgreSQL 18.4 on the Windows dev machine.
- Data: `npm run db:seed-bulk`, giving **1290 active questions**, 129 tickets, 38 topics and 14,769 answers in total. The measured bench user has 3,000 answers.
- Method: `npm run bench:pool`, with 3 warm-up runs and 15 measured runs per query. Times are medians in ms; p95 is in the JSON files.

| Query | Before indexes | After indexes | After indexes + SQL aggregation |
|---|---:|---:|---:|
| Tickets list: page of 40 + counts | 7.44 | 2.59 | 3.27 |
| Start ticket: questions of one ticket | 3.39 | 0.93 | 0.90 |
| Topics list: search + page + counts | 10.34 | 5.73 | 4.33 |
| Progress per ticket (user) | 20.28 | 20.20 | 21.68 |
| Progress per topic (user) | 28.81 | 14.63 | 15.19 |
| Exam: pool + recent + pick 20 | 9.66 | 12.48 | 10.53 |
| Marathon: pool + mastered | 14.20 | 15.13 | 15.31 |
| **Smart practice: stats + pool + pick** | **238.16** | 186.26 | **15.69** |
| Mistakes: due review items | 4.29 | 3.14 | 1.62 |
| Mistakes: due count | 2.81 | 1.82 | 0.91 |
| Trap questions (all users) | 31.36 | 25.28 | 17.83 |
| **Statistics: userStats** | **238.11** | 213.65 | **31.75** |
| Home counts | 4.45 | 4.62 | 4.34 |
| Bookmarks page | 10.55 | 10.64 | 11.01 |
| Leaderboard (7 days) | 23.09 | 22.13 | 22.62 |

**How to read the results**
- The indexes speed up the filtered lookups by 2–4×: tickets, ticket start, topics, mistakes and traps.
- The two slow screens (statistics and smart practice) were slow because `userStats` loaded up to 5,000 answers with their questions into JS. Moving that work into SQL brought them from about 238 ms to 16–32 ms.
- Differences of 1–3 ms between runs are noise at this size.

Raw results:
- [bench-before-indexes.json](bench-before-indexes.json)
- [bench-after-indexes.json](bench-after-indexes.json)
- [bench-after.json](bench-after.json)

**Reproduce**
```
npm run db:seed-bulk           # 1250 [TEST] questions, 30 test topics, 40 bench users
npm run bench:pool
npm run db:seed-bulk -- --remove
```

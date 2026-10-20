/**
 * Imports a questions JSON file (same format as Admin → Bulk import) through the app's own importer:
 * rows are validated first, existing external_ids are updated, then new questions are dealt into tickets.
 *
 *   npm run questions:import -- prisma/content/umumiy-qoidalar.json
 */
import { readFileSync } from 'node:fs';
import { db } from '../src/lib/db';
import { commitQuestions, validateQuestions } from '../src/lib/importers';
import { assignNewTickets } from '../src/lib/tickets';

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: npm run questions:import -- <file.json>');
  const v = await validateQuestions(readFileSync(file, 'utf8'), 'json');
  if (v.errors.length) {
    for (const e of v.errors) console.error(`row ${e.row}: ${e.messages.join('; ')}`);
    throw new Error(`${v.errors.length} invalid rows; nothing imported`);
  }
  const r = await commitQuestions(v.rows);
  const t = await assignNewTickets();
  console.log(`questions: ${r.created} created, ${r.updated} updated; new tickets: ${t.created} (waiting for a ticket: ${t.leftover})`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

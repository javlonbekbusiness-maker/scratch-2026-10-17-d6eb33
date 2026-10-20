import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { db } from './db';

/**
 * Numbered tickets over the one shared question pool.
 *
 * Stability rules:
 * - A question keeps its ticket number for good (editing it never moves it).
 * - Generation only deals questions that have no ticket yet, and only in whole tickets of
 *   TICKET_SIZE; a partly filled last group waits until enough new questions arrive.
 * - New tickets always get numbers after the highest existing one, so tickets users already
 *   completed are never reshuffled.
 * - Order inside the pool is a hash of (seed, question id), so the same set of new questions
 *   always forms the same tickets, wherever and whenever generation runs.
 */
export const TICKET_SIZE = 10;
export const TICKET_SEED = 'yhq-tickets-v1';
/** How many of the first tickets are free demo tickets when they are created. */
export const FREE_DEMO_TICKETS = 2;

const rank = (id: string) => createHash('sha256').update(`${TICKET_SEED}:${id}`).digest('hex');

/** Pure planning step: which unassigned questions form which new ticket numbers. */
export function planTickets(unassignedIds: string[], nextNumber: number, size = TICKET_SIZE) {
  const ordered = [...new Set(unassignedIds)].sort((a, b) => (rank(a) < rank(b) ? -1 : rank(a) > rank(b) ? 1 : a < b ? -1 : 1));
  const whole = Math.floor(ordered.length / size) * size;
  const tickets: { number: number; questionIds: string[] }[] = [];
  for (let i = 0; i < whole; i += size) tickets.push({ number: nextNumber + i / size, questionIds: ordered.slice(i, i + size) });
  return { tickets, leftover: ordered.length - whole };
}

/**
 * Deals active, ticketless questions into new tickets. Safe to run any time (after an import, an
 * admin edit, or from the seed); concurrent runs are serialised by an advisory lock.
 */
export async function assignNewTickets(client: PrismaClient = db) {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('yhq-ticket-generation'))`;
    const unassigned = await tx.question.findMany({ where: { isActive: true, ticketNumber: null }, select: { id: true } });
    const [maxQ, maxT] = await Promise.all([
      tx.question.aggregate({ _max: { ticketNumber: true } }),
      tx.ticket.aggregate({ _max: { number: true } }),
    ]);
    const next = Math.max(maxQ._max.ticketNumber ?? 0, maxT._max.number ?? 0) + 1;
    const plan = planTickets(unassigned.map((q) => q.id), next);
    for (const tk of plan.tickets) {
      await tx.ticket.upsert({ where: { number: tk.number }, create: { number: tk.number, isFree: tk.number <= FREE_DEMO_TICKETS }, update: {} });
      for (const [i, id] of tk.questionIds.entries()) {
        // `ticketNumber: null` guard: a question assigned meanwhile is never moved.
        await tx.question.updateMany({ where: { id, ticketNumber: null }, data: { ticketNumber: tk.number, sortOrder: i } });
      }
    }
    return { created: plan.tickets.length, leftover: plan.leftover, firstNumber: plan.tickets[0]?.number ?? null };
  }, { timeout: 60_000 });
}

/** Makes sure a Ticket row exists for a number an admin or import set by hand. */
export async function ensureTicket(number: number, client: Pick<PrismaClient, 'ticket'> = db) {
  await client.ticket.upsert({ where: { number }, create: { number, isFree: number <= FREE_DEMO_TICKETS }, update: {} });
}

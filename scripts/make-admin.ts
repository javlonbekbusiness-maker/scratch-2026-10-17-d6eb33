/**
 * Gives an existing account admin rights (or takes them away with --revoke).
 *   npm run make-admin -- +998901234567
 *   npm run make-admin -- 901234567 --revoke
 * The user must have signed up first. Only the role field of that one user changes.
 */
import { PrismaClient } from '@prisma/client';
import { formatPhone, isValidPhone, normalizePhone } from '../src/lib/phone';

const args = process.argv.slice(2);
const revoke = args.includes('--revoke');
const raw = args.find((a) => !a.startsWith('--'));
const phone = raw ? normalizePhone(raw) : '';

if (!isValidPhone(phone)) {
  console.error('Usage: npm run make-admin -- +998XXXXXXXXX [--revoke]');
  process.exit(1);
}

const db = new PrismaClient();

async function main() {
  const user = await db.user.findUnique({ where: { phone } });
  if (!user) return `No account with ${formatPhone(phone)}. Sign up on the site first, then run this again.`;
  if (revoke && user.role === 'ADMIN' && (await db.user.count({ where: { role: 'ADMIN' } })) <= 1) {
    return 'This is the last admin; refusing to remove admin rights.';
  }
  const role = revoke ? 'USER' : 'ADMIN';
  await db.user.update({ where: { id: user.id }, data: { role } });
  console.log(`${formatPhone(phone)} (${user.name ?? 'no name'}) is now ${role}. Reload /admin in the browser.`);
  return null;
}

main()
  .then((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  })
  .finally(() => db.$disconnect());

// Local PostgreSQL without Docker, for development only.
//
//   npm install --no-save embedded-postgres
//   npm run db:local            (keep this terminal open; Ctrl+C stops the server)
//
// Data lives in .localdb/ (git-ignored). Listens on port 5433 with user/password yhq/yhq
// and creates the UTF-8 database "yhq_dev". Override with LOCAL_DB_DIR / LOCAL_DB_PORT.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

let EmbeddedPostgres;
try {
  ({ default: EmbeddedPostgres } = await import('embedded-postgres'));
} catch {
  console.error('embedded-postgres is not installed. Run:\n\n  npm install --no-save embedded-postgres\n');
  process.exit(1);
}

const dataDir = resolve(process.env.LOCAL_DB_DIR ?? '.localdb');
const port = Number(process.env.LOCAL_DB_PORT ?? 5433);
const database = 'yhq_dev';

const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'yhq', password: 'yhq', port, persistent: true });

if (!existsSync(resolve(dataDir, 'PG_VERSION'))) {
  console.log(`Initialising a new cluster in ${dataDir} …`);
  await pg.initialise();
}
await pg.start();

// Create the app database explicitly as UTF-8: on Windows the cluster default is often
// WIN1251, which cannot store emoji (topic icons) and makes `prisma db push` fail.
const client = pg.getPgClient();
await client.connect();
const exists = await client.query('SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = $1', [database]);
if (!exists.rowCount) {
  await client.query(`CREATE DATABASE ${database} ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`);
} else if (exists.rows[0].enc !== 'UTF8') {
  console.warn(`Warning: database ${database} exists with encoding ${exists.rows[0].enc}; drop it or set a new name.`);
}
await client.end();

console.log(`\nPostgreSQL ready. Put this in .env:\n\n  DATABASE_URL="postgresql://yhq:yhq@localhost:${port}/${database}"\n\nThen: npx prisma db push && npm run db:seed\nPress Ctrl+C to stop.\n`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);

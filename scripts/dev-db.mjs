// PostgreSQL embutido para desenvolvimento local sem Docker.
// Dados persistidos em .dev-db/. Ctrl+C para parar.
// Com Docker disponível, prefere: docker compose up -d (inclui PostGIS, Redis e Mosquitto).
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';

const PORT = Number(process.env.DEV_DB_PORT ?? 54329);
const dir = new URL('../.dev-db', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'postgres',
  password: 'agrogenius',
  port: PORT,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

const fresh = !existsSync(dir);
if (fresh) await pg.initialise();
await pg.start();
try { await pg.createDatabase('agrogenius'); } catch { /* já existe */ }
console.log(`\n✔ PostgreSQL pronto em postgresql://postgres:agrogenius@localhost:${PORT}/agrogenius\n`);

const stop = async () => { await pg.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

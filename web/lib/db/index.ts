// Client Postgres partagé (postgres.js). /web "possède" le schéma :
// users, projects, assets, jobs, crédits. Le worker écrit dans la MÊME
// base pendant l'exécution des jobs (status, assets, ledger).
import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://renderstudio:renderstudio@127.0.0.1:5433/renderstudio";

// Pool petit, ancré sur globalThis : en dev, Next.js réinstancie les
// modules à chaud — sans ça, chaque recompilation ouvrirait un nouveau
// pool de connexions.
const globalForDb = globalThis as unknown as { __renderStudioSql?: postgres.Sql };

export const sql: postgres.Sql =
  globalForDb.__renderStudioSql ??
  (globalForDb.__renderStudioSql = postgres(DATABASE_URL, { max: 5 }));

export default sql;

// Purge des assets trashés depuis plus de 30 jours : supprime la ligne DB
// ET le fichier chez le worker (best-effort).
//
// Lancement : npm run purge:trash — manuel ou tâche planifiée de l'OS
// (pas de service cron externe requis en V1).
import sql from "../lib/db";

const WORKER_BASE_URL = (process.env.WORKER_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const TRASH_RETENTION_DAYS = 30;

async function main(): Promise<void> {
  const rows = await sql<Array<{ storage_path: string }>>`
    DELETE FROM assets
    WHERE is_trashed AND trashed_at < now() - interval '30 days'
    RETURNING storage_path`;

  for (const row of rows) {
    const name = row.storage_path.replace("/storage/", "");
    await fetch(`${WORKER_BASE_URL}/storage/${name}`, { method: "DELETE" }).catch(() => undefined);
  }

  console.log(`${rows.length} asset(s) trashé(s) depuis +${TRASH_RETENTION_DAYS} j purgé(s).`);
  await sql.end();
}

void main();

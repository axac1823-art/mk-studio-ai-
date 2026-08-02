// Store de jobs EN MÉMOIRE process — suffisant en dev mono-instance.
//
// Au jalon DB : remplacer l'implémentation par la table `generations`
// (interface publique inchangée), puis par une vraie file (BullMQ) en prod
// serverless — le fire-and-forget des routes ne survivrait pas à un
// environnement sans état.
//
// Règle non négociable : `errorMessage` ne contient QUE des messages
// génériques destinés au client. L'erreur réelle est journalisée côté
// serveur (lib/ai/logger.ts).
export type JobStatus = "pending" | "processing" | "done" | "error";

export interface Job {
  id: string;
  status: JobStatus;
  /** Étape courante — libellés PRODUIT génériques ("render", "video",
   *  "upscaling"...), jamais un nom de modèle/fournisseur. */
  stage?: string;
  /** Type de média produit ("audio" n'apparaît qu'en intermédiaire de
   *  chaîne, jamais en résultat final aujourd'hui — union alignée sur
   *  GenerationResult pour éviter les conversions). */
  kind?: "image" | "video" | "audio";
  outputUrls?: string[];
  errorMessage?: string;
  createdAt: number;
}

// En dev, Next.js instancie ce module SÉPARÉMENT pour chaque route handler :
// POST /api/generate et GET /api/generate/[id] ne partageraient alors pas le
// même Map (le poll 404 systématiquement). Ancré sur globalThis, le store
// reste unique quelle que soit la compilation.
const globalForJobs = globalThis as unknown as { __renderStudioJobs?: Map<string, Job> };
if (!globalForJobs.__renderStudioJobs) {
  globalForJobs.__renderStudioJobs = new Map<string, Job>();
}
const jobs = globalForJobs.__renderStudioJobs;

export function createJob(id: string): Job {
  const job: Job = { id, status: "pending", createdAt: Date.now() };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<Omit<Job, "id" | "createdAt">>): void {
  const job = jobs.get(id);
  if (job) Object.assign(job, patch);
}

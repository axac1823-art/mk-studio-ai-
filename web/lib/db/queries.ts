// Requêtes SQL pures — une fonction par usage, AUCUNE logique métier ici
// (elle vit dans les routes et dans lib/credits). Toutes les lectures
// "utilisateur courant" passent par getDevUser() : placeholder en
// attendant Supabase Auth (jalon suivant) — la signature restera la même.
import type { JSONValue } from "postgres";

import sql from "./index";

export interface DbUser {
  id: string;
  email: string;
  display_name: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface DbProject {
  id: string;
  user_id: string;
  name: string;
  cover_asset_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbAsset {
  id: string;
  project_id: string;
  user_id: string;
  type: "image" | "video" | "audio" | "3d_model";
  generation_id: string | null;
  storage_path: string;
  is_favorite: boolean;
  is_trashed: boolean;
  trashed_at: string | null;
  created_at: string;
}

export interface DbJob {
  id: string;
  user_id: string;
  project_id: string;
  type: string;
  status: "pending" | "processing" | "complete" | "failed";
  input: Record<string, unknown>;
  result_asset_id: string | null;
  parent_generation_id: string | null;
  error_message: string | null;
  model_used: string | null;
  credits_charged: number;
  created_at: string;
}

export interface DbVideoJob {
  id: string;
  user_id: string;
  project_id: string;
  status: "pending" | "processing" | "complete" | "failed";
  mode: string | null;
  selected_model: string | null;
  model_used: string | null;
  start_image_url: string | null;
  end_image_url: string | null;
  media_references: Array<{ tag: string; asset_url: string; type: "image" | "video" }>;
  shots: Array<{ id: string; prompt: string; tagged_media_ids: string[] }>;
  duration: number;
  aspect_ratio: string;
  audio_enabled: boolean;
  result_url: string | null;
  credits_charged: number;
  error_message: string | null;
  progress: { current: number; total: number } | null;
  created_at: string;
  updated_at: string;
}

const DEV_USER_EMAIL = "dev@renderstudio.local";

/** Utilisateur unique de dev (placeholder auth). */
export async function getDevUser(): Promise<DbUser> {
  const rows = await sql<DbUser[]>`SELECT id, email, display_name, full_name, avatar_url FROM users WHERE email = ${DEV_USER_EMAIL} LIMIT 1`;
  if (!rows[0]) throw new Error("dev user missing — apply db/schema.sql");
  return rows[0];
}

/** Projet par défaut de l'utilisateur (le plus ancien). */
export async function getDefaultProject(userId: string): Promise<DbProject | null> {
  const rows = await sql<DbProject[]>`SELECT * FROM projects WHERE user_id = ${userId} ORDER BY created_at ASC LIMIT 1`;
  return rows[0] ?? null;
}

/** Crée un projet par défaut si l'utilisateur n'en a aucun (sécurité). */
export async function ensureDefaultProject(userId: string): Promise<DbProject> {
  const existing = await getDefaultProject(userId);
  if (existing) return existing;
  return createProject(userId, "General");
}

export interface DbProjectWithMeta extends DbProject {
  cover_path: string | null;
  asset_count: number;
}

/** Projets de l'utilisateur, avec cover et compteur d'assets visibles.
 *  La cover est d'abord l'asset explicitement choisie ; sinon la dernière
 *  asset visible du projet est utilisée comme aperçu automatique. */
export async function listProjects(userId: string): Promise<DbProjectWithMeta[]> {
  return sql<DbProjectWithMeta[]>`
    SELECT p.*,
      COALESCE(cover.storage_path, latest.storage_path) AS cover_path,
      (SELECT count(*)::int FROM assets a2
        WHERE a2.project_id = p.id AND NOT a2.is_trashed) AS asset_count
    FROM projects p
    LEFT JOIN assets cover
      ON cover.id = p.cover_asset_id AND NOT cover.is_trashed
    LEFT JOIN LATERAL (
      SELECT storage_path FROM assets a
      WHERE a.project_id = p.id AND NOT a.is_trashed
      ORDER BY a.created_at DESC
      LIMIT 1
    ) latest ON true
    WHERE p.user_id = ${userId}
    ORDER BY p.updated_at DESC`;
}

export async function createProject(userId: string, name: string): Promise<DbProject> {
  const rows = await sql<DbProject[]>`
    INSERT INTO projects (user_id, name) VALUES (${userId}, ${name}) RETURNING *`;
  return rows[0];
}

export async function getProject(userId: string, projectId: string): Promise<DbProject | null> {
  const rows = await sql<DbProject[]>`SELECT * FROM projects WHERE id = ${projectId} AND user_id = ${userId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function renameProject(userId: string, projectId: string, name: string): Promise<void> {
  await sql`UPDATE projects SET name = ${name}, updated_at = now() WHERE id = ${projectId} AND user_id = ${userId}`;
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  // Les assets et jobs sont CASCADE — suppression définitive.
  await sql`DELETE FROM projects WHERE id = ${projectId} AND user_id = ${userId}`;
}

export async function setProjectCover(userId: string, projectId: string, assetId: string | null): Promise<void> {
  await sql`UPDATE projects SET cover_asset_id = ${assetId}, updated_at = now() WHERE id = ${projectId} AND user_id = ${userId}`;
}

/** Crée un job (génération ou upscale) et retourne son id. */
export async function insertJob(input: {
  userId: string;
  projectId: string;
  type: string;
  jobInput: Record<string, unknown>;
  parentGenerationId?: string;
}): Promise<string> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO jobs (user_id, project_id, type, input, parent_generation_id)
    VALUES (${input.userId}, ${input.projectId}, ${input.type}, ${sql.json(input.jobInput as JSONValue)}, ${input.parentGenerationId ?? null})
    RETURNING id`;
  return rows[0].id;
}

/** Crée un video_job (Video Generator). */
export async function insertVideoJob(input: {
  userId: string;
  projectId: string;
  mode?: string | null;
  startImageUrl: string | null;
  endImageUrl: string | null;
  mediaReferences: Array<{ tag: string; asset_url: string; type: "image" | "video" }>;
  shots: Array<{ id: string; prompt: string; tagged_media_ids: string[] }>;
  duration: number;
  aspectRatio: string;
  audioEnabled: boolean;
  selectedModel: string | null;
}): Promise<string> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO video_jobs (
      user_id, project_id, mode,
      start_image_url, end_image_url,
      media_references, shots,
      duration, aspect_ratio, audio_enabled, selected_model
    )
    VALUES (
      ${input.userId}, ${input.projectId}, ${input.mode ?? null},
      ${input.startImageUrl}, ${input.endImageUrl},
      ${sql.json(input.mediaReferences as JSONValue)}, ${sql.json(input.shots as JSONValue)},
      ${input.duration}, ${input.aspectRatio}, ${input.audioEnabled}, ${input.selectedModel}
    )
    RETURNING id`;
  return rows[0].id;
}

export async function getVideoJob(jobId: string): Promise<DbVideoJob | null> {
  const rows = await sql<DbVideoJob[]>`SELECT * FROM video_jobs WHERE id = ${jobId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getVideoJobForUser(jobId: string, userId: string): Promise<DbVideoJob | null> {
  const rows = await sql<DbVideoJob[]>`SELECT * FROM video_jobs WHERE id = ${jobId} AND user_id = ${userId} LIMIT 1`;
  return rows[0] ?? null;
}

/** Crée un asset SOURCE (upload utilisateur — generation_id NULL, visible
 *  dans la page Uploads, réutilisable comme entrée de génération). */
export async function insertSourceAsset(input: {
  userId: string;
  projectId: string;
  type: "image" | "video" | "audio";
  storagePath: string;
}): Promise<string> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO assets (project_id, user_id, type, generation_id, storage_path)
    VALUES (${input.projectId}, ${input.userId}, ${input.type}, NULL, ${input.storagePath})
    RETURNING id`;
  return rows[0].id;
}

export async function getJob(jobId: string): Promise<DbJob | null> {
  const rows = await sql<DbJob[]>`SELECT * FROM jobs WHERE id = ${jobId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getJobForUser(jobId: string, userId: string): Promise<DbJob | null> {
  const rows = await sql<DbJob[]>`SELECT * FROM jobs WHERE id = ${jobId} AND user_id = ${userId} LIMIT 1`;
  return rows[0] ?? null;
}

/** Marque un job failed quand le DÉMARRAGE côté worker a échoué (le job
 *  n'a jamais tourné — message générique, aucun débit). */
export async function markJobFailed(jobId: string): Promise<void> {
  await sql`UPDATE jobs SET status = 'failed', error_message = 'Generation failed, please try again.' WHERE id = ${jobId} AND status = 'pending'`;
}

/** Enregistre le modèle ayant servi (pour historique + debug). */
export async function setJobModelUsed(jobId: string, model: string): Promise<void> {
  await sql`UPDATE jobs SET model_used = ${model} WHERE id = ${jobId}`;
}

/** Assets produits par un job (polling du statut). */
export async function listAssetsForJob(jobId: string): Promise<DbAsset[]> {
  return sql<DbAsset[]>`SELECT * FROM assets WHERE generation_id = ${jobId} ORDER BY created_at ASC`;
}

export async function getAsset(userId: string, assetId: string): Promise<DbAsset | null> {
  const rows = await sql<DbAsset[]>`SELECT * FROM assets WHERE id = ${assetId} AND user_id = ${userId} LIMIT 1`;
  return rows[0] ?? null;
}

/** Liste les assets visibles (par défaut : hors corbeille). */
export async function listAssets(
  userId: string,
  filters: {
    projectId?: string;
    type?: "image" | "video" | "audio" | "3d_model";
    favorite?: boolean;
    trashed?: boolean;
    uploadsOnly?: boolean;
  } = {}
): Promise<DbAsset[]> {
  return sql<DbAsset[]>`
    SELECT * FROM assets
    WHERE user_id = ${userId}
      AND (${filters.projectId ?? null}::uuid IS NULL OR project_id = ${filters.projectId ?? null}::uuid)
      AND (${filters.type ?? null}::text IS NULL OR type = ${filters.type ?? null})
      AND (${filters.favorite ?? null}::boolean IS NULL OR is_favorite = ${filters.favorite ?? null})
      AND is_trashed = ${filters.trashed ?? false}
      AND (${!filters.uploadsOnly}::boolean OR generation_id IS NULL)
    ORDER BY created_at DESC`;
}

/** Bascule favori / corbeille (trashed_at géré ici — restore remet à NULL). */
export async function setAssetFlags(
  userId: string,
  assetId: string,
  flags: { isFavorite?: boolean; isTrashed?: boolean }
): Promise<void> {
  if (flags.isFavorite !== undefined) {
    await sql`UPDATE assets SET is_favorite = ${flags.isFavorite} WHERE id = ${assetId} AND user_id = ${userId}`;
  }
  if (flags.isTrashed !== undefined) {
    await sql`UPDATE assets SET is_trashed = ${flags.isTrashed}, trashed_at = ${flags.isTrashed ? sql`now()` : null} WHERE id = ${assetId} AND user_id = ${userId}`;
  }
}

export async function deleteAsset(userId: string, assetId: string): Promise<void> {
  // Suppression définitive d'un asset (depuis la corbeille ou ailleurs).
  await sql`DELETE FROM assets WHERE id = ${assetId} AND user_id = ${userId}`;
}

/** Coûts par action depuis la table de config (clé = feature_type). */
export async function getActionCosts(): Promise<Record<string, number>> {
  const rows = await sql<Array<{ feature_type: string; credit_cost: number }>>`SELECT feature_type, credit_cost FROM action_costs`;
  return Object.fromEntries(rows.map((row) => [row.feature_type, row.credit_cost]));
}

/** Marges par action (clé = feature_type). */
export async function getActionMargins(): Promise<Record<string, number>> {
  const rows = await sql<Array<{ feature_type: string; margin_multiplier: number }>>`SELECT feature_type, margin_multiplier FROM action_costs`;
  return Object.fromEntries(rows.map((row) => [row.feature_type, Number(row.margin_multiplier)]));
}

/** Coûts vidéo par mode (clé = mode). */
export async function getVideoActionCosts(): Promise<Record<string, number>> {
  const rows = await sql<Array<{ mode: string; credit_cost: number }>>`SELECT mode, credit_cost FROM video_action_costs`;
  return Object.fromEntries(rows.map((row) => [row.mode, row.credit_cost]));
}

/** Marges vidéo par mode (clé = mode). */
export async function getVideoActionMargins(): Promise<Record<string, number>> {
  const rows = await sql<Array<{ mode: string; margin_multiplier: number }>>`SELECT mode, margin_multiplier FROM video_action_costs`;
  return Object.fromEntries(rows.map((row) => [row.mode, Number(row.margin_multiplier)]));
}

/** Solde = somme du ledger (append-only : mint/spend/refund/expire). */
export async function getLedgerBalance(userId: string): Promise<number> {
  const rows = await sql<Array<{ balance: number | null }>>`
    SELECT COALESCE(SUM(delta), 0)::int AS balance FROM credit_ledger WHERE user_id = ${userId}`;
  return rows[0]?.balance ?? 0;
}

export interface DbPlan {
  plan: string;
  monthly_price_cents: number;
  yearly_discount_rate: number;
  monthly_credits: number;
}

export async function getPlans(): Promise<DbPlan[]> {
  return sql<DbPlan[]>`SELECT plan, monthly_price_cents, yearly_discount_rate, monthly_credits FROM plans ORDER BY monthly_price_cents ASC`;
}

export interface DbSubscription {
  id: string;
  user_id: string;
  status: string;
  plan: string | null;
  stripe_customer_id: string | null;
  current_period_end: string | null;
}

export async function getSubscription(userId: string): Promise<DbSubscription | null> {
  const rows = await sql<DbSubscription[]>`
    SELECT * FROM subscriptions WHERE user_id = ${userId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getAppConfigInt(key: string, fallback: number): Promise<number> {
  const rows = await sql<Array<{ value_int: number | null }>>`
    SELECT value_int FROM app_config WHERE key = ${key} LIMIT 1`;
  return rows[0]?.value_int ?? fallback;
}

export async function getAppConfigNumber(key: string, fallback: number): Promise<number> {
  const rows = await sql<Array<{ value_int: number | null; value_text: string | null }>>`
    SELECT value_int, value_text FROM app_config WHERE key = ${key} LIMIT 1`;
  const raw = rows[0];
  if (!raw) return fallback;
  if (raw.value_text !== null && raw.value_text !== "") {
    const parsed = Number.parseFloat(raw.value_text);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (raw.value_int !== null) return raw.value_int;
  return fallback;
}

import sql from "@/lib/db";

export interface AssetProvenance {
  generationId: string | null;
  videoJobId: string | null;
  source: "generated" | "upload";
  feature: string | null;
  modelUsed: string | null;
  selectedModel: string | null;
  createdAt: string | null;
  generationCreatedAt: string | null;
  description: string | null;
}

interface AssetProvenanceRow {
  generation_id: string | null;
  video_job_id: string | null;
  asset_created_at: Date | string | null;
  job_feature: string | null;
  job_type: string | null;
  job_model_used: string | null;
  job_selected_model: string | null;
  job_created_at: Date | string | null;
  job_description: string | null;
  video_mode: string | null;
  video_model_used: string | null;
  video_selected_model: string | null;
  video_created_at: Date | string | null;
  video_description: string | null;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Reads the actual service/model recorded on the generation job for an asset.
 * Ownership is checked in the SQL query; no provider or model is inferred from
 * the file URL. Uploaded source assets intentionally have no AI model.
 */
export async function getAssetProvenance(
  userId: string,
  assetId: string,
): Promise<AssetProvenance | null> {
  const rows = await sql<AssetProvenanceRow[]>`
    SELECT
      a.generation_id::text AS generation_id,
      a.video_job_id::text AS video_job_id,
      a.created_at AS asset_created_at,
      j.input->>'feature' AS job_feature,
      j.type AS job_type,
      j.model_used AS job_model_used,
      j.input->>'model' AS job_selected_model,
      j.created_at AS job_created_at,
      COALESCE(
        NULLIF(j.input->>'sceneDetails', ''),
        NULLIF(j.input->>'description', ''),
        NULLIF(j.input->>'prompt', '')
      ) AS job_description,
      v.mode AS video_mode,
      v.model_used AS video_model_used,
      v.selected_model AS video_selected_model,
      v.created_at AS video_created_at,
      (
        SELECT string_agg(NULLIF(shot->>'prompt', ''), E'\n\n')
        FROM jsonb_array_elements(COALESCE(v.shots, '[]'::jsonb)) AS shot
      ) AS video_description
    FROM assets a
    LEFT JOIN jobs j ON j.id = a.generation_id
    LEFT JOIN video_jobs v ON v.id = a.video_job_id
    WHERE a.user_id = ${userId}
      AND a.id = ${assetId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  const generationId = row.generation_id ?? null;
  const videoJobId = row.video_job_id ?? null;
  const generated = Boolean(generationId || videoJobId);

  return {
    generationId,
    videoJobId,
    source: generated ? "generated" : "upload",
    feature: row.job_feature ?? row.job_type ?? row.video_mode ?? null,
    modelUsed: row.job_model_used ?? row.video_model_used ?? null,
    selectedModel: row.job_selected_model ?? row.video_selected_model ?? null,
    createdAt: toIsoString(row.asset_created_at),
    generationCreatedAt: toIsoString(row.job_created_at ?? row.video_created_at),
    description: row.job_description ?? row.video_description ?? null,
  };
}

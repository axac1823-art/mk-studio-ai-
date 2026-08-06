-- Migration 002 — Video Generator (video_jobs)
-- Crée une table dédiée aux jobs vidéo et une table de coûts par mode.

BEGIN;

CREATE TABLE IF NOT EXISTS video_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','complete','failed')),
  mode            text,
  selected_model  text,
  model_used      text,
  start_image_url text,
  end_image_url   text,
  media_references jsonb NOT NULL DEFAULT '[]',
  shots           jsonb NOT NULL DEFAULT '[]',
  duration        int NOT NULL,
  aspect_ratio    text NOT NULL,
  audio_enabled   boolean NOT NULL DEFAULT false,
  result_url      text,
  credits_charged int NOT NULL DEFAULT 0,
  error_message   text,
  progress        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_jobs_user_created ON video_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_jobs_project ON video_jobs(project_id);

CREATE TABLE IF NOT EXISTS video_action_costs (
  mode        text PRIMARY KEY,
  credit_cost int NOT NULL CHECK (credit_cost >= 0)
);

INSERT INTO video_action_costs (mode, credit_cost) VALUES
  ('text_to_video', 25),
  ('image_to_video', 30),
  ('start_end_frame', 40),
  ('multi_reference', 45),
  ('multi_shot', 35),
  ('multi_shot_concat_overhead', 5)
ON CONFLICT (mode) DO NOTHING;

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS video_job_id uuid REFERENCES video_jobs(id) ON DELETE SET NULL;

-- Le ledger doit pouvoir référencer aussi bien un job image qu'un job vidéo.
ALTER TABLE credit_ledger
  ADD COLUMN IF NOT EXISTS ref_video_job_id uuid REFERENCES video_jobs(id) ON DELETE SET NULL;

-- Supprime la contrainte unique unique-table existante au profit d'index partiels
-- qui permettent soit ref_job_id, soit ref_video_job_id, mais pas les deux.
ALTER TABLE credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_ref_job_id_reason_key;
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_job_reason_unique
  ON credit_ledger(ref_job_id, reason) WHERE ref_video_job_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_video_job_reason_unique
  ON credit_ledger(ref_video_job_id, reason) WHERE ref_job_id IS NULL;

COMMIT;

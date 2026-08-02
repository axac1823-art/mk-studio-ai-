-- RenderStudio — schéma unique (source de vérité) partagé par /web et /worker.
-- PostgreSQL 13+ (gen_random_uuid natif). Appliquer avec :
--   docker compose exec -T db psql -U renderstudio -d renderstudio < db/schema.sql
-- Idempotent : ré-exécutable sans effet de bord.

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  cover_asset_id uuid, -- FK ajoutée après assets (cycle projects <-> assets)
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Un job = UNE génération (image, vidéo ou upscale). parent_generation_id
-- lie un job upscale à sa génération source (l'original n'est JAMAIS
-- remplacé — avant/après comparable).
CREATE TABLE IF NOT EXISTS jobs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id           uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type                 text NOT NULL,
  status               text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','processing','complete','failed')),
  input                jsonb NOT NULL DEFAULT '{}',
  result_asset_id      uuid, -- FK ajoutée après assets
  parent_generation_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  error_message        text, -- message GÉNÉRIQUE client uniquement
  credits_charged      int NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_user_created ON jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_project ON jobs(project_id);

-- Un asset = un fichier visible par l'utilisateur (résultat de génération
-- ou image source uploadée — generation_id NULL = upload).
CREATE TABLE IF NOT EXISTS assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('image','video')),
  generation_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  storage_path  text NOT NULL, -- chemin public relatif servi par le worker (/storage/...)
  is_favorite   boolean NOT NULL DEFAULT false,
  is_trashed    boolean NOT NULL DEFAULT false,
  trashed_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assets_project_visible ON assets(project_id) WHERE (NOT is_trashed);
CREATE INDEX IF NOT EXISTS assets_user_created ON assets(user_id, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_cover_fk'
    ) THEN
        ALTER TABLE projects ADD CONSTRAINT projects_cover_fk
          FOREIGN KEY (cover_asset_id) REFERENCES assets(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'jobs_result_fk'
    ) THEN
        ALTER TABLE jobs ADD CONSTRAINT jobs_result_fk
          FOREIGN KEY (result_asset_id) REFERENCES assets(id) ON DELETE SET NULL;
    END IF;
END
$$;

-- Coûts par action EN TABLE (spec : pas de coût en dur). Les
-- multiplicateurs (qualité pro x2, durée vidéo, surcharge résolution)
-- restent des constantes documentées côté /web (lib/credits).
CREATE TABLE IF NOT EXISTS action_costs (
  feature_type text PRIMARY KEY,
  credit_cost  int NOT NULL CHECK (credit_cost >= 0)
);

-- Ledger append-only : mint/spend/refund/expire. L'unicité
-- (ref_job_id, reason) rend le débit IDEMPOTENT (le worker débite au
-- succès ; jamais deux 'spend' pour le même job). Les mints (ref_job_id
-- NULL) ne sont pas contraints.
CREATE TABLE IF NOT EXISTS credit_ledger (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta      int NOT NULL,
  reason     text NOT NULL CHECK (reason IN ('mint','spend','refund','expire')),
  ref_job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ref_job_id, reason)
);

-- Coquille pour le jalon Stripe (abonnements + webhooks).
CREATE TABLE IF NOT EXISTS subscriptions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status             text NOT NULL DEFAULT 'inactive',
  stripe_customer_id text,
  current_period_end timestamptz
);

-- --- Seed V1 : dev user placeholder (auth au jalon suivant) + coûts ---
INSERT INTO users (email, display_name)
VALUES ('dev@renderstudio.local', 'Dev User')
ON CONFLICT (email) DO NOTHING;

INSERT INTO projects (user_id, name)
SELECT id, 'General' FROM users
WHERE email = 'dev@renderstudio.local'
  AND NOT EXISTS (
    SELECT 1 FROM projects p JOIN users u ON u.id = p.user_id
    WHERE u.email = 'dev@renderstudio.local' AND p.name = 'General'
  );

INSERT INTO action_costs (feature_type, credit_cost) VALUES
  ('print_render', 10),
  ('mood_swap', 8),
  ('exterior_to_interior', 12),
  ('plan_to_render', 12),
  ('multi_angle', 15),
  ('animate', 30),
  ('upscale_2x', 8),
  ('upscale_4x', 15)
ON CONFLICT (feature_type) DO NOTHING;

INSERT INTO credit_ledger (user_id, delta, reason)
SELECT id, 100, 'mint' FROM users
WHERE email = 'dev@renderstudio.local'
  AND NOT EXISTS (
    SELECT 1 FROM credit_ledger l JOIN users u ON u.id = l.user_id
    WHERE u.email = 'dev@renderstudio.local' AND l.reason = 'mint'
  );

COMMIT;

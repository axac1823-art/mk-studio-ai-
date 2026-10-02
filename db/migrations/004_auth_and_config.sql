-- Migration : auth Supabase + config opérationnelle + index crédits.
-- Idempotente : ré-exécutable sans effet de bord.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}';

ALTER TABLE credit_ledger
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS plan text;

CREATE INDEX IF NOT EXISTS credit_ledger_user_created
  ON credit_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value_int int,
  value_text text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_config (key, value_int) VALUES
  ('signup_bonus_credits', 100),
  ('low_credit_threshold', 10)
ON CONFLICT (key) DO NOTHING;

COMMIT;

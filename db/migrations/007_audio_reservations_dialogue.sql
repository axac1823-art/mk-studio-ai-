-- Audio jobs : idempotency, credit reservations and Text-to-Dialogue pricing.
BEGIN;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS provider_request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_user_idempotency_unique
  ON jobs(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS audio_credit_reservations (
  job_id     uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     int NOT NULL CHECK (amount >= 0),
  status     text NOT NULL DEFAULT 'reserved'
             CHECK (status IN ('reserved', 'consumed', 'released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audio_credit_reservations_user_status
  ON audio_credit_reservations(user_id, status);

INSERT INTO action_costs (feature_type, credit_cost, margin_multiplier)
SELECT 'dialogue_generator', credit_cost, margin_multiplier
FROM action_costs
WHERE feature_type = 'voice_generator'
ON CONFLICT (feature_type) DO NOTHING;

COMMIT;

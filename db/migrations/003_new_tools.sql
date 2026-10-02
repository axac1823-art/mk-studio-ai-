-- Migration 003 — Audio, video editing, video upscaling.

BEGIN;

-- Le type 'audio' est maintenant un asset valide (résultats du Voice Generator).
ALTER TABLE assets
  DROP CONSTRAINT IF EXISTS assets_type_check;
ALTER TABLE assets
  ADD CONSTRAINT assets_type_check CHECK (type IN ('image', 'video', 'audio'));

-- Coûts des nouvelles actions.
INSERT INTO action_costs (feature_type, credit_cost) VALUES
  ('video_upscale_2x', 20),
  ('video_upscale_4x', 35),
  ('video_edit_trim', 5),
  ('video_edit_concat', 8),
  ('voice_generator', 6)
ON CONFLICT (feature_type) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;

COMMIT;

-- Réduit le coût des générations Image-to-3D et Text-to-3D.
-- Les deux modes utilisent la même action `3d_generator`.
BEGIN;

INSERT INTO action_costs (feature_type, credit_cost)
VALUES ('3d_generator', 2)
ON CONFLICT (feature_type)
DO UPDATE SET credit_cost = EXCLUDED.credit_cost;

COMMIT;

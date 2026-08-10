-- Ajoute l'unicité user_id sur subscriptions pour que ON CONFLICT (user_id)
-- dans getOrCreateStripeCustomer fonctionne.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_unique
  ON subscriptions(user_id);

COMMIT;

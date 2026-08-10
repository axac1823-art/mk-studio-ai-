// Stripe — côté serveur uniquement. Aucune clé ne fuite vers le client.
import Stripe from "stripe";

import sql from "./db";

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(key, {
    apiVersion: "2026-07-29.dahlia",
  });
}

const PLAN_CREDITS: Record<string, number> = {
  starter: 500,
  pro: 2000,
  studio: 6000,
};

export function planCredits(plan: string): number {
  return PLAN_CREDITS[plan.toLowerCase()] ?? 0;
}

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  const existing = await sql<Array<{ stripe_customer_id: string | null }>>`
    SELECT stripe_customer_id FROM subscriptions WHERE user_id = ${userId} LIMIT 1
  `;
  const storedCustomerId = existing[0]?.stripe_customer_id;

  // Vérifie que le customer stocké existe toujours dans le compte Stripe courant.
  // Si la clé Stripe a changé (test/live ou autre compte), l'ID est invalide :
  // on en recrée un nouveau et on met à jour la DB.
  if (storedCustomerId) {
    try {
      await getStripe().customers.retrieve(storedCustomerId);
      return storedCustomerId;
    } catch (err) {
      const stripeError = err as { code?: string; type?: string };
      if (stripeError.code === "resource_missing" || stripeError.type === "StripeInvalidRequestError") {
        console.warn("Stored Stripe customer not found, recreating:", storedCustomerId);
      } else {
        throw err;
      }
    }
  }

  const customer = await getStripe().customers.create({
    email,
    metadata: { user_id: userId },
  });

  await sql`
    INSERT INTO subscriptions (user_id, status, stripe_customer_id)
    VALUES (${userId}, 'inactive', ${customer.id})
    ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id
  `;

  return customer.id;
}

interface SubscriptionLike {
  status: string;
  current_period_end: number | string | null | undefined;
}

function toUnixTimestamp(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function syncSubscriptionFromStripe(
  userId: string,
  stripeCustomerId: string,
  subscription: SubscriptionLike,
  plan: string
) {
  const status = subscription.status;
  const periodEndUnix = toUnixTimestamp(subscription.current_period_end);
  const currentPeriodEnd = periodEndUnix
    ? new Date(periodEndUnix * 1000).toISOString()
    : null;

  await sql`
    INSERT INTO subscriptions (user_id, status, plan, stripe_customer_id, current_period_end)
    VALUES (${userId}, ${status}, ${plan}, ${stripeCustomerId}, ${currentPeriodEnd})
    ON CONFLICT (user_id) DO UPDATE SET
      status = EXCLUDED.status,
      plan = EXCLUDED.plan,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      current_period_end = EXCLUDED.current_period_end
  `;
}

export async function mintSubscriptionCredits(
  userId: string,
  plan: string,
  periodEndUnix: number
) {
  const credits = planCredits(plan);
  if (credits <= 0) return;

  // Idempotence par période : une seule ligne mint par mois facturé.
  const refKey = `subscription_${periodEndUnix}`;
  const existing = await sql<Array<{ id: number }>>`
    SELECT id FROM credit_ledger
    WHERE user_id = ${userId} AND reason = 'mint' AND ref_job_id IS NULL
      AND COALESCE(metadata->>'stripe_ref', '') = ${refKey}
    LIMIT 1
  `;
  if (existing[0]) return;

  await sql`
    INSERT INTO credit_ledger (user_id, delta, reason, metadata)
    VALUES (${userId}, ${credits}, 'mint', ${sql.json({ stripe_ref: refKey, plan })})
  `;
}

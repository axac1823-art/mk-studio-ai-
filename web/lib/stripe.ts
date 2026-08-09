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
  const customerId = existing[0]?.stripe_customer_id;
  if (customerId) return customerId;

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
  current_period_end: number;
}

export async function syncSubscriptionFromStripe(
  userId: string,
  stripeCustomerId: string,
  subscription: SubscriptionLike,
  plan: string
) {
  const status = subscription.status;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  await sql`
    INSERT INTO subscriptions (user_id, status, plan, stripe_customer_id, current_period_end)
    VALUES (${userId}, ${status}, ${plan}, ${stripeCustomerId}, ${currentPeriodEnd}::timestamptz)
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

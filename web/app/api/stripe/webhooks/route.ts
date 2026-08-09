// Webhook Stripe : synchronise les abonnements et minte les crédits.
import { NextRequest, NextResponse } from "next/server";

import { getStripe, mintSubscriptionCredits, syncSubscriptionFromStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_BY_PRICE: Record<string, string> = {};
function ensurePriceMap() {
  if (process.env.STRIPE_PRICE_STARTER) PLAN_BY_PRICE[process.env.STRIPE_PRICE_STARTER] = "starter";
  if (process.env.STRIPE_PRICE_PRO) PLAN_BY_PRICE[process.env.STRIPE_PRICE_PRO] = "pro";
  if (process.env.STRIPE_PRICE_STUDIO) PLAN_BY_PRICE[process.env.STRIPE_PRICE_STUDIO] = "studio";
}
ensurePriceMap();

function planFromPrice(priceId: string | null): string | null {
  return priceId ? PLAN_BY_PRICE[priceId] ?? null : null;
}

interface StripeSubscriptionLike {
  id: string;
  metadata?: Record<string, string> | null;
  customer: string | { id: string };
  status: string;
  current_period_end: number;
  items: { data: Array<{ price: { id?: string | null; lookup_key?: string | null } }> };
}

async function handleSubscription(subscription: StripeSubscriptionLike) {
  const userId = subscription.metadata?.user_id;
  if (!userId) return;

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const plan = planFromPrice(priceId);
  if (!plan) return;

  await syncSubscriptionFromStripe(userId, customerId, subscription as never, plan);
  if (subscription.status === "active" || subscription.status === "trialing") {
    await mintSubscriptionCredits(userId, plan, subscription.current_period_end);
  }
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const object = event.data.object as unknown as Record<string, unknown>;
    switch (event.type) {
      case "checkout.session.completed": {
        const subscriptionId = object.subscription;
        if (typeof subscriptionId === "string") {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          await handleSubscription(subscription as unknown as StripeSubscriptionLike);
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const subscriptionId = object.subscription;
        if (typeof subscriptionId === "string") {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          await handleSubscription(subscription as unknown as StripeSubscriptionLike);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscription(object as unknown as StripeSubscriptionLike);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("stripe webhook handler error", err);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

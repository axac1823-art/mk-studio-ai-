// Création d'une session Stripe Checkout pour un abonnement.
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { getOrCreateStripeCustomer, getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICE_MAP: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  studio: process.env.STRIPE_PRICE_STUDIO,
};

export async function POST(req: NextRequest) {
  const { dbUser: user, supabaseUser } = await requireAuth();
  const body = (await req.json().catch(() => null)) as { plan?: string } | null;
  const plan = body?.plan?.toLowerCase();
  const priceId = plan ? PRICE_MAP[plan] : undefined;

  if (!plan || !priceId) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  try {
    const customerId = await getOrCreateStripeCustomer(user.id, supabaseUser.email ?? user.email);
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      client_reference_id: user.id,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/app/account?success=1`,
      cancel_url: `${origin}/app/pricing`,
      subscription_data: {
        metadata: { user_id: user.id, plan },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("stripe checkout error", err);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}

// Création d'une session Stripe Billing Portal.
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import sql from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const { dbUser: user } = await requireAuth();

  const rows = await sql<Array<{ stripe_customer_id: string | null }>>`
    SELECT stripe_customer_id FROM subscriptions WHERE user_id = ${user.id} LIMIT 1
  `;
  const customerId = rows[0]?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "No subscription found." }, { status: 404 });
  }

  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("stripe portal error", err);
    return NextResponse.json({ error: "Could not open billing portal." }, { status: 500 });
  }
}

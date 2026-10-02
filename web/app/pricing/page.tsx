import type { Metadata } from "next";

import { PricingContent } from "@/app/app/pricing/pricing-content";
import { PLAN_DESCRIPTIONS, PLAN_FEATURES, HIGHLIGHTED_PLAN } from "@/lib/config/pricing";
import { getCurrentUser } from "@/lib/auth";
import { getLedgerBalance, getPlans } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing for Architectural AI Tools",
  description:
    "Compare Renderuim plans for architectural rendering, image and video generation, and visualization workflows.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    type: "website",
    siteName: "Renderuim",
    title: "Renderuim Pricing | Architectural AI Tools",
    description:
      "Compare plans and monthly credits for Renderuim's architectural visualization workspace.",
    url: "/pricing",
    images: [
      {
        url: "/hero.webp",
        alt: "Architectural visualization created with Renderuim",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Renderuim Pricing | Architectural AI Tools",
    description:
      "Compare plans and monthly credits for Renderuim's architectural visualization workspace.",
    images: ["/hero.webp"],
  },
};

export default async function PublicPricingPage() {
  const [user, dbPlans] = await Promise.all([getCurrentUser(), getPlans()]);
  const balance = user ? await getLedgerBalance(user.id) : undefined;

  const plans = dbPlans.map((plan) => ({
    plan: plan.plan,
    name: plan.plan.charAt(0).toUpperCase() + plan.plan.slice(1),
    monthly_price_cents: plan.monthly_price_cents,
    yearly_discount_rate: plan.yearly_discount_rate,
    monthly_credits: plan.monthly_credits,
    description: PLAN_DESCRIPTIONS[plan.plan] ?? "",
    features: [
      `${plan.monthly_credits.toLocaleString()} credits per month`,
      ...(PLAN_FEATURES[plan.plan] ?? []),
    ],
    highlighted: plan.plan === HIGHLIGHTED_PLAN,
  }));

  return (
    <PricingContent
      plans={plans}
      balance={balance}
      displayName={user?.display_name || user?.full_name || user?.email}
      isAuthenticated={Boolean(user)}
    />
  );
}

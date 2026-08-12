import { requireAuth } from "@/lib/auth";
import { getLedgerBalance, getPlans } from "@/lib/db/queries";
import { PricingContent } from "./pricing-content";

export const dynamic = "force-dynamic";

// Features des plans — couvre les outils disponibles ; les crédits/prix
// proviennent de la table `plans`.
const PLAN_FEATURES: Record<string, string[]> = {
  starter: ["500 credits / month", "All image tools", "Video generator", "Email support"],
  pro: ["2,000 credits / month", "Priority processing", "All image tools", "Video generator", "Audio & 3D tools", "Priority support"],
  studio: ["6,000 credits / month", "Team projects", "Priority processing", "All image, video, audio & 3D tools", "Dedicated support"],
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  starter: "Try RenderStudio with a small monthly credit pack.",
  pro: "Best for freelancers and small studios.",
  studio: "For teams with heavier archviz workflows.",
};

const HIGHLIGHTED_PLAN = "pro";

export default async function PricingPage() {
  const { dbUser, supabaseUser } = await requireAuth();
  const [balance, dbPlans] = await Promise.all([getLedgerBalance(dbUser.id), getPlans()]);
  const displayName = dbUser.display_name || dbUser.full_name || supabaseUser.email || "User";

  const plans = dbPlans.map((p) => ({
    plan: p.plan,
    name: p.plan.charAt(0).toUpperCase() + p.plan.slice(1),
    monthly_price_cents: p.monthly_price_cents,
    yearly_discount_rate: p.yearly_discount_rate,
    monthly_credits: p.monthly_credits,
    description: PLAN_DESCRIPTIONS[p.plan] ?? "",
    features: PLAN_FEATURES[p.plan] ?? [],
    highlighted: p.plan === HIGHLIGHTED_PLAN,
  }));

  return <PricingContent plans={plans} balance={balance} displayName={displayName} />;
}

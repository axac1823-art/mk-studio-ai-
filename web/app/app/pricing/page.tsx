import { requireAuth } from "@/lib/auth";
import { getLedgerBalance } from "@/lib/db/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SubscribeButton } from "./subscribe-button";

export const dynamic = "force-dynamic";

const PLANS = [
  {
    name: "Starter",
    plan: "starter",
    price: "$19",
    period: "/month",
    description: "Try RenderStudio with a small monthly credit pack.",
    features: ["500 credits / month", "All image tools", "Video generator", "Email support"],
    highlighted: false,
  },
  {
    name: "Pro",
    plan: "pro",
    price: "$49",
    period: "/month",
    description: "Best for freelancers and small studios.",
    features: ["2,000 credits / month", "Priority processing", "All image tools", "Video generator", "Priority support"],
    highlighted: true,
  },
  {
    name: "Studio",
    plan: "studio",
    price: "$129",
    period: "/month",
    description: "For teams with heavier archviz workflows.",
    features: ["6,000 credits / month", "Team projects", "Priority processing", "All image & video tools", "Dedicated support"],
    highlighted: false,
  },
];

export default async function PricingPage() {
  const { dbUser, supabaseUser } = await requireAuth();
  const balance = await getLedgerBalance(dbUser.id);
  const displayName = dbUser.display_name || dbUser.full_name || supabaseUser.email || "User";

  return (
    <main className="flex min-h-screen w-full flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Simple plans for architectural visualization professionals.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{displayName}</span>
          <Badge variant="secondary">{balance.toLocaleString()} credits</Badge>
        </div>
      </header>

      <div className="grid w-full max-w-5xl gap-6 self-center sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={plan.highlighted ? "border-primary ring-1 ring-primary" : ""}
          >
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
              <ul className="flex flex-col gap-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <SubscribeButton plan={plan.plan} highlighted={plan.highlighted} />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}

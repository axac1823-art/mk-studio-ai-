import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

const PLANS = [
  {
    name: "Starter",
    price: "$19",
    period: "/month",
    description: "Try RenderStudio with a small monthly credit pack.",
    features: ["500 credits / month", "All image tools", "Video generator", "Email support"],
    cta: "Get Started",
    href: "/app/dashboard",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    description: "Best for freelancers and small studios.",
    features: ["2,000 credits / month", "Priority processing", "All image tools", "Video generator", "Priority support"],
    cta: "Subscribe",
    href: "/app/dashboard",
    highlighted: true,
  },
  {
    name: "Studio",
    price: "$129",
    period: "/month",
    description: "For teams with heavier archviz workflows.",
    features: ["6,000 credits / month", "Team projects", "Priority processing", "All image & video tools", "Dedicated support"],
    cta: "Contact Sales",
    href: "/app/dashboard",
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <main className="flex min-h-screen w-full flex-col gap-8 p-4 sm:p-6">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Simple plans for architectural visualization professionals.
        </p>
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
              <Button asChild variant={plan.highlighted ? "default" : "outline"} className="w-full">
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Prices are illustrative — Stripe billing integration is coming in the next milestone.
      </p>
    </main>
  );
}

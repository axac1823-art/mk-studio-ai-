"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SubscribeButton } from "./subscribe-button";

interface PricingPlan {
  plan: string;
  name: string;
  monthly_price_cents: number;
  yearly_discount_rate: number;
  monthly_credits: number;
  description: string;
  features: string[];
  highlighted: boolean;
}

interface PricingContentProps {
  plans: PricingPlan[];
  balance: number;
  displayName: string;
}

const FAQS = [
  {
    question: "What is a credit and how is it spent?",
    answer:
      "One credit equals one U.S. cent of provider compute. Each generation debits the cost shown for that tool only when the generation succeeds. You can see the exact cost before you click Generate.",
  },
  {
    question: "Do unused credits roll over?",
    answer:
      "Subscription credits are reset at the start of each billing period and do not roll over. One-time top-up credits (when available) remain on your account until spent.",
  },
  {
    question: "What happens if I run out mid-month?",
    answer:
      "You can upgrade to a higher plan at any time, or wait for the next billing cycle when your subscription credits refresh. You keep access to all your existing assets and projects.",
  },
  {
    question: "How do I cancel or change my plan?",
    answer:
      "Visit your Account page to open the Stripe Customer Portal. You can upgrade, downgrade, or cancel there. Cancellations take effect at the end of the current paid period.",
  },
  {
    question: "What payment methods are accepted?",
    answer:
      "We accept all major credit and debit cards through Stripe, including Visa, Mastercard, American Express, and Discover.",
  },
  {
    question: "Is there a free trial or starter credits?",
    answer:
      "Every new account receives 100 free signup credits. No payment method is required to try the tools.",
  },
  {
    question: "What is the refund policy?",
    answer:
      "Credits are consumed on successful generations, so we do not issue refunds for spent credits. If you experience a billing error, contact support and we will review it.",
  },
];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function PricingContent({ plans, balance, displayName }: PricingContentProps) {
  const [isYearly, setIsYearly] = useState(true);

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

      <section className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-3 rounded-full border bg-background px-4 py-2">
          <span className={isYearly ? "text-muted-foreground" : "font-medium"}>Monthly</span>
          <Switch checked={isYearly} onCheckedChange={setIsYearly} aria-label="Toggle yearly billing" />
          <span className={isYearly ? "font-medium" : "text-muted-foreground"}>Yearly</span>
          {isYearly && <Badge className="ml-1">Save 25%</Badge>}
        </div>

        <div className="grid w-full max-w-5xl gap-6 self-center sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const yearlyTotalCents = Math.round(plan.monthly_price_cents * 12 * (1 - plan.yearly_discount_rate));
            const effectiveMonthlyCents = Math.round(yearlyTotalCents / 12);
            const displayedPrice = isYearly ? effectiveMonthlyCents : plan.monthly_price_cents;
            const displayedPeriod = isYearly ? "/month, billed yearly" : "/month";

            return (
              <Card key={plan.plan} className={plan.highlighted ? "border-primary ring-1 ring-primary" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.highlighted && <Badge>Popular</Badge>}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{formatPrice(displayedPrice)}</span>
                      <span className="text-sm text-muted-foreground">{displayedPeriod}</span>
                    </div>
                    {isYearly && (
                      <span className="text-xs text-muted-foreground">
                        {formatPrice(yearlyTotalCents)} billed annually
                      </span>
                    )}
                  </div>
                  <ul className="flex flex-col gap-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <SubscribeButton plan={plan.plan} highlighted={plan.highlighted} billing={isYearly ? "yearly" : "monthly"} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="flex flex-col gap-3">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-lg border bg-background px-4 py-3 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                {faq.question}
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}

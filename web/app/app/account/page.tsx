import { requireAuth } from "@/lib/auth";
import { getLedgerBalance, getSubscription } from "@/lib/db/queries";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PortalButton } from "./portal-button";
import { DeleteAccountButton } from "./delete-account-button";

export const dynamic = "force-dynamic";

function formatPlan(plan: string | null, status: string): string {
  if (plan) return `${plan.charAt(0).toUpperCase() + plan.slice(1)}`;
  if (status === "active" || status === "trialing") return "Active";
  return "Free";
}

export default async function AccountPage() {
  const { supabaseUser, dbUser } = await requireAuth();
  const [balance, subscription] = await Promise.all([
    getLedgerBalance(dbUser.id),
    getSubscription(dbUser.id),
  ]);

  return (
    <main className="flex min-h-screen w-full flex-col gap-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">Your profile, plan and billing.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your RenderStudio identity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{supabaseUser.email ?? dbUser.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Display name</p>
              <p className="text-sm text-muted-foreground">{dbUser.display_name || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Full name</p>
              <p className="text-sm text-muted-foreground">{dbUser.full_name || "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan & Credits</CardTitle>
            <CardDescription>Your current subscription and credit balance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current plan</span>
              <Badge variant={subscription?.status === "active" ? "default" : "secondary"}>
                {formatPlan(subscription?.plan ?? null, subscription?.status ?? "inactive")}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Credits</span>
              <span className="text-sm font-semibold">{balance.toLocaleString()}</span>
            </div>
            {subscription?.current_period_end && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Current period ends</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              </div>
            )}
            <PortalButton />
          </CardContent>
        </Card>

        <Card className="border-destructive/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>Permanently delete your RenderStudio account and all data.</CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccountButton />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

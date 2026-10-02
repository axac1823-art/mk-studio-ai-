import { getCurrentUser } from "@/lib/auth";
import { getLedgerBalance, getAppConfigInt } from "@/lib/db/queries";
import { AppShell } from "@/components/navigation/app-shell";
import { JobNotificationsProvider } from "@/components/jobs/job-notifications";
import { SessionTimeout } from "@/components/auth/session-timeout";
import { LandingPage } from "@/components/landing/landing-page";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const dynamic = "force-dynamic";

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const showLogin = params.login === "true";

  if (!user) {
    return <LandingPage login={showLogin} />;
  }

  const [balance, lowThreshold] = await Promise.all([
    getLedgerBalance(user.id),
    getAppConfigInt("low_credit_threshold", 10),
  ]);

  return (
    <JobNotificationsProvider>
      <SessionTimeout />
      <AppShell user={user} balance={balance} lowThreshold={lowThreshold}>
        <DashboardContent />
      </AppShell>
    </JobNotificationsProvider>
  );
}

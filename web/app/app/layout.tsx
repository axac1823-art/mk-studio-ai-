// Layout de la section /app : header fixe en haut, sidebar repliable à gauche.
// Le shell gère l'état d'ouverture de la sidebar ; le reste du contenu
// s'insère dans <main>.
import { JobNotificationsProvider } from "@/components/jobs/job-notifications";
import { AppShell } from "@/components/navigation/app-shell";
import { SessionTimeout } from "@/components/auth/session-timeout";
import { requireAuth } from "@/lib/auth";
import { getLedgerBalance, getAppConfigInt } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { dbUser } = await requireAuth();
  const [balance, lowThreshold] = await Promise.all([
    getLedgerBalance(dbUser.id),
    getAppConfigInt("low_credit_threshold", 10),
  ]);

  return (
    <JobNotificationsProvider>
      <SessionTimeout />
      <AppShell user={dbUser} balance={balance} lowThreshold={lowThreshold}>
        {children}
      </AppShell>
    </JobNotificationsProvider>
  );
}

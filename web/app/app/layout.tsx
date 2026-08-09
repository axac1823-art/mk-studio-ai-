// Layout de la section /app : sidebar fixe à gauche, contenu à droite.
// Le home (/app/dashboard) et les pages projet/studio s'y insèrent telles
// quelles — le layout ne fournit que le cadre et la navigation latérale.
import { AppSidebar } from "@/components/navigation/Sidebar";
import { JobNotificationsProvider } from "@/components/jobs/job-notifications";
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
      <div className="flex min-h-screen w-full">
        <AppSidebar user={dbUser} balance={balance} lowThreshold={lowThreshold} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </JobNotificationsProvider>
  );
}

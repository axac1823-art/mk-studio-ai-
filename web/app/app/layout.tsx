// Layout de la section /app : sidebar fixe à gauche, contenu à droite.
// Le home (/app/dashboard) et les pages projet/studio s'y insèrent telles
// quelles — le layout ne fournit que le cadre et la navigation latérale.
import { AppSidebar } from "@/components/navigation/Sidebar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// Layout de la section /app : sidebar fixe à gauche, contenu à droite.
// Le studio existant (/app/dashboard) s'y insère tel quel — ses pages
// gardent leur propre <main> interne, le layout ne fournit que le cadre.
import { AppSidebar } from "@/components/app-sidebar";

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

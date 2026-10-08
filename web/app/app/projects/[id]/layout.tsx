import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { getProject } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { dbUser } = await requireAuth();

  const project = await getProject(dbUser.id, params.id);

  if (!project) {
    notFound();
  }

  return <div className="min-w-0 w-full flex-1">{children}</div>;
}

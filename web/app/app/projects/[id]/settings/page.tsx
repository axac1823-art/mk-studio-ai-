import { notFound } from "next/navigation";

import { ProjectSettingsForm } from "@/components/projects/project-settings-form";
import { requireAuth } from "@/lib/auth";
import { getProject } from "@/lib/db/queries";

export default async function ProjectSettingsPage({
  params,
}: {
  params: { id: string };
}) {
  const { dbUser } = await requireAuth();
  const project = await getProject(dbUser.id, params.id);

  if (!project) notFound();

  return (
    <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="border-b border-border pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Project settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage this project&apos;s name and lifecycle.
        </p>
      </header>
      <ProjectSettingsForm projectId={project.id} initialName={project.name} />
    </section>
  );
}

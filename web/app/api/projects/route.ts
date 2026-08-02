// Projets de l'utilisateur (dev user placeholder — auth au jalon suivant) :
// GET liste (avec cover + compteur d'assets) et POST création (utilisée
// aussi par le sélecteur de projet du studio, création inline).
import { NextRequest, NextResponse } from "next/server";

import { createProject, getDefaultProject, getDevUser, listProjects } from "@/lib/db/queries";
import { publicUrl } from "@/lib/worker-client";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getDevUser();
  const [projects, defaultProject] = await Promise.all([
    listProjects(user.id),
    getDefaultProject(user.id),
  ]);
  return NextResponse.json({
    defaultProjectId: defaultProject.id,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      coverUrl: project.cover_path ? publicUrl(project.cover_path) : null,
      assetCount: project.asset_count,
      updatedAt: project.updated_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) {
    return NextResponse.json({ error: "Project name required." }, { status: 400 });
  }
  const user = await getDevUser();
  const project = await createProject(user.id, name);
  return NextResponse.json({ project: { id: project.id, name: project.name } }, { status: 201 });
}

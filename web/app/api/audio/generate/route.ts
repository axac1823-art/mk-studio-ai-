// Route de création d'un job voice_generator (ElevenLabs).
// Valide le texte, calcule le coût, crée le job et délègue au worker.
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { computeCost, getBalance } from "@/lib/credits";
import { getDefaultProject, getProject, insertJob } from "@/lib/db/queries";
import { WorkerNotConfiguredError, isWorkerConfigured, startAudioJob } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_TEXT_LENGTH = 5000;

function optionalString(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function POST(req: NextRequest) {
  if (!(await isWorkerConfigured())) {
    return NextResponse.json({ error: "Generation is not configured yet — please try again later." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = form.get("text");
  if (typeof text !== "string" || text.trim().length === 0 || text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "Please provide a text between 1 and 5000 characters." }, { status: 400 });
  }

  const voiceId = optionalString(form, "voiceId");
  const model = optionalString(form, "model");
  const projectIdField = optionalString(form, "projectId");

  const { dbUser: user } = await requireAuth();
  const project = projectIdField ? await getProject(user.id, projectIdField) : await getDefaultProject(user.id);
  if (!project) {
    return NextResponse.json({ error: "Unknown project." }, { status: 400 });
  }

  const cost = await computeCost({ feature: "voice_generator", quality: "standard", resolution: "1K", quantity: 1 });
  const balance = await getBalance();
  if (balance < cost) {
    return NextResponse.json({ error: "insufficient_credits", required: cost, balance }, { status: 402 });
  }

  const jobId = await insertJob({
    userId: user.id,
    projectId: project.id,
    type: "voice_generator",
    jobInput: {
      text: text.trim(),
      voiceId,
      model,
      creditCost: cost,
    },
  });

  try {
    await startAudioJob(jobId);
  } catch (err) {
    if (err instanceof WorkerNotConfiguredError) {
      return NextResponse.json({ error: "Audio generation is not configured yet — please try again later." }, { status: 503 });
    }
    return NextResponse.json({ error: "Generation failed, please try again." }, { status: 500 });
  }

  return NextResponse.json({ jobId });
}

// Valide une demande audio, réserve ses crédits avec le job et délègue au worker.
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { computeCost } from "@/lib/credits";
import {
  createAudioJobWithReservation,
  getDefaultProject,
  getProject,
  InsufficientCreditsError,
  markJobFailed,
} from "@/lib/db/queries";
import { WorkerNotConfiguredError, isWorkerConfigured, startAudioJob } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SINGLE_TEXT_LENGTH = 5000;
const MAX_DIALOGUE_CHARACTERS = 2000;
const MAX_DIALOGUE_TURNS = 50;
const MAX_UNIQUE_DIALOGUE_VOICES = 10;
const VOICE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MODELS = new Set(["eleven_multilingual_v2", "eleven_flash_v2_5", "eleven_turbo_v2_5", "eleven_v3"]);

function stringField(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseDialogue(raw: string | undefined): { inputs: Record<string, string>[]; languageCode?: string; seed?: number } | null {
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!isRecord(parsed) || !Array.isArray(parsed.inputs) || parsed.inputs.length < 2 || parsed.inputs.length > MAX_DIALOGUE_TURNS) return null;

  const voices = new Set<string>();
  let totalLength = 0;
  const inputs: Record<string, string>[] = [];
  for (const rawTurn of parsed.inputs) {
    if (!isRecord(rawTurn) || typeof rawTurn.text !== "string" || !rawTurn.text.trim() || typeof rawTurn.voice_id !== "string" || !VOICE_ID.test(rawTurn.voice_id)) return null;
    const emotion = typeof rawTurn.emotion === "string" ? rawTurn.emotion.trim() : "";
    if (emotion.length > 80 || /[\[\]\r\n]/.test(emotion)) return null;
    const turn: Record<string, string> = { text: rawTurn.text.trim(), voice_id: rawTurn.voice_id };
    if (emotion) turn.emotion = emotion;
    totalLength += turn.text.length + (emotion ? emotion.length + 3 : 0);
    voices.add(turn.voice_id);
    inputs.push(turn);
  }
  if (totalLength > MAX_DIALOGUE_CHARACTERS || voices.size > MAX_UNIQUE_DIALOGUE_VOICES) return null;

  const result: { inputs: Record<string, string>[]; languageCode?: string; seed?: number } = { inputs };
  if (parsed.language_code !== undefined) {
    if (typeof parsed.language_code !== "string" || !/^[a-z]{2}$/i.test(parsed.language_code)) return null;
    result.languageCode = parsed.language_code.toLowerCase();
  }
  if (parsed.seed !== undefined) {
    if (typeof parsed.seed !== "number" || !Number.isInteger(parsed.seed) || parsed.seed < 0 || parsed.seed > 4_294_967_295) return null;
    result.seed = parsed.seed;
  }
  return result;
}

export async function POST(req: NextRequest) {
  const { dbUser: user } = await requireAuth();
  if (!(await isWorkerConfigured())) {
    return NextResponse.json({ error: "Generation is not configured yet — please try again later." }, { status: 503 });
  }

  let form: FormData;
  try { form = await req.formData(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const mode = stringField(form, "mode") ?? "single";
  const projectIdField = stringField(form, "projectId");
  let type: "voice_generator" | "dialogue_generator";
  let jobInput: Record<string, unknown>;

  if (mode === "dialogue") {
    const dialogue = parseDialogue(stringField(form, "dialogue"));
    if (!dialogue) return NextResponse.json({ error: "Dialogue must contain 2–50 valid turns, no more than 2,000 characters and 10 voices." }, { status: 400 });
    type = "dialogue_generator";
    jobInput = { ...dialogue };
  } else if (mode === "single") {
    const text = stringField(form, "text")?.trim();
    const voiceId = stringField(form, "voiceId");
    const model = stringField(form, "model") ?? "eleven_multilingual_v2";
    if (!text || text.length > MAX_SINGLE_TEXT_LENGTH || (voiceId && !VOICE_ID.test(voiceId)) || !MODELS.has(model)) {
      return NextResponse.json({ error: "Please provide valid text, voice and model values." }, { status: 400 });
    }
    type = "voice_generator";
    jobInput = { text, voiceId: voiceId ?? null, model };
  } else {
    return NextResponse.json({ error: "Unsupported audio generation mode." }, { status: 400 });
  }

  const project = projectIdField ? await getProject(user.id, projectIdField) : await getDefaultProject(user.id);
  if (!project) return NextResponse.json({ error: "Unknown project." }, { status: 400 });

  const keyHeader = req.headers.get("idempotency-key");
  if (keyHeader && !validUuid(keyHeader)) return NextResponse.json({ error: "Invalid idempotency key." }, { status: 400 });
  const idempotencyKey = keyHeader ?? randomUUID();
  const cost = await computeCost({ feature: type, quality: "standard", resolution: "1K", quantity: 1 });

  try {
    const created = await createAudioJobWithReservation({
      userId: user.id,
      projectId: project.id,
      type,
      jobInput: { ...jobInput, creditCost: cost },
      idempotencyKey,
      creditCost: cost,
    });
    if (created.status === "failed") {
      return NextResponse.json({ error: "This request already failed. Start a new generation." }, { status: 409 });
    }

    try {
      await startAudioJob(created.jobId);
    } catch (err) {
      await markJobFailed(created.jobId);
      if (err instanceof WorkerNotConfiguredError) {
        return NextResponse.json({ error: "Audio generation is not configured yet — please try again later." }, { status: 503 });
      }
      return NextResponse.json({ error: "Generation failed to start. You can safely retry this request." }, { status: 502 });
    }
    return NextResponse.json({ jobId: created.jobId, duplicate: created.duplicate }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "insufficient_credits", required: cost, balance: error.balance }, { status: 402 });
    }
    throw error;
  }
}

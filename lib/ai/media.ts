// Production de fichiers côté serveur (merge vidéo+audio) et stockage
// local temporaire — REMPLACÉ par S3/Supabase Storage au jalon DB.
//
// Les fichiers mergés sont écrits dans un dossier temporaire et servis
// par la route /api/media/[name] (validation stricte du nom). Prérequis
// local : le binaire `ffmpeg` dans le PATH.
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const MEDIA_DIR = path.join(os.tmpdir(), "renderstudio-media");

export class FfmpegUnavailableError extends Error {
  constructor() {
    super("ffmpeg binary not found in PATH");
    this.name = "FfmpegUnavailableError";
  }
}

let ffmpegChecked: boolean | null = null;

async function ensureFfmpeg(): Promise<void> {
  if (ffmpegChecked === true) return;
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    ffmpegChecked = true;
  } catch {
    ffmpegChecked = false;
    throw new FfmpegUnavailableError();
  }
}

async function downloadToTemp(url: string, ext: string): Promise<string> {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const filePath = path.join(MEDIA_DIR, `${randomUUID()}${ext}`);
  // Les vidéos déjà stockées en local (ex. sortie Sora, voir providers/
  // openai.ts) sont lues sur disque — `fetch` ne résout pas les chemins
  // relatifs `/api/media/...` côté serveur.
  const localMatch = /^\/api\/media\/([a-f0-9-]+\.mp4)$/.exec(url);
  if (localMatch) {
    const buffer = await readMediaFile(localMatch[1]);
    if (!buffer) throw new Error("local media not found");
    await fs.writeFile(filePath, buffer);
    return filePath;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  await fs.writeFile(filePath, Buffer.from(await res.arrayBuffer()));
  return filePath;
}

/** Stocke une vidéo produite côté serveur (ex. MP4 téléchargé depuis l'API
 *  d'un fournisseur qui ne publie pas d'URL de sortie — Sora) et retourne
 *  le chemin PUBLIC `/api/media/<nom>.mp4`, comme le merge ffmpeg. */
export async function storeVideoBuffer(buffer: Buffer): Promise<string> {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const outputName = `${randomUUID()}.mp4`;
  await fs.writeFile(path.join(MEDIA_DIR, outputName), buffer);
  return `/api/media/${outputName}`;
}

/** Fusionne une vidéo (URL CDN) et une piste audio (URL CDN) en un seul
 *  MP4, stocké en local. Retourne le chemin PUBLIC `/api/media/<nom>.mp4`. */
export async function mergeVideoAudio(videoUrl: string, audioUrl: string): Promise<string> {
  await ensureFfmpeg();
  const videoPath = await downloadToTemp(videoUrl, ".mp4");
  const audioPath = await downloadToTemp(audioUrl, ".mp3");
  const outputName = `${randomUUID()}.mp4`;
  const outputPath = path.join(MEDIA_DIR, outputName);
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", videoPath,
      "-i", audioPath,
      "-c:v", "copy",
      "-c:a", "aac",
      "-shortest",
      outputPath,
    ]);
  } finally {
    // Les sources téléchargées ne sont plus utiles après le merge.
    await fs.unlink(videoPath).catch(() => undefined);
    await fs.unlink(audioPath).catch(() => undefined);
  }
  return `/api/media/${outputName}`;
}

/** Lecture sécurisée pour la route /api/media/[name] : noms strictement
 *  contrôlés, aucun path traversal possible. */
export async function readMediaFile(name: string): Promise<Buffer | null> {
  if (!/^[a-f0-9-]+\.mp4$/.test(name)) return null;
  try {
    return await fs.readFile(path.join(MEDIA_DIR, name));
  } catch {
    return null;
  }
}

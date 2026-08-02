// Production de fichiers côté serveur et stockage local temporaire —
// REMPLACÉ par S3/Supabase Storage au jalon DB.
//
// Les vidéos produites côté serveur sont écrites dans un dossier temporaire
// et servies par la route /api/media/[name] (validation stricte du nom) :
// MP4 téléchargé depuis l'API d'un fournisseur qui ne publie pas d'URL de
// sortie (Sora), ou sortie du serveur ComfyUI local (i2v).
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const MEDIA_DIR = path.join(os.tmpdir(), "renderstudio-media");

/** Stocke une vidéo produite côté serveur (ex. MP4 téléchargé depuis l'API
 *  d'un fournisseur qui ne publie pas d'URL de sortie — Sora, ou sortie du
 *  serveur ComfyUI local) et retourne le chemin PUBLIC
 *  `/api/media/<nom>.mp4`. */
export async function storeVideoBuffer(buffer: Buffer): Promise<string> {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const outputName = `${randomUUID()}.mp4`;
  await fs.writeFile(path.join(MEDIA_DIR, outputName), buffer);
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

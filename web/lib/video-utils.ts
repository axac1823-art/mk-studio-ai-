// Utilitaires partagés client/serveur pour le Video Generator.
// Règle : le mode final est toujours détecté côté serveur ; ces helpers
// servent UNIQUEMENT à l'estimation du coût et au filtrage du dropdown UI.

export type VideoMode =
  | "text_to_video"
  | "image_to_video"
  | "start_end_frame"
  | "multi_reference"
  | "multi_shot";

export interface VideoShot {
  id: string;
  prompt: string;
  taggedMediaIds: string[];
}

const TAG_RE = /@(img|vid)(\d+)/g;

function findTags(prompt: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(TAG_RE.source, "g");
  while ((match = regex.exec(prompt)) !== null) {
    const key = `${match[1]}${match[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      ids.push(`@${key}`);
    }
  }
  return ids;
}

export function findMediaTags(prompt: string): string[] {
  return findTags(prompt);
}

function countDistinctTags(prompt: string): number {
  return findTags(prompt).length;
}

export function resolveVideoMode(input: {
  startImage: string | null;
  endImage: string | null;
  shots: VideoShot[];
}): VideoMode {
  if (input.shots.length > 1) return "multi_shot";
  if (input.startImage && input.endImage) return "start_end_frame";

  const firstPrompt = input.shots[0]?.prompt ?? "";
  const taggedCount = countDistinctTags(firstPrompt);
  if (taggedCount >= 2) return "multi_reference";

  if (input.startImage || taggedCount === 1) return "image_to_video";
  return "text_to_video";
}

export function computeVideoCost(
  costs: Record<string, number>,
  mode: VideoMode,
  shotCount: number
): number {
  if (mode === "multi_shot") {
    const perShot = costs["multi_shot"] ?? 0;
    const overhead = costs["multi_shot_concat_overhead"] ?? 0;
    return perShot * Math.max(shotCount, 1) + overhead;
  }
  return costs[mode] ?? 0;
}



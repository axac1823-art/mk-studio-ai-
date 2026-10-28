/**
 * Résolutions natives acceptées par chaque adaptateur Video Upscaler.
 * Garder cette liste commune à l'interface et à la route API évite de
 * proposer des options que la route rejetterait avant l'appel fournisseur.
 */
export type VideoUpscaleProvider = "runway_magnific" | "magichour" | "hitpaw";

export const VIDEO_UPSCALE_RESOLUTIONS: Record<VideoUpscaleProvider, readonly string[]> = {
  runway_magnific: ["720p", "1k", "2k", "4k"],
  magichour: ["720p", "1080p", "2k", "4k"],
  hitpaw: ["720p", "1080p", "1440p", "4k"],
};

export const DEFAULT_VIDEO_UPSCALE_RESOLUTION: Record<VideoUpscaleProvider, string> = {
  runway_magnific: "1k",
  magichour: "720p",
  hitpaw: "1080p",
};

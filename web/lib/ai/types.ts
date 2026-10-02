// Types partagés client/serveur — CLIENT-SAFE.
//
// Aucun nom de fournisseur, de modèle ou d'identifiant d'API ici : ces
// détails vivent dans le worker (catalogue Python) et ne doivent JAMAIS
// apparaître côté client.

/** Fonctionnalités du scope MVP + le type de job "upscale". */
export type Feature =
  | "print_render"
  | "mood_swap"
  | "exterior_to_interior"
  | "plan_to_render"
  | "multi_angle"
  | "image_extender"
  | "variations"
  | "background_remover"
  | "text_to_image"
  | "animate"
  | "upscale";

export type QualityTier = "standard" | "pro";
export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type Resolution = "1K" | "2K" | "4K";

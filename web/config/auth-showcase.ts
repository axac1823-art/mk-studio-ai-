// Contenu du panneau gauche de l'écran d'authentification.
// Chaque item est une catégorie produit avec son média de showcase,
// son titre et son sous-titre. Le média peut être une image ou une vidéo.
// Les URLs sont volontairement centralisées ici pour pouvoir être échangées
// contre des rendus/vidéos générés par l'application sans toucher au code UI.

export type ShowcaseMediaType = "image" | "video";

export interface ShowcaseItem {
  label: string;
  mediaUrl: string;
  mediaType: ShowcaseMediaType;
  headline: string;
  subtext: string;
}

export const AUTH_SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    label: "Renders",
    mediaUrl:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1920&q=80",
    mediaType: "image",
    headline: "AI renders for architecture, archviz & real estate.",
    subtext: "Turn rough 3D screenshots into photorealistic visuals in seconds.",
  },
  {
    label: "Video",
    mediaUrl:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1920&q=80",
    mediaType: "image",
    headline: "Cinematic presentation videos from a single render.",
    subtext: "Camera moves, atmosphere, and pacing — fully automated.",
  },
  {
    label: "Upscale",
    mediaUrl:
      "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1920&q=80",
    mediaType: "image",
    headline: "Enhance resolution and detail on any visual.",
    subtext: "Crisp, print-ready output ready for client presentations.",
  },
];

export const AUTH_SHOWCASE_ROTATION_INTERVAL_MS = 5000;

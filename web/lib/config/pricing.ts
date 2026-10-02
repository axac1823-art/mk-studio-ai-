/** Détails marketing des plans partagés par les pages publiques et l'espace client. */
export const PLAN_FEATURES: Record<string, string[]> = {
  starter: ["All image tools", "Video generator", "Email support"],
  pro: ["Priority processing", "All image tools", "Video generator", "Audio & 3D tools", "Priority support"],
  studio: ["Team projects", "Priority processing", "All image, video, audio & 3D tools", "Dedicated support"],
};

export const PLAN_DESCRIPTIONS: Record<string, string> = {
  starter: "A practical monthly credit pack for trying architectural AI workflows.",
  pro: "For freelancers and small architectural visualization studios.",
  studio: "For teams with heavier architectural visualization workflows.",
};

export const HIGHLIGHTED_PLAN = "pro";

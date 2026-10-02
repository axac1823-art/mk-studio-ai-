/**
 * URL publique unique du site, utilisée pour les canonicals et les fichiers
 * destinés aux robots. La variable doit être définie sur le domaine de
 * production ; Vercel sert de repli quand elle n'est pas renseignée.
 */
export function getSiteUrl(): URL {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null);

  return new URL(configuredUrl ?? "http://192.168.1.4:3000/");
}

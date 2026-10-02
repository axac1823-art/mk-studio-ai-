// Rate limiting basique par IP pour les endpoints d'authentification v1.
// En mémoire local : suffisant pour le MVP ; à remplacer par Redis si le
// déploiement devient multi-instance.

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

function key(path: string, ip: string) {
  return `${path}:${ip}`;
}

export function checkRateLimit(
  path: string,
  ip: string,
  options: { max: number; windowMs: number } = { max: 5, windowMs: 15 * 60 * 1000 }
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = store.get(key(path, ip));

  if (!entry || now > entry.resetAt) {
    store.set(key(path, ip), { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= options.max) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return "unknown";
}

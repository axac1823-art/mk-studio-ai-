// Helpers HTTP partagés par les adaptateurs de fournisseurs.
//
// Toutes les API officielles ont le même schéma général : POST d'une tâche
// (ou appel synchrone) + polling jusqu'au résultat. Ces helpers centralisent
// : JSON + gestion d'erreurs, polling avec budget de timeout (le routeur
// bascule sur le candidat suivant quand il expire), et conversion d'images.

/** Erreur fournisseur — le routeur la trace et déclenche le fallback. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Récupère une variable d'env requise ou échoue VITE (le routeur bascule
 *  alors sur un autre fournisseur configuré — pas de vendor lock-in). */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new ProviderError(`provider not configured: missing ${name}`);
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readErrorSnippet(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return text.slice(0, 300);
}

export async function postJson<T = unknown>(
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ProviderError(`POST ${url} failed (${res.status}): ${await readErrorSnippet(res)}`, res.status);
  }
  return res.json() as Promise<T>;
}

export async function getJson<T = unknown>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new ProviderError(`GET ${url} failed (${res.status}): ${await readErrorSnippet(res)}`, res.status);
  }
  return res.json() as Promise<T>;
}

export interface PollOptions<T> {
  /** Interroge l'état courant de la tâche. */
  fetchStatus: () => Promise<T>;
  /** Extrait le résultat final quand la tâche est terminée (null sinon). */
  extractDone: (status: T) => unknown | null;
  /** Détecte un échec définitif de la tâche (message d'erreur ou null). */
  extractError: (status: T) => string | null;
  timeoutMs: number;
  intervalMs?: number;
}

/** Polling générique jusqu'au résultat, à l'échec ou au timeout. Le timeout
 *  global fait échouer la tentative pour laisser le routeur basculer. */
export async function pollUntilDone<T>(options: PollOptions<T>): Promise<unknown> {
  const { fetchStatus, extractDone, extractError, timeoutMs } = options;
  const intervalMs = options.intervalMs ?? 3000;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    if (Date.now() > deadline) {
      throw new ProviderError(`provider timeout after ${timeoutMs}ms`);
    }
    const status = await fetchStatus();
    const done = extractDone(status);
    if (done !== null && done !== undefined) return done;
    const error = extractError(status);
    if (error) throw new ProviderError(error);
    await sleep(intervalMs);
  }
}

/** Extrait mime + base64 brut d'une data URI ; les URL http passent telles
 *  quelles (certains fournisseurs acceptent les deux, d'autres non). */
export function parseDataUri(uri: string): { mime: string; data: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(uri);
  return match ? { mime: match[1], data: match[2] } : null;
}

/** La plupart des API "image en entrée" veulent du base64 BRUT quand on
 *  leur passe une data URI (les URL http sont acceptées telles quelles). */
export function toBase64OrUrl(uri: string): string {
  return parseDataUri(uri)?.data ?? uri;
}

/** Base64 brut -> octets pour FormData/fetch : les typings DOM exigent un
 *  buffer NON partagé (Uint8Array<ArrayBuffer>) pour Blob/BodyInit — la
 *  copie explicite évite les erreurs de typage avec un Buffer Node. */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(base64, "base64");
  const bytes = new Uint8Array(new ArrayBuffer(buf.length));
  bytes.set(buf);
  return bytes;
}

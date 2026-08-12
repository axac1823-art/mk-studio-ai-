// Téléchargement côté client d'un résultat de génération (image ou vidéo).
// Les sorties sont soit des data URIs (Google/OpenAI), soit des URL
// locales (/storage/...), soit des URL distantes (CDN fournisseurs) : fetch ->
// blob -> object URL -> <a download> couvre les trois. Si le CDN refuse le
// fetch (CORS), repli sur un nouvel onglet (Ctrl+S / clic droit pour
// sauvegarder) — une route de téléchargement serveur prendra le relais au
// jalon DB si nécessaire.

export async function saveResult(url: string, kind: "image" | "video" | "audio" | "3d_model"): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed (${res.status})`);
    const blob = await res.blob();
    const ext =
      kind === "video"
        ? "mp4"
        : kind === "audio"
          ? "mp3"
          : kind === "3d_model"
            ? "glb"
            : blob.type.includes("png")
              ? "png"
              : blob.type.includes("webp")
                ? "webp"
                : "jpg";
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `renderstudio-${kind}-${Date.now()}.${ext}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noreferrer");
  }
}

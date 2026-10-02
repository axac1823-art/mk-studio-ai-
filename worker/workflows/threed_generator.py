"""Workflow 3D Generator — génère un modèle 3D (GLB).

Entrée : job type "3d_generator" avec input JSON :
- text-to-3D : { prompt, creditCost, model? }
- image-to-3D / multi-view : { imageUrls: {front, back, ...}, creditCost, model? }

Le modèle choisi par l'utilisateur est essayé en premier ; s'il ne supporte
pas le type d'entrée (ex: Trellis ne fait pas de text-to-3D), le workflow
bascule sur les autres candidats configurés.

Sortie : asset type "3d_model", job complete, crédits débités.
"""
import db
import storage
from catalog import MODEL_CATALOG, Candidate
from providers.http_helpers import get_bytes
from workflows.common import complete_job, fail_job, insert_asset, mark_processing
from workflows.engine import AllModelsFailedError, execute_with_fallback


FEATURE = "3d_generator"


def _store_model(url: str) -> str:
    """Télécharge le GLB et retourne un chemin /storage/..."""
    if url.startswith("/storage/"):
        return url
    data, _mime = get_bytes(url)
    return storage.save_file(data, "glb")


def _pick_candidates(candidates: list[Candidate], input_: dict, selected_key: str | None) -> list[Candidate]:
    """Ordonne les candidats : modèle choisi en premier (s'il supporte l'entrée),
    puis les autres candidats compatibles avec texte/image."""
    has_image = bool(input_.get("imageUrls")) or bool(input_.get("imageUrl"))
    has_prompt = bool(input_.get("prompt"))

    def supports_input(c: Candidate) -> bool:
        if has_image and has_prompt:
            return c.supports_image_to_3d or c.supports_text_to_3d
        if has_image:
            return c.supports_image_to_3d
        if has_prompt:
            return c.supports_text_to_3d
        return True

    ordered: list[Candidate] = []
    if selected_key:
        chosen = [c for c in candidates if c.key == selected_key and supports_input(c)]
        ordered.extend(chosen)

    ordered.extend([c for c in candidates if c.key != selected_key and supports_input(c)])
    return ordered or candidates


def run(job: dict) -> None:
    """Exécute un job 3d_generator : prompt/image(s) -> GLB -> stockage."""
    input_ = job["input"]
    with db.connect() as conn:
        mark_processing(conn, job["id"])

    try:
        candidates = MODEL_CATALOG.get(FEATURE, [])
        if not candidates:
            raise AllModelsFailedError(FEATURE, [{"candidateKey": "none", "ok": False, "error": "no 3d provider configured"}])

        selected_key = input_.get("model")
        ordered = _pick_candidates(candidates, input_, selected_key)
        if not ordered:
            raise AllModelsFailedError(FEATURE, [{"candidateKey": "none", "ok": False, "error": "no matching 3d candidate"}])

        outcome = execute_with_fallback(FEATURE, ordered, input_)
        winner = outcome["winner"]
        model_url = outcome["output_urls"][0]
        storage_path = _store_model(model_url)

        with db.connect() as conn:
            asset_id = insert_asset(conn, job, "3d_model", storage_path)
            complete_job(
                conn,
                job,
                asset_id,
                int(input_.get("creditCost") or 0),
                model_used=winner.key,
                provider_cost_cents=winner.cost_per_generation,
            )
    except Exception as err:
        with db.connect() as conn:
            fail_job(conn, job, err)

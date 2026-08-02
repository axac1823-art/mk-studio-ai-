"""Workflow vidéo (animate) — exécute UN job vidéo de bout en bout.

Entrée : la ligne `jobs` (input JSON construit par /web : feature "animate",
imageUrl, quality, aspectRatio, durationSeconds, motionId, sceneDetails,
creditCost). Sortie : UN asset vidéo (mp4 dans storage + ligne en DB), puis
job -> complete (crédits débités, idempotent) ou failed.
"""
import db
from catalog import MODEL_CATALOG
from prompts import build_feature_prompt
from workflows.common import (
    complete_job,
    fail_job,
    insert_asset,
    mark_processing,
    store_output,
)
from workflows.engine import execute_with_fallback, order_candidates


def run(job: dict) -> None:
    """Exécute le job vidéo : prompt serveur -> candidats avec fallback ->
    stockage du mp4 -> asset + completion. Aucune exception ne sort : toute
    erreur termine le job en 'failed' (message générique client)."""
    input_ = job["input"]
    feature = input_["feature"]
    with db.connect() as conn:
        mark_processing(conn, job["id"])
        try:
            req = {**input_, "prompt": build_feature_prompt(feature, input_)}
            candidates = order_candidates(MODEL_CATALOG[feature], input_.get("quality") or "standard")
            outcome = execute_with_fallback(feature, candidates, req)

            result_asset_id = None
            for url in outcome["output_urls"]:
                path, _ext = store_output(url)
                asset_id = insert_asset(conn, job, "video", path)
                result_asset_id = result_asset_id or asset_id

            complete_job(conn, job, result_asset_id, int(input_.get("creditCost") or 0))
        except Exception as err:  # AllModelsFailedError incluse
            fail_job(conn, job, err)

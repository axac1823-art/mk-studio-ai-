"""Workflow vidéo unifié (Video Generator).

Entrée : une ligne `video_jobs` (start/end images, media_references, shots,
duration, aspect_ratio, audio_enabled, model choisi). Le backend détecte le
mode, choisit le provider, génère la vidéo et met à jour la ligne.

Conventions :
- Les tags utilisateurs sont de la forme @img1, @img2, @vid1…
- Le mode est DÉTECTÉ par le serveur (jamais envoyé par le client).
- multi_shot : génération séquentielle des clips, concaténation ffmpeg en dur,
  conservation des entrées/sorties par shot dans `video_jobs.shots`.
"""
from __future__ import annotations

import base64
import json
import logging
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Literal

import db
import storage
from catalog import MODEL_CATALOG, Candidate, filter_candidates_by_mode
from providers.http_helpers import data_uri_to_bytes, get_bytes
from prompts import build_animate_prompt
from workflows.common import (
    complete_video_job,
    fail_video_job,
    insert_video_asset,
    mark_video_processing,
    set_video_progress,
    store_output,
)
from workflows.engine import AllModelsFailedError, execute_with_fallback, order_candidates

log = logging.getLogger("workflows.video")

VideoMode = Literal[
    "text_to_video",
    "image_to_video",
    "start_end_frame",
    "multi_reference",
    "multi_shot",
]

_TAG_RE = re.compile(r"@(?P<type>img|vid)(?P<idx>\d+)")


def _count_tagged_media(prompt: str) -> int:
    """Nombre de tags @imgN / @vidN distincts dans un prompt."""
    return len({_tag_key(m) for m in _TAG_RE.finditer(prompt)})


def _tag_key(match: re.Match) -> str:
    return f"{match.group('type')}{match.group('idx')}"


def _strip_tags(prompt: str) -> str:
    """Supprime les tags @imgN/@vidN du prompt envoyé au provider."""
    return _TAG_RE.sub("", prompt).strip()


def _lookup_media(media_references: list[dict], tag: str) -> dict | None:
    """Retrouve une référence par son tag."""
    for ref in media_references or []:
        if ref.get("tag") == tag:
            return ref
    return None


def _tagged_media_urls(prompt: str, media_references: list[dict]) -> list[str]:
    """URLs des médias référencés par tags dans un prompt, dans l'ordre d'apparition."""
    seen = set()
    urls: list[str] = []
    for match in _TAG_RE.finditer(prompt):
        key = _tag_key(match)
        if key in seen:
            continue
        seen.add(key)
        ref = _lookup_media(media_references, f"@{key}")
        if ref and ref.get("asset_url"):
            urls.append(ref["asset_url"])
    return urls


def resolve_video_mode(input_: dict) -> VideoMode:
    """Détecte le mode à partir des champs utilisateur.

    Règles (priorité décroissante) :
    1. Plus d'un shot -> multi_shot.
    2. Start image ET End image -> start_end_frame.
    3. ≥ 2 médias tagués dans le premier shot -> multi_reference.
    4. Exactement une image (start image ou un tag) -> image_to_video.
    5. Sinon -> text_to_video.
    """
    shots = input_.get("shots") or []
    if len(shots) > 1:
        return "multi_shot"

    start_image = input_.get("start_image_url")
    end_image = input_.get("end_image_url")
    if start_image and end_image:
        return "start_end_frame"

    media_refs = input_.get("media_references") or []
    first_prompt = (shots[0].get("prompt") if shots else "") or ""
    tagged_count = _count_tagged_media(first_prompt)
    if tagged_count >= 2:
        return "multi_reference"

    has_start_image = bool(start_image)
    if has_start_image or tagged_count == 1:
        return "image_to_video"

    return "text_to_video"


def _get_action_costs(conn) -> dict[str, int]:
    rows = conn.execute("SELECT mode, credit_cost FROM video_action_costs").fetchall()
    return {row["mode"]: row["credit_cost"] for row in rows}


def compute_video_cost(conn, mode: VideoMode, shot_count: int) -> int:
    """Coût d'un job vidéo depuis la table de config."""
    costs = _get_action_costs(conn)
    if mode == "multi_shot":
        per_shot = costs.get("multi_shot", 0)
        overhead = costs.get("multi_shot_concat_overhead", 0)
        return per_shot * max(shot_count, 1) + overhead
    return costs.get(mode, 0)


def _public_url(url: str | None) -> str | None:
    """Transforme un chemin /storage/... en URL publique absolue."""
    if not url:
        return None
    if url.startswith("/storage/"):
        return storage.get_url(url)
    return url


def _build_request(job: dict, prompt: str, extra: dict | None = None) -> dict:
    """Construit le dict normalisé passé aux adaptateurs providers."""
    req = {
        "prompt": prompt,
        "imageUrl": _public_url(job.get("start_image_url")),
        "endImageUrl": _public_url(job.get("end_image_url")),
        "referenceUrls": [],
        "durationSeconds": job.get("duration") or 4,
        "aspectRatio": job.get("aspect_ratio") or "16:9",
        "quality": job.get("quality") or "standard",
        "quantity": 1,
        "model": job.get("selected_model"),
    }
    if extra:
        extra = {k: _public_url(v) if isinstance(v, str) else v for k, v in extra.items()}
        if isinstance(extra.get("referenceUrls"), list):
            extra["referenceUrls"] = [_public_url(u) for u in extra["referenceUrls"]]
        req.update(extra)
    return req


def _execute_single_video(
    mode: VideoMode,
    candidates: list[Candidate],
    req: dict,
    adapter_override=None,
) -> tuple[Candidate, list[str]]:
    """Exécute UN appel vidéo (avec fallback) et retourne (winner, urls)."""
    ordered = order_candidates(candidates, req.get("quality") or "standard", req.get("model"))
    if not ordered:
        raise AllModelsFailedError("video", [{"candidateKey": "none", "ok": False, "error": "no matching model for mode"}])

    outcome = execute_with_fallback("video", ordered, req, adapter_override=adapter_override)
    return outcome["winner"], outcome["output_urls"]


def _store_clip(url: str) -> str:
    """Télécharge/stocke un clip et retourne son chemin public (/storage/...)."""
    path, _ext = store_output(url)
    return path


def _ffmpeg_extract_last_frame(video_storage_path: str) -> str:
    """Extrait la dernière image d'un clip stocké et retourne un data URI JPEG."""
    video_path = storage.resolve(video_storage_path)
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        out_path = tmp.name
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-sseof",
                "-0.1",
                "-i",
                str(video_path),
                "-q:v",
                "2",
                "-frames:v",
                "1",
                out_path,
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError as err:
        Path(out_path).unlink(missing_ok=True)
        raise RuntimeError(f"ffmpeg last-frame extraction failed: {err.stderr.decode()}") from err
    data = Path(out_path).read_bytes()
    Path(out_path).unlink(missing_ok=True)
    return f"data:image/jpeg;base64,{base64.b64encode(data).decode()}"


def _concatenate_video_clips(clip_paths: list[str]) -> str:
    """Concatène une liste de clips (chemins /storage/...) en une seule vidéo.

    Retourne le chemin public du fichier final.
    """
    if len(clip_paths) == 1:
        return clip_paths[0]

    abs_paths = [storage.resolve(p) for p in clip_paths]
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as list_file:
        for p in abs_paths:
            list_file.write(f"file '{p.as_posix()}'\n")
        list_path = list_file.name

    out_name = storage.save_file(b"", "mp4")
    out_abs = storage.resolve(out_name)
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                list_path,
                "-c",
                "copy",
                str(out_abs),
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError as err:
        Path(list_path).unlink(missing_ok=True)
        raise RuntimeError(f"ffmpeg concat failed: {err.stderr.decode()}") from err
    Path(list_path).unlink(missing_ok=True)
    return out_name


def _provider_has_last_frame(provider_name: str) -> bool:
    """Indique si le provider expose une fonction d'extraction de dernière frame."""
    from providers import PROVIDERS

    provider = PROVIDERS.get(provider_name)
    return provider is not None and hasattr(provider, "extract_last_frame")


def run_text_to_video(
    job: dict,
    candidates: list[Candidate],
    req: dict,
    adapter_override=None,
) -> tuple[Candidate, list[str]]:
    """text_to_video : appel direct si le provider le supporte, sinon échec
    (pas de générateur d'image de secours dans le catalogue actuel)."""
    filtered = filter_candidates_by_mode(candidates, "text_to_video")
    if not filtered:
        raise AllModelsFailedError("video", [{"candidateKey": "none", "ok": False, "error": "no text_to_video provider"}])
    return _execute_single_video("text_to_video", filtered, req, adapter_override=adapter_override)


def run_image_to_video(
    job: dict,
    candidates: list[Candidate],
    req: dict,
    adapter_override=None,
) -> tuple[Candidate, list[str]]:
    """image_to_video : une image de départ + prompt."""
    filtered = filter_candidates_by_mode(candidates, "image_to_video")
    if not filtered:
        raise AllModelsFailedError("video", [{"candidateKey": "none", "ok": False, "error": "no image_to_video provider"}])
    return _execute_single_video("image_to_video", filtered, req, adapter_override=adapter_override)


def run_start_end_frame(
    job: dict,
    candidates: list[Candidate],
    req: dict,
    adapter_override=None,
) -> tuple[Candidate, list[str]]:
    """start_end_frame : start + end images + prompt optionnel."""
    filtered = filter_candidates_by_mode(candidates, "start_end_frame")
    if not filtered:
        raise AllModelsFailedError("video", [{"candidateKey": "none", "ok": False, "error": "no start_end_frame provider"}])
    return _execute_single_video("start_end_frame", filtered, req, adapter_override=adapter_override)


def run_multi_reference(
    job: dict,
    candidates: list[Candidate],
    req: dict,
    adapter_override=None,
) -> tuple[Candidate, list[str]]:
    """multi_reference : plusieurs images de référence taguées.

    Si aucun provider ne supporte explicitement le multi-reference, on
    retombe sur image_to_video en utilisant la première image taguée comme
    frame de départ (best-effort).
    """
    filtered = filter_candidates_by_mode(candidates, "multi_reference")
    if filtered:
        return _execute_single_video("multi_reference", filtered, req, adapter_override=adapter_override)

    # Fallback best-effort : image_to_video avec la première image taguée.
    first_ref = (req.get("referenceUrls") or [None])[0]
    if not first_ref:
        raise AllModelsFailedError("video", [{"candidateKey": "none", "ok": False, "error": "multi_reference fallback missing reference"}])
    fallback_req = {**req, "imageUrl": first_ref, "referenceUrls": (req.get("referenceUrls") or [])[1:]}
    return _execute_single_video("image_to_video", candidates, fallback_req, adapter_override=adapter_override)


def run_multi_shot(
    job: dict,
    candidates: list[Candidate],
    req: dict,
    adapter_override=None,
) -> tuple[Candidate, list[str]]:
    """multi_shot : un clip par shot, concaténation finale, continuité best-effort."""
    shots = job.get("shots") or []
    if not shots:
        raise ValueError("multi_shot requires at least one shot")

    media_refs = job.get("media_references") or []
    winner: Candidate | None = None
    clip_paths: list[str] = []
    shot_records: list[dict] = []
    last_frame_url: str | None = None

    for idx, shot in enumerate(shots):
        with db.connect() as conn:
            set_video_progress(conn, job["id"], {"current": idx + 1, "total": len(shots)})

        prompt = _strip_tags(shot.get("prompt", ""))
        wrapped = build_animate_prompt(scene_details=prompt)
        tagged_urls = _tagged_media_urls(shot.get("prompt", ""), media_refs)

        # Détermine l'image de départ pour ce shot.
        start_image = job.get("start_image_url")
        if tagged_urls:
            start_image = tagged_urls[0]
        elif last_frame_url and not start_image:
            start_image = last_frame_url

        shot_req = _build_request(job, wrapped, {
            "imageUrl": start_image,
            "endImageUrl": job.get("end_image_url"),
            "referenceUrls": tagged_urls[1:] if len(tagged_urls) > 1 else [],
        })

        # Premier shot : choix du modèle gagnant (ou modèle imposé).
        # Shots suivants : on force le même modèle pour la cohérence.
        if winner is None:
            shot_candidates = filter_candidates_by_mode(candidates, "image_to_video")
            current_winner, urls = _execute_single_video(
                "image_to_video",
                shot_candidates,
                shot_req,
                adapter_override=adapter_override,
            )
            winner = current_winner
        else:
            shot_candidates = order_candidates(candidates, shot_req.get("quality") or "standard", winner.key)
            shot_candidates = [c for c in shot_candidates if c.supports_image_to_video]
            current_winner, urls = _execute_single_video(
                "image_to_video",
                shot_candidates,
                shot_req,
                adapter_override=adapter_override,
            )

        clip_path = _store_clip(urls[0])
        clip_paths.append(clip_path)
        shot_records.append({
            "id": shot.get("id"),
            "prompt": shot.get("prompt"),
            "tagged_media_ids": shot.get("taggedMediaIds") or [],
            "output_clip_url": clip_path,
        })

        # Continuité : extrait la dernière frame si le provider l'expose.
        if _provider_has_last_frame(winner.provider):
            try:
                last_frame_url = _ffmpeg_extract_last_frame(clip_path)
            except Exception:
                last_frame_url = None
        else:
            last_frame_url = None

    with db.connect() as conn:
        conn.execute(
            "UPDATE video_jobs SET shots = %s WHERE id = %s",
            (json.dumps(shot_records), job["id"]),
        )

    final_path = _concatenate_video_clips(clip_paths)
    return winner, [final_path]


def run(job: dict, adapter_override=None) -> None:
    """Point d'entrée unique d'un video_job."""
    with db.connect() as conn:
        mark_video_processing(conn, job["id"])
        mode = resolve_video_mode(job)
        conn.execute("UPDATE video_jobs SET mode = %s WHERE id = %s", (mode, job["id"]))
        credits_charged = compute_video_cost(conn, mode, len(job.get("shots") or []))

    candidates = MODEL_CATALOG.get("animate", [])
    first_prompt = (job.get("shots") or [{}])[0].get("prompt", "")
    prompt = build_animate_prompt(scene_details=_strip_tags(first_prompt))
    req = _build_request(job, prompt, {
        "referenceUrls": _tagged_media_urls(first_prompt, job.get("media_references") or []),
    })
    # Si aucune image de départ n'est fournie mais qu'un média est tagué,
    # on l'utilise comme frame de départ (image_to_video / multi_reference).
    if not req.get("imageUrl") and req.get("referenceUrls"):
        req["imageUrl"] = req["referenceUrls"][0]
        req["referenceUrls"] = req["referenceUrls"][1:]

    try:
        if mode == "text_to_video":
            winner, urls = run_text_to_video(job, candidates, req, adapter_override=adapter_override)
        elif mode == "image_to_video":
            winner, urls = run_image_to_video(job, candidates, req, adapter_override=adapter_override)
        elif mode == "start_end_frame":
            winner, urls = run_start_end_frame(job, candidates, req, adapter_override=adapter_override)
        elif mode == "multi_reference":
            winner, urls = run_multi_reference(job, candidates, req, adapter_override=adapter_override)
        elif mode == "multi_shot":
            winner, urls = run_multi_shot(job, candidates, req, adapter_override=adapter_override)
        else:
            raise ValueError(f"unknown video mode: {mode}")

        final_url = urls[0]
        if mode != "multi_shot":
            final_url = _store_clip(final_url)

        with db.connect() as conn:
            conn.execute(
                "UPDATE video_jobs SET model_used = %s WHERE id = %s",
                (winner.key, job["id"]),
            )
            asset_id = insert_video_asset(conn, job["id"], job["user_id"], job["project_id"], "video", final_url)
            complete_video_job(conn, job, final_url, credits_charged, winner.key)
    except Exception as err:
        with db.connect() as conn:
            fail_video_job(conn, job, err)

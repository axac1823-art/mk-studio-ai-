"""Moteur de fallback partagé par les workflows — port de lib/ai/router.ts.

Deux responsabilités :
- order_candidates : tri par tier de qualité (l'ordre du catalogue reste la
  priorité principale, tri stable) ;
- execute_with_fallback : essaie chaque candidat dans l'ordre jusqu'au
  premier succès — TOUTE erreur provider (timeout, 4xx/5xx, rejet contenu,
  sortie vide) déclenche la bascule sur le suivant, invisible pour
  l'utilisateur. Chaque tentative est tracée pour l'analytics interne.
"""
import time

from catalog import Candidate
from providers import PROVIDERS


class AllModelsFailedError(Exception):
    """Levée quand tous les candidats d'une feature ont échoué : la route
    traduit en message GÉNÉRIQUE côté client (la trace garde le détail)."""

    def __init__(self, feature: str, attempts: list[dict]):
        super().__init__(f'All models failed for feature "{feature}"')
        self.feature = feature
        self.attempts = attempts


def order_candidates(candidates: list[Candidate], quality: str, preferred_key: str | None = None) -> list[Candidate]:
    """Tri : `preferred_key` (réservé aux tests — aucun sélecteur de modèle
    n'est exposé en V1) passe en premier, puis un candidat du tier demandé
    passe devant à priorité égale. Tri stable."""
    indexed = list(enumerate(candidates))

    def rank(item):
        index, candidate = item
        preferred = 0 if (preferred_key and candidate.key == preferred_key) else 1
        tier_match = 0 if quality in candidate.tiers else 1
        return (preferred, tier_match, index)

    return [candidate for _, candidate in sorted(indexed, key=rank)]


def execute_with_fallback(feature: str, candidates: list[Candidate], req: dict, adapter_override=None) -> dict:
    """Essaie les candidats dans l'ordre. Retourne
    {"winner": Candidate, "output_urls": [...], "attempts": [...]} ou lève
    AllModelsFailedError avec la trace complète.

    `adapter_override` (tests uniquement) : callable
    (model_id, input, timeout_ms) -> dict injecté à la place des providers.
    """
    attempts: list[dict] = []

    for candidate in candidates:
        started = time.monotonic()
        try:
            if adapter_override is not None:
                run = adapter_override
            else:
                run = PROVIDERS[candidate.provider].generate
            # Tronque les références au max supporté par le candidat.
            truncated = dict(req)
            if candidate.max_references < len(truncated.get("referenceUrls", [])):
                truncated["referenceUrls"] = truncated["referenceUrls"][: candidate.max_references]
            data = run(candidate.model_id, candidate.build_input(truncated), candidate.timeout_ms)
            output_urls = candidate.extract_output(data)
            if not output_urls:
                raise ValueError("provider returned an empty output")
            attempts.append(
                {"candidateKey": candidate.key, "ok": True, "latencyMs": int((time.monotonic() - started) * 1000)}
            )
            return {"winner": candidate, "output_urls": output_urls, "attempts": attempts}
        except Exception as err:  # noqa: BLE001 — toute erreur = fallback
            # L'erreur réelle reste dans la trace serveur, jamais chez le client.
            attempts.append(
                {
                    "candidateKey": candidate.key,
                    "ok": False,
                    "latencyMs": int((time.monotonic() - started) * 1000),
                    "error": str(err),
                }
            )

    raise AllModelsFailedError(feature, attempts)

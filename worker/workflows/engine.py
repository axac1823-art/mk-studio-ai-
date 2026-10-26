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


def order_candidates(
    candidates: list[Candidate],
    quality: str,
    selected_key: str | None = None,
    *,
    prefer_reference_fidelity: bool = False,
) -> list[Candidate]:
    """Ordonne les candidats.

    - `selected_key` (choix utilisateur) retourne UNIQUEMENT ce candidat
      (pas de fallback silencieux).
    - Mode "Auto" (`selected_key` vide) : sans image de référence, le coût
      reste prioritaire parmi les modèles du tier demandé. Pour Image2 avec
      des références, `prefer_reference_fidelity` place d'abord les adaptateurs
      déclarés les plus adaptés à la conservation de l'identité visuelle ; le
      tier et le coût départagent ensuite les candidats comparables.
    - Les candidats hors tier restent des solutions de repli.
    """
    if selected_key and selected_key != "auto":
        return [c for c in candidates if c.key == selected_key]

    indexed = list(enumerate(candidates))

    def rank(item):
        index, candidate = item
        tier_match = 0 if quality in candidate.tiers else 1
        if prefer_reference_fidelity:
            # Preserve actual submitted objects first; cost only breaks ties
            # between adapters with equivalent declared reference fidelity.
            return (tier_match, -candidate.reference_priority, candidate.cost_per_generation, index)
        # No references: retain the original cost-first Auto behavior.
        return (tier_match, candidate.cost_per_generation, index)

    return [candidate for _, candidate in sorted(indexed, key=rank)]


def execute_with_fallback(
    feature: str,
    candidates: list[Candidate],
    req: dict,
    adapter_override=None,
    output_validator=None,
) -> dict:
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
            reference_count = len(req.get("referenceUrls", []))
            if feature == "text_to_image" and req.get("imageUrl"):
                reference_count += 1
            if reference_count > candidate.max_references:
                raise ValueError(
                    f"candidate accepts {candidate.max_references} reference images; "
                    f"request contains {reference_count}"
                )
            if adapter_override is not None:
                run = adapter_override
            else:
                run = PROVIDERS[candidate.provider].generate
            # Les candidats insuffisants ont été sautés, les tags gardent ainsi leur image exacte.
            candidate_req = dict(req)
            data = run(candidate.model_id, candidate.build_input(candidate_req), candidate.timeout_ms)
            output_urls = candidate.extract_output(data)
            if not output_urls:
                raise ValueError("provider returned an empty output")
            validated_output = output_validator(candidate, output_urls) if output_validator else None
            attempts.append(
                {"candidateKey": candidate.key, "ok": True, "latencyMs": int((time.monotonic() - started) * 1000)}
            )
            return {
                "winner": candidate,
                "output_urls": output_urls,
                "attempts": attempts,
                "validated_output": validated_output,
            }
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

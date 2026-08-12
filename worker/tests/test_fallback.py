"""Simulation hors-ligne du moteur de fallback — port de scripts/simulate-fallback.ts.

    cd worker && ./.venv/Scripts/python -m tests.test_fallback

Couvre : ordre des tentatives, fallback après erreurs, normalisation de la
sortie, échec global (AllModelsFailedError), tri par tier de qualité,
troncature des références, sortie vide = échec.
"""
from catalog import Candidate
from workflows.engine import AllModelsFailedError, execute_with_fallback, order_candidates

failures = 0


def check(condition: bool, label: str) -> None:
    global failures
    if condition:
        print(f"  PASS  {label}")
    else:
        failures += 1
        print(f"  FAIL  {label}")


def fake_candidate(key: str, **overrides) -> Candidate:
    """Fabrique un candidat factice. build_input propage les références
    pour pouvoir vérifier la troncature."""
    defaults = {
        "name": key,
        "description": f"fake model {key}",
        "provider": "bfl",
        "model_id": f"fake/{key}",
        "cost_weight": 1,
        "cost_per_generation": 5,
        "max_references": 99,
        "timeout_ms": 1000,
        "tiers": ("standard", "pro"),
        "build_input": lambda req: {"prompt": req["prompt"], "refs": req.get("referenceUrls", [])},
        "extract_output": lambda data: data.get("urls") if isinstance(data.get("urls"), list) else [],
    }
    defaults.update(overrides)
    return Candidate(key=key, **defaults)


def fake_adapter(failing_keys: list[str], calls: list[str]):
    """Adaptateur factice : échoue pour les clés listées, réussit sinon et
    enregistre l'ordre des appels."""

    def run(model_id, _input, _timeout_ms):
        calls.append(model_id)
        if any(model_id.endswith(key) for key in failing_keys):
            raise RuntimeError("simulated provider failure")
        return {"urls": [f"https://example.test/{model_id.split('/')[-1]}.jpg"]}

    return run


def base_request(**overrides) -> dict:
    req = {
        "feature": "print_render",
        "imageUrl": "data:image/png;base64,x",
        "referenceUrls": ["ref-1", "ref-2", "ref-3"],
        "prompt": "test prompt",
        "quality": "standard",
        "aspectRatio": "1:1",
        "resolution": "1K",
        "quantity": 1,
    }
    req.update(overrides)
    return req


def main() -> None:
    print("\n[1] Fallback : A et B échouent, C sert la génération")
    calls: list[str] = []
    candidates = [fake_candidate("a"), fake_candidate("b"), fake_candidate("c")]
    outcome = execute_with_fallback("print_render", candidates, base_request(), fake_adapter(["a", "b"], calls))
    check(",".join(calls) == "fake/a,fake/b,fake/c", "tentatives dans l'ordre a, b, c")
    check(outcome["winner"].key == "c", "le gagnant est c")
    check(outcome["output_urls"][0] == "https://example.test/c.jpg", "sortie normalisée (URL)")
    check(len(outcome["attempts"]) == 3, "3 tentatives tracées")
    check(outcome["attempts"][0]["ok"] is False and bool(outcome["attempts"][0].get("error")), "erreur réelle tracée côté serveur")
    check(all(a["latencyMs"] >= 0 for a in outcome["attempts"]), "latences enregistrées")

    print("\n[2] Tous les candidats échouent -> AllModelsFailedError")
    calls = []
    thrown = None
    try:
        execute_with_fallback("print_render", [fake_candidate("a"), fake_candidate("b")], base_request(), fake_adapter(["a", "b"], calls))
    except AllModelsFailedError as err:
        thrown = err
    check(isinstance(thrown, AllModelsFailedError), "lève AllModelsFailedError")
    check(thrown is not None and len(thrown.attempts) == 2, "la trace des 2 tentatives est jointe")

    print("\n[3] Tri par tier : un candidat 'pro' passe devant pour quality=pro")
    standard = fake_candidate("standard-first", tiers=("standard",))
    pro = fake_candidate("pro-second", tiers=("pro",))
    ordered = order_candidates([standard, pro], "pro")
    check(ordered[0].key == "pro-second", "le candidat pro est essayé en premier")
    ordered_standard = order_candidates([standard, pro], "standard")
    check(ordered_standard[0].key == "standard-first", "l'ordre config est conservé pour standard")

    print("\n[4] Tri Auto : le moins cher satisfaisant le tier est choisi en premier")
    cheap_standard = fake_candidate("cheap-std", tiers=("standard",), cost_per_generation=1)
    expensive_standard = fake_candidate("expensive-std", tiers=("standard",), cost_per_generation=10)
    cheap_pro = fake_candidate("cheap-pro", tiers=("pro",), cost_per_generation=2)
    ordered_auto_pro = order_candidates([cheap_standard, expensive_standard, cheap_pro], "pro")
    check(ordered_auto_pro[0].key == "cheap-pro", "Auto qualité pro choisit le moins cher du tier pro")
    ordered_auto_std = order_candidates([cheap_standard, expensive_standard, cheap_pro], "standard")
    check(ordered_auto_std[0].key == "cheap-std", "Auto qualité standard choisit le moins cher du tier standard")
    check(ordered_auto_std[-1].key == "cheap-pro", "les candidats hors tier arrivent en dernier")

    print("\n[5] Références tronquées au max supporté par le candidat")
    calls = []
    seen_refs: list = []

    def build_input_spy(req):
        seen_refs.extend(req.get("referenceUrls", []))
        return {}

    limited = fake_candidate("limited", max_references=1, build_input=build_input_spy)
    execute_with_fallback("print_render", [limited], base_request(), fake_adapter([], calls))
    check(len(seen_refs) == 1 and seen_refs[0] == "ref-1", "3 références fournies -> 1 seule passée au modèle")

    print("\n[6] Sortie vide du fournisseur = échec -> fallback")
    calls = []
    empty = fake_candidate("empty", extract_output=lambda _data: [])
    ok = fake_candidate("ok")
    outcome = execute_with_fallback("print_render", [empty, ok], base_request(), fake_adapter([], calls))
    check(outcome["winner"].key == "ok", "sortie vide traitée comme un échec, b sert")

    print("\n[7] Clé préférée (choix utilisateur) : uniquement ce candidat, pas de fallback silencieux")
    candidates = [fake_candidate("a"), fake_candidate("b"), fake_candidate("c")]
    ordered = order_candidates(candidates, "standard", "b")
    check(len(ordered) == 1 and ordered[0].key == "b", "seul le candidat choisi est retenu")
    unchanged = order_candidates(candidates, "standard", "inconnu")
    check(len(unchanged) == 0, "une clé inconnue retourne une liste vide (échec explicite)")
    tier_ordered = order_candidates(
        [fake_candidate("pro-first", tiers=("pro",)), fake_candidate("std-second")], "pro", "std-second"
    )
    check(len(tier_ordered) == 1 and tier_ordered[0].key == "std-second", "la clé choisie prime sur le tier")

    print("\n[8] Choix utilisateur = échec du candidat unique -> AllModelsFailedError")
    calls = []
    thrown = None
    try:
        selected = [fake_candidate("x", max_references=1)]
        execute_with_fallback("print_render", selected, base_request(), fake_adapter(["x"], calls))
    except AllModelsFailedError as err:
        thrown = err
    check(isinstance(thrown, AllModelsFailedError), "échec du modèle choisi lève AllModelsFailedError")
    check(thrown is not None and len(thrown.attempts) == 1, "une seule tentative tracée")

    print("\nTous les tests passent.\n" if failures == 0 else f"\n{failures} test(s) en échec.\n")
    raise SystemExit(0 if failures == 0 else 1)


if __name__ == "__main__":
    main()

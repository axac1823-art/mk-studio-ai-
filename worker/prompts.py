"""Templates de prompt — port de lib/ai/prompt-templates.ts.

Règle non négociable : tout le prompt engineering vit ici. Le texte libre
de l'utilisateur ("scene details") est TOUJOURS enveloppé dans ces
templates, jamais envoyé brut au modèle. Itérer sur la qualité = modifier
ce fichier (et bumper la version), sans toucher au frontend.
"""

PROMPT_TEMPLATES_VERSION = "2026-07-30.v2"

# --- Fragments internes par preset (jamais affichés tels quels) ---

SCENE_TYPE_FRAGMENTS = {
    "commercial_exterior": "commercial building exterior, urban façade, street-level architectural photography, city context, professional presentation",
    "interior": "interior space, indoor environment, carefully staged furniture and décor, balanced indoor lighting",
    "residential_exterior": "residential home exterior, garden and landscaping, welcoming curb appeal, neighborhood context",
}

MATERIAL_FRAGMENTS = {
    "oak": "light oak wood flooring and joinery",
    "marble": "polished marble surfaces with subtle veining",
    "concrete": "board-formed raw concrete surfaces",
    "brick": "warm exposed brick walls",
    "steel_glass": "black steel frames and floor-to-ceiling glass",
    "textile": "soft natural textiles, linen and wool textures",
}

LIGHTING_FRAGMENTS = {
    "daylight": "bright natural daylight, soft shadows",
    "golden_hour": "golden hour lighting, warm sunset glow, long soft shadows",
    "overcast": "overcast daylight, soft diffused light, neutral color grading",
    "night": "night scene, interior lights on, blue hour sky",
}

MOTION_FRAGMENTS = {
    "push_in": "slow cinematic camera push-in towards the building",
    "orbit": "smooth orbital camera movement around the subject",
    "pan": "slow lateral camera pan across the scene",
    "tilt_up": "gentle upward camera tilt revealing the full height",
    "dolly": "slow lateral dolly shot, architectural walkthrough feel",
}

# Mood Shift : la géométrie et la composition sont figées — SEULE
# l'ambiance change (jour/nuit/saison/météo).
MOOD_FRAGMENTS = {
    "daylight": "bright midday daylight, clear sky, crisp natural shadows",
    "golden_hour": "golden hour lighting, warm sunset glow, long soft shadows",
    "night": "night scene, interior and exterior lights on, blue hour sky",
    "overcast": "overcast daylight, soft diffused light, neutral color grading",
    "rain": "rainy weather, wet ground and surfaces with reflections, moody overcast sky",
    "snow": "winter scene, snow on roofs and ground, cold pale light",
}

# Plan to Render : orientation du rendu depuis un plan 2D.
PLAN_RENDER_FRAGMENTS = {
    "furnished_interior": "photorealistic 3D interior render generated from this 2D technical floor plan, furnished and professionally staged, wide perspective view, consistent room proportions",
    "landscaped_exterior": "photorealistic 3D exterior render generated from this 2D technical plan, landscaped garden and surroundings, plausible façade materials, street context",
}

# Multi-Angle : même scène, SEUL le point de vue change (best-effort).
ANGLE_FRAGMENTS = {
    "eye_level": "same scene from an eye-level pedestrian viewpoint",
    "high_angle": "same scene from an elevated high-angle viewpoint",
    "aerial": "same scene from an aerial top-down drone viewpoint",
    "corner_view": "same scene from a corner viewpoint showing two façades",
    "close_up": "same scene with a closer framing on the main subject",
}


def _fragment(table: dict, preset_id: str | None) -> str | None:
    return table.get(preset_id) if preset_id else None


def _sanitize_scene_details(scene_details: str | None) -> str | None:
    """Enveloppe le texte libre utilisateur : borné et neutralisé."""
    trimmed = (scene_details or "").strip()
    return trimmed[:10_000] if trimmed else None


def _join(parts: list[str | None]) -> str:
    return ", ".join(part for part in parts if part)


def build_print_render_prompt(scene_details=None, scene_type_id=None, material_id=None, lighting_id=None) -> str:
    """Fonction 1 — Screenshot-to-Render."""
    return _join(
        [
            "photorealistic architectural render, preserve exact geometry and proportions of the input image",
            _fragment(SCENE_TYPE_FRAGMENTS, scene_type_id),
            _fragment(MATERIAL_FRAGMENTS, material_id),
            _fragment(LIGHTING_FRAGMENTS, lighting_id),
            _sanitize_scene_details(scene_details),
        ]
    )


def build_mood_swap_prompt(mood_id=None, scene_details=None) -> str:
    """Fonction 2 — Mood Shift : MÊME scène, seule l'ambiance varie."""
    return _join(
        [
            "same architectural scene as the input image, preserve exact geometry, composition and materials — change only the atmosphere",
            _fragment(MOOD_FRAGMENTS, mood_id) or MOOD_FRAGMENTS["daylight"],
            _sanitize_scene_details(scene_details),
        ]
    )


def build_exterior_to_interior_prompt(scene_details=None) -> str:
    """Fonction 3 — Exterior -> Interior (pas de preset en V1)."""
    return _join(
        [
            "plausible interior view of the same building, coherent with the exterior architecture, style and materials visible in the input image, professionally staged interior, natural light consistent with the façade openings, photorealistic",
            _sanitize_scene_details(scene_details),
        ]
    )


def build_plan_to_render_prompt(plan_style_id=None, scene_details=None) -> str:
    """Fonction 4 — Plan technique 2D -> rendu meublé/paysagé."""
    return _join(
        [
            "transform this 2D technical plan into a photorealistic architectural render, accurate to the plan layout",
            _fragment(PLAN_RENDER_FRAGMENTS, plan_style_id) or PLAN_RENDER_FRAGMENTS["furnished_interior"],
            _sanitize_scene_details(scene_details),
        ]
    )


def build_multi_angle_prompt(angle_id=None, scene_details=None) -> str:
    """Fonction 6 — Multi-Angle : cohérence best-effort (pas de garantie)."""
    return _join(
        [
            _fragment(ANGLE_FRAGMENTS, angle_id) or ANGLE_FRAGMENTS["eye_level"],
            "preserve the architecture, geometry, materials, lighting and environment of the input image — only the camera viewpoint changes, photorealistic",
            _sanitize_scene_details(scene_details),
        ]
    )


def build_animate_prompt(scene_details=None, motion_id=None) -> str:
    """Fonction 5 — Animate : mouvement de caméra simple, sans narration."""
    return _join(
        [
            "cinematic architectural video, photorealistic, smooth camera motion, preserve the building geometry",
            _fragment(MOTION_FRAGMENTS, motion_id) or MOTION_FRAGMENTS["push_in"],
            _sanitize_scene_details(scene_details),
        ]
    )


def build_feature_prompt(feature: str, fields: dict) -> str:
    """Dispatch par feature — l'`option_id` générique porte le preset de la
    fonction (mood_id, plan_style_id ou angle_id)."""
    option_id = fields.get("optionId")
    details = fields.get("sceneDetails")
    if feature == "animate":
        return build_animate_prompt(scene_details=details, motion_id=fields.get("motionId"))
    if feature == "mood_swap":
        return build_mood_swap_prompt(mood_id=option_id, scene_details=details)
    if feature == "exterior_to_interior":
        return build_exterior_to_interior_prompt(scene_details=details)
    if feature == "plan_to_render":
        return build_plan_to_render_prompt(plan_style_id=option_id, scene_details=details)
    if feature == "multi_angle":
        return build_multi_angle_prompt(angle_id=option_id, scene_details=details)
    return build_print_render_prompt(
        scene_details=details,
        scene_type_id=fields.get("sceneTypeId"),
        material_id=fields.get("materialId"),
        lighting_id=fields.get("lightingId"),
    )

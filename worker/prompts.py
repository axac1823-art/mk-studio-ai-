# """Templates de prompt — port de lib/ai/prompt-templates.ts.

# Règle non négociable : tout le prompt engineering vit ici. Le texte libre
# de l'utilisateur ("scene details") est TOUJOURS enveloppé dans ces
# templates, jamais envoyé brut au modèle. Itérer sur la qualité = modifier
# ce fichier (et bumper la version), sans toucher au frontend.
# """

# PROMPT_TEMPLATES_VERSION = "2026-07-30.v2"

# # --- Fragments internes par preset (jamais affichés tels quels) ---

# SCENE_TYPE_FRAGMENTS = {
#     "commercial_exterior": "commercial building exterior, urban façade, street-level architectural photography, city context, professional presentation",
#     "interior": "interior space, indoor environment, carefully staged furniture and décor, balanced indoor lighting",
#     "residential_exterior": "residential home exterior, garden and landscaping, welcoming curb appeal, neighborhood context",
# }

# MATERIAL_FRAGMENTS = {
#     "oak": "light oak wood flooring and joinery",
#     "marble": "polished marble surfaces with subtle veining",
#     "concrete": "board-formed raw concrete surfaces",
#     "brick": "warm exposed brick walls",
#     "steel_glass": "black steel frames and floor-to-ceiling glass",
#     "textile": "soft natural textiles, linen and wool textures",
# }

# LIGHTING_FRAGMENTS = {
#     "daylight": "bright natural daylight, soft shadows",
#     "golden_hour": "golden hour lighting, warm sunset glow, long soft shadows",
#     "overcast": "overcast daylight, soft diffused light, neutral color grading",
#     "night": "night scene, interior lights on, blue hour sky",
# }

# # Mood Shift : la géométrie et la composition sont figées — SEULE
# # l'ambiance change (jour/nuit/saison/météo).
# MOOD_FRAGMENTS = {
#     "daylight": "bright midday daylight, clear sky, crisp natural shadows",
#     "golden_hour": "golden hour lighting, warm sunset glow, long soft shadows",
#     "night": "night scene, interior and exterior lights on, blue hour sky",
#     "overcast": "overcast daylight, soft diffused light, neutral color grading",
#     "rain": "rainy weather, wet ground and surfaces with reflections, moody overcast sky",
#     "snow": "winter scene, snow on roofs and ground, cold pale light",
# }

# # Plan to Render : orientation du rendu depuis un plan 2D.
# PLAN_RENDER_FRAGMENTS = {
#     "furnished_interior": "photorealistic 3D interior render generated from this 2D technical floor plan, furnished and professionally staged, wide perspective view, consistent room proportions",
#     "landscaped_exterior": "photorealistic 3D exterior render generated from this 2D technical plan, landscaped garden and surroundings, plausible façade materials, street context",
# }

# # Multi-Angle : même scène, SEUL le point de vue change (best-effort).
# ANGLE_FRAGMENTS = {
#     "eye_level": "same scene from an eye-level pedestrian viewpoint",
#     "high_angle": "same scene from an elevated high-angle viewpoint",
#     "aerial": "same scene from an aerial top-down drone viewpoint",
#     "corner_view": "same scene from a corner viewpoint showing two façades",
#     "close_up": "same scene with a closer framing on the main subject",
# }


# def _fragment(table: dict, preset_id: str | None) -> str | None:
#     return table.get(preset_id) if preset_id else None


# def _sanitize_scene_details(scene_details: str | None) -> str | None:
#     """Enveloppe le texte libre utilisateur : borné et neutralisé."""
#     trimmed = (scene_details or "").strip()
#     return trimmed[:10_000] if trimmed else None


# def _join(parts: list[str | None]) -> str:
#     return ", ".join(part for part in parts if part)


# def build_print_render_prompt(scene_details=None, scene_type_id=None, material_id=None, lighting_id=None) -> str:
#     """Fonction 1 — Screenshot-to-Render."""
#     return _join(
#         [
#             "photorealistic architectural render, preserve exact geometry and proportions of the input image",
#             _fragment(SCENE_TYPE_FRAGMENTS, scene_type_id),
#             _fragment(MATERIAL_FRAGMENTS, material_id),
#             _fragment(LIGHTING_FRAGMENTS, lighting_id),
#             _sanitize_scene_details(scene_details),
#         ]
#     )


# def build_mood_swap_prompt(mood_id=None, scene_details=None) -> str:
#     """Fonction 2 — Mood Shift : MÊME scène, seule l'ambiance varie."""
#     return _join(
#         [
#             "same architectural scene as the input image, preserve exact geometry, composition and materials — change only the atmosphere",
#             _fragment(MOOD_FRAGMENTS, mood_id) or MOOD_FRAGMENTS["daylight"],
#             _sanitize_scene_details(scene_details),
#         ]
#     )


# def build_exterior_to_interior_prompt(scene_details=None) -> str:
#     """Fonction 3 — Exterior -> Interior (pas de preset en V1)."""
#     return _join(
#         [
#             "plausible interior view of the same building, coherent with the exterior architecture, style and materials visible in the input image, professionally staged interior, natural light consistent with the façade openings, photorealistic",
#             _sanitize_scene_details(scene_details),
#         ]
#     )


# def build_plan_to_render_prompt(plan_style_id=None, scene_details=None) -> str:
#     """Fonction 4 — Plan technique 2D -> rendu meublé/paysagé."""
#     return _join(
#         [
#             "transform this 2D technical plan into a photorealistic architectural render, accurate to the plan layout",
#             _fragment(PLAN_RENDER_FRAGMENTS, plan_style_id) or PLAN_RENDER_FRAGMENTS["furnished_interior"],
#             _sanitize_scene_details(scene_details),
#         ]
#     )


# def build_multi_angle_prompt(angle_id=None, scene_details=None) -> str:
#     """Fonction 6 — Multi-Angle : cohérence best-effort (pas de garantie)."""
#     return _join(
#         [
#             _fragment(ANGLE_FRAGMENTS, angle_id) or ANGLE_FRAGMENTS["eye_level"],
#             "preserve the architecture, geometry, materials, lighting and environment of the input image — only the camera viewpoint changes, photorealistic",
#             _sanitize_scene_details(scene_details),
#         ]
#     )


# def build_animate_prompt(scene_details=None, motion_prompt=None) -> str:
#     """Fonction 5 — Animate : le mouvement est décrit en texte libre par
#     l'utilisateur (pas de preset). Si vide, on applique un mouvement par
#     défaut raisonnable."""
#     motion = (motion_prompt or "").strip() or "smooth cinematic camera motion"
#     return _join(
#         [
#             "cinematic architectural video, photorealistic, preserve the building geometry",
#             motion,
#             _sanitize_scene_details(scene_details),
#         ]
#     )


# def build_video_to_video_prompt(scene_details=None) -> str:
#     """Fonction 5b — Modify Video : transforme une vidéo existante tout en
#     préservant le sujet architectural, la géométrie et le mouvement de caméra."""
#     return _join(
#         [
#             "modify this existing architectural video according to the following description, preserve the original subject, geometry and camera motion",
#             _sanitize_scene_details(scene_details),
#         ]
#     )


# def build_video_relight_prompt(scene_details=None) -> str:
#     """Fonction 5c — Video Relight : change l'éclairage / l'heure du jour
#     d'une vidéo existante sans toucher à la géométrie."""
#     return _join(
#         [
#             "change the lighting and time of day of this architectural video while preserving the original subject, geometry and camera motion",
#             _sanitize_scene_details(scene_details),
#         ]
#     )


# def build_image_extender_prompt(direction=None, target_ratio=None, scene_details=None) -> str:
#     """Image Extender — outpaint : étend le canvas dans la direction demandée
#     en préservant le sujet original."""
#     direction = direction or "center"
#     ratio = target_ratio or "original"
#     return _join(
#         [
#             f"extend the canvas of the image toward the {direction}, keep the original subject and architecture intact",
#             f"target aspect ratio {ratio}, fill the new area with content perfectly consistent with the original style, lighting, materials and surroundings",
#             "seamless outpaint, photorealistic architectural image, no distortion of existing elements",
#             _sanitize_scene_details(scene_details),
#         ]
#     )


# def build_variations_prompt(scene_details=None) -> str:
#     """Variations — alternate versions with similar composition/style."""
#     return _join(
#         [
#             "create a visual variation of this architectural image, keep the same overall composition, perspective, subject and style",
#             "change subtle visual details: materials, lighting, atmosphere, landscape or small design elements while preserving geometry and camera angle",
#             "photorealistic architectural render, consistent with the original",
#             _sanitize_scene_details(scene_details),
#         ]
#     )


# def build_background_remover_prompt() -> str:
#     """Instructions serveur d'isolation, envoyées aux modèles qui acceptent un prompt."""
#     return """Remove the entire background from this image with professional graphic-design precision.

# STRICT REQUIREMENTS:

# - Completely remove the background and make it fully transparent.
# - Keep the main subject/object 100% intact and unchanged.
# - Do NOT modify, redesign, retouch, reshape, resize, or alter the subject.
# - Preserve the exact original proportions, geometry, colors, textures, materials, reflections, highlights, shadows, and fine details.
# - Precisely detect and preserve all edges, including thin, small, complex, or irregular details.
# - Remove all unwanted background pixels, halos, color contamination, reflections from the background, and edge artifacts.
# - Do not leave any white, gray, black, colored, or semi-transparent background around the subject.
# - Carefully refine the edges at pixel level for a clean professional cutout.
# - Preserve hair, thin lines, transparent areas, small details, corners, curves, and delicate edges if present.
# - Do not create artificial edges or remove legitimate parts of the subject.
# - Do not add any new objects, decorations, shadows, lighting, or effects.
# - Do not change the camera angle, perspective, composition, or subject position.
# - Do not crop the subject.
# - Keep the complete subject visible from edge to edge.

# OUTPUT:

# - Transparent PNG with a true alpha channel.
# - No background whatsoever.
# - No artificial shadow unless it is an original part of the subject.
# - Clean, natural, professional edges suitable for high-end commercial graphic design, advertising, architecture, e-commerce, and professional presentation layouts.

# The final result must look like it was manually isolated by an expert Photoshop designer using precise professional masking techniques."""


# def build_text_to_image_prompt(scene_details=None) -> str:
#     """Image Generator (standalone) : text-to-image architectural."""
#     return _join(
#         [
#             "photorealistic architectural render, high detail, professional archviz presentation",
#             _sanitize_scene_details(scene_details),
#         ]
#     )


# def build_feature_prompt(feature: str, fields: dict) -> str:
#     """Dispatch par feature — l'`option_id` générique porte le preset de la
#     fonction (mood_id, plan_style_id, angle_id, direction...)."""
#     option_id = fields.get("optionId")
#     details = fields.get("sceneDetails")
#     if feature == "animate":
#         return build_animate_prompt(scene_details=details, motion_prompt=fields.get("motionPrompt"))
#     if feature == "mood_swap":
#         return build_mood_swap_prompt(mood_id=option_id, scene_details=details)
#     if feature == "exterior_to_interior":
#         return build_exterior_to_interior_prompt(scene_details=details)
#     if feature == "plan_to_render":
#         return build_plan_to_render_prompt(plan_style_id=option_id, scene_details=details)
#     if feature == "multi_angle":
#         return build_multi_angle_prompt(angle_id=option_id, scene_details=details)
#     if feature == "image_extender":
#         return build_image_extender_prompt(
#             direction=option_id,
#             target_ratio=fields.get("aspectRatio"),
#             scene_details=details,
#         )
#     if feature == "variations":
#         return build_variations_prompt(scene_details=details)
#     if feature == "background_remover":
#         return build_background_remover_prompt()
#     if feature == "text_to_image":
#         return build_text_to_image_prompt(scene_details=details)
#     return build_print_render_prompt(
#         scene_details=details,
#         scene_type_id=fields.get("sceneTypeId"),
#         material_id=fields.get("materialId"),
#         lighting_id=fields.get("lightingId"),
#     )
"""Templates de prompts — version professionnelle pour l'API d'images/vidéos.

Règle non négociable : tout le prompt engineering vit ici. Le texte libre
fourni par l'utilisateur ("scene details") est TOUJOURS encadré par ces
templates et n'est jamais envoyé brut au modèle.

Objectifs des prompts :
- priorité absolue à la fidélité architecturale et à la géométrie source ;
- instructions hiérarchisées et non ambiguës ;
- rendu archviz photoréaliste, crédible et techniquement cohérent ;
- contrôle explicite de la caméra, de la lumière, des matériaux et du contexte ;
- réduction des dérives : pas de redesign, pas de déplacement arbitraire,
  pas d'éléments inventés lorsque la tâche demande une conservation.
"""

PROMPT_TEMPLATES_VERSION = "2026-09-23.v3-professional"

# --- Fragments internes par preset (jamais affichés tels quels) ---

SCENE_TYPE_FRAGMENTS = {
    "commercial_exterior": (
        "professional commercial architectural exterior visualization, urban context, "
        "street-level architectural photography language, realistic pedestrian scale, "
        "refined façade composition, credible storefronts and entrances, disciplined landscaping"
    ),
    "interior": (
        "high-end architectural interior visualization, fully resolved spatial composition, "
        "professionally staged furniture and décor, realistic circulation and scale, "
        "balanced natural and artificial illumination, sophisticated material detailing"
    ),
    "residential_exterior": (
        "high-end residential architectural exterior visualization, coherent garden and "
        "landscape design, realistic site grading, believable entry sequence, refined curb appeal, "
        "contextually appropriate surrounding buildings and vegetation"
    ),
}

MATERIAL_FRAGMENTS = {
    "oak": (
        "natural light-oak timber flooring and joinery, authentic wood grain, "
        "subtle variation, realistic roughness and edge detailing"
    ),
    "marble": (
        "premium polished marble surfaces with restrained natural veining, "
        "physically plausible reflections, realistic micro-texture and polished edges"
    ),
    "concrete": (
        "board-formed architectural concrete, authentic formwork rhythm, "
        "subtle tonal variation, realistic pores, joints and surface imperfections"
    ),
    "brick": (
        "warm exposed brick masonry, individually readable brick modules, "
        "natural mortar joints, restrained color variation and realistic weathering"
    ),
    "steel_glass": (
        "slim matte-black steel framing with high-quality floor-to-ceiling glazing, "
        "realistic glass transparency, controlled reflections and accurate frame proportions"
    ),
    "textile": (
        "premium natural textiles such as linen and wool, realistic weave scale, "
        "soft folds, believable tension and physically plausible light response"
    ),
}

LIGHTING_FRAGMENTS = {
    "daylight": (
        "clear natural daylight with balanced exposure, soft directional shadows, "
        "neutral-to-warm architectural color response and realistic bounce light"
    ),
    "golden_hour": (
        "late golden-hour sunlight, warm low-angle illumination, long soft shadows, "
        "subtle atmospheric depth and controlled warm highlights without clipping"
    ),
    "overcast": (
        "bright overcast daylight, broad diffuse illumination, soft contact shadows, "
        "neutral white balance and restrained contrast suitable for architectural documentation"
    ),
    "night": (
        "refined architectural night scene, interior and exterior luminaires active, "
        "deep blue-hour ambient sky, realistic warm/cool light balance and controlled highlights"
    ),
}

# Mood Shift : la géométrie, le cadrage et les matériaux sont verrouillés —
# seule l'ambiance demandée est modifiée.
MOOD_FRAGMENTS = {
    "daylight": (
        "bright daytime atmosphere, clean sky, realistic solar illumination, "
        "crisp but natural shadows and faithful neutral material colors"
    ),
    "golden_hour": (
        "cinematic golden-hour atmosphere, low warm sunlight, long soft shadows, "
        "subtle warm reflections and realistic dusk transition"
    ),
    "night": (
        "sophisticated night atmosphere, blue-hour ambient sky, warm architectural lighting, "
        "realistic luminance hierarchy and restrained specular highlights"
    ),
    "overcast": (
        "soft overcast atmosphere, diffused sky illumination, low-contrast shadows, "
        "neutral color grading and realistic wet-or-dry surface response as applicable"
    ),
    "rain": (
        "realistic rainy weather, wet architectural surfaces and pavement, subtle reflections, "
        "soft overcast sky, fine atmospheric moisture and physically plausible water behavior"
    ),
    "snow": (
        "realistic winter atmosphere with natural snow accumulation on exposed surfaces, "
        "cold diffuse daylight, softened contrast and physically plausible contact shadows"
    ),
}

# Plan to Render : orientation du rendu depuis un plan 2D.
PLAN_RENDER_FRAGMENTS = {
    "furnished_interior": (
        "convert the provided 2D technical floor plan into a coherent photorealistic 3D interior, "
        "strictly respecting the plan's room boundaries, openings, circulation paths, proportions "
        "and relative adjacencies; furnish the spaces at realistic human scale with professionally "
        "selected contemporary furniture and décor"
    ),
    "landscaped_exterior": (
        "convert the provided 2D technical site/floor plan into a coherent photorealistic 3D exterior, "
        "strictly respecting the drawn building footprint, access points, terraces, setbacks and major "
        "site relationships; develop plausible landscaping, façade materials and immediate context without "
        "altering the underlying plan geometry"
    ),
}

# Multi-Angle : même scène, SEUL le point de vue change (best-effort).
ANGLE_FRAGMENTS = {
    "eye_level": (
        "same architectural scene viewed from a natural human eye-level camera, "
        "approximately 1.5–1.7 m above finished floor/ground, with realistic architectural perspective"
    ),
    "high_angle": (
        "same architectural scene from a controlled elevated viewpoint, revealing rooflines, "
        "site organization and spatial relationships while maintaining correct perspective"
    ),
    "aerial": (
        "same architectural scene from an aerial drone viewpoint, clearly legible site context, "
        "roof geometry and circulation, with realistic top-down perspective rather than a flat diagram"
    ),
    "corner_view": (
        "same architectural scene from a three-quarter corner viewpoint, clearly revealing two principal "
        "façades, their junction and the surrounding site context with consistent geometry"
    ),
    "close_up": (
        "same architectural scene with a tighter professional framing on the principal architectural subject, "
        "retaining recognizable context, scale and exact design language"
    ),
}


def _fragment(table: dict, preset_id: str | None) -> str | None:
    return table.get(preset_id) if preset_id else None


def _sanitize_scene_details(scene_details: str | None) -> str | None:
    """Encadre le texte libre utilisateur et évite les entrées excessivement longues."""
    trimmed = (scene_details or "").strip()
    return trimmed[:10_000] if trimmed else None


def _join(parts: list[str | None]) -> str:
    return ", ".join(part for part in parts if part)


def add_image_reference_map(prompt: str, fields: dict) -> str:
    """Describe independent visual inputs without assigning Style the subject role."""
    references = fields.get("referenceUrls") or []
    tags = fields.get("referenceTags") or [f"@img{index + 1}" for index in range(len(references))]
    has_style = bool(fields.get("styleReferenceUrl"))
    if not references and not has_style:
        return prompt

    lines: list[str] = []
    if has_style:
        lines.append(
            "The separate Style/Filter image is input image 1 and is named @style. It is an aesthetic reference only, "
            "not the subject image and not a composition to copy. Match its actual visual signature faithfully: overall "
            "luminance, exposure, highlight roll-off, shadow depth, contrast curve, saturation, palette, color temperature, "
            "texture character, material response, grain, edge treatment and rendering medium."
        )
    for index, tag in enumerate(tags[:len(references)]):
        provider_index = index + (2 if has_style else 1)
        lines.append(
            f"{tag} is content/reference image {provider_index}; use its subject or details only as directed by the user's prompt."
        )

    if fields.get("feature") == "text_to_image" and has_style:
        guidance = (
            "HIGHEST-PRIORITY STYLE TRANSFER: @style must control the final image's visual treatment. Keep the requested subject, "
            "objects and scene from the written prompt and @img content references, but make the result look as though it was "
            "created with the same art direction as @style. Do not copy @style's subject, objects, architecture or layout unless asked. "
            "Do not brighten, warm, whiten, increase exposure, soften shadows, boost saturation, add gloss, or convert the result to "
            "generic photorealistic / high-key architectural imagery unless those traits are visibly present in @style. If @style is dark, "
            "muted, low-key, cool, monochrome, matte, grainy, painterly, graphic, cinematic or high-contrast, preserve that character. "
            "Do not insert any unrequested default lighting or color-grade."
        )
    elif fields.get("feature") == "text_to_image":
        guidance = (
            "CONTENT REFERENCE RULE: the @img labels point to content images, not hidden fixed roles. Follow the user's prompt to decide "
            "what to retain or borrow. Do not impose a default daylight, high-key, warm, glossy or bright visual style; follow the user's description."
        )
    else:
        guidance = "REFERENCE INPUT RULE: the @img labels identify their corresponding content/reference images."
    return prompt + "\n\n" + guidance + "\n" + "\n".join(lines)


def build_print_render_prompt(scene_details=None, scene_type_id=None, material_id=None, lighting_id=None) -> str:
    """Fonction 1 — Screenshot-to-Render."""
    return _join(
        [
            (
                "You are an expert architectural visualization director and archviz photographer. "
                "Transform the provided reference image into a premium photorealistic architectural render. "
                "Preserve the source design exactly: building footprint, wall positions, openings, floor levels, "
                "rooflines, proportions, structural logic, camera composition and all clearly visible architectural elements."
            ),
            (
                "Do not redesign, reinterpret, simplify, mirror, relocate, resize or invent architectural elements. "
                "Do not change the number or shape of rooms/openings when they are visible in the source. "
                "Keep perspective and framing faithful to the reference unless an explicit camera instruction is provided."
            ),
            _fragment(SCENE_TYPE_FRAGMENTS, scene_type_id),
            _fragment(MATERIAL_FRAGMENTS, material_id),
            _fragment(LIGHTING_FRAGMENTS, lighting_id),
            (
                "Use physically plausible materials, realistic roughness, accurate scale, subtle micro-texture, "
                "natural reflections, correct contact shadows, indirect illumination and restrained post-processing."
            ),
            (
                "Target a high-end professional architecture photography aesthetic: realistic lens behavior, "
                "clean verticals, believable depth, calibrated exposure, natural color science, fine edge definition "
                "and publication-quality detail suitable for an architectural portfolio or design presentation."
            ),
            (
                "Avoid CGI-looking surfaces, excessive sharpening, plastic materials, surreal reflections, "
                "warped geometry, floating objects, duplicated elements, deformed furniture, inconsistent scale, "
                "text artifacts, logos or random decorative additions."
            ),
            _sanitize_scene_details(scene_details),
        ]
    )


def build_mood_swap_prompt(mood_id=None, scene_details=None) -> str:
    """Fonction 2 — Mood Shift : MÊME scène, seule l'ambiance varie."""
    return _join(
        [
            (
                "Edit the provided architectural image while preserving the original design as an immutable base. "
                "Keep the exact geometry, dimensions, façade composition, openings, materials, objects, site layout, "
                "camera angle, perspective, framing and image composition unchanged."
            ),
            (
                "Change ONLY the requested atmosphere, weather, time of day and corresponding illumination. "
                "Do not redesign the building, alter materials, move objects, add architectural elements or change the camera."
            ),
            _fragment(MOOD_FRAGMENTS, mood_id) or MOOD_FRAGMENTS["daylight"],
            (
                "Recompute illumination physically and coherently: shadow direction, softness, ambient light, "
                "window glow, reflections and sky contribution must all agree with the selected mood. "
                "Maintain realistic material response and natural architectural photography color grading."
            ),
            (
                "No geometry drift, no perspective drift, no object duplication, no invented structures, "
                "no artificial HDR glow, no excessive bloom, no cartoon look and no loss of architectural detail."
            ),
            _sanitize_scene_details(scene_details),
        ]
    )


def build_exterior_to_interior_prompt(scene_details=None) -> str:
    """Fonction 3 — Exterior -> Interior (pas de preset en V1)."""
    return _join(
        [
            (
                "Generate a premium photorealistic interior visualization of the same building shown in the provided exterior reference. "
                "Infer the interior only from evidence visible in the façade and openings: architectural language, floor-to-floor height, "
                "window proportions, structural rhythm, materials, daylight direction and overall design intent."
            ),
            (
                "The interior must be architecturally plausible and buildable, with correct human scale, realistic circulation, "
                "credible wall and ceiling thicknesses, coherent door/window positions and a consistent relationship to the exterior envelope."
            ),
            (
                "Continue the exterior material palette and design vocabulary into the interior without making arbitrary stylistic changes. "
                "Use refined contemporary furniture, restrained décor and professional interior styling appropriate to a high-end architectural project."
            ),
            (
                "Lighting must be physically consistent with the façade openings and apparent sun/sky conditions. "
                "Use realistic daylight penetration, indirect bounce light, contact shadows, reflections and material roughness."
            ),
            (
                "Present the result as a professional architectural photograph: natural perspective, accurate scale, clean lines, "
                "high-resolution textures, realistic glass behavior and no CGI artifacts. Do not invent extravagant features that are unsupported by the reference."
            ),
            _sanitize_scene_details(scene_details),
        ]
    )


def build_plan_to_render_prompt(plan_style_id=None, scene_details=None) -> str:
    """Fonction 4 — Plan technique 2D -> rendu meublé/paysagé."""
    return _join(
        [
            (
                "Act as a senior architectural visualization specialist. Convert the supplied 2D technical plan into a coherent, "
                "photorealistic 3D architectural visualization while treating the plan geometry as the primary source of truth."
            ),
            (
                "Read and respect the plan's walls, wall thicknesses, room boundaries, dimensions, door swings, window locations, "
                "stairs, terraces, fixed openings, circulation paths and major built elements. Preserve the relative proportions and adjacencies."
            ),
            _fragment(PLAN_RENDER_FRAGMENTS, plan_style_id) or PLAN_RENDER_FRAGMENTS["furnished_interior"],
            (
                "Do not move, merge, delete or invent rooms. Do not alter the footprint or openings merely to improve aesthetics. "
                "Any element not explicitly drawn should remain visually restrained and architecturally plausible."
            ),
            (
                "Use realistic human scale, appropriate furniture dimensions, coherent circulation clearance, physically plausible "
                "construction thicknesses and believable relationships between built form, furniture and landscape."
            ),
            (
                "Render with premium archviz quality: physically based materials, accurate roughness, subtle imperfections, "
                "realistic indirect illumination, contact shadows, controlled reflections, calibrated exposure and natural color grading."
            ),
            (
                "Avoid diagrammatic interpretation, distorted geometry, impossible furniture placement, floating objects, excessive decoration, "
                "unrealistic proportions, text, annotations or labels unless explicitly present in the plan or requested by the user."
            ),
            _sanitize_scene_details(scene_details),
        ]
    )


def build_multi_angle_prompt(angle_id=None, scene_details=None) -> str:
    """Fonction 6 — Multi-Angle : cohérence best-effort."""
    return _join(
        [
            (
                "Create a new camera view of the exact same architectural scene shown in the input image. "
                "The source image is the immutable design reference. Preserve the building geometry, dimensions, "
                "façade composition, materials, landscape, furniture/objects and environmental identity."
            ),
            _fragment(ANGLE_FRAGMENTS, angle_id) or ANGLE_FRAGMENTS["eye_level"],
            (
                "Only the camera viewpoint and resulting visible composition may change. Keep architectural proportions, "
                "vertical/horizontal alignment, floor levels, rooflines, openings and object scale consistent with the reference."
            ),
            (
                "Use realistic perspective and professional architectural photography optics. Maintain physically coherent lighting, "
                "material response, reflections and shadows across the newly revealed surfaces."
            ),
            (
                "Do not redesign hidden areas arbitrarily. Infer occluded geometry conservatively from the visible design language "
                "and maintain continuity with the source. No mirrored geometry, duplicate elements, warped façades or inconsistent windows."
            ),
            (
                "Final output: premium photorealistic archviz, clean composition, natural depth, realistic scale and publication-quality detail."
            ),
            _sanitize_scene_details(scene_details),
        ]
    )


def build_camera_to_image_prompt(camera_state: dict, scene_details=None) -> str:
    """Construit une consigne de nouvelle vue depuis la pose de la cam?ra 3D."""
    target = camera_state.get("target") if isinstance(camera_state.get("target"), dict) else {}

    def number(key: str, default: float) -> str:
        value = camera_state.get(key, default)
        try:
            return f"{float(value):.2f}".rstrip("0").rstrip(".")
        except (TypeError, ValueError):
            return str(default)

    target_text = ", ".join(
        f"{axis.upper()}={float(target.get(axis, default)):.2f}"
        for axis, default in (("x", 0), ("y", 0.5), ("z", 0))
    )
    azimuth = float(camera_state.get("azimuth", 0)) % 360
    elevation = float(camera_state.get("elevation", 0))
    distance = float(camera_state.get("distance", 5))
    if azimuth < 22.5 or azimuth >= 337.5:
        horizontal_view = "front view"
    elif azimuth < 67.5:
        horizontal_view = "front-right three-quarter view"
    elif azimuth < 112.5:
        horizontal_view = "right-side view"
    elif azimuth < 157.5:
        horizontal_view = "rear-right three-quarter view"
    elif azimuth < 202.5:
        horizontal_view = "rear view"
    elif azimuth < 247.5:
        horizontal_view = "rear-left three-quarter view"
    elif azimuth < 292.5:
        horizontal_view = "left-side view"
    else:
        horizontal_view = "front-left three-quarter view"
    vertical_view = "low-angle" if elevation < -15 else "eye-level" if elevation < 15 else "elevated" if elevation < 45 else "high-angle"
    shot_scale = "close-up" if distance < 2 else "medium shot" if distance <= 6 else "wide shot"
    return _join(
        [
            (
                "The PRIMARY image is a camera-view guide captured from the 3D editor at the requested camera pose. It determines viewpoint, perspective, which side is visible, and framing. "
                "Reconstruct the subject as a new photorealistic view from this camera. Do not copy the guide as a flat, skewed card or preserve its preview rendering style."
            ),
            (
                "The SECONDARY image is the original subject reference. Use it for the subject's identity, shape, proportions, recognizable details and materials. "
                "Follow the PRIMARY camera guide for viewpoint and composition. Ignore any editor grid, camera gizmos, borders or UI visible in the guide."
            ),
            (
                "This is a genuine camera viewpoint change, NOT a lighting edit, color edit, crop, zoom, flat-image rotation or perspective warp. "
                "Visibly follow the PRIMARY camera guide and show the side/top surfaces visible from that pose. "
                "Do not preserve the original reference's composition when it conflicts with the camera guide."
            ),
            (
                "REQUIRED VIEWPOINT: "
                f"{horizontal_view}, {vertical_view}, {shot_scale}. "
                "Azimuth is measured around the subject's front as defined by the secondary subject reference: 0 degrees is front, "
                "90 degrees right side, 180 degrees rear, and 270 degrees left side. These directions determine which faces must be visible. "
                "REQUESTED CAMERA POSE: "
                f"horizontal azimuth {number('azimuth', 0)} degrees; vertical elevation {number('elevation', 0)} degrees; "
                f"ground distance {number('distance', 5)} scene units; camera height {number('height', 0.5)} scene units; "
                f"look-at target {target_text}; vertical field of view {number('fov', 45)} degrees; "
                f"roll {number('roll', 0)} degrees; zoom {number('zoom', 1)}x; projection {camera_state.get('projection', 'perspective')}. "
                "Treat this camera pose and the primary camera guide as authoritative. The output should have the framing that a real camera at this position would see."
            ),
            (
                "Preserve the subject's overall shape, proportions, recognizable details and structural relationships from the secondary reference. "
                "Infer newly revealed areas conservatively; do not invent unrelated parts, add or remove components, or redesign the subject."
            ),
            (
                "Render as a premium photorealistic photograph with physically plausible materials, natural exposure, soft realistic shadows, "
                "accurate reflections, realistic roughness and subtle surface texture. Avoid cartoon, illustration, plastic CGI, exaggerated reflections and oversaturation."
            ),
            _sanitize_scene_details(scene_details),
        ]
    )


def build_animate_prompt(scene_details=None, motion_prompt=None) -> str:
    """Fonction 5 — Animate : mouvement décrit par l'utilisateur."""
    motion = (motion_prompt or "").strip() or "slow, smooth cinematic architectural camera movement"
    return _join(
        [
            (
                "Create a premium photorealistic architectural video from the provided reference image. "
                "Treat the reference as a locked visual source: preserve building geometry, proportions, materials, landscape, "
                "objects, lighting identity and architectural detailing throughout the shot."
            ),
            (
                "The animation must feel like a professionally filmed architectural visualization with stable geometry, "
                "natural parallax, believable depth, realistic camera inertia and physically coherent perspective."
            ),
            (
                "Camera motion instruction: " + motion + ". Execute the movement smoothly and deliberately, without sudden jumps, "
                "warping, rolling, elastic motion or synthetic camera shake unless explicitly requested."
            ),
            (
                "Preserve temporal consistency: walls, windows, furniture, plants, reflections and shadows must remain stable from frame to frame. "
                "Avoid morphing, texture crawling, object flicker, geometry melting, duplicated details and lighting discontinuities."
            ),
            (
                "Use cinematic but restrained motion blur, realistic depth cues, high-quality anti-aliasing and natural architectural color grading."
            ),
            _sanitize_scene_details(scene_details),
        ]
    )


def build_video_to_video_prompt(scene_details=None) -> str:
    """Fonction 5b — Modify Video : modification contrôlée d'une vidéo existante."""
    return _join(
        [
            (
                "Modify the existing architectural video according to the user's requested changes while keeping the original shot as the locked reference. "
                "Preserve the exact subject identity, building geometry, spatial proportions, camera path, framing, lens character, timing and motion."
            ),
            (
                "Apply only the requested visual changes. Do not redesign the architecture, alter structural elements, move fixed openings, "
                "invent new rooms or change the trajectory of the camera unless explicitly instructed."
            ),
            (
                "Maintain frame-to-frame consistency for architecture, materials, furniture, vegetation, reflections and lighting. "
                "The modified video should remain physically plausible and visually continuous with the original footage."
            ),
            (
                "Use professional architectural post-production quality: realistic textures, stable edges, coherent shadows and reflections, "
                "natural color science and no flicker, warping, melting, ghosting or temporal artifacts."
            ),
            _sanitize_scene_details(scene_details),
        ]
    )


def build_video_relight_prompt(scene_details=None) -> str:
    """Fonction 5c — Video Relight : changement d'éclairage sans modifier la géométrie."""
    return _join(
        [
            (
                "Relight the existing architectural video while preserving the original building, objects, geometry, camera movement, "
                "composition, materials and scene layout exactly. This is an illumination-only transformation."
            ),
            (
                "Change the requested time of day, sky condition, light direction, color temperature and luminance hierarchy, "
                "but keep every architectural and environmental element fixed in place."
            ),
            (
                "Recalculate physically plausible direct and indirect lighting, window illumination, cast shadows, ambient occlusion, "
                "surface reflections and exposure so the new lighting condition is internally consistent across the entire sequence."
            ),
            (
                "Maintain temporal stability from frame to frame: no brightness pumping, shadow popping, texture changes, material drift, "
                "flicker or geometry deformation."
            ),
            (
                "Final result must look like professional architectural cinematography, not an artificial color filter. "
                "Preserve realistic material response and restrained color grading."
            ),
            _sanitize_scene_details(scene_details),
        ]
    )


def build_image_extender_prompt(direction=None, target_ratio=None, scene_details=None) -> str:
    """Image Extender — outpaint contrôlé, sans altérer la zone existante."""
    direction = direction or "center"
    ratio = target_ratio or "original"
    return _join(
        [
            (
                "Extend the canvas of the provided architectural image toward the " + direction +
                " while treating every existing pixel and architectural element inside the original frame as locked."
            ),
            (
                f"Target aspect ratio: {ratio}. Extend only the missing canvas area and reconstruct the new region so that "
                "perspective, scale, vanishing points, horizon, lighting direction, materials, textures, vegetation, sky and site context "
                "continue seamlessly from the original image."
            ),
            (
                "Do not crop, resize, move, repaint, redesign or otherwise modify any existing building element. "
                "Do not change doors, windows, walls, rooflines, furniture, landscape features or camera perspective in the original area."
            ),
            (
                "Match edge continuity with pixel-level care: lines, façade joints, floor boundaries, shadows, reflections and repetitive patterns "
                "must connect naturally across the old/new image boundary."
            ),
            (
                "Use premium photorealistic architectural rendering quality with physically plausible continuation and no visible seams. "
                "Avoid duplicated objects, impossible geometry, repeated textures, warped perspective or invented focal elements."
            ),
            _sanitize_scene_details(scene_details),
        ]
    )


def build_variations_prompt(scene_details=None) -> str:
    """Variations — variations contrôlées autour de la même architecture."""
    return _join(
        [
            (
                "Create a professional architectural visualization variation based on the provided reference image. "
                "Preserve the same architecture, footprint, geometry, room organization when visible, camera position, perspective and overall composition."
            ),
            (
                "Introduce only subtle, intentional visual variation in the areas permitted by the user, such as finish selection, "
                "soft landscaping, lighting atmosphere or small non-structural styling details. Keep the architectural identity immediately recognizable."
            ),
            (
                "Never alter structural geometry, façade openings, rooflines, floor levels, major walls or camera framing unless explicitly requested."
            ),
            (
                "Use realistic materials with coherent physical properties, refined detailing, believable scale, natural imperfections, "
                "accurate reflections, realistic contact shadows and professional architectural color grading."
            ),
            (
                "Variation should look like a legitimate alternative design presentation by an architecture studio, not like a random AI reinterpretation. "
                "Avoid exaggerated shapes, decorative clutter, inconsistent scale, duplicated objects, distorted lines or fantasy elements."
            ),
            _sanitize_scene_details(scene_details),
        ]
    )


def build_background_remover_prompt() -> str:
    """Instructions d'isolation professionnelle pour les modèles acceptant un prompt."""
    return """Act as a professional high-end image masking and compositing specialist.

OBJECTIVE:
Precisely isolate the complete foreground subject from the image and remove the entire background. Output a clean, production-ready cutout with a true transparent alpha channel.

STRICT PRESERVATION:
- Keep the main subject 100% unchanged: do not redesign, retouch, recolor, reshape, resize, sharpen, smooth, reconstruct or stylistically reinterpret it.
- Preserve the exact original proportions, geometry, materials, colors, textures, reflections, highlights and legitimate subject shadows.
- Keep every real part of the subject, including thin edges, corners, curves, small details, transparent regions and partially occluded components when they belong to the subject.
- Do not alter camera angle, perspective, framing or subject position.
- Do not crop any part of the subject.

BACKGROUND REMOVAL:
- Remove all background pixels completely and make them fully transparent.
- Eliminate halos, matte contamination, edge color spill, background reflections and accidental semi-transparent fringes.
- Carefully distinguish the subject from the background even where contrast is low or edges are complex.
- Preserve legitimate transparency in glass or other transparent subject materials without inventing opaque shapes.

DO NOT:
- Add objects, decoration, lighting effects, artificial shadows or new reflections.
- Remove legitimate portions of the subject.
- Create artificial outlines or cartoon-style edges.
- Leave white, gray, black, colored or semi-transparent background remnants.

QUALITY STANDARD:
The result must resemble a manually prepared professional Photoshop/visual-effects mask for premium architecture, advertising, e-commerce or graphic-design production.

OUTPUT:
- True transparent PNG / alpha channel.
- Full subject visible edge-to-edge.
- Clean, natural, anti-aliased edges without visible cutout artifacts."""



# Text-only Image2 style filters. The external thumbnail URLs are UI previews only;
# only these stable IDs are passed to the worker. The filter modifies rendering
# treatment, never the requested subject, composition, background, or object count.
IMAGE2_STYLE_FILTER_PROMPTS: dict[str, str] = {
    "inkprint": "Apply a handcrafted linocut / relief-print treatment: carved confident contour lines, bold ink shapes, simplified value groups, purposeful crosshatching, limited spot colors, and subtle print texture. Keep the subject legible. Do not add text, symbols, or a new paper background.",
    "oilpainting": "Apply a convincing oil-on-canvas treatment with layered pigments, controlled visible brush strokes, subtle glazing, painterly edge transitions, rich midtones, and natural canvas tooth. Preserve geometry and key details; do not blur the subject, force swirling strokes, or add warm sunset lighting unless requested.",
    "traditional-japan": "Use a traditional Japanese woodblock-print language inspired by ukiyo-e: clear ink contours, flat layered color, deliberate negative space, elegant asymmetry, simplified atmospheric depth, and restrained indigo, mineral blue, vermilion and earth tones where suitable. Do not add Japanese motifs or replace the scene unless requested.",
    "fantasy": "Apply polished fantasy concept-art treatment through atmospheric depth, evocative value design, layered color, selective luminous accents, and painterly detail hierarchy. Preserve the actual subject and scene; do not invent dragons, castles, magical creatures, runes, portals, or props.",
    "cartoon": "Use a clean 2D cartoon style with confident outlines, simplified but accurate silhouettes, readable shape language, flat color blocks, restrained cel shading, and intentional highlights. Keep the subject recognizable and do not add speech bubbles, props, or childish exaggeration unless requested.",
    "3d": "Give the existing subject a designed 3D-rendered appearance: coherent volume, believable material response, physically plausible shading, controlled ambient occlusion, soft contact shadows, and readable geometry. Preserve all shapes, proportions, viewpoint, and composition. Do not assume bright white studio lighting, glossy plastic, or extra objects.",
    "cartoonfun": "Apply a playful, energetic cartoon-illustration finish with expressive rounded shapes, lively curves, rhythmic color blocking, coordinated cheerful colors, and a fun graphic finish. Keep the original subject and object count. Do not add confetti, stars, characters, toys, emojis, or decorative clutter.",
    "digital-art": "Apply refined digital-art treatment with controlled digital brushwork, nuanced shading, intentional edge control, layered color transitions, crisp focal details, and a cohesive art-directed palette. Do not impose neon, holograms, fantasy props, excess glow, or a new environment.",
    "comic": "Apply professional comic-book rendering: bold controlled inking, expressive contour weights, graphic shadow shapes, selective halftone texture, clear focal hierarchy, and purposeful highlights. Preserve the scene. Do not add panels, speech bubbles, captions, sound effects, or lettering unless requested.",
    "painting": "Translate the subject into a versatile fine-art painting treatment with intentional brushwork, layered pigment-like color, expressive but controlled edges, surface texture, and painterly light transitions. Do not force oil, watercolor, gouache, or acrylic unless specified, and do not add scenery.",
    "dark": "Apply a deliberate dark, low-key treatment with deeper shadow values, restrained highlights, controlled contrast, subdued color, and selective local illumination. Preserve the user's setting and time of day; do not brighten the image, add golden-hour light, neon, fog, or a new night background unless asked.",
    "sketch": "Render the subject as a refined hand-drawn sketch using graphite-like strokes, varied line weight, light construction marks, deliberate hatching, and restrained paper texture. Preserve perspective and geometry. Do not add labels, measurements, arrows, grids, annotations, or blueprint symbols.",
    "mock": "Treat #mock as an early-stage rough concept draft, not as a polished presentation mockup. Establish primary masses and silhouettes first; use loose exploratory strokes and light construction guides; simplify secondary details; keep materials partially resolved; and use rough shading or broad color blocking instead of final polish. Preserve the user's subject, object count, essential geometry, spatial relationships, camera, perspective, and composition. For architecture, retain existing building masses, levels, openings, and circulation cues; roughen the finish without redesigning the architecture. Do not create a product-on-background mockup, device frame, poster, presentation board, CAD wireframe, blueprint grid, notes, labels, dimensions, logos, watermarks, extra objects, or a new background. The result should read as a first-pass concept explored by a designer, less finished than a polished sketch or render.",
    "2000s-phone": "Apply an authentic early-2000s compact digital-camera / phone snapshot look: modest sensor detail, limited dynamic range, slightly imperfect white balance, subtle chroma noise, mild JPEG compression, gentle softness, and direct flash only where the scene supports it. Preserve the original subject and background. Do not add VHS lines, film scratches, date stamps, camera UI, frames, or a new party setting.",
    "cyberpunk": "Apply a restrained cyberpunk treatment through controlled cyan-and-magenta color, selective neon-like accents, cinematic contrast, cooler shadow colors, and edge reflections only where materials support them. Preserve the current scene, subject, architecture, object count, camera, and setting. Do not add neon signs, holograms, vehicles, rain, wet pavement, sci-fi buildings, or a new city background unless requested.",
}

# The provider API sets the requested frame. These short hints guide composition only;
# they do not ask the model to crop an existing image to achieve the target ratio.
_FRAME_NAMES: dict[str, str] = {
    "1:1": "a square 1:1 frame",
    "16:9": "a widescreen 16:9 landscape frame",
    "9:16": "a vertical 9:16 portrait frame",
    "4:3": "a 4:3 landscape frame",
    "3:4": "a 3:4 portrait frame",
    "3:2": "a 3:2 landscape photographic frame",
    "2:3": "a 2:3 portrait photographic frame",
    "21:9": "an ultra-wide 21:9 cinematic frame",
}
_FRAME_COMMON = (
    "Compose the scene naturally for the requested frame. Fill the frame edge to edge; "
    "do not add borders, letterboxing, blank margins, or padding. Keep the main subject "
    "complete and undistorted."
)
IMAGE2_FRAME_SIZE_PROMPTS: dict[str, str] = {
    "auto": (
        "Use the frame chosen by the image provider's native Auto setting. "
        + _FRAME_COMMON
    ),
    **{
        ratio: f"Compose the image for {name}. " + _FRAME_COMMON
        for ratio, name in _FRAME_NAMES.items()
    },
}
def build_text_to_image_prompt(
    scene_details=None,
    has_style_reference=False,
    style_filters=None,
    aspect_ratio=None,
) -> str:
    """Build a sectioned, subject-first prompt that keeps explicit user requirements salient."""
    user_description = _sanitize_scene_details(scene_details)
    sections = [
        (
            "TASK: Generate one coherent image of the scene requested by the user. "
            "The user's scene specification below is the source of truth for the subject and its contents."
        ),
        (
            "FIDELITY RULES: Include every explicitly requested object and meaningful detail. "
            "Preserve stated quantities, colors, materials, locations, directions, relative sizes and relationships. "
            "Do not omit, replace, duplicate, merge, hide, or invent scene objects. Do not add decorative elements "
            "that the user did not request. Keep each requested object recognizable and visible; avoid unnecessary "
            "occlusion. If a stylistic choice conflicts with an explicit scene requirement, the scene requirement wins."
        ),
        "USER'S EXACT SCENE SPECIFICATION:\n" + (user_description or "(No scene description supplied.)"),
        (
            "VISUAL COHERENCE: Use believable proportions where relevant, coherent perspective, consistent object identity, "
            "intentional detail hierarchy and clean rendering appropriate to the user's requested medium. "
            "Do not impose an unrequested style, lighting setup, camera angle, or color grade."
        ),
    ]

    if aspect_ratio and aspect_ratio in IMAGE2_FRAME_SIZE_PROMPTS:
        sections.append("OUTPUT FRAME:\n" + IMAGE2_FRAME_SIZE_PROMPTS[aspect_ratio])

    selected_filters: list[str] = []
    if isinstance(style_filters, (list, tuple)):
        for value in style_filters:
            if isinstance(value, str) and value in IMAGE2_STYLE_FILTER_PROMPTS and value not in selected_filters:
                selected_filters.append(value)

    if selected_filters:
        sections.append(
            "STYLE-ONLY MODIFIERS (apply after resolving the required scene; never change its contents): "
            + ", ".join(f"#{item}" for item in selected_filters)
            + "."
        )
        sections.extend(IMAGE2_STYLE_FILTER_PROMPTS[item] for item in selected_filters)
        sections.append(
            "Style filters may change rendering technique, linework, texture, color treatment, shading and finish only. "
            "They must not change the requested subject, object inventory, object count, composition, architectural geometry "
            "or setting. If filters conflict, prioritize the first selected style while preserving every scene requirement."
        )
    elif has_style_reference:
        sections.extend([
            (
                "STYLE REFERENCE: Use the separate Style image only as an aesthetic guide. Match its tonal range, contrast, "
                "palette, texture and rendering medium without copying its subject or composition unless the user asks."
            ),
            (
                "Do not automatically brighten, warm, whiten, add gloss or force a photorealistic architectural look when "
                "the Style image does not show those traits."
            ),
        ])
    else:
        sections.append(
            "LIGHTING AND MOOD: Follow the user's exact description. Do not add default daylight, high-key exposure, "
            "warm color grading, glossy materials or artificial glow unless requested."
        )

    return "\n\n".join(section for section in sections if section)

def build_feature_prompt(feature: str, fields: dict) -> str:
    """Dispatch par feature — l'`option_id` générique porte le preset de la fonction."""
    option_id = fields.get("optionId")
    details = fields.get("sceneDetails")
    if feature == "animate":
        return build_animate_prompt(scene_details=details, motion_prompt=fields.get("motionPrompt"))
    if feature == "mood_swap":
        return build_mood_swap_prompt(mood_id=option_id, scene_details=details)
    if feature == "exterior_to_interior":
        return build_exterior_to_interior_prompt(scene_details=details)
    if feature == "plan_to_render":
        return build_plan_to_render_prompt(plan_style_id=option_id, scene_details=details)
    if feature == "multi_angle":
        camera_state = fields.get("cameraState")
        if isinstance(camera_state, dict):
            return build_camera_to_image_prompt(camera_state, scene_details=details)
        return build_multi_angle_prompt(angle_id=option_id, scene_details=details)
    if feature == "image_extender":
        return build_image_extender_prompt(
            direction=option_id,
            target_ratio=fields.get("aspectRatio"),
            scene_details=details,
        )
    if feature == "variations":
        return build_variations_prompt(scene_details=details)
    if feature == "background_remover":
        return build_background_remover_prompt()
    if feature == "text_to_image":
        return build_text_to_image_prompt(
            scene_details=details,
            has_style_reference=bool(fields.get("styleReferenceUrl")),
            style_filters=fields.get("styleFilters"),
            aspect_ratio=fields.get("aspectRatio"),
        )
    return build_print_render_prompt(
        scene_details=details,
        scene_type_id=fields.get("sceneTypeId"),
        material_id=fields.get("materialId"),
        lighting_id=fields.get("lightingId"),
    )

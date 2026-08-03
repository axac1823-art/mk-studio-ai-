# RenderStudio Worker

Service Python FastAPI qui détient **toute** la logique IA : appels providers, workflows, upscaling, stockage local.

## Lancer en local

Depuis la racine du dépôt :

```bash
cd worker
python -m venv .venv
./.venv/Scripts/python -m pip install -r requirements.txt

# Copier et renseigner AU MOINS une clé provider (voir .env.example)
cp .env.example .env

./.venv/Scripts/python -m uvicorn main:app --reload --port 8000
```

Le worker expose :

- `GET /health` — santé.
- `POST /generate/image` — génération image (Render, Mood, Ext→Int, Plan, Multi-Angle).
- `POST /generate/video` — génération vidéo (Animate).
- `POST /upscale` — upscaler un asset existant.
- `GET /jobs/{id}` — état d'un job.
- `GET /storage/{path}` — fichiers générés.

## Tests

```bash
./.venv/Scripts/python -m tests.test_fallback
./.venv/Scripts/python -m tests.smoke_comfyui
```

## Ajouter un provider IA

1. Créer `providers/<nom>.py` avec une fonction `generate(input) -> dict`.
2. L'enregistrer dans `providers/__init__.py`.
3. L'ajouter dans la liste de fallback du workflow concerné (`workflows/image_render.py`, `workflows/video_generation.py`, `workflows/upscale.py`).
4. Ajouter la clé dans `config.py` et `.env.example` si nécessaire.
5. Les clés providers ne vivent **jamais** côté `/web`.

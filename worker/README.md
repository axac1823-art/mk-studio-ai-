# RenderStudio Worker

Service Python FastAPI qui détient **toute** la logique IA : appels providers officiels, workflows, upscaling, montage vidéo, génération audio, stockage local. Ce dossier est le seul à lire les **clés API des providers**.

## Lancer en local

Depuis la racine du dépôt :

```bash
cd worker
python -m venv .venv
./.venv/Scripts/python -m pip install -r requirements.txt

# Copier et renseigner AU MOINS une clé provider (voir .env.example)
# Voir ENVIRONMENT.md à la racine pour la répartition complète.
cp .env.example .env

./.venv/Scripts/python -m uvicorn main:app --reload --port 8000
```

## Prérequis système

- **ffmpeg** requis pour le montage vidéo (`/video/edit`) et l'upscaling vidéo (`/video/upscale`).
- **ffprobe** recommandé pour conserver le FPS original lors de l'upscaling vidéo.

## Structure des fichiers

```
main.py                      # application FastAPI + enregistrement des routers
config.py                  # variables d'environnement (STORAGE_DIR, DATABASE_URL, PUBLIC_BASE_URL)
catalog.py                 # MODEL_CATALOG : feature -> candidats ordonnés
providers/                 # un fichier = un provider officiel
  __init__.py              # registre PROVIDERS + vérification de configuration
  http_helpers.py          # helpers POST/GET/polling/data URI
  bfl.py                   # Black Forest Labs (Flux Kontext)
  google.py                # Google Gemini
  openai.py                # GPT Image + Sora
  kling.py                 # Kling (vidéo)
  runway.py                # Runway Gen-4
  magichour.py             # Magic Hour (agrégateur — exception assumée)
  upscale.py               # provider dédié image upscale (Magic Hour)
  elevenlabs.py            # ElevenLabs (Voice Generator)
workflows/                 # logique métier exécutée en BackgroundTasks
  common.py                # helpers DB + stockage + completion/fail idempotents
  engine.py                # fallback, ordonnancement par tier
  image_render.py         # génération image (5 features image)
  video.py                # génération vidéo (Animate)
  upscale.py              # upscaling image
  audio.py                # génération voix (ElevenLabs)
  video_edit.py           # montage simple (trim / concat)
  video_upscale.py        # upscaling vidéo frame par frame
routes/                    # endpoints FastAPI
  generate.py             # POST /generate/image, /generate/video
  jobs.py                 # GET /jobs/{id}
  models.py               # GET /models
  upscale.py              # POST /upscale
  audio.py                # POST /audio/generate
  video_edit.py           # POST /video/edit
  video_upscale.py        # POST /video/upscale
  storage.py              # POST /storage/upload + GET /storage/{path}
storage/                   # fichiers générés en local (dev)
tests/                     # tests hors-ligne / smoke
  test_fallback.py        # moteur de fallback
  test_video_modes.py     # détection des modes vidéo
  test_elevenlabs.py      # provider ElevenLabs (mocké)
```

## Endpoints exposés

- `GET /health` — santé + indicateur `providers_configured`.
- `POST /generate/image` — génération image (Render, Mood, Ext→Int, Plan, Multi-Angle).
- `POST /generate/video` — génération vidéo (Animate).
- `POST /upscale` — upscaling image.
- `POST /video/upscale` — upscaling vidéo.
- `POST /video/edit` — montage vidéo (trim / concat).
- `POST /audio/generate` — génération de voix (ElevenLabs).
- `GET /jobs/{id}` — état d'un job.
- `GET /storage/{path}` — fichiers générés.

## Tests

```bash
cd worker
./.venv/Scripts/python -m tests.test_fallback
./.venv/Scripts/python -m tests.test_elevenlabs
```

## Ajouter un provider IA

1. Créer `providers/<nom>.py` avec une fonction `generate(input) -> dict` (voir `bfl.py` ou `google.py` comme modèle).
2. L'enregistrer dans `providers/__init__.py` et dans `PROVIDER_ENV_KEYS`.
3. L'ajouter dans la liste de fallback du workflow concerné (`workflows/image_render.py`, `workflows/video.py`, `workflows/audio.py`, ...).
4. Ajouter la clé dans `.env.example`.
5. Les clés providers ne vivent **jamais** côté `/web`.


Commande simple en une ligne
docker compose exec db psql -U renderstudio -d renderstudio -c "ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_type_check; ALTER TABLE assets ADD CONSTRAINT assets_type_check CHECK (type IN ('image', 'video', 'audio', '3d_model'));"
Vérification
docker compose exec db psql -U renderstudio -d renderstudio -c "\d assets"
Tu dois voir à la fin :

Check constraints:
    "assets_type_check" CHECK (type IN ('image', 'video', 'audio', '3d_model'))
# RenderStudio — README

> SaaS de rendu architectural par IA : screenshot 3D → rendu photoréaliste, ambiance, plan 2D → rendu meublé, vidéo courte de présentation, et multi-angles. Produit vertical pour architectes, archviz, décorateurs et agents immobiliers.

Ce dépôt est organisé en **deux services** et une base de données partagée :

- `/web` : interface Next.js 14 + TypeScript, pages, auth, facturation, studio, gestion des projets.
- `/worker` : service Python FastAPI qui détient **toute** la logique IA (appels providers, upscale, ffmpeg, stockage local).
- `/db` : schéma PostgreSQL unique, utilisé par les deux services.

---

## Prérequis

- Docker Desktop (ou Docker Engine) pour la base de données.
- Node.js 20+ et npm.
- Python 3.11+.
- **ffmpeg** (et idéalement **ffprobe**) installé sur le système, requis pour
  le montage vidéo (Clip Editor, Video Project Editor) et l'upscaling vidéo.

---

## Lancer le projet en local

### 1. Base de données

```bash
docker compose up -d db
```

Port exposé côté hôte : `5433` (car `5432` est souvent déjà pris par un PostgreSQL natif Windows).

Appliquer le schéma et le seed de dev :

```bash
docker compose exec -T db psql -U renderstudio -d renderstudio < db/schema.sql
```

Le seed crée un utilisateur `dev@renderstudio.local` avec 100 crédits et un projet `General` par défaut.

### 2. Worker FastAPI

```bash
cd worker
python -m venv .venv
./.venv/Scripts/python -m pip install -r requirements.txt

# Copier et renseigner AU MOINS une clé provider (voir worker/.env.example)
cp .env.example .env

./.venv/Scripts/python -m uvicorn main:app --port 8000
```

Le worker expose :
- `http://127.0.0.1:8000/health` — santé.
- `POST /generate/image` — génération image (Render, Mood, Ext→Int, Plan, Multi-Angle).
- `POST /generate/video` — génération vidéo (Animate).
- `POST /upscale` — upscaling d'image.
- `POST /video/upscale` — upscaling de vidéo.
- `POST /video/edit` — montage simple de vidéo (découpe / concaténation).
- `POST /audio/generate` — génération de voix (ElevenLabs).
- `GET /jobs/{id}` — état d'un job.
- `GET /storage/{path}` — fichiers générés.

### 3. Web Next.js

```bash
cd web
npm install

# Copier et ajuster DATABASE_URL / WORKER_BASE_URL
npm install
cp .env.example .env.local

npm run dev
```

Ouvrir `http://localhost:3000/app/dashboard`.

---

## Alternatives pour la base de données

### PostgreSQL local (sans Docker)

Si tu préfères utiliser une installation PostgreSQL native sur Windows :

1. Installe PostgreSQL 16 : [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
2. Crée l’utilisateur et la base :

```sql
CREATE USER renderstudio WITH PASSWORD 'renderstudio' SUPERUSER;
CREATE DATABASE renderstudio OWNER renderstudio;
```

3. Mets à jour `DATABASE_URL` dans les deux fichiers d’environnement :

```env
DATABASE_URL=postgresql://renderstudio:renderstudio@127.0.0.1:5432/renderstudio
```

4. Applique le schéma directement :

```bash
psql -U renderstudio -d renderstudio -h 127.0.0.1 -p 5432 -f db/schema.sql
```

Sous PowerShell, si `psql` n’est pas dans le PATH, utilise celui fourni avec PostgreSQL ou ajoute-le manuellement. Pas besoin de `docker compose` dans ce cas.

### Supabase (production recommandée)

Supabase fournit PostgreSQL + Auth + Storage. Le projet utilise déjà Supabase Auth, donc seule la connexion base de données change en production.

1. Crée un projet sur [supabase.com](https://supabase.com) et note le **project ref**.
2. Récupère la **Connection string** dans Project Settings → Database.
3. Utilise le port **5432** (session directe) pour appliquer les migrations, et le port **6543** (pooler transactionnel) pour le runtime.

**Appliquer le schéma sur Supabase :**

```bash
PGPASSWORD=<password> psql \
  -h aws-0-eu-west-1.pooler.supabase.com \
  -p 5432 \
  -U postgres.<project_ref> \
  -d postgres \
  -f db/schema.sql
```

**Variables d’environnement production :**

```env
# /web/.env.local + /worker/.env
DATABASE_URL=postgresql://postgres.<project_ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

# /web/.env.local uniquement
NEXT_PUBLIC_SUPABASE_URL=https://<project_ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

4. Déploie le worker sur un hôte séparé (Render, Railway, Fly.io...) et ajuste :

```env
WORKER_BASE_URL=https://worker.yourdomain.com
WORKER_PUBLIC_URL=https://worker.yourdomain.com
WORKER_API_KEY=<secret-partagé-fort>
```

5. Pour le stockage des fichiers générés en production, remplace `worker/storage/` par **Supabase Storage** (bucket public `renders`) ou S3. Le fichier `worker/storage.py` est conçu pour être remplacé par un adaptateur distant sans toucher au reste du code.

---

## Variables d'environnement

Voir [`ENVIRONMENT.md`](./ENVIRONMENT.md) pour la répartition complète.
En résumé :

### `/web/.env.local`

```env
DATABASE_URL=postgresql://renderstudio:renderstudio@127.0.0.1:5433/renderstudio
WORKER_BASE_URL=http://127.0.0.1:8000
WORKER_PUBLIC_URL=http://127.0.0.1:8000
```

Aucune clé de provider IA ici — le frontend ne parle jamais aux providers.

### `/worker/.env`

```env
DATABASE_URL=postgresql://renderstudio:renderstudio@127.0.0.1:5433/renderstudio
WORKER_PUBLIC_URL=http://127.0.0.1:8000

# Provider images
BFL_API_KEY=
GOOGLE_API_KEY=
OPENAI_API_KEY=
MAGIC_HOUR_API_KEY=

# Providers vidéo
KLING_SECRET_KEY=
RUNWAY_API_KEY=
OPENAI_API_KEY=
MAGIC_HOUR_API_KEY=

# Voice Generator (ElevenLabs)
ELEVENLABS_API_KEY=
```

Un provider non configuré est simplement sauté par le fallback.

---

## Architecture des flux

1. L'utilisateur upload une image dans `/web` et choisit un feature (Render, Mood, etc.) dans un projet.
2. `/web` crée un job `pending` dans la table `jobs`, puis appelle `POST /generate/image` (ou `/video`) du worker.
3. Le worker démarre un `BackgroundTasks`, vérifie le solde, débite **uniquement au succès**, et exécute le workflow.
4. Le workflow tente les providers dans l'ordre du catalogue (`worker/providers/*.py`), enregistre l'image/vidéo dans `worker/storage/`, crée une ligne `assets`, et met à jour le job en `complete`.
5. Le front polle `GET /jobs/{id}` toutes les 2,5 s via la DB.

---

## Structure du dépôt

```
/                    <- racine : docker-compose, schéma DB, README, ENVIRONMENT.md
├── web/             <- Next.js 14 : UI, pages, routes API, appels worker
│   ├── app/         <- App Router (dashboard, outils image/vidéo/audio, modèles)
│   ├── components/  <- Composants React (studio, projets, sidebar, popover)
│   ├── lib/         <- DB, crédits, client worker, configs, presets
│   ├── scripts/     <- purge-trash.ts (nettoyage corbeille)
│   └── .env.example
├── worker/          <- FastAPI Python : toute la logique IA
│   ├── providers/   <- un fichier = un provider (bfl, google, kling, runway, openai, magichour, upscale, elevenlabs)
│   ├── workflows/   <- image_render.py, video.py, upscale.py, audio.py, video_edit.py, video_upscale.py
│   ├── routes/      <- endpoints FastAPI (generate, jobs, models, upscale, storage, audio, video/edit, video/upscale)
│   ├── storage/     <- fichiers générés en local (dev)
│   ├── tests/       <- test_fallback.py, test_video_modes.py
│   └── .env.example
├── db/              <- schema.sql (source unique de vérité Postgres) + migrations
```

---

## Features V1

Les 10 onglets/outils du studio :

1. **Render** : screenshot 3D → rendu photoréaliste.
2. **Mood** : variation jour/nuit/saison/météo de la même scène.
3. **Exterior → Interior** : vue intérieure plausible depuis une vue extérieure.
4. **Plan to Render** : plan 2D technique → rendu meublé/paysagé.
5. **Animate** : image → vidéo courte 4-8 s. Le panneau expose un champ de texte libre pour décrire le mouvement, un sélecteur de modèle vidéo, et une image de fin optionnelle (start/end frame).
6. **Multi-Angle** : 2-3 angles additionnels de la même scène (best-effort).
7. **Upscale** : amélioration d'une image existante (upload ou asset), facteur 2×/4×, modèle au choix.
8. **Video Upscaler** : amélioration d'une vidéo existante (frame par frame puis ré-encodage ffmpeg), facteur 2×/4×.
9. **Clip Editor / Video Project Editor** : découpe et assemblage de clips vidéo via ffmpeg.
10. **Voice Generator (Speak)** : génération audio / voix off à partir d'un texte (ElevenLabs).
11. **Models** : page de découverte des modèles disponibles pour chaque type de génération.

### Upscale

- Panneau dédié dans le studio : upload, choix du modèle upcaleur, facteur 2× ou 4×, toggle « Enhance quality ».
- Bouton « Download » disponible sur chaque résultat de la galerie.
- Crée un nouvel asset lié à l'original via `parent_generation_id` ; l'original n'est jamais écrasé.
- Coûts : `upscale_2x` = 8 crédits, `upscale_4x` = 15 crédits (configurable dans `action_costs`).

### Projets / Assets (hiérarchie personnelle)

- `projects` : id, user_id, name, cover_asset_id.
- `assets` : id, project_id, user_id, type (`image`/`video`), generation_id, is_favorite, is_trashed, trashed_at.
- Chaque génération est attachée à un projet au moment de la création.
- Navigation : Home, Search, Projects, Favorites, Uploads, Trash.
- Corbeille : `is_trashed` + `trashed_at` ; suppression définitive après 30 jours via `npm run purge:trash`.
- La cover d'une carte projet est l'asset explicitement choisie, ou à défaut la dernière asset visible du projet.

---

## Ajouter un nouveau provider IA

1. Créer `worker/providers/<nom>.py` avec une fonction `generate(input) -> dict` (voir `bfl.py` ou `google.py` comme modèle).
2. L'enregistrer dans `worker/providers/__init__.py` et dans `PROVIDER_ENV_KEYS`.
3. L'ajouter dans la liste de fallback du workflow concerné (`workflows/image_render.py`, `workflows/video.py`, `workflows/audio.py`, etc.).
4. Ajouter la clé dans `worker/.env.example`.
5. **Ne rien modifier côté `/web` :** les clés providers restent dans `/worker` uniquement. Voir `ENVIRONMENT.md`.

---

## Tests et vérifications

```bash
# Worker
cd worker
./.venv/Scripts/python -m tests.test_fallback
./.venv/Scripts/python -m tests.test_elevenlabs

# Web
cd web
npm run build
npm run purge:trash
```

Vérification rapide :
- `GET http://localhost:3000/app/dashboard` → 200.
- `GET http://localhost:8000/health` → `{"status":"ok"}`.
- Sans aucune clé provider, une génération retourne une erreur explicite sans débiter de crédits.

---

## Notes de sécurité

- Les clés providers ne vivent que dans `worker/.env`.
- `/web` ne connaît que `WORKER_BASE_URL`.
- Aucune variable sensible ne doit être préfixée `NEXT_PUBLIC_`.

---

## Jalons suivants (non implémentés)

- Auth (Supabase Auth) + remplacer le user seed par une vraie authentification.
- Facturation Stripe (Checkout + Customer Portal + webhooks) et plans d'abonnement.
- Stockage distant S3/Supabase Storage à la place de `worker/storage/`.
- Queue externe (BullMQ) pour remplacer `BackgroundTasks` à grande échelle.

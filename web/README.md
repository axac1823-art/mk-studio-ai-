# RenderStudio — SaaS de rendu architectural par IA

**Agrégateur IA vertical** pour architectes, professionnels de l'archviz,
décorateurs d'intérieur et agents immobiliers — pas un outil généraliste
de création de contenu. Chaque modèle est appelé côté serveur sur l'API
**officielle** de son éditeur (BFL, Google, OpenAI, Kling, Runway) — pas
d'agrégateur (une seule exception documentée : Magic Hour) et pas de
vendor lock-in : le fallback entre fournisseurs est automatique et
invisible, et **aucun sélecteur de modèle n'est exposé** à l'utilisateur.

> Architecture détaillée et spec produit : [`AGENTS.md`](AGENTS.md) —
> guide développeur (lancer, comprendre chaque fichier, modifier) :
> [`GUIDE.md`](GUIDE.md). L'ancien backend FastAPI est archivé dans
> [`legacy/`](legacy/) (référence, non fonctionnel en l'état).

## Fonctionnalités

Scope MVP : 6 fonctions métier, une par onglet du studio — **toutes
câblées** (les 5 fonctions image partagent le même pipeline, seul le
prompt change).

- **Render** — photoréalisme extrême à partir d'un screenshot de viewport
  3D (SketchUp, Revit, 3ds Max), géométrie préservée : type de scène,
  presets matériau/éclairage, images de référence, réglages
  qualité/ratio/résolution/quantité, comparateur avant/après,
  téléchargement du résultat.
- **Mood** — même scène, variation jour/nuit/saison/météo (pluie, neige),
  sans re-génération depuis zéro.
- **Exterior → Interior** — vue intérieure plausible et cohérente avec
  l'architecture, depuis un rendu extérieur.
- **Plan to Render** — plan technique 2D → rendu meublé (intérieur) ou
  paysagé (extérieur).
- **Animate** — vidéo courte de présentation (4-8 s) : mouvement de caméra
  simple (push-in, orbite, zoom…) sur un rendu existant, sans narration
  en V1.
- **Multi-Angle** — 2-3 angles de caméra additionnels de la même scène
  (cohérence best-effort, sans garantie parfaite).

## Stack

- **Next.js 14.2** (App Router) · **React 18** · **TypeScript strict**
- **TailwindCSS 3.4** · **shadcn/ui** (style new-york, base zinc, thème
  sombre par défaut)
- **Fetch natif + node:crypto** — aucune dépendance SDK propriétaire :
  appels directs (submit + polling) aux API officielles des fournisseurs
- À venir : **Supabase** (auth + Postgres + storage) et **Stripe**
  (abonnements + webhooks)

## Prérequis

- **Node.js ≥ 18.17** (20 LTS recommandé) et npm
- Au moins **une clé fournisseur image** et **une clé vidéo** (voir
  [Configuration](#configuration)) — un fournisseur non configuré échoue
  vite et le routeur bascule automatiquement sur le suivant

## Démarrage

```bash
npm install
cp .env.example .env.local   # renseigner au moins un fournisseur
npm run dev                  # http://localhost:3000 -> /app/dashboard
```

Vérification rapide : `GET /app/dashboard` → 200 ; `POST /api/generate`
sans aucune clé fournisseur → erreur JSON explicite (503).

## Configuration

Toutes les clés sont lues **côté serveur uniquement** via `.env.local`
(jamais de préfixe `NEXT_PUBLIC_`). Chaque entrée de `.env.example` est
documentée (où obtenir la clé, options).

| Variable | Fournisseur | Usage |
| --- | --- | --- |
| `BFL_API_KEY` | Black Forest Labs | Image — Flux Kontext Pro/Max |
| `GOOGLE_API_KEY` | Google Gemini | Image — Nano Banana / Nano Banana Pro |
| `OPENAI_API_KEY` | OpenAI | Image (GPT Image) + vidéo (Sora 2) |
| `KLING_SECRET_KEY` | Kling (Kuaishou) | Vidéo — Kling 3 / 2.5 Turbo |
| `RUNWAY_API_KEY` | Runway | Vidéo — Gen-4 Turbo |
| `MAGIC_HOUR_API_KEY` | Magic Hour | Image + vidéo — agrégateur (exception assumée, éligible free tier) |
| `COMFYUI_CHECKPOINT` | ComfyUI (local) | Image img2img hors-ligne sur votre GPU |
| `COMFYUI_VIDEO_WORKFLOW_FILE` | ComfyUI (local) | Vidéo i2v hors-ligne — workflow custom requis (Wan/LTX, sortie mp4) |

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Vérification complète : compile + lint + types |
| `npm start` | Sert le build de production |
| `npm run lint` | ESLint |
| `npm run test:fallback` | Tests hors-ligne du routeur (tri, fallback) |
| `npm run test:comfyui` | Smoke test de l'adaptateur ComfyUI (serveur mock) |

## Structure du projet

```
app/                      # App Router (pas de src/)
  page.tsx                # redirige vers /app/dashboard
  app/dashboard/          # STUDIO : 6 onglets métier, upload, presets,
                          #   génération, comparateur, historique session
  api/generate/           # POST multipart -> job ; GET [id] -> statut
  api/credits/balance/    # solde de crédits (stub jusqu'au jalon DB)
  api/media/[name]/       # sert les vidéos stockées en local
components/
  studio/                 # panneaux du studio (render, animate, panneau
                          #   image générique des 4 autres fonctions…)
  ui/                     # shadcn/ui (installé à la main, style new-york)
  compare-slider.tsx      # comparateur avant/après
  upload-dropzone.tsx     # drag & drop + aperçu (PNG/JPEG/WebP, 10 Mo max)
lib/
  ai/catalog.ts           # LE fichier central : feature -> candidats ordonnés
  ai/providers/           # un adaptateur par API officielle (+ http.ts : helpers)
  ai/router.ts            # orchestration : tri par tier, fallback, upscale
  ai/prompt-templates.ts  # prompts versionnés (presets -> prompt de génération)
  ai/media.ts             # stockage temp local des vidéos (Sora, ComfyUI)
  ai/types.ts             # schéma interne normalisé (aucun nom de fournisseur)
  jobs/store.ts           # jobs en mémoire (remplaçable par BullMQ)
  presets.ts  costs.ts  credits.ts  features.ts  download.ts  utils.ts
scripts/                  # tests hors-ligne (routeur, adaptateur ComfyUI)
legacy/                   # ancien backend FastAPI (référence, non utilisé)
```

## Fonctionnement d'une génération

1. Le client POST `multipart/form-data` vers `/api/generate` (image +
   feature + `sceneTypeId`/`motionId` + réglages
   qualité/ratio/résolution/quantité/durée).
2. La route valide (type, taille), construit le prompt via
   `lib/ai/prompt-templates.ts` et crée un job.
3. Le routeur (`lib/ai/router.ts`) essaie les candidats du catalogue dans
   l'ordre (tier de qualité), chacun sur l'API officielle de son
   fournisseur ; échec → fallback automatique.
4. Le client polle `GET /api/generate/{jobId}` toutes les 2,5 s jusqu'à
   `done` (avec `outputUrls`) ou `error`.

## Feuille de route

Ordre de construction convenu avec le propriétaire (détail et exigences
d'architecture dans `AGENTS.md`) :

1. Scaffold Next.js + Tailwind + shadcn/ui — **fait**.
2. Fonctions 1 à 6 — **toutes câblées** (les 5 fonctions image partagent
   le même pipeline, seul le prompt change ; multi-angle en cohérence
   best-effort).
3. Auth (Supabase), schéma DB, système de crédits — **prochain jalon**.
4. Abonnements Stripe + webhooks + mint des crédits.
5. Landing page marketing.

## Sécurité et limites du jalon courant

- Les clés API ne quittent jamais le serveur : tous les appels modèles
  passent par des Route Handlers (`app/api/...`).
- `.env` est listé dans `.gitignore` — ne jamais committer de clés réelles.
- Pas d'auth : la route `/api/generate` est **ouverte** — ne pas exposer
  telle quelle en production.
- L'image transite en data URI base64 (10 Mo max) ; S3/Supabase Storage
  prendra le relais au jalon DB.
- L'historique du studio et les jobs sont **en mémoire** (session
  navigateur / processus serveur) — la persistance arrive avec la DB.

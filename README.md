# RenderStudio — SaaS de rendu architectural par IA

Transforme un screenshot brut de viewport 3D (SketchUp, Revit, 3ds Max) en
rendu photoréaliste, puis en clip cinématique avec narration IA. Chaque
modèle est appelé côté serveur sur l'API **officielle** de son éditeur
(BFL, Google, OpenAI, Kling, Runway, ElevenLabs) — pas d'agrégateur (une
seule exception documentée : Magic Hour) et pas de vendor lock-in : le
fallback entre fournisseurs est automatique et invisible.

> Architecture détaillée, conventions de code et spec produit :
> [`AGENTS.md`](AGENTS.md). L'ancien backend FastAPI est archivé dans
> [`legacy/`](legacy/) (référence, non fonctionnel en l'état).

## Fonctionnalités

- **Print Render** — photoréalisme extrême à partir d'un viewport 3D brut :
  type de scène, presets matériau/éclairage, texte libre optionnel,
  réglages qualité/ratio/résolution/quantité, comparateur avant/après et
  téléchargement du résultat.
- **Animate** — transforme un rendu en mouvement de caméra cinématique
  (4/8/12 s), avec narration IA optionnelle (TTS ElevenLabs + merge ffmpeg).
- **Dropdown « modèle »** — liste curatée de noms PRODUIT : le choix de
  l'utilisateur est essayé en premier, le fallback sur les autres
  fournisseurs reste automatique.
- **Edit / Audio** — onglets visibles dans le studio, fonctionnalités à
  venir (jalon 5 de la feuille de route).

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
- **ffmpeg** dans le PATH — requis uniquement pour le merge narration de la
  chaîne Animate
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
| `ELEVENLABS_API_KEY` | ElevenLabs | Narration TTS de la chaîne Animate |
| `MAGIC_HOUR_API_KEY` | Magic Hour | Image + vidéo — agrégateur (exception assumée, éligible free tier) |
| `COMFYUI_CHECKPOINT` | ComfyUI (local) | Serveur de test hors-ligne sur votre GPU |

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
  app/dashboard/          # STUDIO : upload, presets, génération,
                          #   comparateur avant/après, historique session
  api/generate/           # POST multipart -> job ; GET [id] -> statut
  api/credits/balance/    # solde de crédits (stub jusqu'au jalon DB)
  api/media/[name]/       # sert les vidéos mergées (ffmpeg) en local
components/
  studio/                 # panneaux du studio (modèle, presets, animate…)
  ui/                     # shadcn/ui (installé à la main, style new-york)
  compare-slider.tsx      # comparateur avant/après
  upload-dropzone.tsx     # drag & drop + aperçu (PNG/JPEG/WebP, 10 Mo max)
lib/
  ai/catalog.ts           # LE fichier central : feature -> candidats ordonnés
  ai/providers/           # un adaptateur par API officielle (+ http.ts : helpers)
  ai/router.ts            # orchestration : tri, fallback, chaînage
  ai/chains/animate.ts    # chaîne vidéo -> TTS -> merge ffmpeg
  ai/prompt-templates.ts  # prompts versionnés (presets -> prompt de génération)
  ai/media.ts             # merge vidéo+audio ffmpeg, stockage temp local
  ai/types.ts             # schéma interne normalisé (aucun nom de fournisseur)
  jobs/store.ts           # jobs en mémoire (remplaçable par BullMQ)
  model-options.ts        # dropdown modèle (noms PRODUIT) — client-safe
  presets.ts  costs.ts  credits.ts  features.ts  download.ts  utils.ts
scripts/                  # tests hors-ligne (routeur, adaptateur ComfyUI)
legacy/                   # ancien backend FastAPI (référence, non utilisé)
```

## Fonctionnement d'une génération

1. Le client POST `multipart/form-data` vers `/api/generate` (image +
   feature + `sceneTypeId`/`motionId` + `modelOption` optionnel + réglages
   qualité/ratio/résolution/quantité).
2. La route valide (type, taille), construit le prompt via
   `lib/ai/prompt-templates.ts`, résout le modèle choisi et crée un job.
3. Le routeur (`lib/ai/router.ts`) essaie les candidats du catalogue dans
   l'ordre (modèle choisi en premier, puis tier de qualité), chacun sur
   l'API officielle de son fournisseur ; échec → fallback automatique.
   Animate chaîne ensuite TTS (ElevenLabs) + merge ffmpeg.
4. Le client polle `GET /api/generate/{jobId}` toutes les 2,5 s jusqu'à
   `done` (avec `outputUrls`) ou `error`.

## Feuille de route

Ordre de construction convenu (détail et exigences d'architecture dans
`AGENTS.md`) :

1. Scaffold Next.js + Tailwind + shadcn/ui — **fait**.
2. Boucle upload → API → modèle IA → affichage (Print Render, sans auth ni
   facturation) — **fait (jalon courant)**.
3. Auth (Supabase Auth), schéma DB, système de crédits.
4. Abonnements Stripe + webhooks + mint des crédits.
5. Fonctionnalités suivantes (mood swap, chat edit, upscale 4K).
6. Object swap et new angle (itération lourde).
7. Landing page marketing.

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

# AGENTS.md — Immo AI Platform (RenderStudio)

Ce fichier s'adresse aux agents de code IA. Il décrit le dépôt tel qu'il
existe réellement — ne rien supposer au-delà de ce qui est écrit ici.

## Vue d'ensemble

SaaS de **rendu architectural par IA** (concept type RenderLab) : les
architectes / designers d'intérieur déposent un screenshot brut de viewport
3D (SketchUp, Revit, 3ds Max) et obtiennent un rendu photoréaliste.
L'utilisateur peut choisir un modèle parmi une liste curatée de noms
PRODUIT (dropdown du studio) : son choix est essayé EN PREMIER, le
fallback sur les autres modèles reste automatique et invisible.

Refonte en cours d'un ancien backend FastAPI : celui-ci est archivé dans
`legacy/` (conservé comme référence pour les presets et le registre, non
fonctionnel en l'état). Le nouveau stack est **Next.js full-stack**.

Trois principes d'architecture à respecter dans toute modification :

1. **Aucun modèle fondamental n'est développé ici, et aucun agrégateur.**
   Chaque capacité IA appelle l'API OFFICIELLE de l'éditeur du modèle
   (BFL, Google, Kling, Runway, ElevenLabs, OpenAI) — pas de
   vendor lock-in. **Exception assumée** (demande explicite du propriétaire,
   juillet 2026) : Magic Hour, plateforme AGRÉGATRICE, est câblée comme
   fournisseur `magichour` (image : flux-2-klein épinglé, éligible free
   tier ; vidéo : routage `default`) — ne pas ajouter d'autre agrégateur
   sans décision explicite. Le catalogue `lib/ai/catalog.ts`
   (feature -> candidats
   ordonnés) et les adaptateurs `lib/ai/providers/` sont le centre de
   l'architecture : changer de fournisseur/modèle = modifier UNE entrée
   du catalogue (+ éventuellement son adaptateur), jamais de code ailleurs.
2. **Les clés API ne quittent JAMAIS le serveur.** Tous les appels modèles
   passent par des Route Handlers (`app/api/...`) ; les clés fournisseurs
   (`BFL_API_KEY`, `GOOGLE_API_KEY`...) ne sont lues que par les
   adaptateurs `lib/ai/providers/`. Aucune variable sensible ne doit
   être préfixée `NEXT_PUBLIC_`.
3. **L'utilisateur n'écrit jamais de prompt technique.** Il clique des
   presets (type de scène, matériau, éclairage) + texte libre optionnel ;
   la traduction en prompt de génération se fait dans
   `lib/ai/prompt-templates.ts`.

## Stack technique

- **Next.js 14.2** (App Router) + **React 18** + **TypeScript strict**
- **TailwindCSS 3.4** + **shadcn/ui** (style new-york, base zinc, variables
  CSS, thème sombre par défaut via `class="dark"` sur `<html>`)
- **Fetch natif + node:crypto** — appels directs aux API officielles des
  fournisseurs (submit + polling), aucune dépendance SDK propriétaire
- Pas encore intégrés (jalons suivants, voir feuille de route) :
  **Supabase** (auth + Postgres + storage), **Stripe** (Checkout +
  Customer Portal + webhooks)

Il n'y a pas de `src/` : l'App Router est à la racine dans `app/`.

## Structure du code

```
app/
  page.tsx                    # redirige vers /app/dashboard (la landing
                              #   marketing arrive en dernier)
  layout.tsx                  # fonts Geist, metadata, thème sombre
  globals.css                 # variables CSS shadcn (zinc, light+dark)
  app/dashboard/page.tsx      # STUDIO : onglets de fonctionnalités, upload,
                              #   type de scène, presets, dropdown modèle,
                              #   génération, polling 2,5 s, comparateur
                              #   avant/après, historique session
  api/generate/route.ts       # POST multipart (image + sceneTypeId +
                              #   modelOption? + réglages) -> crée le job et
                              #   lance l'orchestration -> { jobId }
  api/generate/[id]/route.ts  # GET -> statut du job -> { status, outputUrls? }
  api/credits/balance/route.ts# GET -> solde de crédits (stub jusqu'au jalon DB)
  api/media/[name]/route.ts   # sert les vidéos mergées (ffmpeg) en local
components/
  compare-slider.tsx          # comparateur avant/après (clip-path + pointer events)
  upload-dropzone.tsx         # drag & drop + aperçu (PNG/JPEG/WebP, 10 Mo max)
  studio/model-picker.tsx     # dropdown modèle (Featured/All, noms PRODUIT)
  studio/scene-type-picker.tsx# "Customize Scene" : 3 types de scène préparés
  studio/generation-controls.tsx # barre basse : dropdowns modèle/quantité/
                              #   qualité/ratio/résolution + bouton Generate
  studio/animate-panel.tsx    # panneau Animate (source, motion, durée,
                              #   narration, dropdown modèle)
  studio/preset-grid.tsx      # vignettes cliquables (matériau, éclairage)
  studio/...                  # result-panel, references-panel, scene-details,
                              #   settings-accordion, feature-card, icon-grid
  ui/                         # composants shadcn/ui (button, card, tabs,
                              #   badge, skeleton, textarea, switch, select)
lib/
  ai/catalog.ts               # LE fichier central : feature -> candidats
                              #   (provider, modelId officiel, coût interne)
  ai/providers/               # un adaptateur par API officielle (bfl, google,
                              #   kling, runway, elevenlabs, openai +
                              #   magichour, agrégateur — exception §1 ;
                              #   comfyui — serveur local de test) + index.ts
                              #   (registre + contrôle de configuration)
  ai/router.ts                # orchestration : tri (tier + modèle choisi),
                              #   fallback, chaînage
  ai/chains/animate.ts        # chaîne vidéo -> TTS -> merge ffmpeg
  ai/prompt-templates.ts      # prompts VERSIONNÉS (fragments par preset)
  ai/media.ts                 # merge vidéo+audio ffmpeg, stockage temp local
  ai/logger.ts                # trace des tentatives (analytics interne)
  ai/types.ts                 # schéma interne normalisé (Feature, Provider,
                              #   GenerationRequest/Result) — le client ne
                              #   connaît jamais les fournisseurs
  ai/providers/http.ts        # helpers partagés des adaptateurs (JSON,
                              #   polling avec timeout, base64)
  model-options.ts            # options du dropdown modèle (noms PRODUIT ->
                              #   clés génériques du catalogue) — CLIENT-SAFE
  presets.ts                  # métadonnées UI des presets (types de scène,
                              #   matériaux, éclairage, motion, bornes)
  costs.ts                    # coûts en crédits affichés/facturés
  credits.ts                  # solde (stub jusqu'au jalon DB)
  features.ts                 # métadonnées d'affichage des onglets/features
                              #   (noms PRODUIT) — CLIENT-SAFE
  download.ts                 # téléchargement client d'un résultat (blob ->
                              #   <a download>, repli nouvel onglet)
  jobs/store.ts               # jobs en mémoire (remplaçable par BullMQ)
  utils.ts                    # cn() (clsx + tailwind-merge)
scripts/
  simulate-fallback.ts        # tests hors-ligne du routeur (npm run test:fallback)
  smoke-comfyui.ts            # test de l'adaptateur ComfyUI contre un serveur
                              #   mock (npm run test:comfyui)
legacy/                       # ancien backend FastAPI (référence, non utilisé)
```

### Flux d'une génération (jalon actuel)

1. Le client POST `multipart/form-data` vers `/api/generate`
   (image + feature + sceneTypeId/motionId + modelOption optionnel +
   réglages qualité/ratio/résolution/quantité).
2. La route valide (type, taille), construit le prompt via
   `lib/ai/prompt-templates.ts`, résout le modèle choisi
   (`lib/model-options.ts` -> clé de candidat interne) et crée un job.
3. Le routeur (`lib/ai/router.ts`) essaie les candidats du catalogue dans
   l'ordre (modèle choisi en premier, puis tier de qualité) — chacun sur
   l'API officielle de son fournisseur ; échec -> fallback automatique.
   Animate chaîne ensuite TTS (ElevenLabs) + merge ffmpeg.
4. Le client polle `GET /api/generate/{jobId}` toutes les 2,5 s jusqu'à
   `done` (avec `outputUrls`) ou `error`.

## Commandes

```bash
npm install
cp .env.example .env.local   # puis renseigner au moins UN fournisseur
                             # (ex. BFL_API_KEY + GOOGLE_API_KEY)
npm run dev                  # http://localhost:3000 -> /app/dashboard
npm run build                # vérif compile + lint + types
npm run test:fallback        # tests hors-ligne du routeur (fallback, tri)
npm run test:comfyui         # test hors-ligne de l'adaptateur ComfyUI (mock)
```

Vérification rapide : `GET /app/dashboard` → 200 ; `POST /api/generate`
sans aucune clé fournisseur → JSON d'erreur explicite (503).

Il n'y a ni Dockerfile, ni CI : seuls le lancement local et la simulation
du fallback ci-dessus sont définis.

## Configuration

Toutes les clés sont côté serveur via `.env.local` (voir `.env.example`,
chaque entrée y est documentée) : `BFL_API_KEY` (Flux Kontext),
`GOOGLE_API_KEY` (Nano Banana),
`KLING_SECRET_KEY` (Kling), `RUNWAY_API_KEY` (Gen-4),
`ELEVENLABS_API_KEY` (narration), `OPENAI_API_KEY` (GPT Image + Sora),
`MAGIC_HOUR_API_KEY` (agrégateur — exception §1),
`COMFYUI_CHECKPOINT` (+ options, serveur local de test — voir .env.example).
Un fournisseur non configuré échoue vite
et le routeur bascule sur le suivant — configurer au moins un fournisseur
image et un fournisseur vidéo pour couvrir les deux fonctionnalités.
À venir : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_*`.

## Conventions de code

- **Langue** : commentaires et docs en **français** ; identifiants, code et
  **copy UI en anglais**. Conserver cette règle.
- Docstrings de module qui expliquent le **pourquoi** (choix d'architecture),
  pas seulement le quoi — en particulier `registry.ts`, routes API, page studio.
- Typage systématique (TS strict, pas de `any` non justifié).
- Composants serveur par défaut ; `"use client"` uniquement pour
  l'interactivité (upload, slider, polling).
- Images distantes : balises `<img>` natives (les URLs de résultat sont des
  CDN fournisseurs) — si `next/image` est adopté, ajouter `remotePatterns`
  dans `next.config.mjs`.
- Changement de fournisseur ou de version de modèle IA : toucher
  **uniquement** `MODEL_CATALOG` dans `lib/ai/catalog.ts` (et l'adaptateur
  `lib/ai/providers/<provider>.ts` si le fournisseur est nouveau), rien
  d'autre. Exposer un nouveau choix dans le dropdown = ajouter UNE entrée
  dans `lib/model-options.ts` qui pointe vers la clé du candidat.
- shadcn/ui a été installé **à la main** (le CLI npm était défaillant) :
  `components.json` + `components/ui/` + thème dans `tailwind.config.ts` et
  `globals.css`. Pour ajouter un composant, reprendre le source officiel
  (style new-york) ou réessayer le CLI.

## Feuille de route (spec produit)

Ordre de construction convenu — **ne pas avancer sans validation de l'étape
courante** :

1. ~~Scaffold Next.js + Tailwind + shadcn/ui~~ — fait.
2. ~~Boucle upload -> API -> modèle IA -> affichage pour Print-to-Render,
   sans auth ni facturation~~ — **fait (jalon courant)**.
3. Auth (Supabase Auth), schéma DB, système de crédits.
4. Abonnements Stripe + webhooks + mint des crédits.
5. Fonctionnalités suivantes (mood swap, chat edit, upscale 4K) — même
   pipeline, autres presets/prompts.
6. Object swap et new angle en dernier (itération lourde).
7. Landing page marketing en tout dernier.

Exigences d'architecture pour les jalons 3-4 (à respecter telles quelles) :

- Chaque génération : vérifier le solde de crédits → refus si insuffisant →
  appel modèle → **débit uniquement au succès** → log (input, output, coût,
  timestamp) → retour client.
- Coûts par action en **table de config** `action_costs(feature_type,
  credit_cost)`, pas en dur (le `creditCost` du registre est indicatif).
- **Ledger append-only** `credit_ledger(id, user_id, delta, reason,
  created_at)` : entrées mint/spend/refund/expire, pas juste un solde.
- Tables minimales : `users`, `subscriptions`, `credit_ledger`,
  `generations`, `action_costs`.
- Webhook Stripe : succès de paiement d'abonnement → mint des crédits de la
  période ; annulation → arrêt des mints futurs, crédits existants
  utilisables jusqu'à la fin de période ; top-up unitaire réservé aux
  abonnés actifs.
- Jobs : polling simple en table pour le MVP, conçu pour être remplaçable
  par une vraie file (BullMQ) plus tard.

## État d'avancement et pièges connus

- **Pivot fournisseurs fait** : fal.ai retiré, chaque modèle est appelé sur
  l'API officielle de son éditeur via `lib/ai/providers/`. `npm run build`
  et `npm run test:fallback` passent ; smoke test dev OK (redirect
  `/` → `/app/dashboard`, 503 propre sans clé).
- ⚠️ **Les adaptateurs fournisseurs n'ont pas encore été validés contre les
  API réelles** (aucune clé configurée au moment de l'écriture) : chaque
  `modelId` est indicatif — vérifier la doc du fournisseur au premier
  branchement de clé (le fallback absorbe un id invalide, mais le coût
  d'appel reste réel). Le `model_name` exact de **Kling v3** est à
  confirmer dans la console Kling.
- Le dropdown "modèle" du studio expose des noms PRODUIT
  (`lib/model-options.ts`) ; il change juste quel candidat est essayé en
  premier — le fallback reste automatique (testé dans
  `scripts/simulate-fallback.ts`).
- Pas d'auth : la route `/api/generate` est **ouverte** — ne pas exposer
  telle quelle en production.
- L'image transite en data URI base64 (10 Mo max) ; S3/Supabase Storage
  prendra le relais au jalon DB.
- L'historique du studio est **en mémoire** (session navigateur) — la
  persistance arrive avec la DB.
- Le dépôt est versionné (git). ⚠️ `.env` (clés réelles) ne doit jamais
  être committé — il est listé dans `.gitignore`.
- `legacy/` n'est pas destiné à être exécuté ; ne pas importer depuis.

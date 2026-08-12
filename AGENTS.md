# AGENTS.md — Immo AI Platform (RenderStudio)

Ce fichier s'adresse aux agents de code IA. Il décrit le dépôt tel qu'il
existe réellement — ne rien supposer au-delà de ce qui est écrit ici.
Pour un guide fichier-par-fichier (lancer / comprendre / modifier), voir
`GUIDE.md`.

## Vue d'ensemble

SaaS de **rendu architectural par IA** — **agrégateur IA VERTICAL** pour
architectes, professionnels de l'archviz, décorateurs d'intérieur et
agents immobiliers. Ce n'est PAS un outil généraliste de création de
contenu (type Magnific/Higgsfield visant pub, cinéma, réseaux sociaux).

Scope MVP : **10 fonctions métier** —

1. **Render** : screenshot 3D (SketchUp, Revit, 3ds Max) -> rendu
   photoréaliste, géométrie préservée ;
2. **Mood** : même scène, variation jour/nuit/saison/météo ;
3. **Exterior -> Interior** : vue intérieure plausible et cohérente
   depuis un rendu extérieur ;
4. **Plan to Render** : plan technique 2D -> rendu meublé/paysagé ;
5. **Animate** : vidéo courte de présentation (4-8 s, mouvement de caméra
   simple) ;
6. **Multi-Angle** : 2-3 angles de caméra additionnels (cohérence
   best-effort) ;
7. **Video Upscaler** : amélioration de la résolution d'une vidéo ;
8. **Clip Editor / Video Project Editor** : découpe, assemblage et montage
   simple de clips ;
9. **Voice Generator (Speak)** : génération audio / voix off à partir d'un
   texte ;
10. **Models** : page de découverte des modèles disponibles (image, vidéo,
    audio, upscaling).

Exclusions V1 (ne pas implémenter, retirer le cas échéant) :
édition conversationnelle par chat, swap d'objets/mobilier, presets non liés
au bâti, et **tout sélecteur de modèle IA visible** — le routage entre
modèles est 100% serveur, le fallback automatique et invisible. La narration
/voix off a été temporairement réintégrée à la demande explicite pour le
Voice Generator.

Le stack actuel est **Next.js 14 full-stack** ; le backend FastAPI n'a pas
été retiré — il a été déplacé dans le service **`/worker`** qui détient
toute la logique IA, les clés providers et le stockage local. `/web` et
`/worker` partagent la base PostgreSQL via `DATABASE_URL`.

Les deux fichiers d'environnement sont documentés dans `ENVIRONMENT.md`.

Trois principes d'architecture à respecter dans toute modification :

1. **Aucun modèle fondamental n'est développé ici, et aucun agrégateur.**
   Chaque capacité IA appelle l'API OFFICIELLE de l'éditeur du modèle
   (BFL, Google, Kling, Runway, OpenAI) — pas de
   vendor lock-in. **Exception assumée** (demande explicite du propriétaire,
   juillet 2026) : Magic Hour, plateforme AGRÉGATRICE, est câblée comme
   fournisseur `magichour` (image : flux-2-klein épinglé, éligible free
   tier ; vidéo : routage `default`) — ne pas ajouter d'autre agrégateur
   sans décision explicite. Le catalogue `worker/catalog.py`
   (feature -> candidats
   ordonnés) et les adaptateurs `worker/providers/` sont le centre de
   l'architecture : changer de fournisseur/modèle = modifier UNE entrée
   du catalogue (+ éventuellement son adaptateur), jamais de code ailleurs.
   Chaque candidat porte un `cost_per_generation` (coût réel provider) et
   la sélection "Auto" choisit le moins cher satisfaisant le tier qualité.
   Le prix utilisateur en crédits découle de ce coût × `margin_multiplier`
   (table `action_costs` / `video_action_costs`).
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
- **Supabase Auth + Postgres** intégrés via `@supabase/ssr` ; sessions
  validées côté serveur dans `middleware.ts`.
- **Stripe** intégré (Checkout + Customer Portal + webhooks) pour
  l'abonnement et le mint des crédits périodiques.

Il n'y a pas de `src/` : l'App Router est à la racine dans `app/`.

## Structure du code

```
/                         <- racine : docker-compose, schéma DB, README
├── web/                  <- Next.js 14 App Router + routes API
│   ├── app/
│   │   ├── page.tsx                 # landing si déconnecté, dashboard si connecté
│   │   ├── layout.tsx               # fonts, metadata, thème sombre, toaster
│   │   ├── middleware.ts            # protection /app/* + Supabase SSR
│   │   ├── app/dashboard/page.tsx   # home / dashboard
│   │   ├── app/ai-image-generator/  # Screenshot-to-Render
│   │   ├── app/ambiance-change/     # Mood
│   │   ├── app/exterior-to-interior/# Ext -> Int
│   │   ├── app/plan-to-render/      # Plan -> Furnished Render
│   │   ├── app/multi-angle/         # Multi-Angle
│   │   ├── app/upscale/             # Image Upscale
│   │   ├── app/ai-video-generator/ # Video Generator
│   │   ├── app/video-upscaler/      # Video Upscaler
│   │   ├── app/clip-editor/         # Clip Editor
│   │   ├── app/video-project-editor/# Video Project Editor
│   │   ├── app/voice-generator/      # Voice Generator (Speak)
│   │   ├── app/models/               # Modèles disponibles
│   │   ├── app/account/              # profil, plan, crédits, suppression
│   │   ├── app/settings/             # email / mot de passe / profil
│   │   ├── app/pricing/              # plans + souscription Stripe
│   │   ├── login/                    # connexion email/Google
│   │   ├── signup/                   # inscription
│   │   ├── forgot-password/          # demande reset
│   │   ├── reset-password/           # nouveau mot de passe
│   │   └── api/                      # routes API Next.js (auth, generate,
│   │                                 #   credits, stripe, jobs/notifications)
│   ├── components/
│   │   ├── navigation/    # ToolPickerPopover, AppSidebar, ToolCard, CommandPalette
│   │   ├── video-generator/# composants du Video Generator
│   │   ├── studio/        # workspaces image réutilisables
│   │   ├── billing/       # CreditAlert, boutons Stripe
│   │   ├── jobs/          # notifications de fin de génération
│   │   └── ui/            # composants shadcn/ui
│   ├── lib/
│   │   ├── config/tools.ts           # catalogue unique des outils
│   │   ├── credits/index.ts          # coûts et solde
│   │   ├── db/                       # client et requêtes Postgres
│   │   ├── supabase/                 # clients client/server + middleware
│   │   ├── auth.ts                   # requireAuth(), requireServiceRoleClient()
│   │   ├── stripe.ts                 # getStripe() + helpers billing
│   │   ├── rate-limit.ts             # rate-limit IP login/signup
│   │   ├── worker-client.ts          # client HTTP vers le worker
│   │   ├── video-utils.ts            # modes vidéo et coûts
│   │   └── presets.ts                # métadonnées des presets UI
│   └── .env.example      # DB + worker URLs uniquement, AUCUNE clé IA
│
├── worker/               <- FastAPI Python : logique IA, providers, stockage
│   ├── main.py           # application FastAPI + routers
│   ├── config.py         # variables d'environnement
│   ├── catalog.py        # MODEL_CATALOG feature -> candidats
│   ├── providers/        # un fichier = un provider officiel (bfl, google,
│   │                     #   kling, runway, openai, magichour, removebg,
│   │                     #   upscale, elevenlabs)
│   ├── workflows/        # image_render.py, video.py, upscale.py, audio.py,
│   │                     #   video_edit.py, video_upscale.py, common.py
│   ├── routes/           # endpoints FastAPI (generate, jobs, models,
│   │                     #   upscale, storage, audio, video/edit, video/upscale)
│   ├── storage/          # fichiers générés en local (dev)
│   └── .env.example      # clés providers + DB + worker URLs
│
└── db/                   <- schéma PostgreSQL unique (web + worker)
    ├── schema.sql
    └── migrations/
```


### Flux d'une génération (jalon actuel)

1. Le client POST `multipart/form-data` vers `/api/generate`
   (image + feature + sceneTypeId/motionId + réglages
   qualité/ratio/résolution/quantité/durée).
2. La route valide (type, taille), construit le prompt via
   `lib/ai/prompt-templates.ts` et crée un job.
3. Le routeur (`lib/ai/router.ts`) essaie les candidats du catalogue dans
   l'ordre (tier de qualité) — chacun sur l'API officielle de son
   fournisseur ; échec -> fallback automatique.
4. Le client polle `GET /api/generate/{jobId}` toutes les 2,5 s jusqu'à
   `done` (avec `outputUrls`) ou `error`.

## Commandes

```bash
# 1. Base de données
docker compose up -d db
docker compose exec -T db psql -U renderstudio -d renderstudio < db/schema.sql

# 2. Worker FastAPI
cd worker
python -m venv .venv
./.venv/Scripts/python -m pip install -r requirements.txt
cp .env.example .env   # renseigner les clés providers
./.venv/Scripts/python -m uvicorn main:app --port 8000

# 3. Web Next.js
cd web
npm install
cp .env.example .env.local   # DB + worker URLs uniquement, aucune clé IA
npm run dev                  # http://localhost:3000 -> /app/dashboard
npm run build                # vérif compile + lint + types
npm run lint                 # lint ESLint
```

Vérification rapide : `GET /app/dashboard` → 200 ; `POST /api/generate`
sans aucune clé fournisseur → JSON d'erreur explicite (503). Voir
`ENVIRONMENT.md` pour la répartition des variables d'environnement.

Il n'y a ni Dockerfile, ni CI : seuls le lancement local et le build sont
définis.

## Configuration

Toutes les clés sont côté serveur via `.env` du worker (voir
`ENVIRONMENT.md` et `worker/.env.example`, chaque entrée y est documentée) :
`BFL_API_KEY` (Flux Kontext), `GOOGLE_API_KEY` (Nano Banana),
`KLING_SECRET_KEY` (Kling), `RUNWAY_API_KEY` (Gen-4),
`OPENAI_API_KEY` (GPT Image + Sora), `MAGIC_HOUR_API_KEY` (agrégateur —
exception §1), `ELEVENLABS_API_KEY` (Voice Generator), `WORKER_API_KEY`
(protection mutuelle worker ↔ web).

`web/.env.local` contient `DATABASE_URL`, `WORKER_BASE_URL`,
`WORKER_PUBLIC_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` et
`NEXT_PUBLIC_APP_URL` — aucune clé provider IA. Voir `ENVIRONMENT.md`.

Un fournisseur non configuré est simplement sauté par le fallback.
Configurer au moins un fournisseur image, un fournisseur vidéo et, si le
Voice Generator est utilisé, `ELEVENLABS_API_KEY`.

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
  d'autre. (Le sélecteur de modèle a été retiré en V1 : le routage est
  100% serveur, aucune liste de modèles côté client.)
- shadcn/ui a été installé **à la main** (le CLI npm était défaillant) :
  `components.json` + `components/ui/` + thème dans `tailwind.config.ts` et
  `globals.css`. Pour ajouter un composant, reprendre le source officiel
  (style new-york) ou réessayer le CLI.

## Feuille de route (spec produit)

Ordre de construction convenu avec le propriétaire (recadrage MVP —
juillet 2026) — **ne pas avancer sans validation de l'étape courante** :

1. ~~Scaffold Next.js + Tailwind + shadcn/ui~~ — fait.
2. ~~Fonction 1 — Screenshot-to-Render (boucle upload -> API -> modèle IA
   -> affichage, sans auth ni facturation)~~ — fait.
3. ~~Fonction 5 — vidéo courte de présentation (4-8 s, sans narration)~~ —
   fait.
4. ~~Fonctions 2, 3, 4 et 6 — Mood, Exterior -> Interior, Plan to Render,
   Multi-Angle (même pipeline image, prompts dédiés ; multi-angle en
   cohérence best-effort)~~ — fait.
5. ~~Auth (Supabase Auth), schéma DB, système de crédits~~ — fait.
6. ~~Abonnements Stripe + webhooks + mint des crédits~~ — fait.
7. Landing page marketing en tout dernier.

Exigences d'architecture pour les jalons 5-6 (à respecter telles quelles) :

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

- **Architecture actuelle** : Next.js `/web` + FastAPI `/worker` + PostgreSQL
  partagée. Les clés providers vivent uniquement dans `worker/.env`. Voir
  `ENVIRONMENT.md`.
- **Navigation home + popover d'outils** : outils image (`/app/ai-image-generator`,
  `/app/ambiance-change`, `/app/exterior-to-interior`, `/app/plan-to-render`,
  `/app/upscale`, `/app/multi-angle`, `/app/image-extender`, `/app/variations`,
  `/app/background-remover`), vidéo (`/app/ai-video-generator`,
  `/app/video-upscaler`, `/app/clip-editor`, `/app/video-project-editor`),
  audio (`/app/voice-generator`), et modèles (`/app/models`). Le dashboard
  `/app/dashboard` est le portail d'entrée avec `ToolPickerPopover` partagé.
- Un audit des adaptateurs providers a été réalisé et plusieurs corrections
  appliquées (BFL : endpoint `.ai` et états de polling ; Google : modèle
  `gemini-3-pro-image` ; Kling : corps de requête legacy et JWT ; Runway :
  suppression de `endImage` non supporté ; ElevenLabs : voix par défaut
  mise à jour). L'utilitaire `worker/scripts/audit_providers.py` permet de
  relancer les tests end-to-end quand une clé ou un provider change.
- **Recadrage MVP** : agrégateur vertical archviz/immobilier — les outils
  ajoutés (Voice Generator, Video Editor, Video Upscaler) restent orientés
  production multimédia de présentation. Le sélecteur de modèle reste
  invisible côté client (routage 100% serveur).
- **Auth** : toutes les routes `/app/*` sont protégées par `middleware.ts`
  (Supabase SSR). Les routes API filtrent par `user_id` et le worker
  exige `WORKER_API_KEY`. En local, `AUTH_DEBUG=true` fournit un fallback
  dev (ne pas utiliser en production).
- L'image transite en data URI base64 (10 Mo max) ; S3/Supabase Storage
  prendra le relais au jalon DB.
- L'historique du studio est **en mémoire** (session navigateur) — la
  persistance arrive avec la DB.
- Le dépôt est versionné (git). ⚠️ `.env` (clés réelles) ne doit jamais
  être committé — il est listé dans `.gitignore`.

# RenderStudio Web

Interface Next.js 14 + TypeScript. Gère le studio, les projets/assets, les crédits, et les appels au worker FastAPI. Ce dossier ne contient **aucune clé de provider IA** : les appels IA passent exclusivement par le worker (`WORKER_BASE_URL`).

## Lancer en local

Depuis la racine du dépôt :

```bash
cd web
npm install

# Copier et ajuster DATABASE_URL / WORKER_BASE_URL / WORKER_PUBLIC_URL
# Voir ENVIRONMENT.md à la racine pour la répartition complète.
cp .env.example .env.local

npm run dev
```

Ouvrir `http://localhost:3000`.

## Build + lint

```bash
npm run build
npm run lint
```

## Scripts utilitaires

```bash
# Suppression définitive des assets mis à la corbeille depuis +30 jours
npm run purge:trash
```

## Structure des fichiers

```
app/
  page.tsx                          # landing si déconnecté, dashboard si connecté
  layout.tsx                        # fonts, metadata, thème sombre
  globals.css                       # variables CSS shadcn/ui
  app/
    dashboard/page.tsx              # portail d'entrée (home)
    ai-image-generator/page.tsx   # Screenshot-to-Render
    ambiance-change/page.tsx      # Mood
    exterior-to-interior/page.tsx   # Ext → Int
    plan-to-render/page.tsx       # Plan → Furnished Render
    multi-angle/page.tsx          # Multi-Angle
    upscale/page.tsx              # Image Upscale
    ai-video-generator/page.tsx   # Video Generator
    video-upscaler/page.tsx       # Video Upscaler
    clip-editor/page.tsx          # Clip Editor
    video-project-editor/page.tsx # Video Project Editor
    voice-generator/page.tsx      # Voice Generator (Speak)
    models/page.tsx               # Modèles disponibles
    projects/                     # liste et détail des projets
    favorites/, uploads/, trash/    # vues filtrées des assets
    studio/page.tsx               # route legacy ?tab=...
  api/                              # routes serveur Next.js
    generate/                     # POST image -> job ID
    video/generate/               # POST video -> job ID
    video/edit/                   # POST video edit -> job ID
    video/upscale/                # POST video upscale -> job ID
    audio/generate/               # POST voice -> job ID
    models/                       # GET modèles disponibles
    config/costs/                 # GET coûts (affiché = facturé)
    credits/balance/              # GET solde crédits
    assets/                       # GET/POST assets
    projects/                     # GET/POST projets
components/
  navigation/
    ToolPickerPopover.tsx         # popover de choix d'outils (Image/Video/Audio)
    ToolCard.tsx                  # carte d'outil dans le popover
    AppSidebar.tsx                # sidebar latérale (Home, Projects, ...)
    CommandPalette.tsx            # palette Ctrl+K
  studio/                         # workspaces image réutilisables
  video-generator/                # composants du Video Generator
  projects/                       # cartes projets/assets
  ui/                             # composants shadcn/ui
lib/
  config/tools.ts                 # catalogue unique des outils (id, icône, route)
  credits/index.ts                # calcul du coût + solde (serveur)
  config/action-costs.ts          # formule côté client (affiché = facturé)
  db/index.ts                     # client Postgres
  db/queries.ts                   # requêtes SQL pures
  worker-client.ts                # wrapper fetch vers le worker
  presets.ts                      # métadonnées UI des presets
  video-utils.ts                  # modes vidéo + coût vidéo
scripts/
  purge-trash.ts                  # nettoyage programmé corbeille
```

## Règles d'architecture

- `/web` ne parle **jamais** aux providers IA ; il appelle `/worker` via `WORKER_BASE_URL`.
- Aucune variable sensible ne doit être préfixée `NEXT_PUBLIC_`.
- Les coûts affichés sont calculés avec la même formule que côté serveur (`lib/credits` et `lib/config/action-costs`).

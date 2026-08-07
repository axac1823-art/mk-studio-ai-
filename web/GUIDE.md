# GUIDE.md — Lancer, comprendre et modifier RenderStudio

Guide développeur complet. Pour l'architecture détaillée et la feuille de
route : [`AGENTS.md`](AGENTS.md). Pour le démarrage rapide :
[`README.md`](README.md).

---

## 1. Lancer le projet

### Prérequis

- **Node.js ≥ 18.17** (20 LTS recommandé) + npm
- Au moins **une clé fournisseur image** et **une clé vidéo** (voir
  `.env.example` — un fournisseur non configuré échoue vite et le routeur
  bascule sur le suivant, donc un sous-ensemble suffit)
- Optionnel : un serveur **ComfyUI** local pour tester gratuitement
  (image et vidéo sur votre GPU)

### Installation et démarrage

```bash
npm install
cp .env.example .env.local   # renseigner au moins une clé (ex. BFL_API_KEY)
npm run dev                  # http://localhost:3000 -> /app/dashboard
```

### Scripts (`package.json`)

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement (port 3000) |
| `npm run build` | Vérification complète : compile + lint + types |
| `npm start` | Sert le build de production |
| `npm run lint` | ESLint seul |
| `npm run test:fallback` | Tests hors-ligne du routeur (tri, fallback) |
| `npm run test:comfyui` | Test de l'adaptateur ComfyUI contre un serveur mock (image + vidéo) |

### Vérifications rapides

- `GET http://localhost:3000/` → redirection 307 vers `/app/dashboard` (home)
- `GET /app/dashboard` → 200 (home)
- `GET /app/studio` → 200 (studio image)
- `POST /api/generate` sans aucune clé → 503 JSON explicite (c'est le
  garde-fou `isAnyProviderConfigured()`)

---

## 2. Comment ça fonctionne (flux d'une génération)

```
Navigateur — app/app/dashboard/page.tsx (home : greeting, recherche, lanceur d'outils)
   │  Clique sur Image/Video → ToolPickerPopover → ouvre une page d'outil
   ▼
app/app/ai-image-generator | ambiance-change | exterior-to-interior |
plan-to-render | upscale | multi-angle | ai-video-generator
   │  POST /api/generate (multipart : image + feature + presets + réglages)
   ▼
app/api/generate/route.ts
   │  1. vérifie la config (providers/index.ts) et le solde (lib/credits.ts)
   │  2. construit le prompt (lib/ai/prompt-templates.ts)
   │  3. crée le job (lib/jobs/store.ts) et lance l'orchestration en
   │     arrière-plan, puis répond { jobId }
   ▼
lib/ai/router.ts — essaie les candidats de lib/ai/catalog.ts dans l'ordre
   │  (fallback automatique en cas d'échec/timeout), chacun appelle
   ▼
lib/ai/providers/<fournisseur>.ts — API OFFICIELLE de l'éditeur du modèle
   │  (submit + polling, réponse normalisée { images } / { video })
   ▼
lib/jobs/store.ts — statut "done" + outputUrls
   ▲
Navigateur — poll GET /api/generate/[id] toutes les 2,5 s jusqu'à
   "done" (affiche le résultat) ou "error" (message générique)
```

Cas particuliers :

- **Vidéo Sora / ComfyUI local** : le mp4 est stocké sur disque par
  `lib/ai/media.ts` et servi par `app/api/media/[name]/route.ts`
  (`/api/media/<uuid>.mp4`).
- **Résolution 2K/4K** : le routeur enchaîne un post-traitement `upscale`
  — aujourd'hui vide dans le catalogue, donc sautée (dégradation gracieuse).
- **Crédits** : le solde est un stub (`lib/credits.ts` = 100) ; le débit
  réel arrive au jalon DB (ledger append-only, voir AGENTS.md).

---

## 3. Fichier par fichier

### Racine

| Fichier | Rôle | Quand y toucher |
| --- | --- | --- |
| `AGENTS.md` | Spec architecture + feuille de route (agents IA) | Après tout changement de structure/convention |
| `README.md` | Démarrage rapide + présentation | Nouvelle feature, nouveau script |
| `GUIDE.md` | Ce fichier | Toute modification des recettes ci-dessous |
| `.env.example` | Toutes les variables documentées | Nouvelle clé/option fournisseur |
| `package.json` | Dépendances + scripts | Nouveau script npm |
| `next.config.mjs` | Config Next (vide à ce jour) | `remotePatterns` si `next/image` adopté |
| `tailwind.config.ts` | Thème shadcn (zinc, dark) | Couleurs, rayons, polices du thème |
| `components.json` | Config shadcn/ui | Ajout de composants shadcn |
| `tsconfig.json` | TS strict, alias `@/*` | — |
| `legacy/` | Ancien backend FastAPI (archive) | Jamais (référence en lecture seule) |

### `app/` — App Router

| Fichier | Rôle |
| --- | --- |
| `app/page.tsx` | Redirige `/` → `/app/dashboard` (home) |
| `app/layout.tsx` | Fonts Geist, metadata, thème sombre |
| `app/globals.css` | Variables CSS shadcn (light + dark) |
| `app/app/dashboard/page.tsx` | **Home / Dashboard** : greeting, recherche Ctrl+K, header Pricing/Customize, lanceurs Image/Video/Projects, panneaux Projects + Create a space + Recent work |
| `app/app/ai-image-generator/page.tsx` | **Screenshot-to-Render** |
| `app/app/ambiance-change/page.tsx` | **Ambiance Change** |
| `app/app/exterior-to-interior/page.tsx` | **Exterior → Interior** |
| `app/app/plan-to-render/page.tsx` | **Plan → Furnished Render** |
| `app/app/upscale/page.tsx` | **Upscale** |
| `app/app/multi-angle/page.tsx` | **Multi-Angle** |
| `app/app/ai-video-generator/page.tsx` | **Video Generator** : génération vidéo unifiée |
| `app/app/studio/page.tsx` | Route legacy avec `?tab=...` (utilise `ImageStudioWorkspace` avec onglets) |
| `app/app/video/page.tsx` | Redirection vers `/app/ai-video-generator` |
| `app/app/pricing/page.tsx` | Plans tarifaires (placeholder) |
| `app/app/account/page.tsx` | Compte utilisateur (placeholder) |
| `app/api/generate/route.ts` | POST multipart → validation, coût, prompt, job, orchestration |
| `app/api/generate/[id]/route.ts` | GET → statut du job (`pending/processing/done/error`) |
| `app/api/credits/balance/route.ts` | GET → solde (stub 100 jusqu'au jalon DB) |
| `app/api/media/[name]/route.ts` | GET → sert les mp4 stockés localement (nom validé, pas de traversal) |

### `components/` — UI

| Fichier | Rôle |
| --- | --- |
| `components/navigation/ToolPickerPopover.tsx` | Popover partagé dashboard/sidebar : tabs Image/Video, recherche, grid d'outils |
| `components/navigation/ToolCard.tsx` | Carte d'un outil (icône, nom, description, onClick) |
| `components/navigation/Sidebar.tsx` | Sidebar persistente (Home, Projects, catégories Image/Video, settings/account) |
| `components/navigation/CommandPalette.tsx` | Palette de commandes Ctrl+K (stub) |
| `components/upload-dropzone.tsx` | Drag & drop + aperçu (PNG/JPEG/WebP, 10 Mo max) |
| `components/compare-slider.tsx` | Comparateur avant/après (clip-path + pointer events) |
| `components/studio/image-studio-workspace.tsx` | Workspace image réutilisable (state, onglets optionnels, génération, polling) |
| `components/studio/animate-panel.tsx` | Panneau Animate (source, mouvement, durée 4/8 s, bouton Generate propre) |
| `components/studio/image-feature-panel.tsx` | Panneau générique des 4 fonctions image simples (upload + presets + détails) |
| `components/studio/generation-controls.tsx` | Barre basse : quantité/qualité/ratio/résolution + Generate avec coût |
| `components/studio/preset-grid.tsx` | Grille de vignettes cliquables (réutilisée par tous les presets) |
| `components/studio/scene-type-picker.tsx` | Sélecteur de type de scène (Render) |
| `components/studio/settings-accordion.tsx` | Accordéon matériau + éclairage (Render) |
| `components/studio/scene-details.tsx` | Texte libre optionnel (compteur) |
| `components/studio/references-panel.tsx` | Images de référence (Render, 14 max) |
| `components/studio/result-panel.tsx` | Affichage résultat / états busy + comparateur |
| `components/ui/*` | shadcn/ui installé à la main (ne pas éditer à la légère) |

### `lib/` — logique partagée

| Fichier | Rôle |
| --- | --- |
| `lib/ai/catalog.ts` | **LE fichier central** : feature → candidats ordonnés (provider, modelId, coût interne). Les 5 fonctions image partagent `IMAGE_EDIT_CANDIDATES` |
| `lib/ai/router.ts` | Orchestration : tri par tier, fallback, post-traitement upscale |
| `lib/ai/types.ts` | Schéma normalisé (Feature, ProviderName, GenerationRequest/Result) — aucun nom de fournisseur côté client |
| `lib/ai/prompt-templates.ts` | **Tout le prompt engineering**, versionné (`PROMPT_TEMPLATES_VERSION`) |
| `lib/ai/media.ts` | Stockage temporaire local des vidéos (Sora, ComfyUI) |
| `lib/ai/logger.ts` | Trace des tentatives (analytics interne, jamais exposée) |
| `lib/ai/providers/index.ts` | Registre des adaptateurs + contrôle de configuration (env) |
| `lib/ai/providers/http.ts` | Helpers partagés : JSON, polling avec timeout, base64 |
| `lib/ai/providers/bfl.ts` `google.ts` `openai.ts` | Adaptateurs image (API officielles) |
| `lib/ai/providers/kling.ts` `runway.ts` `openai.ts` | Adaptateurs vidéo |
| `lib/ai/providers/magichour.ts` | Agrégateur (exception documentée, free tier) |
| `lib/ai/providers/comfyui.ts` | Serveur LOCAL de test : `img2img` + `i2v` (workflow custom) |
| `lib/features.ts` | Les 6 onglets + noms PRODUIT (client-safe) |
| `lib/presets.ts` | Métadonnées UI des presets (scène, matériau, éclairage, mood, plan, angle, motion) + bornes |
| `lib/costs.ts` | Coûts en crédits affichés/facturés (future table `action_costs`) |
| `lib/credits.ts` | Solde — STUB 100 jusqu'au jalon DB |
| `lib/download.ts` | Téléchargement client d'un résultat (blob → `<a download>`) |
| `lib/jobs/store.ts` | Jobs en mémoire (globalThis ; remplaçable par BullMQ/DB) |
| `lib/utils.ts` | `cn()` (clsx + tailwind-merge) |

### `config/` — catalogue produit

| Fichier | Rôle |
| --- | --- |
| `config/tools.ts` | Source unique des outils IA (nom, description, icône Lucide, route) pour le popover et le dashboard |

### `scripts/`

| Fichier | Rôle |
| --- | --- |
| `scripts/simulate-fallback.ts` | Prouve le fallback sans appels réels (adaptateur injecté) |
| `scripts/smoke-comfyui.ts` | Faux serveur ComfyUI (node:http) : contrat upload→prompt→history→view, image **et** vidéo |

---

## 4. Recettes de modification

### Changer de modèle ou de version chez un fournisseur

→ **Une seule entrée** dans `lib/ai/catalog.ts` (champ `modelId`), rien
d'autre. Vérifier le nom exact dans la doc du fournisseur (les versions
évoluent vite — le fallback absorbe un id invalide, mais l'appel coûte).

### Ajouter un fournisseur

1. Nouvel adaptateur `lib/ai/providers/<nom>.ts` (contrat
   `ProviderAdapter` : `run(modelId, input, timeoutMs)` →
   `{ images: [{url}] }` ou `{ video: { url } }`).
2. `ProviderName` dans `lib/ai/types.ts`.
3. Registre + clé d'env dans `lib/ai/providers/index.ts`.
4. Un candidat dans `MODEL_CATALOG` (feature + `buildInput`/`extractOutput`).
5. Variable documentée dans `.env.example`.

### Modifier un prompt

→ `lib/ai/prompt-templates.ts` uniquement (fragments ou builders), puis
**bumper `PROMPT_TEMPLATES_VERSION`**. Jamais de prompt côté client.

### Ajouter un preset (ambiance, angle, style…)

1. Métadonnées UI dans `lib/presets.ts` (id, label, swatch).
2. Fragment correspondant dans `lib/ai/prompt-templates.ts`.
3. Si nouveau sélecteur : déclarer dans `SIMPLE_TAB_CONFIG`
   (`components/studio/image-studio-workspace.tsx`) ou le panneau dédié.

### Changer les coûts

→ `lib/costs.ts` (`FEATURE_BASE_COSTS`, multiplicateurs qualité/durée,
surcharge résolution). Migrera vers la table `action_costs` au jalon DB.

### Changer les bornes (tailles, quantités, durées)

- Upload image : `MAX_PRIMARY_SIZE` / `MAX_REFERENCE_SIZE` (route) +
  texte dans `components/upload-dropzone.tsx`.
- Quantité max : `MAX_QUANTITY` (`lib/presets.ts`).
- Références max : `MAX_REFERENCES` (`lib/presets.ts`) + validation route.
- Durées vidéo : `DURATIONS` dans `lib/presets.ts` ET dans
  `app/api/generate/route.ts` + type `durationSeconds` dans
  `lib/ai/types.ts`.
- Timeouts d'appel : `IMAGE_TIMEOUT_MS` / `VIDEO_TIMEOUT_MS`
  (`lib/ai/catalog.ts`).

### Ajouter une fonction image au studio

1. `Feature` dans `lib/ai/types.ts` + coût dans `lib/costs.ts`.
2. Candidats dans `lib/ai/catalog.ts` (liste partagée ou dédiée).
3. Builder de prompt dans `lib/ai/prompt-templates.ts` (+ fragment/preset).
4. Route : `SUPPORTED_FEATURES` + branche du `switch` de
   `buildFeaturePrompt`.
5. Onglet dans `lib/features.ts` + état/config dans le workspace
   (`components/studio/image-studio-workspace.tsx` ; `SIMPLE_TAB_CONFIG` si
   panneau générique suffit), puis nouvelle page dans `app/app/<outil>/page.tsx`
   et entrée dans `config/tools.ts`.

### ComfyUI local (gratuit, hors-ligne)

- **Image** : `COMFYUI_CHECKPOINT` (nom exact du `.safetensors`). Graphe
  custom → exporter en *format API* depuis ComfyUI et pointer
  `COMFYUI_WORKFLOW_FILE` (placeholders `"{{PROMPT}}"`, `"{{NEGATIVE}}"`,
  `"{{IMAGE}}"`, `"{{SEED}}"`). Force d'édition : `COMFYUI_DENOISE`.
- **Vidéo** : exporter un workflow i2v (Wan 2.2, LTX-Video…) et pointer
  `COMFYUI_VIDEO_WORKFLOW_FILE` (placeholders vidéo en plus :
  `"{{FRAMES}}"`, `"{{FPS}}"`, `"{{WIDTH}}"`, `"{{HEIGHT}}"`) ; sortie mp4
  obligatoire (ex. `VHS_VideoCombine`) ; `COMFYUI_VIDEO_FPS` = frame_rate
  du graphe. Sans ces variables, le provider échoue vite et le routeur
  bascule silencieusement sur les fournisseurs cloud.

---

## 5. Règles non négociables (rappel)

1. **Clés API côté serveur uniquement** — jamais de `NEXT_PUBLIC_` pour du
   sensible ; tout appel modèle passe par `app/api/...`.
2. **Aucun sélecteur de modèle exposé** — le routage/fallback est un
   détail interne (scope V1).
3. **Aucun prompt technique côté client** — presets + texte libre
   enveloppé serveur (`prompt-templates.ts`).
4. **Commentaires et docs en français** ; code, identifiants et copy UI en
   anglais. TS strict, pas de `any` non justifié.
5. Après un changement : `npm run test:fallback`, `npm run test:comfyui`,
   `npm run build`, et mettre à jour `AGENTS.md` / `README.md` / ce guide.

---

## 6. Dépannage

| Symptôme | Cause probable | Action |
| --- | --- | --- |
| 503 « Generation is not configured » | Aucune clé dans `.env.local` | Renseigner ≥ 1 fournisseur, relancer `npm run dev` |
| « This feature is not available yet. » | Feature absente de `SUPPORTED_FEATURES` | L'ajouter dans `app/api/generate/route.ts` |
| « Generation failed » systématique | Toutes les tentatives ont échoué | Lire la trace serveur (`lib/ai/logger.ts`) : clé invalide, `modelId` rejeté, timeout |
| ComfyUI jamais utilisé | Serveur éteint ou `COMFYUI_CHECKPOINT` / `COMFYUI_VIDEO_WORKFLOW_FILE` manquant | Le fallback masque l'échec — vérifier les logs, pas l'UI |
| Vidéo locale absente | Sortie du workflow non mp4 | Utiliser `VHS_VideoCombine` (format `video/h264-mp4`) dans le graphe |
| Jobs 404 après redémarrage dev | Store en mémoire réinitialisé | Normal avant le jalon DB — relancer la génération |
| Solde toujours 100 | Stub volontaire | Jalon auth + DB (ledger `credit_ledger`) |

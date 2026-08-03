# RenderStudio Web

Interface Next.js 14 + TypeScript. Gère le studio, les projets/assets, les crédits, et les appels au worker FastAPI.

## Lancer en local

Depuis la racine du dépôt :

```bash
cd web
npm install

# Copier et ajuster DATABASE_URL / WORKER_BASE_URL
cp .env.example .env.local

npm run dev
```

Ouvrir `http://localhost:3000/app/dashboard`.

## Build + lint

```bash
npm run build
```

## Scripts utilitaires

```bash
# Suppression définitive des assets mis à la corbeille depuis +30 jours
npm run purge:trash
```

## Structure rapide

- `app/` : App Router (pages marketing, dashboard, routes API).
- `components/studio/` : panneaux des 7 onglets (Render, Mood, Ext→Int, Plan, Animate, Multi-Angle, Upscale).
- `components/projects/` : grille projets, cartes assets, sidebar.
- `lib/db/` : client Postgres + requêtes.
- `lib/worker-client.ts` : thin wrapper fetch vers le worker.

## Règles d'architecture

- `/web` ne parle **jamais** aux providers IA ; il appelle `/worker` via `WORKER_BASE_URL`.
- Aucune variable sensible ne doit être préfixée `NEXT_PUBLIC_`.

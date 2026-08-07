# Variables d'environnement — pourquoi deux fichiers `.env` ?

Le dépôt contient **deux services** qui partagent la même base PostgreSQL
mais ont des responsabilités différentes. C'est pourquoi il y a deux
fichiers d'environnement.

## 1. `/web/.env.local` — Next.js (frontend + routes API)

Ce fichier ne contient **aucune clé de provider IA**. Il sert uniquement à
connecter l'interface et les routes API Next.js à la base de données et au
worker.

```env
DATABASE_URL=postgresql://renderstudio:renderstudio@127.0.0.1:5433/renderstudio
WORKER_BASE_URL=http://127.0.0.1:8000
WORKER_PUBLIC_URL=http://127.0.0.1:8000
```

- `DATABASE_URL` : Postgres partagée avec le worker.
- `WORKER_BASE_URL` : URL interne utilisée par les routes serveur Next.js
  pour appeler le worker (génération, upscaling, stockage).
- `WORKER_PUBLIC_URL` : URL publique vue par le navigateur pour servir les
  fichiers stockés par le worker (`/storage/...`).

## 2. `/worker/.env` — FastAPI worker (logique IA + clés providers)

Ce fichier contient **toutes les clés des API officielles** des fournisseurs
IA. Le worker est le seul service à les lire. Les routes Next.js ne parlent
jamais directement aux providers.

```env
DATABASE_URL=postgresql://renderstudio:renderstudio@127.0.0.1:5433/renderstudio
WORKER_PUBLIC_URL=http://127.0.0.1:8000

# Providers image
BFL_API_KEY=
GOOGLE_API_KEY=
OPENAI_API_KEY=
MAGIC_HOUR_API_KEY=

# Providers vidéo
KLING_SECRET_KEY=
RUNWAY_API_KEY=
OPENAI_API_KEY=
MAGIC_HOUR_API_KEY=

# Audio / voix (ElevenLabs)
ELEVENLABS_API_KEY=
```

## Règles de sécurité

- Aucune variable sensible ne doit être préfixée `NEXT_PUBLIC_`.
- Le worker est le seul service autorisé à détenir les clés providers.
- Les fichiers `.env` et `.env.local` sont listés dans `.gitignore` et ne
  doivent jamais être commités.

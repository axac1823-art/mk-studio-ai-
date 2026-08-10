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

## 3. Variables d'authentification et de facturation

### `/web/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=         # URL du projet Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # clé publique (RLS-friendly)
SUPABASE_SERVICE_ROLE_KEY=        # clé serveur — jamais exposée au navigateur
STRIPE_SECRET_KEY=                # clé secrète Stripe
STRIPE_WEBHOOK_SECRET=            # secret du endpoint webhook Stripe
STRIPE_PRICE_STARTER=             # price ID Stripe du plan Starter
STRIPE_PRICE_PRO=                 # price ID Stripe du plan Pro
STRIPE_PRICE_STUDIO=              # price ID Stripe du plan Studio
WORKER_API_KEY=                   # secret partagé /web ↔ /worker
AUTH_DEBUG=false                  # fallback dev user si true (local only)
NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES=30  # délai d'inactivité avant déconnexion auto (minutes)
```

### `/worker/.env`

```env
WORKER_API_KEY=                   # même secret que dans /web/.env.local
```

## Règles de sécurité

- Aucune variable sensible ne doit être préfixée `NEXT_PUBLIC_`.
- Le worker est le seul service autorisé à détenir les clés providers.
- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` et `WORKER_API_KEY` sont
  réservées au serveur ; elles ne doivent jamais être lues par du code client.
- Les fichiers `.env` et `.env.local` sont listés dans `.gitignore` et ne
  doivent jamais être commités.

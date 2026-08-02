# Immo AI Platform — scaffold backend

Scaffold backend pour un agrégateur IA image/vidéo immobilier, inspiré de
RenderLab (rendu architectural depuis un screenshot 3D) et Higgsfield
(agrégation multi-modèles + orchestration).

## Pourquoi cette architecture

- **On ne développe aucun modèle fondamental.** `app/clients/model_registry.py`
  est un registre pluggable : chaque action métier (render, mood swap, upscale,
  animation, narration) pointe vers un modèle tiers appelé via fal.ai ou
  Replicate. Changer de fournisseur = changer une ligne, pas réécrire le produit.
- **LangGraph orchestre le pipeline, pas LangChain.** `app/graph/pipeline.py`
  modélise le flux comme une machine à états : vérification des crédits →
  planification du prompt → génération → post-traitement (upscale auto) →
  fin. Chaque étape est un noeud, chaque décision un edge conditionnel. C'est
  ce qui permet d'enchaîner facilement de nouvelles étapes (ex: génération →
  upscale → animation → narration) sans complexifier le code en cascade
  de if/else. LangChain n'apporte rien ici : il n'y a pas de RAG, pas de
  mémoire conversationnelle, l'essentiel des décisions est déterministe.
- **Le seul endroit "intelligent" du graphe** est `prompt_planner.py`, qui
  traduit presets cliqués + texte libre en paramètres de génération — c'est
  la couche qui permet à l'utilisateur de ne jamais écrire de prompt technique.

## Structure

```
app/
  core/config.py          # variables d'environnement, clés API
  core/credits.py         # système de crédits (débit/vérification)
  clients/model_registry.py  # registre des modèles tiers (fal.ai/Replicate)
  graph/state.py          # state partagé du graphe LangGraph
  graph/prompt_planner.py # construction des prompts/paramètres
  graph/pipeline.py       # le graphe LangGraph lui-même
  models/db_models.py     # tables SQLAlchemy (users, projets, jobs)
  api/generations.py      # routes FastAPI (créer/suivre une génération)
  main.py                 # point d'entrée FastAPI
```

## Lancer en local

```bash
python -m venv .venv &&  .venv/Scripts/Activate
pip install -r requirements.txt
cp .env.example .env   # puis renseigner tes clés fal.ai / Replicate / DB
uvicorn app.main:app --reload
```

## Flux d'utilisation (côté frontend)

1. Upload du screenshot SketchUp/Revit → obtenir une URL (S3 présigné, à ajouter).
2. `POST /generations` avec `capability="render_exterior"` + presets choisis
   par clic (style, ambiance) → retourne un `job_id` immédiatement (traitement
   asynchrone, la génération peut prendre 10s à plusieurs minutes selon le modèle).
3. `GET /generations/{job_id}` en polling jusqu'à `status: "done"`.

## Ce qu'il reste à brancher pour un MVP réel

- **Upload S3** : endpoint qui génère une URL présignée (boto3, déjà en dépendance).
- **Persistance réelle des jobs** : remplacer le dict `JOBS` en mémoire dans
  `api/generations.py` par la table `generation_jobs` + un vrai worker
  (Celery ou RQ avec Redis) au lieu de `BackgroundTasks` de FastAPI, qui ne
  survit pas à un redémarrage du serveur.
- **Débit des crédits réel** : appeler `debit_credits()` dans `_run_job` une
  fois le statut `done` confirmé, avec un check anti-race-condition.
- **Auth** : JWT sur les routes (`jose` est déjà en dépendance).
- **Webhook Stripe** : pour recharger les crédits à chaque cycle d'abonnement
  (`refill_monthly_credits` dans `core/credits.py` est prêt à être appelé).
- **model_id réels** : les identifiants dans `model_registry.py` sont indicatifs
  — vérifier le catalogue exact fal.ai/Replicate au moment de l'implémentation
  (ces catalogues évoluent vite).
- **Frontend** : Next.js avec l'UI par presets (pas de prompt visible), upload
  drag & drop, slider avant/après, galerie de projet.

## Étendre le pipeline (exemple : enchaîner animation + narration automatique)

Ajouter un noeud `node_auto_narrate` dans `pipeline.py`, et un edge conditionnel
après `post_process` qui route vers ce noeud si `state["auto_narrate"]` est vrai.
Aucune autre partie du code n'a besoin de changer — c'est l'intérêt du graphe.

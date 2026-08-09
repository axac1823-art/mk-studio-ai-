"""Configuration du worker — toutes les variables d'env au même endroit.

Les clés fournisseurs (BFL_API_KEY, GOOGLE_API_KEY...) ne vivent QUE dans
l'environnement du worker : /web ne connaît que WORKER_BASE_URL et ne parle
jamais aux providers directement (durcissement du principe "clés serveur").
"""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # worker/.env (optionnel)

BASE_DIR = Path(__file__).resolve().parent

# Dossier des fichiers générés (dev local ; S3/Supabase Storage en prod).
STORAGE_DIR = Path(os.environ.get("STORAGE_DIR", BASE_DIR / "storage")).resolve()

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://renderstudio:renderstudio@127.0.0.1:5433/renderstudio"
)

# URL publique du worker, utilisée pour construire les URLs des fichiers
# servis depuis /storage (le navigateur doit pouvoir l'atteindre).
PUBLIC_BASE_URL = os.environ.get("WORKER_PUBLIC_URL", "http://127.0.0.1:8000").rstrip("/")

# Secret partagé entre /web et /worker pour authentifier les appels internes.
# Optionnel en dev (aucune vérification), requis en production.
WORKER_API_KEY = os.environ.get("WORKER_API_KEY", "")

"""Dépendances FastAPI partagées : authentification des appels internes /web."""
from fastapi import Header, HTTPException

from config import WORKER_API_KEY


def require_worker_key(x_worker_key: str = Header(default="")) -> None:
    """Vérifie le secret partagé WORKER_API_KEY. Si la variable n'est pas
    configurée côté worker, la dépendance est silencieusement ignorée
    (mode dev). Dès qu'elle est configurée, elle est exigée."""
    if not WORKER_API_KEY:
        return
    if x_worker_key != WORKER_API_KEY:
        raise HTTPException(401, "invalid worker key")

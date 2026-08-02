"""Accès Postgres partagé (même base que /web — c'est /web qui "possède" le
schéma ; le worker n'écrit que jobs/assets/ledger pendant l'exécution).

Connexions courtes (une par fonction) : suffisant en dev mono-worker, pas
de pool à ce stade — volontairement simple (voir README worker).
"""
import psycopg
from psycopg.rows import dict_row

from config import DATABASE_URL


def connect():
    """Nouvelle connexion (rows en dict, autocommit — chaque statement est
    atomique ; les écritures multi-tables restent rares et courtes)."""
    return psycopg.connect(DATABASE_URL, row_factory=dict_row, autocommit=True)

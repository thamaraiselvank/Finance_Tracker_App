import logging
import os
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

from psycopg.conninfo import make_conninfo
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import settings

logger = logging.getLogger("finverse.database")

_pool: Optional[ConnectionPool] = None


def get_connection_string() -> str:
    return make_conninfo(
        host=settings.POSTGRES_HOST,
        port=settings.POSTGRES_PORT,
        dbname=settings.POSTGRES_DB,
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
    )


def init_db_pool() -> ConnectionPool:
    global _pool
    if _pool is not None:
        return _pool

    pool: Optional[ConnectionPool] = None
    try:
        pool = ConnectionPool(
            conninfo=get_connection_string(),
            min_size=settings.PG_MIN_POOL_SIZE,
            max_size=settings.PG_MAX_POOL_SIZE,
            kwargs={"row_factory": dict_row, "autocommit": False},
            open=True,
            timeout=3.0,
        )
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
    except Exception as error:
        if pool is not None:
            try:
                pool.close()
            except Exception:
                logger.exception("Could not close the failed PostgreSQL connection pool.")
        logger.exception(
            "Could not connect to PostgreSQL at %s:%s (database %s).",
            settings.POSTGRES_HOST,
            settings.POSTGRES_PORT,
            settings.POSTGRES_DB,
        )
        raise RuntimeError(
            "Could not connect to PostgreSQL. Check that the database is running "
            "and that POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, "
            "POSTGRES_PASSWORD, and POSTGRES_DB are configured correctly."
        ) from error

    _pool = pool
    logger.info("Connected to PostgreSQL successfully.")
    return _pool


def check_db_connection() -> bool:
    try:
        pool = init_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return True
    except Exception:
        logger.exception("PostgreSQL health check failed.")
        return False


def close_db_pool() -> None:
    global _pool
    pool = _pool
    _pool = None
    if pool is not None:
        try:
            pool.close()
        except Exception:
            logger.exception("Could not close the PostgreSQL connection pool.")


@contextmanager
def get_db_connection():
    pool = init_db_pool()
    with pool.connection() as conn:
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def fetch_one(
    query: str, params: Optional[tuple | dict] = None
) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            row = cur.fetchone()
            return dict(row) if row else None


def fetch_all(
    query: str, params: Optional[tuple | dict] = None
) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            rows = cur.fetchall()
            return [dict(row) for row in rows] if rows else []


def execute_query(query: str, params: Optional[tuple | dict] = None) -> int:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            return cur.rowcount


def execute_returning(
    query: str, params: Optional[tuple | dict] = None
) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            row = cur.fetchone()
            return dict(row) if row else None


def execute_script(sql_content: str) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql_content)


def run_schema_migration() -> None:
    schema_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "db", "schema.sql"
    )
    if not os.path.exists(schema_path):
        raise FileNotFoundError(f"Database schema file not found: {schema_path}")
    with open(schema_path, "r", encoding="utf-8") as schema_file:
        execute_script(schema_file.read())
    logger.info("Database schema initialized successfully.")

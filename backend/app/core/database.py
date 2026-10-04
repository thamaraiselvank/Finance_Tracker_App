import os
import json
import sqlite3
import datetime
import uuid
import logging
from contextlib import contextmanager
from typing import Any, Dict, List, Optional, Generator
import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from app.core.config import settings

logger = logging.getLogger("finverse.database")
logging.basicConfig(level=logging.INFO)

_pool: Optional[ConnectionPool] = None
_use_sqlite_fallback: bool = False
_sqlite_db_path = os.path.join(os.path.dirname(__file__), "..", "..", "finverse_local.db")

def get_connection_string() -> str:
    return (
        f"host={settings.POSTGRES_HOST} "
        f"port={settings.POSTGRES_PORT} "
        f"dbname={settings.POSTGRES_DB} "
        f"user={settings.POSTGRES_USER} "
        f"password={settings.POSTGRES_PASSWORD}"
    )

def init_db_pool() -> Optional[ConnectionPool]:
    global _pool, _use_sqlite_fallback
    if _use_sqlite_fallback:
        return None
        
    if _pool is None:
        try:
            conn_info = get_connection_string()
            _pool = ConnectionPool(
                conninfo=conn_info,
                min_size=settings.PG_MIN_POOL_SIZE,
                max_size=settings.PG_MAX_POOL_SIZE,
                kwargs={"row_factory": dict_row, "autocommit": False},
                open=True,
                timeout=3.0
            )
            with _pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
            logger.info("Connected to PostgreSQL successfully.")
            _use_sqlite_fallback = False
        except Exception as e:
            logger.warning(f"PostgreSQL server credentials not yet configured ({e}). Using local SQLite engine.")
            _pool = None
            _use_sqlite_fallback = True
            _init_sqlite_schema()
    return _pool

def close_db_pool():
    global _pool
    if _pool is not None:
        try:
            _pool.close()
        except Exception:
            pass
        _pool = None

def _dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        val = row[idx]
        d[col[0]] = val
    return d

def _init_sqlite_schema():
    os.makedirs(os.path.dirname(_sqlite_db_path), exist_ok=True)
    conn = sqlite3.connect(_sqlite_db_path)
    conn.row_factory = _dict_factory
    cur = conn.cursor()
    
    cur.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        hashed_password TEXT NOT NULL,
        full_name TEXT,
        currency TEXT DEFAULT 'INR',
        current_age INTEGER DEFAULT 28,
        target_retirement_age INTEGER DEFAULT 50,
        monthly_income REAL DEFAULT 0.0,
        monthly_expense REAL DEFAULT 0.0,
        target_savings_rate REAL DEFAULT 30.0,
        emergency_fund_amount REAL DEFAULT 0.0,
        dependents_count INTEGER DEFAULT 0,
        health_dependents TEXT DEFAULT '[]',
        is_onboarded INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        revoked INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        icon TEXT DEFAULT 'Tag',
        color TEXT DEFAULT '#10B981',
        is_system INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subcategories (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        account_type TEXT NOT NULL,
        balance REAL DEFAULT 0.0,
        currency TEXT DEFAULT 'INR',
        institution TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        account_id TEXT,
        category_id TEXT,
        subcategory_id TEXT,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        notes TEXT,
        tags TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        asset_class TEXT NOT NULL,
        sub_type TEXT,
        invested_amount REAL DEFAULT 0.0,
        current_value REAL DEFAULT 0.0,
        quantity REAL DEFAULT 1.0,
        buy_price REAL DEFAULT 0.0,
        current_price REAL DEFAULT 0.0,
        purchase_date TEXT,
        notes TEXT,
        meta_data TEXT DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS liabilities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        liability_type TEXT NOT NULL,
        principal_amount REAL DEFAULT 0.0,
        current_outstanding REAL DEFAULT 0.0,
        interest_rate_pct REAL DEFAULT 0.0,
        tenure_months INTEGER DEFAULT 12,
        emi_amount REAL DEFAULT 0.0,
        start_date TEXT,
        lender TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS insurances (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        policy_name TEXT NOT NULL,
        insurance_type TEXT NOT NULL,
        sum_insured REAL DEFAULT 0.0,
        annual_premium REAL DEFAULT 0.0,
        policy_start_date TEXT,
        renewal_date TEXT,
        dependents_covered INTEGER DEFAULT 0,
        insurer_name TEXT,
        is_active INTEGER DEFAULT 1,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        debt_name TEXT NOT NULL,
        debt_type TEXT NOT NULL,
        principal_amount REAL DEFAULT 0.0,
        current_outstanding REAL DEFAULT 0.0,
        interest_rate_pct REAL DEFAULT 0.0,
        tenure_months INTEGER DEFAULT 12,
        monthly_emi REAL DEFAULT 0.0,
        start_date TEXT,
        end_date TEXT,
        creditor_name TEXT,
        priority_payoff INTEGER DEFAULT 0,
        payoff_strategy TEXT DEFAULT 'STANDARD',
        total_interest_paid REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS insurance_policies (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        policy_name TEXT NOT NULL,
        policy_type TEXT NOT NULL,
        sum_insured REAL NOT NULL,
        annual_premium REAL NOT NULL,
        policy_number TEXT,
        start_date TEXT,
        maturity_date TEXT,
        renewal_date TEXT,
        coverage_type TEXT,
        dependents_covered INTEGER DEFAULT 0,
        insurer_name TEXT,
        payment_frequency TEXT NOT NULL DEFAULT 'YEARLY',
        payment_status TEXT NOT NULL DEFAULT 'PENDING',
        next_payment_date TEXT,
        last_payment_date TEXT,
        agent_name TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        document_url TEXT,
        claim_tracker TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        monthly_limit REAL DEFAULT 0.0,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        goal_name TEXT NOT NULL,
        goal_type TEXT NOT NULL,
        target_amount REAL DEFAULT 0.0,
        current_amount REAL DEFAULT 0.0,
        target_date TEXT,
        priority INTEGER DEFAULT 3,
        description TEXT,
        status TEXT DEFAULT 'ACTIVE',
        suggested_monthly_savings REAL DEFAULT 0.0,
        allocated_monthly_savings REAL DEFAULT 0.0,
        progress_percentage REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Attempt to alter existing tables if this is an upgrade
    try:
        cur.execute("ALTER TABLE users ADD COLUMN is_onboarded INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass # Column already exists
    for column, definition in [
        ("monthly_expense", "REAL DEFAULT 0.0"),
        ("emergency_fund_amount", "REAL DEFAULT 0.0"),
        ("health_dependents", "TEXT DEFAULT '[]'"),
    ]:
        try:
            cur.execute(f"ALTER TABLE users ADD COLUMN {column} {definition}")
        except sqlite3.OperationalError:
            pass

    for column, definition in [
        ("payment_frequency", "TEXT NOT NULL DEFAULT 'YEARLY'"),
        ("payment_status", "TEXT NOT NULL DEFAULT 'PENDING'"),
        ("next_payment_date", "TEXT"),
        ("last_payment_date", "TEXT"),
    ]:
        try:
            cur.execute(f"ALTER TABLE insurance_policies ADD COLUMN {column} {definition}")
        except sqlite3.OperationalError:
            pass

    for column, definition in [
        ("debt_name", "TEXT"),
        ("debt_type", "TEXT"),
        ("principal_amount", "REAL DEFAULT 0.0"),
        ("current_outstanding", "REAL DEFAULT 0.0"),
        ("interest_rate_pct", "REAL DEFAULT 0.0"),
        ("tenure_months", "INTEGER DEFAULT 12"),
        ("monthly_emi", "REAL DEFAULT 0.0"),
        ("start_date", "TEXT"),
        ("end_date", "TEXT"),
        ("creditor_name", "TEXT"),
        ("priority_payoff", "INTEGER DEFAULT 0"),
        ("payoff_strategy", "TEXT DEFAULT 'STANDARD'"),
        ("total_interest_paid", "REAL DEFAULT 0.0"),
    ]:
        try:
            cur.execute(f"ALTER TABLE debts ADD COLUMN {column} {definition}")
        except sqlite3.OperationalError:
            pass

    for column, definition in [
        ("goal_name", "TEXT"),
        ("goal_type", "TEXT"),
        ("target_amount", "REAL DEFAULT 0.0"),
        ("current_amount", "REAL DEFAULT 0.0"),
        ("target_date", "TEXT"),
        ("priority", "INTEGER DEFAULT 3"),
        ("description", "TEXT"),
        ("status", "TEXT DEFAULT 'ACTIVE'"),
        ("suggested_monthly_savings", "REAL DEFAULT 0.0"),
        ("allocated_monthly_savings", "REAL DEFAULT 0.0"),
        ("progress_percentage", "REAL DEFAULT 0.0"),
    ]:
        try:
            cur.execute(f"ALTER TABLE goals ADD COLUMN {column} {definition}")
        except sqlite3.OperationalError:
            pass

    # Seed default categories if empty
    cur.execute("SELECT COUNT(*) as count FROM categories")
    row = cur.fetchone()
    if row and row.get("count", 0) == 0:
        default_categories = [
            ('00000000-0000-0000-0000-000000000001', None, 'Salary', 'INCOME', 'Briefcase', '#10B981', 1),
            ('00000000-0000-0000-0000-000000000002', None, 'Investments & Returns', 'INCOME', 'TrendingUp', '#059669', 1),
            ('00000000-0000-0000-0000-000000000003', None, 'Freelance / Business', 'INCOME', 'Laptop', '#34D399', 1),
            ('00000000-0000-0000-0000-000000000004', None, 'Rental Income', 'INCOME', 'Home', '#6EE7B7', 1),
            ('00000000-0000-0000-0000-000000000005', None, 'Other Income', 'INCOME', 'PlusCircle', '#A7F3D0', 1),
            ('00000000-0000-0000-0000-000000000010', None, 'Housing & Rent', 'EXPENSE', 'Home', '#EF4444', 1),
            ('00000000-0000-0000-0000-000000000011', None, 'Food & Groceries', 'EXPENSE', 'Utensils', '#F59E0B', 1),
            ('00000000-0000-0000-0000-000000000012', None, 'Utilities & Bills', 'EXPENSE', 'Zap', '#6366F1', 1),
            ('00000000-0000-0000-0000-000000000013', None, 'Transportation & Fuel', 'EXPENSE', 'Car', '#EC4899', 1),
            ('00000000-0000-0000-0000-000000000014', None, 'Healthcare & Medical', 'EXPENSE', 'Activity', '#14B8A6', 1),
            ('00000000-0000-0000-0000-000000000015', None, 'Shopping & Lifestyle', 'EXPENSE', 'ShoppingBag', '#8B5CF6', 1),
            ('00000000-0000-0000-0000-000000000016', None, 'Entertainment & Leisure', 'EXPENSE', 'Film', '#F97316', 1),
            ('00000000-0000-0000-0000-000000000017', None, 'Insurance Premiums', 'EXPENSE', 'ShieldCheck', '#3B82F6', 1),
            ('00000000-0000-0000-0000-000000000018', None, 'Loan EMI & Debt Payoff', 'EXPENSE', 'CreditCard', '#DC2626', 1),
            ('00000000-0000-0000-0000-000000000019', None, 'Education & Courses', 'EXPENSE', 'BookOpen', '#0284C7', 1),
            ('00000000-0000-0000-0000-000000000020', None, 'Other Expenses', 'EXPENSE', 'MinusCircle', '#64748B', 1)
        ]
        cur.executemany("INSERT OR IGNORE INTO categories VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))", default_categories)
        
        default_subcats = [
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000001', 'Monthly Salary'),
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000001', 'Bonus & Incentive'),
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000002', 'Dividends'),
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000002', 'Stock Capital Gains'),
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000002', 'Mutual Fund Gains'),
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000010', 'Apartment Rent'),
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000011', 'Daily Groceries'),
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000011', 'Dining Out'),
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000012', 'Electricity Bill'),
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000012', 'Broadband & Mobile'),
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000013', 'Fuel & Petrol'),
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000014', 'Doctor Consultations'),
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000017', 'Health Insurance Premium'),
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000017', 'Term Life Insurance Premium'),
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000018', 'Home Loan EMI'),
            (str(uuid.uuid4()), '00000000-0000-0000-0000-000000000018', 'Car Loan EMI')
        ]
        cur.executemany("INSERT OR IGNORE INTO subcategories VALUES (?, ?, ?, datetime('now'))", default_subcats)
        conn.commit()
    cur.close()
    conn.close()

def _adapt_sql(query: str) -> str:
    q = query.replace("%s::jsonb", "?")
    q = q.replace("::jsonb", "")
    q = q.replace("ILIKE", "LIKE")
    q = q.replace("INTERVAL '90 days'", "'-90 days'")
    q = q.replace("CURRENT_TIMESTAMP", "datetime('now')")
    q = q.replace("CURRENT_DATE", "date('now')")
    q = q.replace("DATE_TRUNC('month', date)", "strftime('%Y-%m', date)")
    q = q.replace("EXTRACT(MONTH FROM date)", "CAST(strftime('%m', date) AS INTEGER)")
    q = q.replace("EXTRACT(YEAR FROM date)", "CAST(strftime('%Y', date) AS INTEGER)")
    q = q.replace("%s", "?")
    return q

@contextmanager
def get_db_connection():
    pool = init_db_pool()
    if _use_sqlite_fallback or pool is None:
        conn = sqlite3.connect(_sqlite_db_path)
        conn.row_factory = _dict_factory
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        return

    with pool.connection() as conn:
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise

def fetch_one(query: str, params: Optional[tuple | dict] = None) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        if _use_sqlite_fallback:
            cur = conn.cursor()
            try:
                adapted_q = _adapt_sql(query)
                cur.execute(adapted_q, params or ())
                row = cur.fetchone()
                return dict(row) if row else None
            finally:
                cur.close()
        else:
            with conn.cursor() as cur:
                cur.execute(query, params or ())
                row = cur.fetchone()
                return dict(row) if row else None

def fetch_all(query: str, params: Optional[tuple | dict] = None) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        if _use_sqlite_fallback:
            cur = conn.cursor()
            try:
                adapted_q = _adapt_sql(query)
                cur.execute(adapted_q, params or ())
                rows = cur.fetchall()
                return [dict(r) for r in rows] if rows else []
            finally:
                cur.close()
        else:
            with conn.cursor() as cur:
                cur.execute(query, params or ())
                rows = cur.fetchall()
                return [dict(r) for r in rows] if rows else []

def execute_query(query: str, params: Optional[tuple | dict] = None) -> int:
    with get_db_connection() as conn:
        if _use_sqlite_fallback:
            cur = conn.cursor()
            try:
                adapted_q = _adapt_sql(query)
                cur.execute(adapted_q, params or ())
                return cur.rowcount
            finally:
                cur.close()
        else:
            with conn.cursor() as cur:
                cur.execute(query, params or ())
                return cur.rowcount

def execute_returning(query: str, params: Optional[tuple | dict] = None) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        if _use_sqlite_fallback:
            cur = conn.cursor()
            try:
                adapted_q = _adapt_sql(query)
                assigned_id = None
                p_list = list(params) if params else []
                
                if "INSERT INTO" in query.upper() and ("(id," not in query and "(id " not in query):
                    assigned_id = str(uuid.uuid4())
                    first_paren = adapted_q.find("(")
                    val_paren = adapted_q.find("VALUES (") + 8
                    if first_paren != -1 and val_paren != 7:
                        adapted_q = adapted_q[:first_paren+1] + "id, " + adapted_q[first_paren+1:val_paren] + "?, " + adapted_q[val_paren:]
                        p_list.insert(0, assigned_id)
                
                # Check for table name to fetch created row if RETURNING needs manual fetch
                cur.execute(adapted_q, tuple(p_list))
                row = cur.fetchone()
                if row:
                    return dict(row)
                if assigned_id:
                    # Fetch by assigned ID
                    table_name = query.split("INTO")[1].strip().split("(")[0].strip()
                    cur.execute(f"SELECT * FROM {table_name} WHERE id = ?", (assigned_id,))
                    row = cur.fetchone()
                    return dict(row) if row else {"id": assigned_id}
                return None
            finally:
                cur.close()
        else:
            with conn.cursor() as cur:
                cur.execute(query, params or ())
                row = cur.fetchone()
                return dict(row) if row else None

def execute_script(sql_content: str):
    with get_db_connection() as conn:
        if _use_sqlite_fallback:
            conn.executescript(_adapt_sql(sql_content))
        else:
            with conn.cursor() as cur:
                cur.execute(sql_content)

def run_schema_migration():
    schema_path = os.path.join(os.path.dirname(__file__), "..", "..", "db", "schema.sql")
    if os.path.exists(schema_path):
        with open(schema_path, "r", encoding="utf-8") as f:
            sql = f.read()
        try:
            execute_script(sql)
            logger.info("Database schema initialized successfully.")
        except Exception as e:
            logger.warning(f"Schema migration note: {e}")

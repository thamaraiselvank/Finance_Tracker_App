import os
import sys
import psycopg
from psycopg.rows import dict_row

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.core.config import settings

def init_postgres_db():
    print(f"Connecting to PostgreSQL at {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT} as user '{settings.POSTGRES_USER}'...")
    
    # 1. Connect to default 'postgres' database to ensure our target DB exists
    try:
        admin_conn = psycopg.connect(
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            dbname="postgres",
            autocommit=True
        )
        with admin_conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (settings.POSTGRES_DB,))
            exists = cur.fetchone()
            if not exists:
                print(f"Database '{settings.POSTGRES_DB}' does not exist. Creating it now...")
                cur.execute(f'CREATE DATABASE "{settings.POSTGRES_DB}"')
                print(f"Database '{settings.POSTGRES_DB}' created successfully.")
            else:
                print(f"Database '{settings.POSTGRES_DB}' already exists.")
        admin_conn.close()
    except Exception as e:
        print(f"Notice during database existence check: {e}")
        
    # 2. Connect to the target DB and execute schema.sql
    try:
        conn = psycopg.connect(
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            dbname=settings.POSTGRES_DB,
            autocommit=True
        )
        schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
        with open(schema_path, "r", encoding="utf-8") as f:
            schema_sql = f.read()
            
        with conn.cursor() as cur:
            cur.execute(schema_sql)
            print("Successfully executed schema.sql on PostgreSQL!")
        conn.close()
        return True
    except Exception as e:
        print(f"Failed to initialize database tables: {e}")
        return False

if __name__ == "__main__":
    init_postgres_db()

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

def get_db():
    """
    Returns a PostgreSQL connection using Supabase DATABASE_URL.
    """
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise ValueError(
            "DATABASE_URL is not set. Please set DATABASE_URL in Vercel Project Settings -> Environment Variables.\n"
            "Format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
        )
    # Ensure sslmode=require for Supabase and cloud PostgreSQL
    if "sslmode=" not in url and ("supabase.co" in url or "neon.tech" in url or "pooler.supabase.com" in url):
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}sslmode=require"

    conn = psycopg2.connect(url)
    conn.autocommit = False
    return conn

def get_cursor(conn):
    """Returns a cursor that returns dicts instead of tuples."""
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

def init_db():
    """
    Tables are managed via Supabase SQL Editor (supabase_schema.sql).
    This function only seeds default users if the table is empty.
    """
    conn = get_db()
    cursor = get_cursor(conn)

    try:
        # Seed default users if empty
        cursor.execute("SELECT COUNT(*) as cnt FROM users")
        row = cursor.fetchone()
        if row and row["cnt"] == 0:
            import hashlib
            def h(p):
                return hashlib.sha256(p.encode("utf-8")).hexdigest()

            users_data = [
                ("admin", h("admin123"), "System Administrator", "Admin"),
                ("engineer", h("engineer123"), "Lead Jobwork Engineer", "Engineer"),
                ("rajtamil", h("rajtamil123"), "Rajtamil", "Chief Operating Officer"),
                ("supervisor", h("supervisor123"), "Shopfloor Supervisor", "Supervisor"),
            ]
            for u in users_data:
                cursor.execute("""
                INSERT INTO users (username, password_hash, full_name, role)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (username) DO NOTHING
                """, u)
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"init_db warning: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized (Supabase PostgreSQL).")

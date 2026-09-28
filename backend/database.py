import os
import json
import urllib.request
import urllib.error
from typing import Any, List, Optional
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_KEY")
DATABASE_URL = os.environ.get("DATABASE_URL")

# Try to import psycopg2 for direct PostgreSQL if DATABASE_URL is configured
try:
    import psycopg2
    import psycopg2.extras
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False


class SupabaseHttpCursor:
    """Cursor that executes SQL via Supabase REST RPC (HTTPS) using SUPABASE_SECRET_KEY."""
    def __init__(self, conn):
        self.conn = conn
        self._rows: List[dict] = []
        self._idx = 0
        self.rowcount = -1

    def execute(self, sql: str, params: Optional[tuple] = None):
        formatted_sql = self._format_query(sql, params)
        self._rows = self.conn._run_rpc(formatted_sql)
        self._idx = 0
        self.rowcount = len(self._rows) if isinstance(self._rows, list) else -1
        return self

    def _format_query(self, sql: str, params: Optional[tuple]) -> str:
        if not params:
            return sql
        formatted = []
        for p in params:
            if p is None:
                formatted.append("NULL")
            elif isinstance(p, bool):
                formatted.append("TRUE" if p else "FALSE")
            elif isinstance(p, (int, float)):
                formatted.append(str(p))
            else:
                escaped = str(p).replace("'", "''")
                formatted.append(f"'{escaped}'")

        parts = sql.split("%s")
        if len(parts) - 1 != len(formatted):
            return sql
        res = parts[0]
        for i, val in enumerate(formatted):
            res += val + parts[i + 1]
        return res

    def fetchone(self) -> Optional[dict]:
        if self._idx < len(self._rows):
            row = self._rows[self._idx]
            self._idx += 1
            return row
        return None

    def fetchall(self) -> List[dict]:
        remaining = self._rows[self._idx:]
        self._idx = len(self._rows)
        return remaining

    def close(self):
        pass


class SupabaseHttpConnection:
    """Database connection that uses Supabase HTTPS API — no database password needed."""
    def __init__(self, url: str, key: str):
        self.url = url.rstrip("/")
        self.key = key

    def _run_rpc(self, sql: str) -> List[dict]:
        rpc_url = f"{self.url}/rest/v1/rpc/exec_sql"
        body = json.dumps({"query": sql}).encode("utf-8")
        req = urllib.request.Request(
            rpc_url,
            data=body,
            headers={
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data if isinstance(data, list) else []
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8")
            if "exec_sql" in err_msg or e.code == 404:
                raise RuntimeError(
                    "Supabase RPC function 'exec_sql' not found in your Supabase project. "
                    "Please run the helper SQL in Supabase SQL Editor."
                ) from e
            raise RuntimeError(f"Database error ({e.code}): {err_msg}") from e

    def cursor(self):
        return SupabaseHttpCursor(self)

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        pass


def get_db():
    """
    Returns a database connection:
    1. If SUPABASE_URL and SUPABASE_SECRET_KEY are set, uses HTTPS REST RPC (No database password needed).
    2. Otherwise if DATABASE_URL is set, uses direct PostgreSQL connection via psycopg2.
    """
    sb_url = os.environ.get("SUPABASE_URL") or SUPABASE_URL
    sb_key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_KEY") or SUPABASE_SECRET_KEY

    if sb_url and sb_key:
        return SupabaseHttpConnection(sb_url, sb_key)

    db_url = os.environ.get("DATABASE_URL") or DATABASE_URL
    if db_url and PSYCOPG2_AVAILABLE:
        if "sslmode=" not in db_url and ("supabase.co" in db_url or "neon.tech" in db_url or "pooler.supabase.com" in db_url):
            sep = "&" if "?" in db_url else "?"
            db_url = f"{db_url}{sep}sslmode=require"
        conn = psycopg2.connect(db_url)
        conn.autocommit = False
        return conn

    raise ValueError(
        "No database configuration found. Please set either:\n"
        "  1) SUPABASE_URL and SUPABASE_SECRET_KEY (API Key method, no password needed)\n"
        "  2) DATABASE_URL (Direct PostgreSQL connection string)"
    )


def get_cursor(conn):
    """Returns a cursor that yields dictionary rows."""
    if hasattr(conn, "cursor_factory") and PSYCOPG2_AVAILABLE:
        return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    return conn.cursor()


def init_db():
    """Seeds default users if users table is empty."""
    try:
        conn = get_db()
        cursor = get_cursor(conn)
        cursor.execute("SELECT COUNT(*) as cnt FROM users")
        row = cursor.fetchone()
        count = 0
        if row:
            count = row.get("cnt") if isinstance(row, dict) else row[0]

        if count == 0:
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
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"init_db note: {e}")

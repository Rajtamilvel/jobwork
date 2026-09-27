import sqlite3
import os

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None

class PgCursorWrapper:
    def __init__(self, pg_cursor):
        self._cursor = pg_cursor
        self.lastrowid = None

    def execute(self, query, params=None):
        pg_query = query.replace('?', '%s')
        if params is not None:
            self._cursor.execute(pg_query, params)
        else:
            self._cursor.execute(pg_query)
        return self

    def executemany(self, query, seq_of_params):
        pg_query = query.replace('?', '%s')
        self._cursor.executemany(pg_query, seq_of_params)
        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def fetchmany(self, size=None):
        return self._cursor.fetchmany(size)

    @property
    def rowcount(self):
        return self._cursor.rowcount

    def close(self):
        self._cursor.close()

class PgConnectionWrapper:
    def __init__(self, pg_conn):
        self._conn = pg_conn

    def cursor(self):
        return PgCursorWrapper(self._conn.cursor(cursor_factory=RealDictCursor))

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "jobwork.db")

def get_db():
    if DATABASE_URL and psycopg2:
        pg_conn = psycopg2.connect(DATABASE_URL)
        return PgConnectionWrapper(pg_conn)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    if DATABASE_URL and psycopg2:
        return
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Raw Materials Master (Weight / Length / Form)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS raw_materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        grade TEXT NOT NULL,
        form TEXT NOT NULL,           -- Round Bar, Flat, Plate, Hex, Tube
        unit TEXT NOT NULL,           -- kg, meters, mm, MT
        stock_quantity REAL DEFAULT 0,
        heat_number TEXT,
        unit_cost REAL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 2. Manufactured Items Master (Item code is constant: CM001)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        drawing_no TEXT,
        revision TEXT,
        material_code TEXT,
        weight REAL DEFAULT 0,
        default_quantity INTEGER DEFAULT 100,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 3. Vendors Master
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vendors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        processes_offered TEXT,      -- Comma-separated or JSON list
        default_lead_time_days INTEGER DEFAULT 3,
        rating REAL DEFAULT 4.5,
        notes TEXT,
        vendor_type TEXT DEFAULT 'Local'
    )
    """)
    
    # 4. Process Routes (Multiple routes possible for 1 item)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS process_routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_code TEXT NOT NULL,
        route_name TEXT NOT NULL,    -- e.g. "Standard Forging Route", "Direct CNC Route"
        is_default INTEGER DEFAULT 1,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(item_code) REFERENCES items(item_code)
    )
    """)
    
    # 5. Route Stages (Sequential steps in a route)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS route_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_id INTEGER NOT NULL,
        sequence_no INTEGER NOT NULL,
        process_name TEXT NOT NULL,  -- Cutting, Forging, Normalizing, Shot Blasting, Machining, Hobbing, Nitriding, Welding, Finished
        vendor_id INTEGER,           -- NULL if in-house
        is_inhouse INTEGER DEFAULT 0,
        lead_time_days INTEGER DEFAULT 3,
        is_welding_stage INTEGER DEFAULT 0,
        notes TEXT,
        FOREIGN KEY(route_id) REFERENCES process_routes(id) ON DELETE CASCADE,
        FOREIGN KEY(vendor_id) REFERENCES vendors(id)
    )
    """)
    
    # 6. Welding BOM (If a stage is welding, multiple child items with variable quantities)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS welding_boms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_stage_id INTEGER NOT NULL,
        parent_item_code TEXT NOT NULL,
        child_item_code TEXT NOT NULL,
        quantity_per_unit REAL NOT NULL, -- e.g. 2 pcs of CM002 for 1 unit of CM-WELD-01
        unit TEXT DEFAULT 'pcs',
        notes TEXT,
        FOREIGN KEY(route_stage_id) REFERENCES route_stages(id) ON DELETE CASCADE
    )
    """)
    
    # 7. Batches / Job Orders (Real-time tracking of item at vendor/process)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT UNIQUE NOT NULL,
        item_code TEXT NOT NULL,
        route_id INTEGER NOT NULL,
        current_stage_sequence INTEGER NOT NULL,
        current_process TEXT NOT NULL,
        current_vendor_id INTEGER,
        is_inhouse INTEGER DEFAULT 0,
        quantity_total INTEGER NOT NULL,
        quantity_accepted INTEGER NOT NULL,
        quantity_rejected INTEGER DEFAULT 0,
        raw_material_code TEXT,
        raw_material_quantity REAL,
        raw_material_unit TEXT,
        status TEXT NOT NULL,         -- Sent to Vendor, In Process, Ready for QC, Dispatched, Completed
        is_critical INTEGER DEFAULT 0,
        date_started TEXT,
        date_sent_to_vendor TEXT,
        expected_delivery_date TEXT,
        actual_delivery_date TEXT,
        challan_no TEXT,
        notes TEXT,
        FOREIGN KEY(item_code) REFERENCES items(item_code),
        FOREIGN KEY(route_id) REFERENCES process_routes(id),
        FOREIGN KEY(current_vendor_id) REFERENCES vendors(id)
    )
    """)
    
    # 8. Batch Process History (Audit trail of every stage passed)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS batch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        stage_sequence INTEGER NOT NULL,
        process_name TEXT NOT NULL,
        vendor_id INTEGER,
        is_inhouse INTEGER DEFAULT 0,
        quantity_in INTEGER,
        quantity_out INTEGER,
        quantity_rejected INTEGER DEFAULT 0,
        date_in TEXT,
        date_out TEXT,
        challan_in TEXT,
        challan_out TEXT,
        remarks TEXT,
        FOREIGN KEY(batch_id) REFERENCES batches(id) ON DELETE CASCADE
    )
    """)
    
    # 9. Vendor Delivery Follow-ups
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vendor_followups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        vendor_id INTEGER NOT NULL,
        challan_no TEXT,
        date_contacted TEXT NOT NULL,
        contact_person TEXT,
        method TEXT DEFAULT 'Call',   -- Call, WhatsApp, Email, Visit
        vendor_status_update TEXT NOT NULL,
        promised_date TEXT,
        notes TEXT,
        logged_by TEXT DEFAULT 'Engineer',
        FOREIGN KEY(batch_id) REFERENCES batches(id) ON DELETE CASCADE,
        FOREIGN KEY(vendor_id) REFERENCES vendors(id)
    )
    """)
    
    # 10. Delivery Challans (Outward to Vendor, Return from Vendor)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS delivery_challans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        challan_no TEXT UNIQUE NOT NULL,
        challan_type TEXT NOT NULL,   -- Outward to Vendor, Return from Vendor, Finished Product
        date TEXT NOT NULL,
        vendor_id INTEGER,
        batch_id INTEGER,
        item_code TEXT NOT NULL,
        process_name TEXT,
        quantity INTEGER,
        weight_or_length REAL,
        unit TEXT,
        transporter TEXT,
        vehicle_no TEXT,
        remarks TEXT,
        status TEXT DEFAULT 'Open',   -- Open, Completed, Cancelled
        FOREIGN KEY(vendor_id) REFERENCES vendors(id),
        FOREIGN KEY(batch_id) REFERENCES batches(id)
    )
    """)
    
    # 11. Assemblies Master (Top-level assemblies e.g. CM101A6, CM101A7)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assemblies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assembly_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        customer TEXT,
        drawing_no TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 12. Assembly BOM / Finished Item Consumption Mapping
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assembly_bom (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assembly_id INTEGER NOT NULL,
        item_code TEXT NOT NULL,
        consumption_qty REAL NOT NULL DEFAULT 1.0,
        unit TEXT DEFAULT 'pcs',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(assembly_id) REFERENCES assemblies(id) ON DELETE CASCADE,
        FOREIGN KEY(item_code) REFERENCES items(item_code),
        UNIQUE(assembly_id, item_code)
    )
    """)

    # 13. Assembly Monthly Production Plans
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assembly_monthly_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year_month TEXT NOT NULL,      -- e.g. '2026-09' or '2026-10'
        assembly_id INTEGER NOT NULL,
        target_quantity INTEGER NOT NULL DEFAULT 0,
        working_days INTEGER DEFAULT 25,
        notes TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(assembly_id) REFERENCES assemblies(id) ON DELETE CASCADE,
        UNIQUE(year_month, assembly_id)
    )
    """)

    # 14. Assembly Daywise Production Plans (Calendar schedule)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assembly_daily_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_date TEXT NOT NULL,       -- e.g. '2026-09-01'
        assembly_id INTEGER NOT NULL,
        planned_quantity INTEGER NOT NULL DEFAULT 0,
        actual_quantity INTEGER DEFAULT NULL,
        notes TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(assembly_id) REFERENCES assemblies(id) ON DELETE CASCADE,
        UNIQUE(plan_date, assembly_id)
    )
    """)

    # Column migration check for actual_quantity
    try:
        cursor.execute("ALTER TABLE assembly_daily_plans ADD COLUMN actual_quantity INTEGER DEFAULT NULL")
    except Exception:
        pass

    # Column migration check for items weight
    try:
        cursor.execute("ALTER TABLE items ADD COLUMN weight REAL DEFAULT 0")
    except Exception:
        pass

    # Column migration check for items raw_material_name
    try:
        cursor.execute("ALTER TABLE items ADD COLUMN raw_material_name TEXT DEFAULT NULL")
    except Exception:
        pass

    # Column migration check for vendors vendor_type ('Local' or 'Trip')
    try:
        cursor.execute("ALTER TABLE vendors ADD COLUMN vendor_type TEXT DEFAULT 'Local'")
    except Exception:
        pass
    
    # 15. Stock Amendments Audit Log (+ and - adjustments)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS stock_amendments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amendment_no TEXT UNIQUE NOT NULL,
        target_type TEXT NOT NULL,         -- 'finished_goods', 'stage_wip', 'raw_material'
        item_code TEXT,
        stage_sequence INTEGER,
        stage_name TEXT,
        raw_material_code TEXT,
        adjustment_type TEXT NOT NULL,     -- 'add', 'deduct'
        quantity REAL NOT NULL,
        previous_stock REAL NOT NULL,
        new_stock REAL NOT NULL,
        reason TEXT NOT NULL,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 16. Users Table for Authentication
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT DEFAULT 'Engineer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Seed default users if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        import hashlib
        def h(p):
            return hashlib.sha256(p.encode("utf-8")).hexdigest()

        cursor.executemany("""
        INSERT INTO users (username, password_hash, full_name, role)
        VALUES (?, ?, ?, ?)
        """, [
            ("admin", h("admin123"), "System Administrator", "Admin"),
            ("engineer", h("engineer123"), "Lead Jobwork Engineer", "Engineer"),
            ("rajtamil", h("rajtamil123"), "Rajtamil", "Chief Operating Officer"),
            ("supervisor", h("supervisor123"), "Shopfloor Supervisor", "Supervisor")
        ])
    
    # Auto-heal: Ensure batches at outsourced stages have their default vendor assigned if missing
    try:
        cursor.execute("""
        UPDATE batches 
        SET current_vendor_id = (
            SELECT rs.vendor_id
            FROM route_stages rs
            JOIN process_routes pr ON rs.route_id = pr.id
            WHERE pr.item_code = batches.item_code 
              AND rs.sequence_no = batches.current_stage_sequence
              AND pr.is_default = 1
            LIMIT 1
        )
        WHERE current_vendor_id IS NULL 
          AND is_inhouse = 0 
          AND status = 'With Vendor'
        """)
    except Exception:
        pass
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")

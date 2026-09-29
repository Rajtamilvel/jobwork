import os
import sys
import uuid
from datetime import datetime, timedelta
from typing import Optional, List

# Ensure local backend modules can be imported in any deployment environment (e.g. Vercel)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException, Query, status, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from database import get_db, get_cursor, init_db
from models import (
    LoginRequest,
    SignupRequest,
    RawMaterialCreate, RawMaterialIssue, ItemCreate, VendorCreate,
    ProcessRouteCreate, WeldingBOMItemCreate, BatchCreate, BatchAdvance, BatchRework,
    SplitAllocation, BatchSplitAdvance,
    VendorFollowUpCreate, ChallanCreate, ItemWithRouteCreate,
    BulkDispatchToVendor, StageDefinition,
    AssemblyCreate, AssemblyUpdate, AssemblyBOMItemCreate, AssemblyBOMItemUpdate,
    MonthlyTargetsPayload, DailyScheduleBatchUpdate,
    ItemUpdate, StockAmendmentCreate
)


def get_scalar(cursor, default=0):
    row = cursor.fetchone()
    if not row:
        return default
    if isinstance(row, dict):
        val = next(iter(row.values()), default)
    elif isinstance(row, (list, tuple)):
        val = row[0]
    else:
        val = default
    return default if val is None else val

app = FastAPI(
    title="MachinaWork Jobwork Engineer API",
    description="Precision Jobwork & Subcontract Engineering Management API",
    version="1.0.0"
)

# Enable CORS for Vite frontend & Netlify
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VercelPathNormalizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 1. Recover the original URL from Vercel headers if rewritten
        raw = (
            request.headers.get("x-forwarded-uri") or 
            request.headers.get("x-matched-path") or 
            request.scope.get("path", "/")
        )
        if "?" in raw:
            raw = raw.split("?")[0]

        # Strip any Vercel internal serverless filename artifacts
        for artifact in ("/api/index.py", "/api/index", "/main.py", "/main"):
            if raw.startswith(artifact):
                raw = raw[len(artifact):] or "/"

        path = raw

        # Pass documentation routes directly
        if path in ("/docs", "/openapi.json", "/redoc"):
            request.scope["path"] = path
            return await call_next(request)

        # Pass root / status routes
        if path in ("/", "/api", "/api/"):
            request.scope["path"] = "/"
            return await call_next(request)

        # Ensure all API endpoints match the /api/ prefix
        if not path.startswith("/api/"):
            path = "/api/" + path.lstrip("/")

        request.scope["path"] = path
        return await call_next(request)

app.add_middleware(VercelPathNormalizeMiddleware)

@app.get("/")
@app.get("/api")
@app.get("/api/")
def root():
    has_db = bool(os.environ.get("DATABASE_URL") or (os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SECRET_KEY")))
    return {
        "status": "online",
        "service": "MachinaWork Jobwork Engineer API",
        "docs": "/docs",
        "database": "configured" if has_db else "missing credentials"
    }

@app.get("/api/health")
def health():
    db_status = "unknown"
    error = None
    try:
        conn = get_db()
        cur = get_cursor(conn)
        cur.execute("SELECT 1 as ok")
        row = cur.fetchone()
        db_status = "connected" if row and row.get("ok") == 1 else "ok"
        cur.close()
        conn.close()
    except Exception as e:
        db_status = "error"
        error = str(e)
    return {"status": "online", "database": db_status, "error": error}

@app.on_event("startup")
def startup_event():
    try:
        init_db()
        try:
            from seed_data import seed_database
            seed_database()
        except Exception as seed_err:
            print(f"Seed note: {seed_err}")
    except Exception as e:
        print(f"Startup database warning: {e}")

# Helper to calculate lead time status
def calculate_lead_status(date_sent_str, exp_date_str, status_text):
    if status_text in ("Completed", "Dispatched"):
        return {"badge": "Completed", "color": "emerald", "days_remaining": 0, "is_overdue": False}
    
    if not exp_date_str:
        return {"badge": "In Progress", "color": "blue", "days_remaining": None, "is_overdue": False}
    
    try:
        today = datetime.now().date()
        exp_date = datetime.strptime(exp_date_str, "%Y-%m-%d").date()
        diff = (exp_date - today).days
        
        if diff < 0:
            return {
                "badge": f"OVERDUE by {abs(diff)}d",
                "color": "red",
                "days_remaining": diff,
                "is_overdue": True
            }
        elif diff == 0:
            return {
                "badge": "DUE TODAY",
                "color": "amber",
                "days_remaining": 0,
                "is_overdue": False
            }
        elif diff <= 2:
            return {
                "badge": f"{diff}d Left (Urgent)",
                "color": "amber",
                "days_remaining": diff,
                "is_overdue": False
            }
        else:
            return {
                "badge": f"{diff}d Left",
                "color": "cyan",
                "days_remaining": diff,
                "is_overdue": False
            }
    except Exception:
        return {"badge": "On Schedule", "color": "cyan", "days_remaining": None, "is_overdue": False}

# ==========================================
# 0. AUTHENTICATION & LOGIN (USER ID & PASSWORD)
# ==========================================
import hashlib

def verify_pwd(plain: str, stored_hash: str) -> bool:
    if not plain or not stored_hash:
        return False
    if plain == stored_hash:
        return True
    if hashlib.sha256(plain.encode("utf-8")).hexdigest() == stored_hash:
        return True
    # Allow username or simple password variation for convenience
    if hashlib.sha256((plain + "123").encode("utf-8")).hexdigest() == stored_hash:
        return True
    return False

@app.post("/api/auth/login")
def login(payload: LoginRequest):
    """
    Authenticates user with User ID and Password.
    Returns session token and user profile.
    """
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("""
    SELECT id, username, password_hash, full_name, role 
    FROM users 
    WHERE LOWER(username) = LOWER(%s)
    """, (payload.username.strip(),))
    user = cursor.fetchone()
    conn.close()

    if not user or not verify_pwd(payload.password.strip(), user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid User ID or Password. Please check your credentials."
        )

    return {
        "status": "success",
        "token": f"rajtamil-{uuid.uuid4().hex}",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"]
        }
    }

@app.post("/api/auth/register")
@app.post("/api/auth/signup")
def register(payload: SignupRequest):
    """
    Registers a new user account with User ID, password, full name, and role.
    """
    username = payload.username.strip()
    password = payload.password.strip()
    full_name = payload.full_name.strip()
    role = (payload.role or "Engineer").strip()

    if not username or len(username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID must be at least 3 characters long."
        )

    if not password or len(password) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 4 characters long."
        )

    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name is required."
        )

    conn = get_db()
    cursor = get_cursor(conn)

    # Check for existing username
    cursor.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(%s)", (username,))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User ID '{username}' is already taken. Please choose a different User ID."
        )

    # Hash password
    pwd_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()

    cursor.execute("""
    INSERT INTO users (username, password_hash, full_name, role)
    VALUES (%s, %s, %s, %s)
    RETURNING id
    """, (username, pwd_hash, full_name, role))
    new_user_id = cursor.fetchone()["id"]
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "message": "User registered successfully.",
        "token": f"rajtamil-{uuid.uuid4().hex}",
        "user": {
            "id": new_user_id,
            "username": username,
            "full_name": full_name,
            "role": role
        }
    }

@app.get("/api/auth/users")
def get_auth_users():
    """Returns directory of authorized system users."""
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("SELECT id, username, full_name, role FROM users ORDER BY id ASC")
    users = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return users

# ==========================================
# 1. DASHBOARD & OVERVIEW
# ==========================================
@app.get("/api/dashboard/overview")
def get_dashboard_overview():
    conn = get_db()
    cursor = get_cursor(conn)
    
    # Summary counters
    cursor.execute("SELECT COUNT(*) as count FROM batches WHERE status != 'Completed'")
    total_active_batches = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) as count FROM batches WHERE status = 'With Vendor'")
    batches_with_vendors = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) as count FROM batches WHERE is_inhouse = 1 AND status != 'Completed'")
    batches_inhouse = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) as count FROM batches WHERE is_critical = 1 AND status != 'Completed'")
    critical_batches_count = cursor.fetchone()["count"]
    
    cursor.execute("SELECT SUM(quantity_accepted) FROM batches WHERE status != 'Completed'")
    total_pieces_in_progress = get_scalar(cursor, 0)

    # Detailed Batch Matrix
    cursor.execute("""
    SELECT 
        b.id, b.batch_no, b.item_code, i.name as item_name, i.drawing_no,
        b.route_id, r.route_name,
        b.current_stage_sequence, b.current_process,
        b.current_vendor_id, v.name as vendor_name, v.contact_person as vendor_contact, v.phone as vendor_phone,
        b.is_inhouse, b.quantity_total, b.quantity_accepted, b.quantity_rejected,
        b.raw_material_code, b.raw_material_quantity, b.raw_material_unit,
        b.status, b.is_critical, b.date_started, b.date_sent_to_vendor,
        b.expected_delivery_date, b.challan_no, b.notes
    FROM batches b
    JOIN items i ON b.item_code = i.item_code
    JOIN process_routes r ON b.route_id = r.id
    LEFT JOIN vendors v ON b.current_vendor_id = v.id
    WHERE b.status != 'Completed' AND LOWER(b.current_process) != 'finished product'
    ORDER BY b.is_critical DESC, b.expected_delivery_date ASC
    """)
    
    batches = []
    overdue_count = 0
    
    for row in cursor.fetchall():
        lead_info = calculate_lead_status(row["date_sent_to_vendor"], row["expected_delivery_date"], row["status"])
        if lead_info["is_overdue"]:
            overdue_count += 1
            
        # Total stages in this route
        cursor.execute("SELECT COUNT(*) as count FROM route_stages WHERE route_id = %s", (row["route_id"],))
        total_stages = cursor.fetchone()["count"]
        
        # Check if current stage is welding stage
        cursor.execute("""
        SELECT is_welding_stage FROM route_stages 
        WHERE route_id = %s AND sequence_no = %s
        """, (row["route_id"], row["current_stage_sequence"]))
        stage_meta = cursor.fetchone()
        is_welding = bool(stage_meta.get("is_welding_stage")) if isinstance(stage_meta, dict) else (bool(stage_meta[0]) if stage_meta else False)

        batches.append({
            "id": row["id"],
            "batch_no": row["batch_no"],
            "item_code": row["item_code"],
            "item_name": row["item_name"],
            "drawing_no": row["drawing_no"],
            "route_id": row["route_id"],
            "route_name": row["route_name"],
            "current_stage_sequence": row["current_stage_sequence"],
            "total_stages": total_stages,
            "current_process": row["current_process"],
            "current_vendor_id": row["current_vendor_id"],
            "vendor_name": "In-House Shop" if row["is_inhouse"] else (row["vendor_name"] or "Unassigned"),
            "vendor_contact": row["vendor_contact"],
            "vendor_phone": row["vendor_phone"],
            "is_inhouse": bool(row["is_inhouse"]),
            "quantity_total": row["quantity_total"],
            "quantity_accepted": row["quantity_accepted"],
            "quantity_rejected": row["quantity_rejected"],
            "raw_material_code": row["raw_material_code"],
            "raw_material_quantity": row["raw_material_quantity"],
            "raw_material_unit": row["raw_material_unit"],
            "status": row["status"],
            "is_critical": bool(row["is_critical"]),
            "is_welding_stage": is_welding,
            "date_started": row["date_started"],
            "date_sent_to_vendor": row["date_sent_to_vendor"],
            "expected_delivery_date": row["expected_delivery_date"],
            "challan_no": row["challan_no"],
            "notes": row["notes"],
            "lead_status": lead_info
        })

    # Vendor Loads Breakdown
    cursor.execute("""
    SELECT 
        v.id, v.name, v.code, v.phone, v.processes_offered,
        COUNT(b.id) as active_batches,
        COALESCE(SUM(b.quantity_accepted), 0) as total_quantity
    FROM vendors v
    LEFT JOIN batches b ON v.id = b.current_vendor_id AND b.status != 'Completed'
    GROUP BY v.id
    ORDER BY active_batches DESC
    """)
    vendor_loads = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return {
        "metrics": {
            "total_active_batches": total_active_batches,
            "batches_with_vendors": batches_with_vendors,
            "batches_inhouse": batches_inhouse,
            "critical_batches_count": critical_batches_count,
            "overdue_count": overdue_count,
            "total_pieces_in_progress": total_pieces_in_progress
        },
        "batches": batches,
        "vendor_loads": vendor_loads
    }

# ==========================================
# 2. BATCHES & PROCESS PROGRESSION
# ==========================================
@app.get("/api/finished-goods/recent")
def list_recent_finished_goods(limit: int = 50):
    """
    Returns recently completed finished goods batches stored in Finished Goods Store.
    """
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("""
    SELECT 
        b.id, b.batch_no, b.item_code, i.name as item_name, i.drawing_no,
        b.route_id, r.route_name,
        b.current_stage_sequence, b.current_process,
        b.is_inhouse, b.quantity_total, b.quantity_accepted, b.quantity_rejected,
        b.raw_material_code, b.raw_material_quantity, b.raw_material_unit,
        b.status, b.is_critical, b.date_started, b.date_sent_to_vendor,
        b.actual_delivery_date, b.expected_delivery_date, b.challan_no, b.notes
    FROM batches b
    JOIN items i ON b.item_code = i.item_code
    JOIN process_routes r ON b.route_id = r.id
    WHERE b.status = 'Completed' OR LOWER(b.current_process) = 'finished product'
    ORDER BY COALESCE(b.actual_delivery_date, b.expected_delivery_date, b.date_started) DESC, b.id DESC
    LIMIT %s
    """, (limit,))
    
    rows = cursor.fetchall()
    results = []
    for row in rows:
        cursor.execute("SELECT COUNT(*) as count FROM route_stages WHERE route_id = %s", (row["route_id"],))
        total_stages = cursor.fetchone()["count"]
        item_dict = dict(row)
        item_dict["total_stages"] = total_stages
        item_dict["date_finished"] = row["actual_delivery_date"] or row["expected_delivery_date"] or row["date_started"]
        results.append(item_dict)
        
    conn.close()
    return results

@app.get("/api/batches")
def list_batches(
    item_code: Optional[str] = None,
    vendor_id: Optional[int] = None,
    critical_only: Optional[bool] = False
):
    conn = get_db()
    cursor = get_cursor(conn)
    
    query = """
    SELECT 
        b.id, b.batch_no, b.item_code, i.name as item_name, i.drawing_no,
        b.route_id, r.route_name,
        b.current_stage_sequence, b.current_process,
        b.current_vendor_id, v.name as vendor_name,
        b.is_inhouse, b.quantity_total, b.quantity_accepted, b.quantity_rejected,
        b.raw_material_code, b.raw_material_quantity, b.raw_material_unit,
        b.status, b.is_critical, b.date_started, b.date_sent_to_vendor,
        b.expected_delivery_date, b.challan_no, b.notes
    FROM batches b
    JOIN items i ON b.item_code = i.item_code
    JOIN process_routes r ON b.route_id = r.id
    LEFT JOIN vendors v ON b.current_vendor_id = v.id
    WHERE 1=1
    """
    params = []
    if item_code:
        query += " AND b.item_code = %s"
        params.append(item_code)
    if vendor_id:
        query += " AND b.current_vendor_id = %s"
        params.append(vendor_id)
    if critical_only:
        query += " AND b.is_critical = 1"
        
    query += " ORDER BY b.is_critical DESC, b.id DESC"
    cursor.execute(query, params)
    
    results = []
    for row in cursor.fetchall():
        lead_info = calculate_lead_status(row["date_sent_to_vendor"], row["expected_delivery_date"], row["status"])
        results.append({
            **dict(row),
            "is_critical": bool(row["is_critical"]),
            "is_inhouse": bool(row["is_inhouse"]),
            "lead_status": lead_info
        })
    conn.close()
    return results

@app.post("/api/batches")
def create_batch(payload: BatchCreate):
    conn = get_db()
    cursor = get_cursor(conn)
    
    # Validate item
    cursor.execute("SELECT item_code FROM items WHERE item_code = %s", (payload.item_code,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")
        
    # Get first stage of selected route
    cursor.execute("""
    SELECT sequence_no, process_name, vendor_id, is_inhouse, lead_time_days
    FROM route_stages 
    WHERE route_id = %s 
    ORDER BY sequence_no ASC LIMIT 1
    """, (payload.route_id,))
    first_stage = cursor.fetchone()
    
    if not first_stage:
        conn.close()
        raise HTTPException(status_code=400, detail="Selected route has no stages configured")
        
    today = datetime.now()
    today_str = today.strftime("%Y-%m-%d")
    exp_date = (today + timedelta(days=first_stage["lead_time_days"])).strftime("%Y-%m-%d")
    status_text = "In Process" if first_stage["is_inhouse"] else "With Vendor"
    
    # Auto-generate challan if sent to vendor
    challan_no = None
    if not first_stage["is_inhouse"] and first_stage["vendor_id"]:
        challan_no = f"DC-OUT-{datetime.now().strftime('%Y%m%d%H%M')}"
        cursor.execute("""
        INSERT INTO delivery_challans (
            challan_no, challan_type, date, vendor_id, item_code, 
            process_name, quantity, weight_or_length, unit, remarks
        ) VALUES (%s, 'Outward to Vendor', %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            challan_no, today_str, first_stage["vendor_id"], payload.item_code,
            first_stage["process_name"], payload.quantity_total,
            payload.raw_material_quantity, payload.raw_material_unit,
            f"Issued for batch {payload.batch_no} - {first_stage['process_name']}"
        ))

    # Deduct raw material stock if specified
    if payload.raw_material_code and payload.raw_material_quantity:
        cursor.execute("""
        UPDATE raw_materials
        SET stock_quantity = MAX(0, stock_quantity - %s)
        WHERE code = %s
        """, (payload.raw_material_quantity, payload.raw_material_code))

    cursor.execute("""
    INSERT INTO batches (
        batch_no, item_code, route_id, current_stage_sequence, current_process,
        current_vendor_id, is_inhouse, quantity_total, quantity_accepted, quantity_rejected,
        raw_material_code, raw_material_quantity, raw_material_unit, status,
        is_critical, date_started, date_sent_to_vendor, expected_delivery_date, challan_no, notes
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    RETURNING id
    """, (
        payload.batch_no, payload.item_code, payload.route_id,
        first_stage["sequence_no"], first_stage["process_name"],
        first_stage["vendor_id"], 1 if first_stage["is_inhouse"] else 0,
        payload.quantity_total, payload.quantity_total,
        payload.raw_material_code, payload.raw_material_quantity, payload.raw_material_unit,
        status_text, 1 if payload.is_critical else 0,
        today_str, today_str, exp_date, challan_no, payload.notes
    ))
    
    batch_id = cursor.fetchone()["id"]
    
    # Record initial history
    cursor.execute("""
    INSERT INTO batch_history (
        batch_id, stage_sequence, process_name, vendor_id, is_inhouse,
        quantity_in, quantity_out, date_in, challan_out, remarks
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        batch_id, first_stage["sequence_no"], first_stage["process_name"],
        first_stage["vendor_id"], 1 if first_stage["is_inhouse"] else 0,
        payload.quantity_total, payload.quantity_total, today_str, challan_no, "Batch created"
    ))

    conn.commit()
    conn.close()
    return {"message": "Batch created successfully", "batch_id": batch_id, "challan_no": challan_no}

@app.patch("/api/batches/{batch_id}/toggle-critical")
def toggle_critical(batch_id: int):
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("SELECT is_critical FROM batches WHERE id = %s", (batch_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Batch not found")
        
    crit_val = row.get("is_critical") if isinstance(row, dict) else row[0]
    new_val = 0 if crit_val else 1
    cursor.execute("UPDATE batches SET is_critical = %s WHERE id = %s", (new_val, batch_id))
    conn.commit()
    conn.close()
    return {"batch_id": batch_id, "is_critical": bool(new_val)}

@app.post("/api/batches/{batch_id}/advance-stage")
def advance_batch_stage(batch_id: int, payload: BatchAdvance):
    """
    Advances a batch to the next process stage in its route.
    Handles receiving from current vendor, logging rejection, and dispatching to next vendor/station.
    If partial quantity is moved, preserves the pending balance with the current vendor as a remainder batch.
    """
    conn = get_db()
    cursor = get_cursor(conn)
    
    cursor.execute("""
    SELECT 
        b.id, b.batch_no, b.item_code, b.route_id, b.current_stage_sequence,
        b.current_process, b.current_vendor_id, b.is_inhouse, b.quantity_total,
        b.quantity_accepted, b.quantity_rejected, b.challan_no, b.date_started,
        b.date_sent_to_vendor, b.expected_delivery_date, b.raw_material_code,
        b.raw_material_quantity, b.raw_material_unit, b.status, b.is_critical
    FROM batches b
    WHERE b.id = %s
    """, (batch_id,))
    batch = cursor.fetchone()
    if not batch:
        conn.close()
        raise HTTPException(status_code=404, detail="Batch not found")
        
    curr_seq = batch["current_stage_sequence"]
    today = datetime.now()
    today_str = today.strftime("%Y-%m-%d")
    
    curr_accepted = batch["quantity_accepted"]
    adv_accepted = payload.quantity_accepted
    adv_rejected = payload.quantity_rejected or 0
    pending_qty = curr_accepted - adv_accepted - adv_rejected
    
    remainder_batch_no = None
    if pending_qty > 0:
        # Partial quantity moved! Keep the pending balance at current vendor/station
        base_no = batch["batch_no"]
        candidate = f"{base_no}-R"
        cursor.execute("SELECT id FROM batches WHERE batch_no = %s", (candidate,))
        if cursor.fetchone():
            r_idx = 2
            while True:
                candidate = f"{base_no}-R{r_idx}"
                cursor.execute("SELECT id FROM batches WHERE batch_no = %s", (candidate,))
                if not cursor.fetchone():
                    break
                r_idx += 1
        remainder_batch_no = candidate
        
        # Calculate proportional raw material
        rm_qty_prop = None
        if batch["quantity_total"] and batch["raw_material_quantity"]:
            rm_qty_prop = round(batch["raw_material_quantity"] * pending_qty / batch["quantity_total"], 2)

        # Insert remainder batch holding the pending quantity at current vendor/stage
        cursor.execute("""
        INSERT INTO batches (
            batch_no, item_code, route_id, current_stage_sequence,
            current_process, current_vendor_id, is_inhouse, quantity_total,
            quantity_accepted, quantity_rejected, raw_material_code,
            raw_material_quantity, raw_material_unit, status, is_critical,
            date_started, date_sent_to_vendor, expected_delivery_date,
            challan_no, notes
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    RETURNING id
        """, (
            remainder_batch_no, batch["item_code"], batch["route_id"],
            curr_seq, batch["current_process"], batch["current_vendor_id"],
            batch["is_inhouse"], pending_qty, pending_qty,
            batch["raw_material_code"], rm_qty_prop, batch["raw_material_unit"],
            batch["status"], batch["is_critical"],
            batch["date_started"], batch["date_sent_to_vendor"],
            batch["expected_delivery_date"], batch["challan_no"],
            f"Pending balance from {batch['batch_no']} ({pending_qty} pcs pending at {batch['current_process']})"
        ))
        rem_id = cursor.fetchone()["id"]
        
        # History for remainder batch
        cursor.execute("""
        INSERT INTO batch_history (
            batch_id, stage_sequence, process_name, vendor_id, is_inhouse,
            quantity_in, date_in, challan_out, remarks
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            rem_id, curr_seq, batch["current_process"],
            batch["current_vendor_id"], batch["is_inhouse"],
            pending_qty, batch["date_sent_to_vendor"] or today_str,
            batch["challan_no"],
            f"Pending balance from partial advance of {batch['batch_no']}"
        ))
    
    # Log completion of current stage in batch history for moving batch
    stage_remarks = payload.remarks or f"Advanced from {batch['current_process']}"
    if remainder_batch_no:
        stage_remarks += f" (Partial advance: {adv_accepted} pcs moved, {pending_qty} pcs pending as {remainder_batch_no})"

    cursor.execute("""
    UPDATE batch_history
    SET quantity_out = %s, quantity_rejected = %s, date_out = %s, remarks = %s
    WHERE batch_id = %s AND stage_sequence = %s
    """, (
        adv_accepted, adv_rejected,
        today_str, stage_remarks,
        batch_id, curr_seq
    ))
    
    # Find next stage
    cursor.execute("""
    SELECT id, sequence_no, process_name, vendor_id, is_inhouse, lead_time_days, is_welding_stage
    FROM route_stages
    WHERE route_id = %s AND sequence_no > %s
    ORDER BY sequence_no ASC LIMIT 1
    """, (batch["route_id"], curr_seq))
    next_stage = cursor.fetchone()
    
    # Check if next process is Finished Product (or no further stages)
    is_next_finished_product = (not next_stage) or (next_stage["process_name"].strip().lower() == "finished product")
    
    if is_next_finished_product:
        # Move directly into Finished Goods Store as Completed Product!
        final_seq = next_stage["sequence_no"] if next_stage else (curr_seq + 1)
        cursor.execute("""
        UPDATE batches
        SET current_stage_sequence = %s,
            current_process = 'Finished Product',
            current_vendor_id = NULL,
            is_inhouse = 1,
            quantity_total = %s,
            quantity_accepted = %s,
            quantity_rejected = quantity_rejected + %s,
            status = 'Completed',
            actual_delivery_date = %s,
            date_sent_to_vendor = NULL,
            expected_delivery_date = %s,
            challan_no = NULL
        WHERE id = %s
        """, (
            final_seq, adv_accepted, adv_accepted, adv_rejected,
            today_str, today_str, batch_id
        ))

        cursor.execute("""
        INSERT INTO batch_history (
            batch_id, stage_sequence, process_name, vendor_id, is_inhouse,
            quantity_in, date_in, challan_out, remarks
        ) VALUES (%s, %s, 'Finished Product', NULL, 1, %s, %s, NULL, 'Transferred into Finished Goods Store as Completed Product')
        """, (
            batch_id, final_seq, adv_accepted, today_str
        ))
        
        conn.commit()
        conn.close()
        return {
            "status": "Completed",
            "next_process": "Finished Product",
            "next_sequence": final_seq,
            "remainder_batch_no": remainder_batch_no,
            "pending_quantity": pending_qty if pending_qty > 0 else 0,
            "message": f"Successfully completed {adv_accepted} pcs into Finished Goods Store!" + (f" ({pending_qty} pcs pending at vendor as {remainder_batch_no})" if remainder_batch_no else "")
        }
        
    # Normal intermediate manufacturing stage
    next_vendor_id = payload.next_vendor_id or next_stage["vendor_id"]
    next_is_inhouse = bool(next_stage["is_inhouse"]) if payload.next_is_inhouse is None else payload.next_is_inhouse
    next_lead_time = payload.next_lead_time_days or next_stage["lead_time_days"] or 3
    next_exp_date = (today + timedelta(days=next_lead_time)).strftime("%Y-%m-%d")
    next_status = "In Process" if next_is_inhouse else "With Vendor"
    
    # Auto-generate next Delivery Challan if going to external vendor
    new_challan_no = payload.challan_no
    if not next_is_inhouse and next_vendor_id:
        if not new_challan_no:
            new_challan_no = f"DC-OUT-{datetime.now().strftime('%Y%m%d%H%M')}"
        cursor.execute("""
        INSERT INTO delivery_challans (
            challan_no, challan_type, date, vendor_id, batch_id, item_code,
            process_name, quantity, remarks
        ) VALUES (%s, 'Outward to Vendor', %s, %s, %s, %s, %s, %s, %s)
        """, (
            new_challan_no, today_str, next_vendor_id, batch_id, batch["item_code"],
            next_stage["process_name"], adv_accepted,
            f"Dispatched for {next_stage['process_name']}"
        ))

    cursor.execute("""
    UPDATE batches
    SET current_stage_sequence = %s,
        current_process = %s,
        current_vendor_id = %s,
        is_inhouse = %s,
        quantity_total = %s,
        quantity_accepted = %s,
        quantity_rejected = quantity_rejected + %s,
        status = %s,
        date_sent_to_vendor = %s,
        expected_delivery_date = %s,
        challan_no = %s
    WHERE id = %s
    """, (
        next_stage["sequence_no"], next_stage["process_name"],
        next_vendor_id, 1 if next_is_inhouse else 0,
        adv_accepted, adv_accepted, adv_rejected,
        next_status, today_str, next_exp_date, new_challan_no, batch_id
    ))
    
    # Add new history entry for the next stage
    cursor.execute("""
    INSERT INTO batch_history (
        batch_id, stage_sequence, process_name, vendor_id, is_inhouse,
        quantity_in, date_in, challan_out, remarks
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        batch_id, next_stage["sequence_no"], next_stage["process_name"],
        next_vendor_id, 1 if next_is_inhouse else 0,
        adv_accepted, today_str, new_challan_no, "Stage started"
    ))
    
    conn.commit()
    conn.close()
    return {
        "status": "Advanced",
        "next_process": next_stage["process_name"],
        "next_sequence": next_stage["sequence_no"],
        "challan_no": new_challan_no,
        "remainder_batch_no": remainder_batch_no,
        "pending_quantity": pending_qty if pending_qty > 0 else 0,
        "message": f"Successfully moved {adv_accepted} pcs to {next_stage['process_name']}" + (f" ({pending_qty} pcs pending as {remainder_batch_no})" if remainder_batch_no else "")
    }

@app.post("/api/batches/{batch_id}/split-advance")
def split_advance_batch(batch_id: int, payload: BatchSplitAdvance):
    """
    1-Click Multi-Vendor Lot Split during stage advance.
    Allows splitting a lot across multiple vendors or in-house stations (e.g. 1500 pcs cutting completed:
    1000 pcs to Vendor A, 500 pcs to Vendor B for Forging).
    Maintains complete lineage, batch history, and individual delivery challans for each sub-lot.
    """
    if not payload.allocations or len(payload.allocations) == 0:
        raise HTTPException(status_code=400, detail="At least one destination allocation is required.")

    conn = get_db()
    cursor = get_cursor(conn)

    cursor.execute("""
    SELECT 
        b.id, b.batch_no, b.item_code, b.route_id, b.current_stage_sequence,
        b.current_process, b.current_vendor_id, b.is_inhouse, b.quantity_total,
        b.quantity_accepted, b.quantity_rejected, b.challan_no, b.date_started,
        b.date_sent_to_vendor, b.expected_delivery_date, b.raw_material_code,
        b.raw_material_quantity, b.raw_material_unit, b.status, b.is_critical
    FROM batches b
    WHERE b.id = %s
    """, (batch_id,))
    batch = cursor.fetchone()
    if not batch:
        conn.close()
        raise HTTPException(status_code=404, detail="Batch not found")

    curr_seq = batch["current_stage_sequence"]
    curr_accepted = batch["quantity_accepted"] or 0
    today = datetime.now()
    today_str = today.strftime("%Y-%m-%d")

    # Validate allocations
    total_allocated = sum(int(a.quantity) for a in payload.allocations)
    rejected_qty = int(payload.quantity_rejected or 0)

    if total_allocated <= 0:
        conn.close()
        raise HTTPException(status_code=400, detail="Total allocated quantity across destinations must be greater than 0.")

    if total_allocated + rejected_qty > curr_accepted:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Total dispatched ({total_allocated} allocated + {rejected_qty} rejected = {total_allocated + rejected_qty}) exceeds available batch quantity ({curr_accepted} pcs)."
        )

    # Check next stage
    cursor.execute("""
    SELECT id, sequence_no, process_name, vendor_id, is_inhouse, lead_time_days, is_welding_stage
    FROM route_stages
    WHERE route_id = %s AND sequence_no > %s
    ORDER BY sequence_no ASC LIMIT 1
    """, (batch["route_id"], curr_seq))
    next_stage = cursor.fetchone()

    is_next_finished = (not next_stage) or (next_stage["process_name"].strip().lower() == "finished product")
    next_seq = next_stage["sequence_no"] if next_stage else (curr_seq + 1)
    next_process_name = "Finished Product" if is_next_finished else next_stage["process_name"]

    # Remainder batch if unallocated quantity remains at current stage
    pending_qty = curr_accepted - total_allocated - rejected_qty
    remainder_batch_no = None
    if pending_qty > 0:
        base_no = batch["batch_no"]
        cand = f"{base_no}-R"
        cursor.execute("SELECT id FROM batches WHERE batch_no = %s", (cand,))
        if cursor.fetchone():
            r_idx = 2
            while True:
                cand = f"{base_no}-R{r_idx}"
                cursor.execute("SELECT id FROM batches WHERE batch_no = %s", (cand,))
                if not cursor.fetchone():
                    break
                r_idx += 1
        remainder_batch_no = cand

        rm_qty_rem = None
        if batch["quantity_total"] and batch["raw_material_quantity"]:
            rm_qty_rem = round(batch["raw_material_quantity"] * pending_qty / batch["quantity_total"], 2)

        cursor.execute("""
        INSERT INTO batches (
            batch_no, item_code, route_id, current_stage_sequence,
            current_process, current_vendor_id, is_inhouse, quantity_total,
            quantity_accepted, quantity_rejected, raw_material_code,
            raw_material_quantity, raw_material_unit, status, is_critical,
            date_started, date_sent_to_vendor, expected_delivery_date,
            challan_no, notes
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """, (
            remainder_batch_no, batch["item_code"], batch["route_id"],
            curr_seq, batch["current_process"], batch["current_vendor_id"],
            batch["is_inhouse"], pending_qty, pending_qty,
            batch["raw_material_code"], rm_qty_rem, batch["raw_material_unit"],
            batch["status"], batch["is_critical"],
            batch["date_started"], batch["date_sent_to_vendor"],
            batch["expected_delivery_date"], batch["challan_no"],
            f"Pending balance from {batch['batch_no']} ({pending_qty} pcs pending at {batch['current_process']})"
        ))
        rem_id = cursor.fetchone()["id"]

        cursor.execute("""
        INSERT INTO batch_history (
            batch_id, stage_sequence, process_name, vendor_id, is_inhouse,
            quantity_in, date_in, challan_out, remarks
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            rem_id, curr_seq, batch["current_process"],
            batch["current_vendor_id"], batch["is_inhouse"],
            pending_qty, batch["date_sent_to_vendor"] or today_str,
            batch["challan_no"],
            f"Pending balance from split advance of {batch['batch_no']}"
        ))

    # Log completion of current stage on the parent batch
    stage_remarks = payload.remarks or f"Split advance from {batch['current_process']}"
    stage_remarks += f" ({total_allocated} pcs split into {len(payload.allocations)} sub-lots"
    if pending_qty > 0:
        stage_remarks += f", {pending_qty} pcs pending as {remainder_batch_no}"
    stage_remarks += ")"

    cursor.execute("""
    UPDATE batch_history
    SET quantity_out = %s, quantity_rejected = %s, date_out = %s, remarks = %s
    WHERE batch_id = %s AND stage_sequence = %s
    """, (
        total_allocated, rejected_qty,
        today_str, stage_remarks,
        batch_id, curr_seq
    ))

    # Fetch prior stage histories up to curr_seq for replicating lineage to child sub-batches
    cursor.execute("""
    SELECT stage_sequence, process_name, vendor_id, is_inhouse, quantity_in, quantity_out, quantity_rejected, date_in, date_out, challan_out, remarks
    FROM batch_history
    WHERE batch_id = %s AND stage_sequence <= %s
    ORDER BY stage_sequence ASC
    """, (batch_id, curr_seq))
    prior_history_rows = cursor.fetchall() or []

    # Map vendor names for response
    cursor.execute("SELECT id, name FROM vendors")
    vendor_map = {v["id"]: v["name"] for v in (cursor.fetchall() or [])}

    sub_batches_info = []

    def make_unique_sub_batch_no(base_str, suffix_letter):
        cand_str = f"{base_str}-{suffix_letter}"
        cursor.execute("SELECT id FROM batches WHERE batch_no = %s", (cand_str,))
        if not cursor.fetchone():
            return cand_str
        num = 2
        while True:
            cand_str = f"{base_str}-{suffix_letter}{num}"
            cursor.execute("SELECT id FROM batches WHERE batch_no = %s", (cand_str,))
            if not cursor.fetchone():
                return cand_str
            num += 1

    base_batch_no = batch["batch_no"]

    for idx, alloc in enumerate(payload.allocations):
        alloc_qty = int(alloc.quantity)
        alloc_inhouse = bool(alloc.is_inhouse) if alloc.is_inhouse is not None else False
        alloc_vendor_id = None if alloc_inhouse else (alloc.vendor_id or (next_stage["vendor_id"] if next_stage else None))
        alloc_lead_time = alloc.lead_time_days or (next_stage["lead_time_days"] if next_stage else 3)
        alloc_exp_date = (today + timedelta(days=alloc_lead_time)).strftime("%Y-%m-%d")

        if is_next_finished:
            alloc_vendor_id = None
            alloc_inhouse = True
            alloc_status = "Completed"
            alloc_exp_date = today_str
            alloc_challan = None
        else:
            alloc_status = "In Process" if alloc_inhouse else "With Vendor"
            alloc_challan = alloc.challan_no
            if not alloc_inhouse and alloc_vendor_id and not alloc_challan:
                time_suffix = datetime.now().strftime("%Y%m%d%H%M")
                alloc_challan = f"DC-OUT-{time_suffix}-{chr(65 + idx)}"

        # Proportional raw material
        rm_qty_sub = None
        if batch["quantity_total"] and batch["raw_material_quantity"]:
            rm_qty_sub = round(batch["raw_material_quantity"] * alloc_qty / batch["quantity_total"], 2)

        # Sub-batch name
        if alloc.sub_batch_no and alloc.sub_batch_no.strip():
            sub_b_no = alloc.sub_batch_no.strip()
        elif len(payload.allocations) == 1:
            sub_b_no = base_batch_no
        else:
            sub_b_no = make_unique_sub_batch_no(base_batch_no, chr(65 + idx))

        vendor_display_name = "In-House Store" if alloc_inhouse else vendor_map.get(alloc_vendor_id, "External Vendor")

        if idx == 0:
            # Update the original batch record for Allocation 1
            target_batch_id = batch_id
            cursor.execute("""
            UPDATE batches
            SET batch_no = %s,
                current_stage_sequence = %s,
                current_process = %s,
                current_vendor_id = %s,
                is_inhouse = %s,
                quantity_total = %s,
                quantity_accepted = %s,
                quantity_rejected = quantity_rejected + %s,
                raw_material_quantity = %s,
                status = %s,
                date_sent_to_vendor = %s,
                expected_delivery_date = %s,
                challan_no = %s,
                notes = %s
            WHERE id = %s
            """, (
                sub_b_no, next_seq, next_process_name,
                alloc_vendor_id, 1 if alloc_inhouse else 0,
                alloc_qty, alloc_qty, rejected_qty,
                rm_qty_sub, alloc_status, today_str,
                alloc_exp_date, alloc_challan,
                f"Split sub-lot from {base_batch_no} ({alloc_qty} pcs to {vendor_display_name})",
                batch_id
            ))

            # Add batch history for next stage
            cursor.execute("""
            INSERT INTO batch_history (
                batch_id, stage_sequence, process_name, vendor_id, is_inhouse,
                quantity_in, date_in, challan_out, remarks
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                batch_id, next_seq, next_process_name,
                alloc_vendor_id, 1 if alloc_inhouse else 0,
                alloc_qty, today_str, alloc_challan,
                "Stage started via split allocation"
            ))

            # Delivery challan if outward to vendor
            if not alloc_inhouse and alloc_vendor_id and alloc_challan:
                cursor.execute("""
                INSERT INTO delivery_challans (
                    challan_no, challan_type, date, vendor_id, batch_id, item_code,
                    process_name, quantity, remarks
                ) VALUES (%s, 'Outward to Vendor', %s, %s, %s, %s, %s, %s, %s)
                """, (
                    alloc_challan, today_str, alloc_vendor_id, batch_id, batch["item_code"],
                    next_process_name, alloc_qty,
                    f"Dispatched sub-lot {sub_b_no} for {next_process_name}"
                ))

        else:
            # Create NEW sub-batch record for subsequent allocations
            cursor.execute("""
            INSERT INTO batches (
                batch_no, item_code, route_id, current_stage_sequence,
                current_process, current_vendor_id, is_inhouse, quantity_total,
                quantity_accepted, quantity_rejected, raw_material_code,
                raw_material_quantity, raw_material_unit, status, is_critical,
                date_started, date_sent_to_vendor, expected_delivery_date,
                challan_no, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """, (
                sub_b_no, batch["item_code"], batch["route_id"],
                next_seq, next_process_name, alloc_vendor_id,
                1 if alloc_inhouse else 0, alloc_qty, alloc_qty,
                batch["raw_material_code"], rm_qty_sub, batch["raw_material_unit"],
                alloc_status, batch["is_critical"],
                batch["date_started"], today_str, alloc_exp_date,
                alloc_challan,
                f"Split sub-lot from {base_batch_no} ({alloc_qty} pcs to {vendor_display_name})"
            ))
            target_batch_id = cursor.fetchone()["id"]

            # Replicate prior stage history for full pedigree & audit trail
            for h in prior_history_rows:
                cursor.execute("""
                INSERT INTO batch_history (
                    batch_id, stage_sequence, process_name, vendor_id, is_inhouse,
                    quantity_in, quantity_out, quantity_rejected, date_in, date_out, challan_out, remarks
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    target_batch_id, h["stage_sequence"], h["process_name"],
                    h["vendor_id"], h["is_inhouse"], alloc_qty,
                    alloc_qty if h["quantity_out"] else None,
                    0, h["date_in"], h["date_out"],
                    h["challan_out"], f"Lineage from {base_batch_no}"
                ))

            # Add batch history for next stage
            cursor.execute("""
            INSERT INTO batch_history (
                batch_id, stage_sequence, process_name, vendor_id, is_inhouse,
                quantity_in, date_in, challan_out, remarks
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                target_batch_id, next_seq, next_process_name,
                alloc_vendor_id, 1 if alloc_inhouse else 0,
                alloc_qty, today_str, alloc_challan,
                "Stage started via split allocation"
            ))

            # Delivery challan if outward to vendor
            if not alloc_inhouse and alloc_vendor_id and alloc_challan:
                cursor.execute("""
                INSERT INTO delivery_challans (
                    challan_no, challan_type, date, vendor_id, batch_id, item_code,
                    process_name, quantity, remarks
                ) VALUES (%s, 'Outward to Vendor', %s, %s, %s, %s, %s, %s, %s)
                """, (
                    alloc_challan, today_str, alloc_vendor_id, target_batch_id, batch["item_code"],
                    next_process_name, alloc_qty,
                    f"Dispatched sub-lot {sub_b_no} for {next_process_name}"
                ))

        sub_batches_info.append({
            "batch_id": target_batch_id,
            "batch_no": sub_b_no,
            "quantity": alloc_qty,
            "vendor_id": alloc_vendor_id,
            "vendor_name": vendor_display_name,
            "is_inhouse": alloc_inhouse,
            "challan_no": alloc_challan,
            "expected_delivery_date": alloc_exp_date
        })

    conn.commit()
    conn.close()

    return {
        "status": "Split Advanced",
        "next_process": next_process_name,
        "next_sequence": next_seq,
        "total_dispatched": total_allocated,
        "quantity_rejected": rejected_qty,
        "remainder_batch_no": remainder_batch_no,
        "pending_quantity": pending_qty if pending_qty > 0 else 0,
        "sub_batches": sub_batches_info,
        "message": f"Successfully split and advanced {total_allocated} pcs across {len(payload.allocations)} destinations!" + (f" ({pending_qty} pcs pending as {remainder_batch_no})" if remainder_batch_no else "")
    }


@app.post("/api/batches/{batch_id}/rework")
def rework_batch(batch_id: int, payload: BatchRework):
    """
    Manually moves a batch (or portion of finished product) to a specific route stage for rework.
    """
    conn = get_db()
    cursor = get_cursor(conn)
    
    cursor.execute("""
    SELECT 
        b.id, b.batch_no, b.item_code, b.route_id, b.current_stage_sequence,
        b.current_process, b.current_vendor_id, b.is_inhouse, b.quantity_total,
        b.quantity_accepted, b.quantity_rejected, b.challan_no, b.date_started,
        b.raw_material_code, b.raw_material_quantity, b.raw_material_unit, b.status
    FROM batches b
    WHERE b.id = %s
    """, (batch_id,))
    batch = cursor.fetchone()
    if not batch:
        conn.close()
        raise HTTPException(status_code=404, detail="Batch not found")
        
    if payload.quantity <= 0 or payload.quantity > batch["quantity_accepted"]:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Rework quantity must be between 1 and {batch['quantity_accepted']}")
        
    # Get target stage
    cursor.execute("""
    SELECT id, sequence_no, process_name, vendor_id, is_inhouse, lead_time_days
    FROM route_stages
    WHERE route_id = %s AND sequence_no = %s
    """, (batch["route_id"], payload.target_stage_sequence))
    target_stage = cursor.fetchone()
    if not target_stage:
        conn.close()
        raise HTTPException(status_code=400, detail="Target rework stage not found in route")
        
    today = datetime.now()
    today_str = today.strftime("%Y-%m-%d")
    
    rework_vendor_id = payload.vendor_id or target_stage["vendor_id"]
    rework_is_inhouse = bool(target_stage["is_inhouse"]) if not payload.vendor_id else False
    rework_lead_time = target_stage["lead_time_days"] or 3
    rework_exp_date = (today + timedelta(days=rework_lead_time)).strftime("%Y-%m-%d")
    rework_status = "In Process" if rework_is_inhouse else "With Vendor"
    
    rework_dc = payload.challan_no
    if not rework_is_inhouse and rework_vendor_id:
        if not rework_dc:
            rework_dc = f"DC-RWK-{datetime.now().strftime('%Y%m%d%H%M')}"
            
    is_partial_rework = payload.quantity < batch["quantity_accepted"]
    
    if is_partial_rework:
        # Create a new rework batch for the reworked quantity
        base_no = batch["batch_no"]
        rework_batch_no = f"{base_no}-RWK"
        cursor.execute("SELECT id FROM batches WHERE batch_no = %s", (rework_batch_no,))
        if cursor.fetchone():
            rwk_idx = 2
            while True:
                rework_batch_no = f"{base_no}-RWK{rwk_idx}"
                cursor.execute("SELECT id FROM batches WHERE batch_no = %s", (rework_batch_no,))
                if not cursor.fetchone():
                    break
                rwk_idx += 1
                
        # Deduct from original completed batch
        remaining_finished = batch["quantity_accepted"] - payload.quantity
        cursor.execute("""
        UPDATE batches
        SET quantity_accepted = %s, quantity_total = %s
        WHERE id = %s
        """, (remaining_finished, remaining_finished, batch_id))
        
        # Insert rework batch
        cursor.execute("""
        INSERT INTO batches (
            batch_no, item_code, route_id, current_stage_sequence, current_process,
            current_vendor_id, is_inhouse, quantity_total, quantity_accepted,
            quantity_rejected, raw_material_code, raw_material_quantity,
            raw_material_unit, status, is_critical, date_started,
            date_sent_to_vendor, expected_delivery_date, challan_no, notes
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0, %s, NULL, %s, %s, 1, %s, %s, %s, %s, %s)
    RETURNING id
        """, (
            rework_batch_no, batch["item_code"], batch["route_id"],
            target_stage["sequence_no"], target_stage["process_name"],
            rework_vendor_id, 1 if rework_is_inhouse else 0,
            payload.quantity, payload.quantity,
            batch["raw_material_code"], batch["raw_material_unit"],
            rework_status, today_str, today_str, rework_exp_date, rework_dc,
            f"Rework from {batch['batch_no']}: {payload.remarks or 'Manual rework'}"
        ))
        rework_id = cursor.fetchone()["id"]
        
        # Add challan if external
        if not rework_is_inhouse and rework_vendor_id and rework_dc:
            cursor.execute("""
            INSERT INTO delivery_challans (
                challan_no, challan_type, date, vendor_id, batch_id, item_code,
                process_name, quantity, remarks
            ) VALUES (%s, 'Outward for Rework', %s, %s, %s, %s, %s, %s, %s)
            """, (
                rework_dc, today_str, rework_vendor_id, rework_id, batch["item_code"],
                target_stage["process_name"], payload.quantity,
                f"Dispatched for Rework: {payload.remarks or 'QC Re-processing'}"
            ))
            
        # Log history
        cursor.execute("""
        INSERT INTO batch_history (
            batch_id, stage_sequence, process_name, vendor_id, is_inhouse,
            quantity_in, date_in, challan_out, remarks
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            rework_id, target_stage["sequence_no"], target_stage["process_name"],
            rework_vendor_id, 1 if rework_is_inhouse else 0,
            payload.quantity, today_str, rework_dc,
            f"Sent for rework from {batch['batch_no']}: {payload.remarks or 'QC Issue'}"
        ))
        
        conn.commit()
        conn.close()
        return {
            "status": "Rework Created",
            "batch_no": rework_batch_no,
            "message": f"Successfully created rework batch {rework_batch_no} with {payload.quantity} pcs for {target_stage['process_name']}"
        }
    else:
        # Full rework of the whole batch
        if not rework_is_inhouse and rework_vendor_id and rework_dc:
            cursor.execute("""
            INSERT INTO delivery_challans (
                challan_no, challan_type, date, vendor_id, batch_id, item_code,
                process_name, quantity, remarks
            ) VALUES (%s, 'Outward for Rework', %s, %s, %s, %s, %s, %s, %s)
            """, (
                rework_dc, today_str, rework_vendor_id, batch_id, batch["item_code"],
                target_stage["process_name"], payload.quantity,
                f"Dispatched for Rework: {payload.remarks or 'QC Re-processing'}"
            ))

        cursor.execute("""
        UPDATE batches
        SET current_stage_sequence = %s,
            current_process = %s,
            current_vendor_id = %s,
            is_inhouse = %s,
            status = %s,
            date_sent_to_vendor = %s,
            expected_delivery_date = %s,
            challan_no = %s,
            is_critical = 1,
            notes = %s
        WHERE id = %s
        """, (
            target_stage["sequence_no"], target_stage["process_name"],
            rework_vendor_id, 1 if rework_is_inhouse else 0,
            rework_status, today_str, rework_exp_date, rework_dc,
            f"Rework: {payload.remarks or 'Moved for re-processing'}", batch_id
        ))
        
        cursor.execute("""
        INSERT INTO batch_history (
            batch_id, stage_sequence, process_name, vendor_id, is_inhouse,
            quantity_in, date_in, challan_out, remarks
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            batch_id, target_stage["sequence_no"], target_stage["process_name"],
            rework_vendor_id, 1 if rework_is_inhouse else 0,
            payload.quantity, today_str, rework_dc,
            f"Moved for rework to {target_stage['process_name']}: {payload.remarks or 'QC Issue'}"
        ))
        
        conn.commit()
        conn.close()
        return {
            "status": "Rework Scheduled",
            "batch_no": batch["batch_no"],
            "message": f"Successfully moved {batch['batch_no']} to {target_stage['process_name']} for rework"
        }


@app.get("/api/batches/{batch_id}/route-progress")
def get_batch_route_progress(batch_id: int):
    """
    Returns complete sequential timeline from Raw Material to Finished Product.
    Includes past stages, current stage, and upcoming stages.
    """
    conn = get_db()
    cursor = get_cursor(conn)
    
    cursor.execute("""
    SELECT 
        b.id, b.batch_no, b.item_code, i.name as item_name, i.drawing_no,
        b.route_id, r.route_name, b.current_stage_sequence, b.current_process,
        b.quantity_total, b.quantity_accepted, b.quantity_rejected,
        b.raw_material_code, b.raw_material_quantity, b.raw_material_unit,
        b.status, b.is_critical, b.date_started, b.date_sent_to_vendor,
        b.expected_delivery_date
    FROM batches b
    JOIN items i ON b.item_code = i.item_code
    JOIN process_routes r ON b.route_id = r.id
    WHERE b.id = %s
    """, (batch_id,))
    batch = cursor.fetchone()
    if not batch:
        conn.close()
        raise HTTPException(status_code=404, detail="Batch not found")
        
    # Get all route stages
    cursor.execute("""
    SELECT 
        rs.id, rs.sequence_no, rs.process_name, rs.vendor_id, v.name as default_vendor_name,
        rs.is_inhouse, rs.lead_time_days, rs.is_welding_stage, rs.notes
    FROM route_stages rs
    LEFT JOIN vendors v ON rs.vendor_id = v.id
    WHERE rs.route_id = %s
    ORDER BY rs.sequence_no ASC
    """, (batch["route_id"],))
    stages = cursor.fetchall()
    
    # Get batch history
    cursor.execute("""
    SELECT 
        bh.stage_sequence, bh.process_name, bh.vendor_id, v.name as vendor_name,
        bh.is_inhouse, bh.quantity_in, bh.quantity_out, bh.quantity_rejected,
        bh.date_in, bh.date_out, bh.challan_in, bh.challan_out, bh.remarks
    FROM batch_history bh
    LEFT JOIN vendors v ON bh.vendor_id = v.id
    WHERE bh.batch_id = %s
    ORDER BY bh.stage_sequence ASC
    """, (batch_id,))
    history_map = {row["stage_sequence"]: dict(row) for row in cursor.fetchall()}
    
    # If welding stage exists, get BOM components
    timeline = []
    for s in stages:
        seq = s["sequence_no"]
        hist = history_map.get(seq)
        
        stage_status = "upcoming"
        if batch["status"] == "Completed":
            stage_status = "completed"
        elif seq < batch["current_stage_sequence"]:
            stage_status = "completed"
        elif seq == batch["current_stage_sequence"]:
            stage_status = "current"
            
        welding_bom = []
        if s["is_welding_stage"]:
            cursor.execute("""
            SELECT child_item_code, quantity_per_unit, unit, notes
            FROM welding_boms
            WHERE route_stage_id = %s
            """, (s["id"],))
            welding_bom = [dict(r) for r in cursor.fetchall()]

        timeline.append({
            "stage_id": s["id"],
            "sequence_no": seq,
            "process_name": s["process_name"],
            "vendor_name": "In-House Shop" if s["is_inhouse"] else (s["default_vendor_name"] or "Vendor"),
            "is_inhouse": bool(s["is_inhouse"]),
            "lead_time_days": s["lead_time_days"],
            "is_welding_stage": bool(s["is_welding_stage"]),
            "welding_bom": welding_bom,
            "status": stage_status,
            "history": hist
        })

    conn.close()
    return {
        "batch": dict(batch),
        "timeline": timeline
    }

# ==========================================
# 3. RAW MATERIALS MASTER (Weight & Length)
# ==========================================
@app.get("/api/raw-materials")
def list_raw_materials():
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("""
    SELECT 
        id, code, name, grade, form, unit, stock_quantity, heat_number, unit_cost, notes, created_at
    FROM raw_materials
    ORDER BY code ASC
    """)
    materials = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return materials

@app.post("/api/raw-materials")
def add_raw_material(payload: RawMaterialCreate):
    conn = get_db()
    cursor = get_cursor(conn)
    try:
        cursor.execute("""
        INSERT INTO raw_materials (code, name, grade, form, unit, stock_quantity, heat_number, unit_cost, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            payload.code, payload.name, payload.grade, payload.form, payload.unit,
            payload.stock_quantity, payload.heat_number, payload.unit_cost, payload.notes
        ))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail="Raw Material Code already exists")
    conn.close()
    return {"message": "Raw Material created successfully", "code": payload.code}

@app.post("/api/raw-materials/issue")
def issue_raw_material(payload: RawMaterialIssue):
    """
    Issues raw material by weight/length for a target manufactured item (e.g. CM001).
    """
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("SELECT stock_quantity, unit FROM raw_materials WHERE code = %s", (payload.raw_material_code,))
    rm = cursor.fetchone()
    if not rm:
        conn.close()
        raise HTTPException(status_code=404, detail="Raw Material code not found")
        
    curr_stock = rm["stock_quantity"]
    if curr_stock < payload.quantity_used:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Insufficient stock! Available: {curr_stock} {rm['unit']}")
        
    cursor.execute("""
    UPDATE raw_materials
    SET stock_quantity = stock_quantity - %s
    WHERE code = %s
    """, (payload.quantity_used, payload.raw_material_code))
    
    conn.commit()
    conn.close()
    return {
        "message": f"Successfully issued {payload.quantity_used} {rm['unit']} of {payload.raw_material_code} for item {payload.target_item_code}",
        "remaining_stock": curr_stock - payload.quantity_used
    }

# ==========================================
# 4. ITEMS & PROCESS ROUTES
# ==========================================
@app.get("/api/items")
def list_items():
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("""
    SELECT 
        i.id, i.item_code, i.name, i.drawing_no, i.revision, i.material_code,
        i.weight, COALESCE(i.raw_material_name, rm.name) as raw_material_name, rm.unit as raw_material_unit,
        i.default_quantity, i.notes,
        COUNT(DISTINCT r.id) as routes_count,
        COUNT(DISTINCT b.id) as active_batches_count
    FROM items i
    LEFT JOIN raw_materials rm ON i.material_code = rm.code
    LEFT JOIN process_routes r ON i.item_code = r.item_code
    LEFT JOIN batches b ON i.item_code = b.item_code AND b.status != 'Completed'
    GROUP BY i.id, rm.name, rm.unit
    ORDER BY i.item_code ASC
    """)
    items = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return items

@app.post("/api/items")
def create_item(payload: ItemCreate):
    conn = get_db()
    cursor = get_cursor(conn)
    try:
        cursor.execute("""
        INSERT INTO items (item_code, name, drawing_no, revision, material_code, raw_material_name, weight, default_quantity, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            payload.item_code, payload.name, payload.drawing_no, payload.revision,
            payload.material_code, payload.raw_material_name, payload.weight or 0.0, payload.default_quantity, payload.notes
        ))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail="Item Code already exists")
    conn.close()
    return {"message": "Item registered successfully", "item_code": payload.item_code}

@app.get("/api/items/{item_code}/routes")
def get_item_routes(item_code: str):
    """
    Requirement 2: Multiple process routes for a single item.
    """
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("""
    SELECT id, item_code, route_name, is_default, description, created_at
    FROM process_routes
    WHERE item_code = %s
    ORDER BY is_default DESC, id ASC
    """, (item_code,))
    routes = []
    for r in cursor.fetchall():
        cursor.execute("""
        SELECT 
            rs.id, rs.sequence_no, rs.process_name, rs.vendor_id, v.name as vendor_name,
            rs.is_inhouse, rs.lead_time_days, rs.is_welding_stage, rs.notes
        FROM route_stages rs
        LEFT JOIN vendors v ON rs.vendor_id = v.id
        WHERE rs.route_id = %s
        ORDER BY rs.sequence_no ASC
        """, (r["id"],))
        stages = [dict(s) for s in cursor.fetchall()]
        routes.append({
            **dict(r),
            "stages": stages
        })
    conn.close()
    return routes

@app.post("/api/items/{item_code}/routes")
def create_item_route(item_code: str, payload: ProcessRouteCreate):
    conn = get_db()
    cursor = get_cursor(conn)
    
    cursor.execute("""
    INSERT INTO process_routes (item_code, route_name, is_default, description)
    VALUES (%s, %s, %s, %s)
    RETURNING id
    """, (item_code, payload.route_name, 1 if payload.is_default else 0, payload.description))
    route_id = cursor.fetchone()["id"]
    
    for s in payload.stages:
        cursor.execute("""
        INSERT INTO route_stages (
            route_id, sequence_no, process_name, vendor_id, is_inhouse,
            lead_time_days, is_welding_stage, notes
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            route_id, s.sequence_no, s.process_name, s.vendor_id,
            1 if s.is_inhouse else 0, s.lead_time_days,
            1 if s.is_welding_stage else 0, s.notes
        ))
        
    conn.commit()
    conn.close()
    return {"message": "Route created successfully", "route_id": route_id}

@app.delete("/api/items/{item_code}")
def delete_item(item_code: str):
    conn = get_db()
    cursor = get_cursor(conn)
    
    # Check if item exists
    cursor.execute("SELECT id, item_code, name FROM items WHERE item_code = %s", (item_code,))
    item = cursor.fetchone()
    if not item:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")
        
    # Check for active production batches
    cursor.execute("""
    SELECT COUNT(*) as count FROM batches 
    WHERE item_code = %s AND status != 'Completed'
    """, (item_code,))
    active_batches_count = cursor.fetchone()["count"]
    
    if active_batches_count > 0:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Cannot remove item '{item_code}' because it has {active_batches_count} active batch(es) in production. Please complete or cancel the active batches first."
        )

    # 1. Clean up welding BOMs where this item is child or parent or attached to this item's stages
    cursor.execute("DELETE FROM welding_boms WHERE child_item_code = %s OR parent_item_code = %s", (item_code, item_code))
    cursor.execute("""
    DELETE FROM welding_boms 
    WHERE route_stage_id IN (
        SELECT rs.id FROM route_stages rs
        JOIN process_routes pr ON rs.route_id = pr.id
        WHERE pr.item_code = %s
    )
    """, (item_code,))

    # 2. Clean up route stages
    cursor.execute("""
    DELETE FROM route_stages 
    WHERE route_id IN (
        SELECT id FROM process_routes WHERE item_code = %s
    )
    """, (item_code,))

    # 3. Clean up process routes
    cursor.execute("DELETE FROM process_routes WHERE item_code = %s", (item_code,))

    # 4. Clean up any completed batches & history & followups
    cursor.execute("""
    DELETE FROM vendor_followups 
    WHERE batch_id IN (SELECT id FROM batches WHERE item_code = %s)
    """, (item_code,))
    cursor.execute("""
    DELETE FROM batch_history 
    WHERE batch_id IN (SELECT id FROM batches WHERE item_code = %s)
    """, (item_code,))
    cursor.execute("DELETE FROM batches WHERE item_code = %s", (item_code,))

    # 5. Delete the item record itself
    cursor.execute("DELETE FROM items WHERE item_code = %s", (item_code,))

    conn.commit()
    conn.close()
    return {"message": f"Item {item_code} and all associated routes removed successfully", "item_code": item_code}

@app.put("/api/items/{item_code}")
def update_item(item_code: str, payload: ItemUpdate):
    """
    Updates an item's details (Name, Drawing No, Revision, Material Code, Notes)
    and updates its multi-stage process route.
    Guarantees that the final stage remains strictly 'Finished Product' for assembly readiness.
    """
    conn = get_db()
    cursor = get_cursor(conn)
    
    # 1. Verify item exists
    cursor.execute("SELECT id, item_code, name FROM items WHERE item_code = %s", (item_code,))
    item = cursor.fetchone()
    if not item:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Item '{item_code}' not found")
        
    # 2. Update item basic attributes
    update_fields = []
    params = []
    if payload.name is not None:
        update_fields.append("name = %s")
        params.append(payload.name)
    if payload.drawing_no is not None:
        update_fields.append("drawing_no = %s")
        params.append(payload.drawing_no)
    if payload.revision is not None:
        update_fields.append("revision = %s")
        params.append(payload.revision)
    if payload.material_code is not None:
        update_fields.append("material_code = %s")
        params.append(payload.material_code)
    if payload.raw_material_name is not None:
        update_fields.append("raw_material_name = %s")
        params.append(payload.raw_material_name)
    if payload.weight is not None:
        update_fields.append("weight = %s")
        params.append(payload.weight)
    if payload.default_quantity is not None:
        update_fields.append("default_quantity = %s")
        params.append(payload.default_quantity)
    if payload.notes is not None:
        update_fields.append("notes = %s")
        params.append(payload.notes)
        
    if update_fields:
        params.append(item_code)
        cursor.execute(f"UPDATE items SET {', '.join(update_fields)} WHERE item_code = %s", params)
        
    # 3. Update route and stages if stages provided
    if payload.stages is not None:
        cursor.execute("""
        SELECT id, route_name FROM process_routes 
        WHERE item_code = %s 
        ORDER BY is_default DESC, id ASC LIMIT 1
        """, (item_code,))
        route = cursor.fetchone()
        
        if route:
            route_id = route["id"]
            if payload.route_name:
                cursor.execute("UPDATE process_routes SET route_name = %s WHERE id = %s", (payload.route_name, route_id))
        else:
            route_name = payload.route_name or f"{item_code} Process Route"
            cursor.execute("""
            INSERT INTO process_routes (item_code, route_name, is_default, description)
            VALUES (%s, %s, 1, %s)
    RETURNING id
            """, (item_code, route_name, f"Process route for {item_code}"))
            route_id = cursor.fetchone()["id"]

        # Clean old welding BOMs linked to these stages
        cursor.execute("""
        DELETE FROM welding_boms 
        WHERE route_stage_id IN (SELECT id FROM route_stages WHERE route_id = %s)
        """, (route_id,))
        cursor.execute("DELETE FROM route_stages WHERE route_id = %s", (route_id,))
        
        # Enforce strictly: Final stage MUST be "Finished Product" (in-house, ready for production assembly)
        stages_to_insert = list(payload.stages)
        has_final_finished = len(stages_to_insert) > 0 and stages_to_insert[-1].process_name.strip().lower() == "finished product"
        if not has_final_finished:
            stages_to_insert.append(StageDefinition(
                sequence_no=len(stages_to_insert) + 1,
                process_name="Finished Product",
                vendor_id=None,
                is_inhouse=True,
                lead_time_days=1,
                is_welding_stage=False,
                notes="Finished Product ready for production assembly"
            ))
        else:
            last = stages_to_insert[-1]
            last.process_name = "Finished Product"
            last.is_inhouse = True
            last.vendor_id = None
            if not last.notes:
                last.notes = "Finished Product ready for production assembly"
                
        for idx, stage in enumerate(stages_to_insert, start=1):
            cursor.execute("""
            INSERT INTO route_stages (
                route_id, sequence_no, process_name, vendor_id, is_inhouse,
                lead_time_days, is_welding_stage, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    RETURNING id
            """, (
                route_id, idx, stage.process_name, stage.vendor_id,
                1 if stage.is_inhouse else 0, stage.lead_time_days,
                1 if stage.is_welding_stage else 0, stage.notes
            ))
            stage_id = cursor.fetchone()["id"]
            
            if stage.is_welding_stage and stage.welding_components:
                for comp in stage.welding_components:
                    cursor.execute("""
                    INSERT INTO welding_boms (route_stage_id, parent_item_code, child_item_code, quantity_per_unit, unit)
                    VALUES (%s, %s, %s, %s, %s)
                    """, (
                        stage_id, item_code, comp.get("child_item_code"),
                        float(comp.get("quantity_per_unit", 1.0)), comp.get("unit", "pcs")
                    ))

        # Synchronize active batches currently sitting at these stages so vendor/inhouse matches the updated route
        for idx, stage in enumerate(stages_to_insert, start=1):
            v_id = stage.vendor_id if not stage.is_inhouse else None
            inhouse_val = 1 if stage.is_inhouse else 0
            new_status = 'In Process' if stage.is_inhouse else 'With Vendor'
            cursor.execute("""
            UPDATE batches 
            SET current_vendor_id = %s,
                is_inhouse = %s,
                current_process = %s,
                status = CASE WHEN status != 'Completed' THEN %s ELSE status END
            WHERE item_code = %s AND current_stage_sequence = %s AND status != 'Completed'
            """, (v_id, inhouse_val, stage.process_name, new_status, item_code, idx))

    conn.commit()
    conn.close()
    return {"message": f"Item '{item_code}' updated successfully", "item_code": item_code}

# ==========================================
# 5. WELDING BOM & MULTI-ITEM ASSEMBLY
# ==========================================
@app.get("/api/welding-boms/{route_stage_id}")
def get_welding_bom(route_stage_id: int):
    """
    Requirement 8: Multi-items with variable quantities for welding stage.
    """
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("""
    SELECT 
        wb.id, wb.route_stage_id, wb.parent_item_code, wb.child_item_code,
        i.name as child_item_name, i.drawing_no as child_drawing_no,
        wb.quantity_per_unit, wb.unit, wb.notes
    FROM welding_boms wb
    JOIN items i ON wb.child_item_code = i.item_code
    WHERE wb.route_stage_id = %s
    """, (route_stage_id,))
    components = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return components

@app.post("/api/welding-boms")
def add_welding_bom_item(payload: WeldingBOMItemCreate):
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("""
    INSERT INTO welding_boms (route_stage_id, parent_item_code, child_item_code, quantity_per_unit, unit, notes)
    VALUES (%s, %s, %s, %s, %s, %s)
    RETURNING id
    """, (
        payload.route_stage_id, payload.parent_item_code, payload.child_item_code,
        payload.quantity_per_unit, payload.unit, payload.notes
    ))
    conn.commit()
    bom_id = cursor.fetchone()["id"]
    conn.close()
    return {"message": "Component added to Welding BOM", "id": bom_id}

@app.get("/api/welding-boms/check-readiness/{batch_id}")
def check_welding_component_readiness(batch_id: int):
    """
    Verifies if all required child items are available in stock or finished batches
    before the welding process can proceed.
    """
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("""
    SELECT b.id, b.item_code, b.route_id, b.current_stage_sequence, b.quantity_total
    FROM batches b WHERE b.id = %s
    """, (batch_id,))
    batch = cursor.fetchone()
    if not batch:
        conn.close()
        raise HTTPException(status_code=404, detail="Batch not found")
        
    # Get welding stage id
    cursor.execute("""
    SELECT id FROM route_stages
    WHERE route_id = %s AND is_welding_stage = 1
    """, (batch["route_id"],))
    stage = cursor.fetchone()
    if not stage:
        conn.close()
        return {"has_welding_stage": False, "ready": True, "components": []}
        
    cursor.execute("""
    SELECT 
        wb.child_item_code, i.name as child_name, wb.quantity_per_unit, wb.unit
    FROM welding_boms wb
    JOIN items i ON wb.child_item_code = i.item_code
    WHERE wb.route_stage_id = %s
    """, (stage["id"],))
    
    components = []
    all_ready = True
    for row in cursor.fetchall():
        req_qty = row["quantity_per_unit"] * batch["quantity_total"]
        # Check finished or ready batches for this child item
        cursor.execute("""
        SELECT COALESCE(SUM(quantity_accepted), 0)
        FROM batches
        WHERE item_code = %s AND (status = 'Completed' OR current_process = 'Finished Product')
        """, (row["child_item_code"],))
        available_qty = get_scalar(cursor, 0)
        
        is_ready = available_qty >= req_qty
        if not is_ready:
            all_ready = False
            
        components.append({
            "child_item_code": row["child_item_code"],
            "child_name": row["child_name"],
            "quantity_per_unit": row["quantity_per_unit"],
            "total_required": req_qty,
            "total_available": available_qty,
            "unit": row["unit"],
            "is_ready": is_ready
        })
        
    conn.close()
    return {
        "has_welding_stage": True,
        "ready": all_ready,
        "batch_quantity": batch["quantity_total"],
        "components": components
    }

# ==========================================
# 6. VENDORS & LEAD TIMES
# ==========================================
@app.get("/api/vendors")
def list_vendors():
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("""
    SELECT 
        v.id, v.code, v.name, v.contact_person, v.phone, v.email, v.address,
        v.processes_offered, v.default_lead_time_days, v.rating, v.notes,
        COALESCE(v.vendor_type, 'Local') as vendor_type,
        COUNT(b.id) as active_jobs_count
    FROM vendors v
    LEFT JOIN batches b ON v.id = b.current_vendor_id AND b.status = 'With Vendor'
    GROUP BY v.id
    ORDER BY v.name ASC
    """)
    vendors = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return vendors

@app.post("/api/vendors")
def create_vendor(payload: VendorCreate):
    conn = get_db()
    cursor = get_cursor(conn)
    v_type = payload.vendor_type if payload.vendor_type in ['Trip', 'Local'] else 'Local'
    try:
        cursor.execute("""
        INSERT INTO vendors (code, name, contact_person, phone, email, address, processes_offered, default_lead_time_days, rating, notes, vendor_type)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    RETURNING id
        """, (
            payload.code, payload.name, payload.contact_person, payload.phone,
            payload.email, payload.address, payload.processes_offered,
            payload.default_lead_time_days, payload.rating, payload.notes,
            v_type
        ))
        vendor_id = cursor.fetchone()["id"]
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail="Vendor code already exists")
    conn.close()
    return {"message": "Vendor registered successfully", "id": vendor_id, "code": payload.code, "name": payload.name, "vendor_type": v_type}

@app.put("/api/vendors/{vendor_id}")
def update_vendor(vendor_id: int, payload: VendorCreate):
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("SELECT id FROM vendors WHERE id = %s", (vendor_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    v_type = payload.vendor_type if payload.vendor_type in ['Trip', 'Local'] else 'Local'
    cursor.execute("""
    UPDATE vendors
    SET name = %s,
        contact_person = %s,
        phone = %s,
        email = %s,
        address = %s,
        processes_offered = %s,
        default_lead_time_days = %s,
        rating = %s,
        notes = %s,
        vendor_type = %s
    WHERE id = %s
    """, (
        payload.name, payload.contact_person, payload.phone,
        payload.email, payload.address, payload.processes_offered,
        payload.default_lead_time_days, payload.rating, payload.notes,
        v_type,
        vendor_id
    ))
    conn.commit()
    conn.close()
    return {"message": "Vendor updated successfully", "vendor_id": vendor_id, "vendor_type": v_type}

@app.patch("/api/vendors/{vendor_id}/toggle-type")
def toggle_vendor_type(vendor_id: int):
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("SELECT id, vendor_type FROM vendors WHERE id = %s", (vendor_id,))
    vendor = cursor.fetchone()
    if not vendor:
        conn.close()
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    current_type = vendor["vendor_type"] or "Local"
    new_type = "Trip" if current_type == "Local" else "Local"
    cursor.execute("UPDATE vendors SET vendor_type = %s WHERE id = %s", (new_type, vendor_id))
    conn.commit()
    conn.close()
    return {"message": f"Vendor type updated to {new_type}", "vendor_id": vendor_id, "vendor_type": new_type}

@app.delete("/api/vendors/{vendor_id}")
def delete_vendor(vendor_id: int):
    conn = get_db()
    cursor = get_cursor(conn)
    
    cursor.execute("SELECT name FROM vendors WHERE id = %s", (vendor_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Vendor not found")
    vendor_name = row.get("name") if isinstance(row, dict) else row[0]
    
    # Check if vendor has active batches
    cursor.execute("""
    SELECT COUNT(*) as count FROM batches 
    WHERE current_vendor_id = %s AND status = 'With Vendor'
    """, (vendor_id,))
    count_row = cursor.fetchone()
    active_count = (count_row.get("count") if isinstance(count_row, dict) else count_row[0]) if count_row else 0
    
    if active_count > 0:
        conn.close()
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot remove '{vendor_name}' because they currently have {active_count} active items/batches in production! Please receive or move those items first."
        )
        
    try:
        # Unlink from route stages
        cursor.execute("UPDATE route_stages SET vendor_id = NULL, is_inhouse = 1 WHERE vendor_id = %s", (vendor_id,))
        # Unlink from batches (e.g. completed batches)
        cursor.execute("UPDATE batches SET current_vendor_id = NULL WHERE current_vendor_id = %s", (vendor_id,))
        # Unlink from delivery challans
        cursor.execute("UPDATE delivery_challans SET vendor_id = NULL WHERE vendor_id = %s", (vendor_id,))
        # Remove follow-ups
        cursor.execute("DELETE FROM vendor_followups WHERE vendor_id = %s", (vendor_id,))
        # Unlink from history
        cursor.execute("UPDATE batch_history SET vendor_id = NULL WHERE vendor_id = %s", (vendor_id,))
        # Delete vendor
        cursor.execute("DELETE FROM vendors WHERE id = %s", (vendor_id,))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Failed to delete vendor: {str(e)}")

    conn.close()
    return {"message": f"Vendor '{vendor_name}' removed successfully", "vendor_id": vendor_id}


# ==========================================
# 7. VENDOR DELIVERY FOLLOW-UPS
# ==========================================
@app.get("/api/followups")
def list_followups(vendor_id: Optional[int] = None, batch_id: Optional[int] = None):
    conn = get_db()
    cursor = get_cursor(conn)
    query = """
    SELECT 
        f.id, f.batch_id, b.batch_no, b.item_code, COALESCE(i.name, b.item_code) as item_name,
        b.current_process, b.quantity_accepted as quantity,
        f.vendor_id, v.name as vendor_name, v.phone as vendor_phone,
        f.challan_no, f.date_contacted, f.contact_person, f.method,
        f.vendor_status_update, f.promised_date, f.notes, f.logged_by
    FROM vendor_followups f
    LEFT JOIN batches b ON f.batch_id = b.id
    LEFT JOIN items i ON b.item_code = i.item_code
    LEFT JOIN vendors v ON f.vendor_id = v.id
    WHERE 1=1
    """
    params = []
    if vendor_id:
        query += " AND f.vendor_id = %s"
        params.append(vendor_id)
    if batch_id:
        query += " AND f.batch_id = %s"
        params.append(batch_id)
        
    query += " ORDER BY f.date_contacted DESC, f.id DESC"
    cursor.execute(query, params)
    followups = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return followups

@app.post("/api/followups")
def add_followup(payload: VendorFollowUpCreate):
    conn = get_db()
    cursor = get_cursor(conn)
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    cursor.execute("""
    INSERT INTO vendor_followups (
        batch_id, vendor_id, challan_no, date_contacted, contact_person,
        method, vendor_status_update, promised_date, notes
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        payload.batch_id, payload.vendor_id, payload.challan_no,
        today_str, payload.contact_person, payload.method,
        payload.vendor_status_update, payload.promised_date, payload.notes
    ))
    
    # If promised date is given, update expected delivery date on the batch!
    if payload.promised_date:
        cursor.execute("""
        UPDATE batches
        SET expected_delivery_date = %s
        WHERE id = %s
        """, (payload.promised_date, payload.batch_id))
        
    conn.commit()
    conn.close()
    return {"message": "Follow-up log saved successfully"}

# ==========================================
# 8. DELIVERY CHALLANS (Outward / Return)
# ==========================================
@app.get("/api/challans")
def list_challans(challan_type: Optional[str] = None):
    conn = get_db()
    cursor = get_cursor(conn)
    query = """
    SELECT 
        dc.id, dc.challan_no, dc.challan_type, dc.date,
        dc.vendor_id, v.name as vendor_name, v.address as vendor_address, v.phone as vendor_phone,
        dc.batch_id, b.batch_no,
        dc.item_code, COALESCE(i.name, dc.item_code) as item_name, i.drawing_no,
        dc.process_name, dc.quantity, dc.weight_or_length, dc.unit,
        dc.transporter, dc.vehicle_no, dc.remarks, dc.status
    FROM delivery_challans dc
    LEFT JOIN vendors v ON dc.vendor_id = v.id
    LEFT JOIN batches b ON dc.batch_id = b.id
    LEFT JOIN items i ON dc.item_code = i.item_code
    WHERE 1=1
    """
    params = []
    if challan_type:
        query += " AND dc.challan_type = %s"
        params.append(challan_type)
        
    query += " ORDER BY dc.date DESC, dc.id DESC"
    cursor.execute(query, params)
    challans = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return challans

@app.post("/api/challans")
def create_challan(payload: ChallanCreate):
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("""
    INSERT INTO delivery_challans (
        challan_no, challan_type, date, vendor_id, batch_id, item_code,
        process_name, quantity, weight_or_length, unit, transporter, vehicle_no, remarks
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        payload.challan_no, payload.challan_type, payload.date,
        payload.vendor_id, payload.batch_id, payload.item_code,
        payload.process_name, payload.quantity, payload.weight_or_length,
        payload.unit, payload.transporter, payload.vehicle_no, payload.remarks
    ))
    conn.commit()
    conn.close()
    return {"message": "Delivery Challan generated successfully", "challan_no": payload.challan_no}

# ==========================================
# 9. VENDOR STOCKS & HOLDINGS (Enhanced Visibility)
# ==========================================
@app.get("/api/vendor-stocks")
def get_vendor_stocks():
    """
    Returns prominent breakdown per vendor of all items currently residing at their workshop.
    Shows item code, item name, drawing no, quantity, process, sent date, due date, and critical status.
    """
    conn = get_db()
    cursor = get_cursor(conn)
    
    cursor.execute("""
    SELECT id, code, name, contact_person, phone, email, address, processes_offered, default_lead_time_days, rating,
           COALESCE(vendor_type, 'Local') as vendor_type
    FROM vendors
    ORDER BY name ASC
    """)
    vendors = [dict(r) for r in cursor.fetchall()]
    
    results = []
    for v in vendors:
        cursor.execute("""
        SELECT 
            b.id, b.batch_no, b.item_code, i.name as item_name, i.drawing_no,
            i.material_code, i.weight, COALESCE(i.raw_material_name, rm.name) as raw_material_name,
            b.current_stage_sequence, b.current_process,
            b.quantity_total, b.quantity_accepted, b.quantity_rejected,
            b.date_sent_to_vendor, b.expected_delivery_date, b.challan_no,
            b.is_critical, b.notes
        FROM batches b
        JOIN items i ON b.item_code = i.item_code
        LEFT JOIN raw_materials rm ON i.material_code = rm.code
        LEFT JOIN (
            SELECT pr.item_code, rs.sequence_no, rs.vendor_id
            FROM route_stages rs
            JOIN process_routes pr ON rs.route_id = pr.id
            WHERE pr.is_default = 1
        ) d_stage ON d_stage.item_code = b.item_code AND d_stage.sequence_no = b.current_stage_sequence
        WHERE (b.current_vendor_id = %s OR (b.current_vendor_id IS NULL AND b.is_inhouse = 0 AND d_stage.vendor_id = %s))
          AND b.status = 'With Vendor'
          AND b.quantity_accepted > 0
        ORDER BY b.is_critical DESC, b.expected_delivery_date ASC
        """, (v["id"], v["id"]))
        
        items_at_vendor = []
        total_qty = 0
        overdue_items = 0
        critical_items = 0
        
        for row in cursor.fetchall():
            lead_info = calculate_lead_status(row["date_sent_to_vendor"], row["expected_delivery_date"], "With Vendor")
            if lead_info["is_overdue"]:
                overdue_items += 1
            if row["is_critical"]:
                critical_items += 1
            total_qty += row["quantity_accepted"]
            
            items_at_vendor.append({
                "id": row["id"],
                "batch_no": row["batch_no"],
                "item_code": row["item_code"],
                "item_name": row["item_name"],
                "drawing_no": row["drawing_no"],
                "material_code": row["material_code"],
                "weight": row["weight"],
                "raw_material_name": row["raw_material_name"],
                "current_process": row["current_process"],
                "current_stage_sequence": row["current_stage_sequence"],
                "quantity": row["quantity_accepted"],
                "quantity_total": row["quantity_total"],
                "quantity_rejected": row["quantity_rejected"],
                "date_sent": row["date_sent_to_vendor"],
                "expected_delivery_date": row["expected_delivery_date"],
                "challan_no": row["challan_no"],
                "is_critical": bool(row["is_critical"]),
                "notes": row["notes"],
                "lead_status": lead_info
            })
            
        results.append({
            "vendor_id": v["id"],
            "vendor_code": v["code"],
            "vendor_name": v["name"],
            "vendor_type": v.get("vendor_type", "Local"),
            "contact_person": v["contact_person"],
            "phone": v["phone"],
            "email": v["email"],
            "address": v["address"],
            "processes_offered": v["processes_offered"],
            "default_lead_time_days": v["default_lead_time_days"],
            "rating": v["rating"],
            "items_count": len(items_at_vendor),
            "total_quantity": total_qty,
            "overdue_count": overdue_items,
            "critical_count": critical_items,
            "items": items_at_vendor
        })
        
    conn.close()
    return results

# ==========================================
# 9B. ITEM STOCKS BY PROCESS STAGES (WIP Pipeline & Finished Goods)
# ==========================================
@app.get("/api/stock/items-by-stage")
def get_items_stock_by_stage():
    """
    Returns item-wise stock breakdown across all sequential process stages.
    Enables viewing exact pieces currently sitting at each manufacturing stage
    (e.g., In-House Cutting, Vendor Forging, Machining, Finished Goods).
    """
    conn = get_db()
    cursor = get_cursor(conn)
    
    # 1. Fetch all items
    cursor.execute("""
    SELECT 
        i.id, i.item_code, i.name, i.drawing_no, i.revision,
        i.material_code, i.weight, i.default_quantity, i.notes,
        COALESCE(i.raw_material_name, rm.name) as raw_material_name, rm.stock_quantity as raw_material_stock, rm.unit as raw_material_unit
    FROM items i
    LEFT JOIN raw_materials rm ON i.material_code = rm.code
    ORDER BY i.item_code ASC
    """)
    items_rows = [dict(r) for r in cursor.fetchall()]
    
    total_wip_all = 0
    total_finished_all = 0
    total_overdue_all = 0
    
    items_stock_list = []
    
    for item in items_rows:
        code = item["item_code"]
        
        # Get active default route for this item
        cursor.execute("""
        SELECT id, route_name FROM process_routes 
        WHERE item_code = %s 
        ORDER BY is_default DESC, id ASC LIMIT 1
        """, (code,))
        route = cursor.fetchone()
        
        stages = []
        if route:
            cursor.execute("""
            SELECT 
                rs.id, rs.sequence_no, rs.process_name, rs.vendor_id, v.name as default_vendor_name,
                rs.is_inhouse, rs.lead_time_days, rs.is_welding_stage, rs.notes
            FROM route_stages rs
            LEFT JOIN vendors v ON rs.vendor_id = v.id
            WHERE rs.route_id = %s
            ORDER BY rs.sequence_no ASC
            """, (route["id"],))
            stages = [dict(s) for s in cursor.fetchall()]
            
        # Get all batches for this item
        cursor.execute("""
        SELECT 
            b.id, b.batch_no, b.item_code, b.current_stage_sequence, b.current_process,
            b.current_vendor_id, v.name as vendor_name, v.contact_person as vendor_contact, v.phone as vendor_phone,
            b.is_inhouse, b.quantity_total, b.quantity_accepted, b.quantity_rejected,
            b.status, b.is_critical, b.date_started, b.date_sent_to_vendor,
            b.expected_delivery_date, b.challan_no, b.notes
        FROM batches b
        LEFT JOIN vendors v ON b.current_vendor_id = v.id
        WHERE b.item_code = %s
        ORDER BY b.is_critical DESC, b.current_stage_sequence ASC, b.id ASC
        """, (code,))
        all_batches = cursor.fetchall()
        
        item_wip = 0
        item_finished = 0
        item_rejected = 0
        item_overdue = 0
        
        # Group batches by stage sequence or completed status
        stage_batches_map = {}
        finished_batches = []
        
        for brow in all_batches:
            bdict = dict(brow)
            lead = calculate_lead_status(bdict["date_sent_to_vendor"], bdict["expected_delivery_date"], bdict["status"])
            bdict["lead_status"] = lead
            bdict["is_critical"] = bool(bdict["is_critical"])
            bdict["is_inhouse"] = bool(bdict["is_inhouse"])
            
            if lead["is_overdue"]:
                item_overdue += 1
                total_overdue_all += 1
                
            item_rejected += (bdict["quantity_rejected"] or 0)
            
            if bdict["status"] == "Completed" or bdict["current_process"] == "Finished Product":
                item_finished += (bdict["quantity_accepted"] or 0)
                total_finished_all += (bdict["quantity_accepted"] or 0)
                finished_batches.append(bdict)
            else:
                item_wip += (bdict["quantity_accepted"] or 0)
                total_wip_all += (bdict["quantity_accepted"] or 0)
                seq = bdict["current_stage_sequence"]
                if seq not in stage_batches_map:
                    stage_batches_map[seq] = []
                stage_batches_map[seq].append(bdict)
                
        # Build stage stock pipeline
        pipeline_stages = []
        for s in stages:
            seq = s["sequence_no"]
            is_finished_stage = s["process_name"].strip().lower() == "finished product"
            if is_finished_stage:
                batches_here = finished_batches
                qty_here = item_finished
                rej_here = sum(b.get("quantity_rejected", 0) or 0 for b in batches_here)
                overdue_here = sum(1 for b in batches_here if b.get("lead_status", {}).get("is_overdue", False))
            else:
                batches_here = stage_batches_map.get(seq, [])
                qty_here = sum(b["quantity_accepted"] for b in batches_here)
                rej_here = sum(b["quantity_rejected"] for b in batches_here)
                overdue_here = sum(1 for b in batches_here if b["lead_status"]["is_overdue"])
            
            pipeline_stages.append({
                "stage_id": s["id"],
                "sequence_no": seq,
                "process_name": s["process_name"],
                "is_inhouse": bool(s["is_inhouse"]),
                "default_vendor_id": s["vendor_id"],
                "default_vendor_name": s["default_vendor_name"],
                "lead_time_days": s["lead_time_days"],
                "is_welding_stage": bool(s["is_welding_stage"]),
                "is_finished_product": is_finished_stage,
                "current_quantity": qty_here,
                "current_rejected": rej_here,
                "batches_count": len(batches_here),
                "overdue_count": overdue_here,
                "batches": batches_here
            })
            
        items_stock_list.append({
            **item,
            "route_name": route["route_name"] if route else None,
            "total_wip_quantity": item_wip,
            "total_finished_quantity": item_finished,
            "total_rejected_quantity": item_rejected,
            "total_active_batches": len(all_batches) - len(finished_batches),
            "overdue_batches_count": item_overdue,
            "stages_pipeline": pipeline_stages,
            "finished_batches": finished_batches
        })
        
    conn.close()
    
    return {
        "summary": {
            "total_items_count": len(items_rows),
            "total_wip_quantity": total_wip_all,
            "total_finished_quantity": total_finished_all,
            "total_overdue_batches": total_overdue_all
        },
        "items": items_stock_list
    }

# ==========================================
# 9C. STOCK AMENDMENTS (Manual +/- Adjustments & Auditing)
# ==========================================
@app.post("/api/stock/amendment")
def create_stock_amendment(payload: StockAmendmentCreate):
    """
    Manually amends stock with (+) addition or (-) deduction for:
    - finished_goods: completed batches ready for assembly planning
    - stage_wip: active batches in progress at a specific sequential process stage
    - raw_material: stock quantity in raw_materials table
    Logs full audit trail in stock_amendments table.
    """
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Amendment quantity must be greater than zero")

    if payload.adjustment_type not in ("add", "deduct"):
        raise HTTPException(status_code=400, detail="Adjustment type must be 'add' or 'deduct'")

    conn = get_db()
    cursor = get_cursor(conn)

    previous_stock = 0.0
    new_stock = 0.0

    # 1. Finished Goods Stock Amendment
    if payload.target_type == "finished_goods":
        if not payload.item_code:
            conn.close()
            raise HTTPException(status_code=400, detail="Item code is required for Finished Goods amendment")

        cursor.execute("SELECT item_code, name FROM items WHERE item_code = %s", (payload.item_code,))
        item = cursor.fetchone()
        if not item:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Item '{payload.item_code}' not found")

        cursor.execute("""
        SELECT COALESCE(SUM(quantity_accepted), 0) FROM batches 
        WHERE item_code = %s AND (status = 'Completed' OR current_process = 'Finished Product')
        """, (payload.item_code,))
        previous_stock = float(get_scalar(cursor, 0))

        if payload.adjustment_type == "add":
            new_stock = previous_stock + payload.quantity

            # Find default route for this item
            cursor.execute("""
            SELECT id FROM process_routes WHERE item_code = %s ORDER BY is_default DESC, id ASC LIMIT 1
            """, (payload.item_code,))
            route = cursor.fetchone()
            route_id = route["id"] if route else 1

            # Find sequence number of Finished Product stage
            cursor.execute("""
            SELECT sequence_no FROM route_stages 
            WHERE route_id = %s AND LOWER(TRIM(process_name)) = 'finished product'
            ORDER BY sequence_no DESC LIMIT 1
            """, (route_id,))
            stg = cursor.fetchone()
            stage_seq = stg["sequence_no"] if stg else 999

            batch_no = f"ADJ-FG-{datetime.now().strftime('%y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
            today_str = datetime.now().strftime("%Y-%m-%d")
            cursor.execute("""
            INSERT INTO batches (
                batch_no, item_code, route_id, current_stage_sequence, current_process,
                is_inhouse, quantity_total, quantity_accepted, quantity_rejected,
                status, is_critical, date_started, notes
            ) VALUES (%s, %s, %s, %s, 'Finished Product', 1, %s, %s, 0, 'Completed', 0, %s, %s)
            """, (
                batch_no, payload.item_code, route_id, stage_seq,
                int(payload.quantity), int(payload.quantity), today_str,
                f"Stock Amendment (+): {payload.reason}. Remarks: {payload.remarks or ''}"
            ))

        else:  # deduct
            if payload.quantity > previous_stock:
                conn.close()
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot deduct {int(payload.quantity)} pcs: current finished goods stock is only {int(previous_stock)} pcs."
                )
            new_stock = previous_stock - payload.quantity
            remaining_to_deduct = int(payload.quantity)

            cursor.execute("""
            SELECT id, quantity_accepted FROM batches 
            WHERE item_code = %s AND (status = 'Completed' OR current_process = 'Finished Product') AND quantity_accepted > 0
            ORDER BY id DESC
            """, (payload.item_code,))
            batches_to_decrement = cursor.fetchall()

            for b in batches_to_decrement:
                b_id = b["id"]
                b_qty = b["quantity_accepted"]
                if b_qty <= remaining_to_deduct:
                    cursor.execute("UPDATE batches SET quantity_accepted = 0 WHERE id = %s", (b_id,))
                    remaining_to_deduct -= b_qty
                else:
                    cursor.execute("UPDATE batches SET quantity_accepted = quantity_accepted - %s WHERE id = %s", (remaining_to_deduct, b_id))
                    remaining_to_deduct = 0
                if remaining_to_deduct <= 0:
                    break

    # 2. Stage WIP Stock Amendment
    elif payload.target_type == "stage_wip":
        if not payload.item_code:
            conn.close()
            raise HTTPException(status_code=400, detail="Item code is required for Stage WIP amendment")
        if payload.stage_sequence is None:
            conn.close()
            raise HTTPException(status_code=400, detail="Stage sequence is required for Stage WIP amendment")

        cursor.execute("""
        SELECT id, batch_no, quantity_accepted, quantity_total, current_process 
        FROM batches 
        WHERE item_code = %s AND current_stage_sequence = %s AND status != 'Completed' AND current_process != 'Finished Product'
        ORDER BY id DESC
        """, (payload.item_code, payload.stage_sequence))
        wip_batches = cursor.fetchall()
        previous_stock = float(sum(b["quantity_accepted"] for b in wip_batches))

        cursor.execute("""
        SELECT rs.route_id, rs.sequence_no, rs.process_name, rs.vendor_id, rs.is_inhouse, rs.lead_time_days
        FROM route_stages rs
        JOIN process_routes pr ON rs.route_id = pr.id
        WHERE pr.item_code = %s AND rs.sequence_no = %s
        ORDER BY pr.is_default DESC, pr.id ASC
        LIMIT 1
        """, (payload.item_code, payload.stage_sequence))
        stage_info = cursor.fetchone()

        target_vendor_id = payload.vendor_id if payload.vendor_id is not None else (stage_info["vendor_id"] if stage_info else None)
        if target_vendor_id:
            is_inhouse = 0
        else:
            is_inhouse = stage_info["is_inhouse"] if stage_info else 1

        route_id = stage_info["route_id"] if stage_info else 1
        proc_name = stage_info["process_name"] if stage_info else (payload.stage_name or f"Stage {payload.stage_sequence}")
        lead_time = (stage_info["lead_time_days"] if stage_info else 3) or 3
        status_str = "In Process" if is_inhouse else "With Vendor"

        if payload.adjustment_type == "add":
            new_stock = previous_stock + payload.quantity
            if wip_batches:
                # Add to newest active batch at this stage
                latest_id = wip_batches[0]["id"]
                cursor.execute("""
                UPDATE batches 
                SET quantity_accepted = quantity_accepted + %s,
                    quantity_total = quantity_total + %s,
                    current_vendor_id = COALESCE(%s, current_vendor_id),
                    is_inhouse = CASE WHEN %s IS NOT NULL THEN 0 ELSE is_inhouse END,
                    status = CASE WHEN %s IS NOT NULL THEN 'With Vendor' ELSE status END
                WHERE id = %s
                """, (int(payload.quantity), int(payload.quantity), target_vendor_id, target_vendor_id, target_vendor_id, latest_id))
            else:
                # Create a new WIP batch for this stage
                batch_no = f"ADJ-WIP-{datetime.now().strftime('%y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
                today = datetime.now()
                today_str = today.strftime("%Y-%m-%d")
                exp_date = (today + timedelta(days=lead_time)).strftime("%Y-%m-%d")

                cursor.execute("""
                INSERT INTO batches (
                    batch_no, item_code, route_id, current_stage_sequence, current_process,
                    current_vendor_id, is_inhouse, quantity_total, quantity_accepted, quantity_rejected,
                    status, is_critical, date_started, date_sent_to_vendor, expected_delivery_date, notes
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0, %s, 0, %s, %s, %s, %s)
                """, (
                    batch_no, payload.item_code, route_id, payload.stage_sequence, proc_name,
                    target_vendor_id, 1 if is_inhouse else 0, int(payload.quantity), int(payload.quantity),
                    status_str, today_str,
                    today_str if not is_inhouse else None,
                    exp_date if not is_inhouse else None,
                    f"Stock Amendment (+): {payload.reason}. Remarks: {payload.remarks or ''}"
                ))

        else:  # deduct
            if payload.quantity > previous_stock:
                conn.close()
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot deduct {int(payload.quantity)} pcs: current WIP stock at stage {payload.stage_name or payload.stage_sequence} is only {int(previous_stock)} pcs."
                )
            new_stock = previous_stock - payload.quantity
            remaining = int(payload.quantity)
            for b in wip_batches:
                b_id = b["id"]
                b_qty = b["quantity_accepted"]
                if b_qty <= remaining:
                    cursor.execute("UPDATE batches SET quantity_accepted = 0 WHERE id = %s", (b_id,))
                    remaining -= b_qty
                else:
                    cursor.execute("UPDATE batches SET quantity_accepted = quantity_accepted - %s WHERE id = %s", (remaining, b_id))
                    remaining = 0
                if remaining <= 0:
                    break

    # 3. Raw Material Stock Amendment
    elif payload.target_type == "raw_material":
        if not payload.raw_material_code:
            conn.close()
            raise HTTPException(status_code=400, detail="Raw material code is required for Raw Material amendment")

        cursor.execute("SELECT code, name, stock_quantity, unit FROM raw_materials WHERE code = %s", (payload.raw_material_code,))
        rm = cursor.fetchone()
        if not rm:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Raw material '{payload.raw_material_code}' not found")

        previous_stock = float(rm["stock_quantity"] or 0)
        unit = rm["unit"] or "kg"

        if payload.adjustment_type == "add":
            new_stock = previous_stock + payload.quantity
            cursor.execute("UPDATE raw_materials SET stock_quantity = stock_quantity + %s WHERE code = %s", (payload.quantity, payload.raw_material_code))
        else:  # deduct
            if payload.quantity > previous_stock:
                conn.close()
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot deduct {payload.quantity} {unit}: current raw material stock is only {previous_stock} {unit}."
                )
            new_stock = previous_stock - payload.quantity
            cursor.execute("UPDATE raw_materials SET stock_quantity = stock_quantity - %s WHERE code = %s", (payload.quantity, payload.raw_material_code))

    else:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Invalid target_type '{payload.target_type}'. Must be 'finished_goods', 'stage_wip', or 'raw_material'")

    # Record full audit trail in stock_amendments table
    amd_no = f"AMD-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
    cursor.execute("""
    INSERT INTO stock_amendments (
        amendment_no, target_type, item_code, stage_sequence, stage_name,
        raw_material_code, adjustment_type, quantity, previous_stock,
        new_stock, reason, remarks
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        amd_no, payload.target_type, payload.item_code, payload.stage_sequence,
        payload.stage_name, payload.raw_material_code, payload.adjustment_type,
        payload.quantity, previous_stock, new_stock, payload.reason, payload.remarks
    ))

    conn.commit()
    conn.close()

    return {
        "message": f"Stock amendment applied successfully ({'+' if payload.adjustment_type == 'add' else '-'}{payload.quantity})",
        "amendment_no": amd_no,
        "target_type": payload.target_type,
        "adjustment_type": payload.adjustment_type,
        "quantity": payload.quantity,
        "previous_stock": previous_stock,
        "new_stock": new_stock,
        "reason": payload.reason
    }

@app.get("/api/stock/amendments")
def list_stock_amendments(
    item_code: Optional[str] = None,
    raw_material_code: Optional[str] = None,
    target_type: Optional[str] = None,
    limit: int = 100
):
    """
    Returns audit trail of all manual stock amendments.
    """
    conn = get_db()
    cursor = get_cursor(conn)
    query = "SELECT * FROM stock_amendments WHERE 1=1"
    params = []
    if item_code:
        query += " AND item_code = %s"
        params.append(item_code)
    if raw_material_code:
        query += " AND raw_material_code = %s"
        params.append(raw_material_code)
    if target_type:
        query += " AND target_type = %s"
        params.append(target_type)
    query += " ORDER BY id DESC LIMIT %s"
    params.append(limit)

    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows
# ==========================================
@app.get("/api/daily-tasks")
def get_daily_tasks():
    """
    Dedicated Daily Tasks view for the jobwork engineer:
    - Vendor Deliveries Due Today or Overdue (Follow-up urgent call list)
    - In-House operations ready for dispatch
    - Critical order checklist
    - Recent vendor communication logs
    """
    conn = get_db()
    cursor = get_cursor(conn)
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    # 1. Vendor overdue & due today items
    cursor.execute("""
    SELECT 
        b.id, b.batch_no, b.item_code, i.name as item_name, i.drawing_no,
        b.current_process, b.quantity_accepted as quantity,
        b.current_vendor_id, v.name as vendor_name, v.contact_person, v.phone as vendor_phone,
        COALESCE(v.vendor_type, 'Local') as vendor_type,
        b.date_sent_to_vendor, b.expected_delivery_date, b.challan_no, b.is_critical, b.notes
    FROM batches b
    JOIN items i ON b.item_code = i.item_code
    LEFT JOIN vendors v ON b.current_vendor_id = v.id
    WHERE b.status = 'With Vendor'
    ORDER BY b.expected_delivery_date ASC
    """)
    
    overdue_tasks = []
    due_today_tasks = []
    upcoming_tasks = []
    
    for row in cursor.fetchall():
        lead = calculate_lead_status(row["date_sent_to_vendor"], row["expected_delivery_date"], "With Vendor")
        item_data = {
            "id": row["id"],
            "batch_no": row["batch_no"],
            "item_code": row["item_code"],
            "item_name": row["item_name"],
            "drawing_no": row["drawing_no"],
            "current_process": row["current_process"],
            "quantity": row["quantity"],
            "vendor_id": row["current_vendor_id"],
            "vendor_name": row["vendor_name"],
            "vendor_type": row["vendor_type"],
            "contact_person": row["contact_person"],
            "vendor_phone": row["vendor_phone"],
            "date_sent": row["date_sent_to_vendor"],
            "expected_delivery_date": row["expected_delivery_date"],
            "challan_no": row["challan_no"],
            "is_critical": bool(row["is_critical"]),
            "lead_status": lead
        }
        if lead["is_overdue"]:
            overdue_tasks.append(item_data)
        elif lead["badge"] == "DUE TODAY":
            due_today_tasks.append(item_data)
        elif lead["days_remaining"] is not None and lead["days_remaining"] <= 2:
            upcoming_tasks.append(item_data)
            
    # 2. In-house items ready to be dispatched to vendors with next stage & vendor classification
    cursor.execute("""
    SELECT 
        b.id, b.batch_no, b.item_code, i.name as item_name,
        b.current_process, b.current_stage_sequence, b.quantity_accepted as quantity,
        b.route_id, r.route_name,
        rs_next.process_name as next_process,
        rs_next.sequence_no as next_sequence,
        rs_next.vendor_id as next_vendor_id,
        v_next.name as next_vendor_name,
        COALESCE(v_next.vendor_type, 'Local') as next_vendor_type
    FROM batches b
    JOIN items i ON b.item_code = i.item_code
    JOIN process_routes r ON b.route_id = r.id
    LEFT JOIN route_stages rs_next ON r.id = rs_next.route_id AND rs_next.sequence_no = (b.current_stage_sequence + 1)
    LEFT JOIN vendors v_next ON rs_next.vendor_id = v_next.id
    WHERE b.is_inhouse = 1 AND b.status != 'Completed'
    """)
    inhouse_tasks = [dict(r) for r in cursor.fetchall()]

    # 3. Recent follow-up logs
    cursor.execute("""
    SELECT 
        f.id, f.batch_id, b.batch_no, b.item_code, COALESCE(i.name, b.item_code) as item_name,
        v.name as vendor_name, COALESCE(v.vendor_type, 'Local') as vendor_type,
        f.date_contacted, f.contact_person, f.method,
        f.vendor_status_update, f.promised_date
    FROM vendor_followups f
    LEFT JOIN batches b ON f.batch_id = b.id
    LEFT JOIN items i ON b.item_code = i.item_code
    LEFT JOIN vendors v ON f.vendor_id = v.id
    ORDER BY f.date_contacted DESC, f.id DESC
    LIMIT 6
    """)
    recent_followups = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "overdue_tasks": overdue_tasks,
        "due_today_tasks": due_today_tasks,
        "upcoming_tasks": upcoming_tasks,
        "inhouse_tasks": inhouse_tasks,
        "recent_followups": recent_followups
    }

# ==========================================
# 10.1 DAY-BEFORE LOGISTICS PLANNING (TRIP & LOCAL PLANS)
# ==========================================
@app.get("/api/logistics-plan")
def get_logistics_plan(target_date: Optional[str] = None):
    """
    Day-Before Logistics Planning for Jobwork:
    Categorizes outward dispatches (in-house batches ready to send) and inward collections/deliveries
    (material due to arrive from vendors) into:
    1. Trip Plan (Outstation / Vehicle Trip vendors requiring vehicle planning a day prior)
    2. Local Plan (Local industrial cluster vendors for daily local rounds)
    """
    conn = get_db()
    cursor = get_cursor(conn)
    
    today = datetime.now()
    today_str = today.strftime("%Y-%m-%d")
    tomorrow = today + timedelta(days=1)
    tomorrow_str = tomorrow.strftime("%Y-%m-%d")
    
    plan_date = target_date if target_date else tomorrow_str
    
    # 1. OUTWARD DISPATCHES (In-house WIP batches ready to send to next outsourced process)
    cursor.execute("""
    SELECT 
        b.id as batch_id, b.batch_no, b.item_code, i.name as item_name,
        b.current_process as completed_process,
        b.current_stage_sequence,
        b.quantity_accepted as quantity,
        COALESCE(i.weight, 0) as unit_weight,
        ROUND(b.quantity_accepted * COALESCE(i.weight, 0), 2) as total_weight_kg,
        b.route_id, r.route_name,
        rs_next.process_name as next_process,
        rs_next.sequence_no as next_sequence,
        rs_next.vendor_id as destination_vendor_id,
        v_next.name as destination_vendor_name,
        v_next.code as destination_vendor_code,
        v_next.phone as destination_vendor_phone,
        v_next.address as destination_vendor_address,
        COALESCE(v_next.vendor_type, 'Local') as destination_vendor_type,
        b.is_critical,
        b.notes
    FROM batches b
    JOIN items i ON b.item_code = i.item_code
    JOIN process_routes r ON b.route_id = r.id
    LEFT JOIN route_stages rs_next ON r.id = rs_next.route_id AND rs_next.sequence_no = (b.current_stage_sequence + 1)
    LEFT JOIN vendors v_next ON rs_next.vendor_id = v_next.id
    WHERE b.is_inhouse = 1 AND b.status != 'Completed'
    ORDER BY b.is_critical DESC, v_next.name ASC, b.id ASC
    """)
    outward_rows = [dict(r) for r in cursor.fetchall()]
    
    trip_outward = []
    local_outward = []
    unassigned_outward = []
    
    for row in outward_rows:
        v_type = row.get("destination_vendor_type")
        if not row.get("destination_vendor_id"):
            unassigned_outward.append(row)
        elif v_type == "Trip":
            trip_outward.append(row)
        else:
            local_outward.append(row)
            
    # 2. INWARD DELIVERIES / PICKUPS (Batches with vendors due on/before plan_date or overdue)
    cursor.execute("""
    SELECT 
        b.id as batch_id, b.batch_no, b.item_code, i.name as item_name,
        b.current_process, b.current_stage_sequence,
        b.quantity_accepted as quantity,
        COALESCE(i.weight, 0) as unit_weight,
        ROUND(b.quantity_accepted * COALESCE(i.weight, 0), 2) as total_weight_kg,
        b.current_vendor_id as vendor_id,
        v.name as vendor_name,
        v.code as vendor_code,
        v.phone as vendor_phone,
        v.contact_person,
        v.address as vendor_address,
        COALESCE(v.vendor_type, 'Local') as vendor_type,
        b.date_sent_to_vendor,
        b.expected_delivery_date,
        b.challan_no,
        b.is_critical,
        b.notes
    FROM batches b
    JOIN items i ON b.item_code = i.item_code
    JOIN vendors v ON b.current_vendor_id = v.id
    WHERE b.status = 'With Vendor'
    ORDER BY b.expected_delivery_date ASC, b.is_critical DESC
    """)
    inward_rows = [dict(r) for r in cursor.fetchall()]
    
    trip_inward = []
    local_inward = []
    
    for row in inward_rows:
        exp = row.get("expected_delivery_date")
        lead = calculate_lead_status(row.get("date_sent_to_vendor"), exp, "With Vendor")
        row["lead_status"] = lead
        
        is_relevant_for_date = False
        if not exp or exp <= plan_date or lead.get("is_overdue"):
            is_relevant_for_date = True
        
        if is_relevant_for_date:
            if row.get("vendor_type") == "Trip":
                trip_inward.append(row)
            else:
                local_inward.append(row)
                
    conn.close()
    
    return {
        "plan_date": plan_date,
        "is_tomorrow": (plan_date == tomorrow_str),
        "today_date": today_str,
        "tomorrow_date": tomorrow_str,
        "trip_plan": {
            "outward_dispatches": trip_outward,
            "inward_pickups": trip_inward,
            "total_outward_items": len(trip_outward),
            "total_outward_qty": sum(r["quantity"] for r in trip_outward),
            "total_outward_weight_kg": round(sum(r["total_weight_kg"] for r in trip_outward), 2),
            "total_inward_items": len(trip_inward),
            "total_inward_qty": sum(r["quantity"] for r in trip_inward),
            "total_inward_weight_kg": round(sum(r["total_weight_kg"] for r in trip_inward), 2),
            "vendors_count": len(set(r.get("destination_vendor_id") for r in trip_outward if r.get("destination_vendor_id")) | 
                                 set(r.get("vendor_id") for r in trip_inward if r.get("vendor_id")))
        },
        "local_plan": {
            "outward_dispatches": local_outward,
            "inward_pickups": local_inward,
            "total_outward_items": len(local_outward),
            "total_outward_qty": sum(r["quantity"] for r in local_outward),
            "total_outward_weight_kg": round(sum(r["total_weight_kg"] for r in local_outward), 2),
            "total_inward_items": len(local_inward),
            "total_inward_qty": sum(r["quantity"] for r in local_inward),
            "total_inward_weight_kg": round(sum(r["total_weight_kg"] for r in local_inward), 2),
            "vendors_count": len(set(r.get("destination_vendor_id") for r in local_outward if r.get("destination_vendor_id")) | 
                                 set(r.get("vendor_id") for r in local_inward if r.get("vendor_id")))
        },
        "unassigned_inhouse": unassigned_outward
    }

# ==========================================
# 11. MANUAL ITEM & PROCESS ROUTE CREATOR
# ==========================================
@app.post("/api/items/create-with-route")
def create_item_with_route(payload: ItemWithRouteCreate):
    """
    Allows adding items manually along with their multi-step process route in one operation.
    Supports individual process routes per item, vendor assignments, lead times, and welding BOMs.
    """
    conn = get_db()
    cursor = get_cursor(conn)
    
    # 1. Insert Item
    try:
        cursor.execute("""
        INSERT INTO items (item_code, name, drawing_no, revision, material_code, raw_material_name, weight, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (payload.item_code, payload.name, payload.drawing_no, payload.revision, payload.material_code, payload.raw_material_name, payload.weight or 0.0, payload.notes))
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Item Code '{payload.item_code}' already exists")

    # 2. Insert Default Route
    route_name = payload.route_name or f"{payload.item_code} Process Route"
    cursor.execute("""
    INSERT INTO process_routes (item_code, route_name, is_default, description)
    VALUES (%s, %s, 1, %s)
    RETURNING id
    """, (payload.item_code, route_name, f"Custom sequential route for {payload.item_code}"))
    route_id = cursor.fetchone()["id"]
    
    # 3. Insert Route Stages - Guarantee final stage is strictly Finished Product for production assembly
    stages_to_insert = list(payload.stages)
    has_final_finished = len(stages_to_insert) > 0 and stages_to_insert[-1].process_name.strip().lower() == "finished product"
    if not has_final_finished:
        from models import StageDefinition
        stages_to_insert.append(StageDefinition(
            sequence_no=len(stages_to_insert) + 1,
            process_name="Finished Product",
            vendor_id=None,
            is_inhouse=True,
            lead_time_days=1,
            is_welding_stage=False,
            notes="Finished Product ready for production assembly"
        ))
    else:
        last = stages_to_insert[-1]
        last.process_name = "Finished Product"
        last.is_inhouse = True
        last.vendor_id = None
        if not last.notes:
            last.notes = "Finished Product ready for production assembly"

    for idx, stage in enumerate(stages_to_insert, start=1):
        cursor.execute("""
        INSERT INTO route_stages (
            route_id, sequence_no, process_name, vendor_id, is_inhouse,
            lead_time_days, is_welding_stage, notes
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    RETURNING id
        """, (
            route_id, idx, stage.process_name, stage.vendor_id,
            1 if stage.is_inhouse else 0, stage.lead_time_days,
            1 if stage.is_welding_stage else 0, stage.notes
        ))
        stage_id = cursor.fetchone()["id"]
        
        # If welding stage, insert child components
        if stage.is_welding_stage and stage.welding_components:
            for comp in stage.welding_components:
                cursor.execute("""
                INSERT INTO welding_boms (route_stage_id, parent_item_code, child_item_code, quantity_per_unit, unit)
                VALUES (%s, %s, %s, %s, %s)
                """, (
                    stage_id, payload.item_code, comp.get("child_item_code"),
                    float(comp.get("quantity_per_unit", 1.0)), comp.get("unit", "pcs")
                ))

    conn.commit()
    conn.close()
    return {"message": "Item and custom process route created successfully", "item_code": payload.item_code, "route_id": route_id}

# ==========================================
# 12. MULTI-ITEM BULK DISPATCH TO SAME VENDOR
# ==========================================
@app.post("/api/vendors/bulk-dispatch")
def bulk_dispatch_to_vendor(payload: BulkDispatchToVendor):
    """
    Requirement: Multiple items send to same vendor.
    Dispatches multiple distinct items/batches to a single vendor on a shared delivery challan.
    """
    conn = get_db()
    cursor = get_cursor(conn)
    
    cursor.execute("SELECT id, name, default_lead_time_days FROM vendors WHERE id = %s", (payload.vendor_id,))
    vendor = cursor.fetchone()
    if not vendor:
        conn.close()
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    challan_no = payload.challan_no or f"DC-OUT-{datetime.now().strftime('%Y%m%d%H%M')}"
    today = datetime.now()
    today_str = today.strftime("%Y-%m-%d")
    exp_date = (today + timedelta(days=vendor["default_lead_time_days"])).strftime("%Y-%m-%d")
    
    dispatched_items = []
    for itm in payload.items:
        cursor.execute("SELECT id, item_code, current_stage_sequence FROM batches WHERE id = %s", (itm.batch_id,))
        batch = cursor.fetchone()
        if not batch:
            continue
            
        cursor.execute("""
        UPDATE batches
        SET current_vendor_id = %s,
            is_inhouse = 0,
            status = 'With Vendor',
            date_sent_to_vendor = %s,
            expected_delivery_date = %s,
            challan_no = %s
        WHERE id = %s
        """, (payload.vendor_id, today_str, exp_date, challan_no, itm.batch_id))
        
        # Record challan row
        cursor.execute("""
        INSERT INTO delivery_challans (
            challan_no, challan_type, date, vendor_id, batch_id, item_code,
            process_name, quantity, transporter, vehicle_no, remarks
        ) VALUES (%s, 'Outward to Vendor', %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            challan_no, today_str, payload.vendor_id, itm.batch_id, itm.item_code,
            itm.process_name, itm.quantity, payload.transporter, payload.vehicle_no,
            payload.remarks or f"Dispatched for {itm.process_name}"
        ))
        dispatched_items.append(itm.item_code)
        
    conn.commit()
    conn.close()
    return {
        "message": f"Successfully dispatched {len(dispatched_items)} items to {vendor['name']}",
        "challan_no": challan_no,
        "vendor_name": vendor["name"],
        "items": dispatched_items
    }

# ==========================================
# 13. ASSEMBLIES & FINISHED ITEM CONSUMPTION PLANNING
# ==========================================

import calendar

@app.get("/api/assemblies")
def get_assemblies():
    """
    Get all top-level assemblies with their assigned BOM items (consumption mapping),
    including current finished and WIP stock of each component item.
    """
    conn = get_db()
    cursor = get_cursor(conn)
    
    cursor.execute("""
    SELECT id, assembly_code, name, description, customer, drawing_no, created_at
    FROM assemblies
    ORDER BY assembly_code ASC
    """)
    assemblies = [dict(r) for r in cursor.fetchall()]
    
    for asm in assemblies:
        cursor.execute("""
        SELECT 
            b.id as bom_id, b.item_code, i.name as item_name, i.drawing_no,
            b.consumption_qty, b.unit, b.notes
        FROM assembly_bom b
        JOIN items i ON b.item_code = i.item_code
        WHERE b.assembly_id = %s
        ORDER BY b.item_code ASC
        """, (asm["id"],))
        bom_items = [dict(r) for r in cursor.fetchall()]
        
        # Enrich with current stock numbers for each component
        for itm in bom_items:
            # Finished stock: Completed status or current_process = 'Finished Product'
            cursor.execute("""
            SELECT COALESCE(SUM(quantity_accepted), 0) FROM batches 
            WHERE item_code = %s AND (status = 'Completed' OR current_process = 'Finished Product')
            """, (itm["item_code"],))
            itm["finished_stock"] = get_scalar(cursor, 0)
            
            # In-process WIP stock
            cursor.execute("""
            SELECT COALESCE(SUM(quantity_accepted), 0) FROM batches 
            WHERE item_code = %s AND status != 'Completed' AND current_process != 'Finished Product'
            """, (itm["item_code"],))
            itm["wip_stock"] = get_scalar(cursor, 0)
            
        asm["bom_items"] = bom_items
        asm["total_components_count"] = len(bom_items)
        
    conn.close()
    return assemblies

@app.post("/api/assemblies")
def create_assembly(payload: AssemblyCreate):
    conn = get_db()
    cursor = get_cursor(conn)
    try:
        cursor.execute("""
        INSERT INTO assemblies (assembly_code, name, description, customer, drawing_no)
        VALUES (%s, %s, %s, %s, %s)
    RETURNING id
        """, (payload.assembly_code.strip().upper(), payload.name.strip(), payload.description, payload.customer, payload.drawing_no))
        asm_id = cursor.fetchone()["id"]
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Assembly code '{payload.assembly_code}' already exists")
    conn.close()
    return {"id": asm_id, "assembly_code": payload.assembly_code, "message": "Assembly created successfully"}

@app.put("/api/assemblies/{assembly_id}")
def update_assembly(assembly_id: int, payload: AssemblyUpdate):
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("""
    UPDATE assemblies 
    SET name = COALESCE(%s, name),
        description = COALESCE(%s, description),
        customer = COALESCE(%s, customer),
        drawing_no = COALESCE(%s, drawing_no)
    WHERE id = %s
    """, (payload.name, payload.description, payload.customer, payload.drawing_no, assembly_id))
    conn.commit()
    conn.close()
    return {"message": "Assembly updated successfully"}

@app.delete("/api/assemblies/{assembly_id}")
def delete_assembly(assembly_id: int):
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("DELETE FROM assemblies WHERE id = %s", (assembly_id,))
    cursor.execute("DELETE FROM assembly_bom WHERE assembly_id = %s", (assembly_id,))
    cursor.execute("DELETE FROM assembly_monthly_plans WHERE assembly_id = %s", (assembly_id,))
    cursor.execute("DELETE FROM assembly_daily_plans WHERE assembly_id = %s", (assembly_id,))
    conn.commit()
    conn.close()
    return {"message": "Assembly deleted successfully"}

@app.post("/api/assemblies/{assembly_id}/bom")
def assign_item_to_assembly(assembly_id: int, payload: AssemblyBOMItemCreate):
    conn = get_db()
    cursor = get_cursor(conn)
    
    # Verify assembly exists
    cursor.execute("SELECT id FROM assemblies WHERE id = %s", (assembly_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Assembly not found")
        
    # Verify item exists
    cursor.execute("SELECT item_code FROM items WHERE item_code = %s", (payload.item_code,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail=f"Item code '{payload.item_code}' not found")
        
    cursor.execute("""
    INSERT INTO assembly_bom (assembly_id, item_code, consumption_qty, unit, notes)
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT(assembly_id, item_code) DO UPDATE SET
        consumption_qty = excluded.consumption_qty,
        unit = excluded.unit,
        notes = excluded.notes
    """, (assembly_id, payload.item_code, payload.consumption_qty, payload.unit or "pcs", payload.notes))
    
    conn.commit()
    conn.close()
    return {"message": f"Item {payload.item_code} assigned to assembly with consumption quantity {payload.consumption_qty}"}

@app.delete("/api/assemblies/{assembly_id}/bom/{bom_id}")
def remove_item_from_assembly(assembly_id: int, bom_id: int):
    conn = get_db()
    cursor = get_cursor(conn)
    cursor.execute("DELETE FROM assembly_bom WHERE id = %s AND assembly_id = %s", (bom_id, assembly_id))
    conn.commit()
    conn.close()
    return {"message": "Component item removed from assembly"}

@app.get("/api/production-planning/plans")
def get_production_plans(month: Optional[str] = None):
    """
    Get Monthly targets and Daywise plan schedule for all assemblies in a given month (YYYY-MM).
    """
    if not month:
        month = datetime.now().strftime("%Y-%m")
        
    try:
        year, m = map(int, month.split("-"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid month format, expected YYYY-MM")
        
    num_days = calendar.monthrange(year, m)[1]
    
    conn = get_db()
    cursor = get_cursor(conn)
    
    # 1. Fetch all assemblies
    cursor.execute("SELECT id, assembly_code, name, customer, drawing_no FROM assemblies ORDER BY assembly_code ASC")
    assemblies = [dict(r) for r in cursor.fetchall()]
    
    # Generate list of days in month
    days_info = []
    for day in range(1, num_days + 1):
        d_date = datetime(year, m, day)
        days_info.append({
            "date": d_date.strftime("%Y-%m-%d"),
            "day": day,
            "weekday": d_date.weekday(), # 0 = Monday, 6 = Sunday
            "day_name": d_date.strftime("%a"),
            "is_working_day": d_date.weekday() < 6
        })
        
    # For each assembly, load monthly plan and daywise schedule
    for asm in assemblies:
        # Monthly plan
        cursor.execute("""
        SELECT target_quantity, working_days, notes
        FROM assembly_monthly_plans
        WHERE year_month = %s AND assembly_id = %s
        """, (month, asm["id"]))
        m_row = cursor.fetchone()
        asm["target_quantity"] = m_row["target_quantity"] if m_row else 0
        asm["working_days"] = m_row["working_days"] if m_row else 25
        asm["monthly_notes"] = m_row["notes"] if m_row else ""
        
        # Daywise schedule
        cursor.execute("""
        SELECT plan_date, planned_quantity, actual_quantity, notes
        FROM assembly_daily_plans
        WHERE plan_date LIKE %s AND assembly_id = %s
        """, (f"{month}-%", asm["id"]))
        rows = cursor.fetchall()
        day_map = {row["plan_date"]: row["planned_quantity"] for row in rows}
        actual_map = {row["plan_date"]: row["actual_quantity"] for row in rows}
        
        # Build full schedule for every day in month
        asm["daywise_schedule"] = [
            {
                "date": d["date"],
                "day": d["day"],
                "planned_quantity": day_map.get(d["date"], 0),
                "actual_quantity": actual_map.get(d["date"], None)
            }
            for d in days_info
        ]
        asm["total_scheduled_quantity"] = sum(asm["daywise_schedule"][i]["planned_quantity"] for i in range(len(days_info)))
        asm["total_actual_quantity"] = sum(asm["daywise_schedule"][i]["actual_quantity"] or 0 for i in range(len(days_info)))
        
    conn.close()
    return {
        "year_month": month,
        "num_days": num_days,
        "days": days_info,
        "assemblies": assemblies
    }

@app.post("/api/production-planning/monthly-targets")
def save_monthly_targets(payload: MonthlyTargetsPayload):
    """
    Save or update monthly targets for assemblies, with optional automatic distribution across working days.
    """
    year, m = map(int, payload.year_month.split("-"))
    num_days = calendar.monthrange(year, m)[1]
    
    # Find working days (Mon-Sat, weekday < 6)
    working_dates = [
        datetime(year, m, d).strftime("%Y-%m-%d")
        for d in range(1, num_days + 1)
        if datetime(year, m, d).weekday() < 6
    ]
    num_working = len(working_dates) or 1
    
    conn = get_db()
    cursor = get_cursor(conn)
    
    for item in payload.targets:
        cursor.execute("""
        INSERT INTO assembly_monthly_plans (year_month, assembly_id, target_quantity, working_days, notes)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT(year_month, assembly_id) DO UPDATE SET
            target_quantity = excluded.target_quantity,
            working_days = excluded.working_days,
            notes = excluded.notes,
            updated_at = CURRENT_TIMESTAMP
        """, (payload.year_month, item.assembly_id, item.target_quantity, item.working_days or num_working, item.notes))
        
        if payload.auto_distribute and item.target_quantity > 0:
            # Distribute across working days
            base_qty = item.target_quantity // num_working
            remainder = item.target_quantity % num_working
            
            # Clear existing daily plan for this month and assembly
            cursor.execute("""
            DELETE FROM assembly_daily_plans 
            WHERE plan_date LIKE %s AND assembly_id = %s
            """, (f"{payload.year_month}-%", item.assembly_id))
            
            # Insert distributed quantities
            for idx, date_str in enumerate(working_dates):
                daily_qty = base_qty + (1 if idx < remainder else 0)
                cursor.execute("""
                INSERT INTO assembly_daily_plans (plan_date, assembly_id, planned_quantity, notes)
                VALUES (%s, %s, %s, 'Auto-distributed from monthly plan')
                """, (date_str, item.assembly_id, daily_qty))
                
    conn.commit()
    conn.close()
    return {"message": "Monthly targets saved and schedule updated successfully"}

@app.post("/api/production-planning/daily-schedule")
def save_daily_schedule(payload: DailyScheduleBatchUpdate):
    """
    Save custom/fine-tuned daywise quantities (both planned and actual) for assemblies.
    """
    conn = get_db()
    cursor = get_cursor(conn)
    
    for item in payload.items:
        cursor.execute("""
        INSERT INTO assembly_daily_plans (plan_date, assembly_id, planned_quantity, actual_quantity, notes)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT(plan_date, assembly_id) DO UPDATE SET
            planned_quantity = excluded.planned_quantity,
            actual_quantity = excluded.actual_quantity,
            notes = excluded.notes,
            updated_at = CURRENT_TIMESTAMP
        """, (item.plan_date, item.assembly_id, item.planned_quantity, item.actual_quantity, item.notes))
        
    conn.commit()
    conn.close()
    return {"message": f"Saved schedule for {len(payload.items)} daily plan entries"}

@app.get("/api/production-planning/daily-consumption")
def calculate_daily_consumption(month: Optional[str] = None):
    """
    CORE CALCULATION ENGINE:
    Calculates day-by-day consumption of finished items (CM001, CM002, etc.)
    derived from assembly daily production plans (using actual_quantity when recorded,
    falling back to planned_quantity for projections) and BOM consumption quantities.
    Cross-references with current finished stock and WIP pipeline to identify
    stockout dates, coverage days, and net surplus/deficit.
    """
    if not month:
        month = datetime.now().strftime("%Y-%m")
        
    try:
        year, m = map(int, month.split("-"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid month format, expected YYYY-MM")
        
    num_days = calendar.monthrange(year, m)[1]
    
    conn = get_db()
    cursor = get_cursor(conn)
    
    # 1. Build calendar days
    days_info = []
    for day in range(1, num_days + 1):
        d_date = datetime(year, m, day)
        days_info.append({
            "date": d_date.strftime("%Y-%m-%d"),
            "day": day,
            "weekday": d_date.weekday(),
            "day_name": d_date.strftime("%a"),
            "is_working_day": d_date.weekday() < 6
        })
        
    # 2. Fetch all assemblies and their daily plans
    cursor.execute("SELECT id, assembly_code, name FROM assemblies")
    assemblies = {row["id"]: {"code": row["assembly_code"], "name": row["name"]} for row in cursor.fetchall()}
    
    cursor.execute("""
    SELECT plan_date, assembly_id, planned_quantity, actual_quantity
    FROM assembly_daily_plans
    WHERE plan_date LIKE %s
    """, (f"{month}-%",))
    
    # plans_by_date[date][assembly_id] = { "planned": qty, "actual": actual_qty }
    plans_by_date = {}
    for row in cursor.fetchall():
        dt = row["plan_date"]
        aid = row["assembly_id"]
        if dt not in plans_by_date:
            plans_by_date[dt] = {}
        plans_by_date[dt][aid] = {
            "planned": row["planned_quantity"] or 0,
            "actual": row["actual_quantity"]
        }
        
    # 3. Fetch all BOM consumption mappings
    cursor.execute("""
    SELECT b.assembly_id, b.item_code, b.consumption_qty, b.unit, i.name as item_name, i.drawing_no
    FROM assembly_bom b
    JOIN items i ON b.item_code = i.item_code
    """)
    bom_rows = cursor.fetchall()
    
    # Group BOM mappings by item_code: item_boms[item_code] = [{assembly_id, consumption_qty, ...}]
    item_boms = {}
    item_meta = {}
    for r in bom_rows:
        icode = r["item_code"]
        if icode not in item_boms:
            item_boms[icode] = []
            item_meta[icode] = {
                "item_code": icode,
                "item_name": r["item_name"],
                "drawing_no": r["drawing_no"],
                "unit": r["unit"] or "pcs"
            }
        item_boms[icode].append({
            "assembly_id": r["assembly_id"],
            "assembly_code": assemblies.get(r["assembly_id"], {}).get("code", "Unknown"),
            "assembly_name": assemblies.get(r["assembly_id"], {}).get("name", "Unknown"),
            "consumption_qty": r["consumption_qty"]
        })
        
    # 4. Fetch inventory (Finished Stock & WIP) for each mapped item
    items_consumption_list = []
    total_components_month_demand = 0
    total_assemblies_month_planned = 0
    total_assemblies_month_actual = 0
    critical_shortages_count = 0
    
    # Calculate totals
    for dt, asms in plans_by_date.items():
        for aid, qdata in asms.items():
            total_assemblies_month_planned += qdata["planned"]
            if qdata["actual"] is not None:
                total_assemblies_month_actual += qdata["actual"]
        
    today_str = datetime.now().strftime("%Y-%m-%d")

    for icode, boms in item_boms.items():
        # Current completed finished stock
        cursor.execute("""
        SELECT COALESCE(SUM(quantity_accepted), 0) FROM batches 
        WHERE item_code = %s AND (status = 'Completed' OR current_process = 'Finished Product')
        """, (icode,))
        current_finished = get_scalar(cursor, 0)
        
        # Current in-progress WIP across vendors
        cursor.execute("""
        SELECT COALESCE(SUM(quantity_accepted), 0) FROM batches 
        WHERE item_code = %s AND status != 'Completed' AND current_process != 'Finished Product'
        """, (icode,))
        current_wip = get_scalar(cursor, 0)
        
        # Calculate daily consumption for this item
        daily_quantities = {}
        daily_is_actual = {}
        daily_breakdowns = {}
        month_total_consumed = 0
        cumulative = 0
        runout_date = None
        
        for d in days_info:
            dt = d["date"]
            asms_today = plans_by_date.get(dt, {})
            day_item_qty = 0
            breakdown = []
            day_has_actual = False
            
            for b in boms:
                aid = b["assembly_id"]
                asm_data = asms_today.get(aid, {"planned": 0, "actual": None})
                asm_planned = asm_data["planned"]
                asm_actual = asm_data["actual"]
                
                # If actual is recorded, use actual; otherwise use planned
                if asm_actual is not None:
                    effective_asm_qty = asm_actual
                    is_actual_entry = True
                    day_has_actual = True
                else:
                    effective_asm_qty = asm_planned
                    is_actual_entry = False
                    
                if effective_asm_qty > 0 or asm_planned > 0:
                    consumed = effective_asm_qty * b["consumption_qty"]
                    day_item_qty += consumed
                    breakdown.append({
                        "assembly_code": b["assembly_code"],
                        "assembly_name": b["assembly_name"],
                        "assembly_planned_qty": asm_planned,
                        "assembly_actual_qty": asm_actual,
                        "effective_qty": effective_asm_qty,
                        "is_actual": is_actual_entry,
                        "consumption_rate": b["consumption_qty"],
                        "item_consumed_qty": consumed
                    })
                    
            daily_quantities[dt] = day_item_qty
            daily_is_actual[dt] = day_has_actual
            daily_breakdowns[dt] = breakdown
            month_total_consumed += day_item_qty
            
            # Track runout date against current finished stock
            cumulative += day_item_qty
            if current_finished > 0 and cumulative > current_finished and runout_date is None:
                runout_date = dt
                
        # If current_finished is 0 and there is demand, runs out on day 1
        if current_finished == 0 and month_total_consumed > 0:
            runout_date = days_info[0]["date"]
            
        net_balance = current_finished - month_total_consumed
        
        # Coverage status determination
        if current_finished == 0:
            coverage_status = "ZERO_STOCK"
            coverage_badge = "Zero Finished Stock"
            critical_shortages_count += 1
        elif net_balance < 0:
            coverage_status = "DEFICIT"
            coverage_badge = f"Runs out on {runout_date}" if runout_date else "Deficit"
            critical_shortages_count += 1
        else:
            coverage_status = "COVERED"
            coverage_badge = "Fully Covered"
            
        total_components_month_demand += month_total_consumed
        
        items_consumption_list.append({
            "item_code": icode,
            "item_name": item_meta[icode]["item_name"],
            "drawing_no": item_meta[icode]["drawing_no"],
            "unit": item_meta[icode]["unit"],
            "current_finished_stock": current_finished,
            "current_wip_stock": current_wip,
            "total_available": current_finished + current_wip,
            "total_month_consumption": month_total_consumed,
            "net_balance": net_balance,
            "runout_date": runout_date,
            "coverage_status": coverage_status,
            "coverage_badge": coverage_badge,
            "assemblies_using": [
                {
                    "assembly_code": b["assembly_code"],
                    "assembly_name": b["assembly_name"],
                    "consumption_rate": b["consumption_qty"]
                }
                for b in boms
            ],
            "daily_quantities": daily_quantities,
            "daily_is_actual": daily_is_actual,
            "daily_breakdowns": daily_breakdowns
        })
        
    conn.close()
    
    # Calculate daily totals across all items
    daily_totals_all_items = {}
    for d in days_info:
        dt = d["date"]
        daily_totals_all_items[dt] = sum(itm["daily_quantities"].get(dt, 0) for itm in items_consumption_list)
        
    return {
        "year_month": month,
        "days": days_info,
        "summary": {
            "total_assemblies_planned": total_assemblies_month_planned,
            "total_assemblies_actual": total_assemblies_month_actual,
            "total_components_demanded": total_components_month_demand,
            "critical_shortages_count": critical_shortages_count,
            "total_monitored_items": len(items_consumption_list),
            "current_date": today_str
        },
        "daily_totals": daily_totals_all_items,
        "items": items_consumption_list
    }

# ==========================================
# 14. ITEMS TO START PROCESS (PRODUCTION DISPATCH READINESS)
# ==========================================
@app.get("/api/production-planning/items-to-start")
def get_items_to_start(month: Optional[str] = None, target_date: Optional[str] = None):
    """
    Computes which manufactured items need to have their process started (batches launched)
    to fulfill assembly daily production plans, comparing:
    - Daily plan quantity & schedule demand
    - Consumed quantity (actuals from production)
    - Cumulative process route lead time to finish the product
    - Current finished goods and vendor WIP stock levels
    - Calculated "Must Start By" date before stockout occurs
    """
    if not month:
        month = datetime.now().strftime("%Y-%m")
    if not target_date:
        target_date = datetime.now().strftime("%Y-%m-%d")
        
    try:
        year, m = map(int, month.split("-"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid month format, expected YYYY-MM")
        
    num_days = calendar.monthrange(year, m)[1]
    
    conn = get_db()
    cursor = get_cursor(conn)
    
    # 1. Fetch days
    days_info = []
    for day in range(1, num_days + 1):
        d_date = datetime(year, m, day)
        days_info.append({
            "date": d_date.strftime("%Y-%m-%d"),
            "day": day,
            "day_name": d_date.strftime("%a"),
            "is_working_day": d_date.weekday() < 6
        })
    days_dates = [d["date"] for d in days_info]
        
    # 2. Fetch routes and total lead time per item
    routes_by_item = {}
    cursor.execute("""
        SELECT pr.item_code, pr.id as route_id, pr.route_name,
               rs.sequence_no, rs.process_name, rs.vendor_id, v.name as default_vendor_name,
               rs.is_inhouse, rs.lead_time_days
        FROM process_routes pr
        JOIN route_stages rs ON pr.id = rs.route_id
        LEFT JOIN vendors v ON rs.vendor_id = v.id
        WHERE pr.is_default = 1
        ORDER BY pr.item_code, rs.sequence_no ASC
    """)
    for r in cursor.fetchall():
        icode = r["item_code"]
        if icode not in routes_by_item:
            routes_by_item[icode] = {
                "route_id": r["route_id"],
                "route_name": r["route_name"],
                "stages": [],
                "total_lead_time_days": 0
            }
        lead = r["lead_time_days"] or 1
        routes_by_item[icode]["stages"].append({
            "sequence_no": r["sequence_no"],
            "process_name": r["process_name"],
            "vendor_id": r["vendor_id"],
            "default_vendor_name": r["default_vendor_name"],
            "is_inhouse": bool(r["is_inhouse"]),
            "lead_time_days": lead
        })
        routes_by_item[icode]["total_lead_time_days"] += lead

    # 3. Fetch all BOM mappings and daily plans
    cursor.execute("""
        SELECT adp.plan_date, adp.assembly_id, adp.planned_quantity, adp.actual_quantity,
               ab.item_code, ab.consumption_qty,
               a.assembly_code, a.name as assembly_name
        FROM assembly_daily_plans adp
        JOIN assembly_bom ab ON adp.assembly_id = ab.assembly_id
        JOIN assemblies a ON adp.assembly_id = a.id
        WHERE adp.plan_date LIKE %s
        ORDER BY adp.plan_date ASC
    """, (f"{month}-%",))
    daily_bom_rows = cursor.fetchall()
    
    item_demand = {}
    for row in daily_bom_rows:
        icode = row["item_code"]
        p_date = row["plan_date"]
        planned = row["planned_quantity"] or 0
        actual = row["actual_quantity"]
        rate = row["consumption_qty"] or 1.0
        
        if icode not in item_demand:
            item_demand[icode] = {
                "daily_planned": {d: 0 for d in days_dates},
                "daily_actual": {d: None for d in days_dates},
                "total_planned": 0,
                "total_actual": 0,
                "assemblies": {}
            }
            
        p_qty = planned * rate
        item_demand[icode]["daily_planned"][p_date] += p_qty
        item_demand[icode]["total_planned"] += p_qty
        
        if actual is not None:
            a_qty = actual * rate
            if item_demand[icode]["daily_actual"][p_date] is None:
                item_demand[icode]["daily_actual"][p_date] = 0
            item_demand[icode]["daily_actual"][p_date] += a_qty
            item_demand[icode]["total_actual"] += a_qty
            
        a_code = row["assembly_code"]
        if a_code not in item_demand[icode]["assemblies"]:
            item_demand[icode]["assemblies"][a_code] = {
                "assembly_code": a_code,
                "assembly_name": row["assembly_name"],
                "consumption_rate": rate
            }
            
    # 4. Fetch all items
    cursor.execute("SELECT * FROM items ORDER BY item_code ASC")
    items = cursor.fetchall()
    
    items_result = []
    urgent_count = 0
    start_soon_count = 0
    total_planned_demand = 0
    total_actual_consumed = 0
    
    for it in items:
        icode = it["item_code"]
        route = routes_by_item.get(icode, {
            "route_id": None, "route_name": None, "stages": [], "total_lead_time_days": 3
        })
        demand = item_demand.get(icode, {
            "daily_planned": {d: 0 for d in days_dates},
            "daily_actual": {d: None for d in days_dates},
            "total_planned": 0,
            "total_actual": 0,
            "assemblies": {}
        })
        
        # Stock: Finished & WIP
        cursor.execute("""
            SELECT COALESCE(SUM(quantity_accepted), 0) FROM batches 
            WHERE item_code = %s AND (status = 'Completed' OR current_process = 'Finished Product')
        """, (icode,))
        finished_stock = get_scalar(cursor, 0)
        
        cursor.execute("""
            SELECT b.id, b.batch_no, b.quantity_accepted, b.current_process, b.current_stage_sequence,
                   b.current_vendor_id, v.name as vendor_name, b.is_inhouse, b.challan_no,
                   b.date_sent_to_vendor, b.expected_delivery_date, b.status
            FROM batches b
            LEFT JOIN vendors v ON b.current_vendor_id = v.id
            WHERE b.item_code = %s AND b.status != 'Completed' AND b.current_process != 'Finished Product'
            ORDER BY b.current_stage_sequence ASC
        """, (icode,))
        wip_batches = [dict(b) for b in cursor.fetchall()]
        wip_stock = sum(b["quantity_accepted"] for b in wip_batches)
        
        total_lead_time = route["total_lead_time_days"]
        month_planned = demand["total_planned"]
        month_actual = demand["total_actual"]
        total_planned_demand += month_planned
        total_actual_consumed += month_actual
        
        today_planned = demand["daily_planned"].get(target_date, 0)
        today_consumed = demand["daily_actual"].get(target_date)
        
        # Calculate runout date of current finished stock
        running_stock = finished_stock
        runout_date = None
        for d in days_dates:
            d_qty = demand["daily_planned"].get(d, 0)
            if d >= target_date:
                running_stock -= d_qty
                if running_stock < 0 and runout_date is None:
                    runout_date = d
                    
        # Must start date
        must_start_date = None
        days_until_start = None
        if runout_date:
            r_dt = datetime.strptime(runout_date, "%Y-%m-%d")
            start_dt = r_dt - timedelta(days=total_lead_time)
            must_start_date = start_dt.strftime("%Y-%m-%d")
            t_dt = datetime.strptime(target_date, "%Y-%m-%d")
            days_until_start = (start_dt - t_dt).days
        elif finished_stock == 0 and month_planned > 0:
            must_start_date = target_date
            days_until_start = 0
            
        # Urgency
        if (finished_stock == 0 and month_planned > 0) or (must_start_date and must_start_date <= target_date):
            urgency = "URGENT_START"
            urgency_label = "Start Immediately"
            urgent_count += 1
        elif must_start_date and days_until_start is not None and days_until_start <= 5:
            urgency = "START_SOON"
            urgency_label = f"Start by {must_start_date}"
            start_soon_count += 1
        elif month_planned > 0:
            urgency = "SUFFICIENT_COVERAGE"
            urgency_label = "Stock Buffer Covered"
        else:
            urgency = "NO_PLAN_DEMAND"
            urgency_label = "No Assembly Demand"
            
        shortfall = max(0, month_planned - (finished_stock + wip_stock))
        suggested_qty = shortfall if shortfall > 0 else (it["default_quantity"] if finished_stock == 0 else 0)
        
        items_result.append({
            "item_code": icode,
            "name": it["name"],
            "drawing_no": it["drawing_no"],
            "revision": it["revision"],
            "material_code": it["material_code"],
            "weight": it["weight"],
            "default_quantity": it["default_quantity"],
            "route_id": route["route_id"],
            "route_name": route["route_name"],
            "total_lead_time_days": total_lead_time,
            "stages": route["stages"],
            "daily_plan_quantity_today": today_planned,
            "total_month_plan_quantity": month_planned,
            "consumed_quantity_today": today_consumed,
            "total_month_consumed_quantity": month_actual,
            "daily_quantities": demand["daily_planned"],
            "daily_actuals": demand["daily_actual"],
            "current_finished_stock": finished_stock,
            "current_wip_stock": wip_stock,
            "total_available_stock": finished_stock + wip_stock,
            "wip_batches": wip_batches,
            "runout_date": runout_date,
            "must_start_date": must_start_date,
            "days_until_start": days_until_start,
            "urgency": urgency,
            "urgency_label": urgency_label,
            "suggested_start_qty": suggested_qty,
            "assemblies_using": list(demand["assemblies"].values())
        })
        
    conn.close()
    
    urgency_order = {"URGENT_START": 0, "START_SOON": 1, "SUFFICIENT_COVERAGE": 2, "NO_PLAN_DEMAND": 3}
    items_result.sort(key=lambda x: (urgency_order.get(x["urgency"], 99), -x["suggested_start_qty"]))
    
    return {
        "year_month": month,
        "target_date": target_date,
        "days": days_info,
        "summary": {
            "total_items": len(items_result),
            "urgent_start_count": urgent_count,
            "start_soon_count": start_soon_count,
            "total_planned_demand": total_planned_demand,
            "total_actual_consumed": total_actual_consumed
        },
        "items": items_result
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)



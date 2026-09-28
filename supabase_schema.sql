-- =============================================
-- SUPABASE SCHEMA: Rajtamil Jobwork Engineer OS
-- Run this in Supabase SQL Editor to create all tables
-- =============================================

-- 1. Raw Materials Master
CREATE TABLE IF NOT EXISTS raw_materials (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    form TEXT NOT NULL,
    unit TEXT NOT NULL,
    stock_quantity DOUBLE PRECISION DEFAULT 0,
    heat_number TEXT,
    unit_cost DOUBLE PRECISION DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Manufactured Items Master
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    item_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    drawing_no TEXT,
    revision TEXT,
    material_code TEXT,
    weight DOUBLE PRECISION DEFAULT 0,
    default_quantity INTEGER DEFAULT 100,
    notes TEXT,
    raw_material_name TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Vendors Master
CREATE TABLE IF NOT EXISTS vendors (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    processes_offered TEXT,
    default_lead_time_days INTEGER DEFAULT 3,
    rating DOUBLE PRECISION DEFAULT 4.5,
    notes TEXT,
    vendor_type TEXT DEFAULT 'Local'
);

-- 4. Process Routes
CREATE TABLE IF NOT EXISTS process_routes (
    id SERIAL PRIMARY KEY,
    item_code TEXT NOT NULL REFERENCES items(item_code),
    route_name TEXT NOT NULL,
    is_default INTEGER DEFAULT 1,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Route Stages
CREATE TABLE IF NOT EXISTS route_stages (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES process_routes(id) ON DELETE CASCADE,
    sequence_no INTEGER NOT NULL,
    process_name TEXT NOT NULL,
    vendor_id INTEGER REFERENCES vendors(id),
    is_inhouse INTEGER DEFAULT 0,
    lead_time_days INTEGER DEFAULT 3,
    is_welding_stage INTEGER DEFAULT 0,
    notes TEXT
);

-- 6. Welding BOM
CREATE TABLE IF NOT EXISTS welding_boms (
    id SERIAL PRIMARY KEY,
    route_stage_id INTEGER NOT NULL REFERENCES route_stages(id) ON DELETE CASCADE,
    parent_item_code TEXT NOT NULL,
    child_item_code TEXT NOT NULL,
    quantity_per_unit DOUBLE PRECISION NOT NULL,
    unit TEXT DEFAULT 'pcs',
    notes TEXT
);

-- 7. Batches / Job Orders
CREATE TABLE IF NOT EXISTS batches (
    id SERIAL PRIMARY KEY,
    batch_no TEXT UNIQUE NOT NULL,
    item_code TEXT NOT NULL REFERENCES items(item_code),
    route_id INTEGER NOT NULL REFERENCES process_routes(id),
    current_stage_sequence INTEGER NOT NULL,
    current_process TEXT NOT NULL,
    current_vendor_id INTEGER REFERENCES vendors(id),
    is_inhouse INTEGER DEFAULT 0,
    quantity_total INTEGER NOT NULL,
    quantity_accepted INTEGER NOT NULL,
    quantity_rejected INTEGER DEFAULT 0,
    raw_material_code TEXT,
    raw_material_quantity DOUBLE PRECISION,
    raw_material_unit TEXT,
    status TEXT NOT NULL,
    is_critical INTEGER DEFAULT 0,
    date_started TEXT,
    date_sent_to_vendor TEXT,
    expected_delivery_date TEXT,
    actual_delivery_date TEXT,
    challan_no TEXT,
    notes TEXT
);

-- 8. Batch Process History
CREATE TABLE IF NOT EXISTS batch_history (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
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
    remarks TEXT
);

-- 9. Vendor Delivery Follow-ups
CREATE TABLE IF NOT EXISTS vendor_followups (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    vendor_id INTEGER NOT NULL REFERENCES vendors(id),
    challan_no TEXT,
    date_contacted TEXT NOT NULL,
    contact_person TEXT,
    method TEXT DEFAULT 'Call',
    vendor_status_update TEXT NOT NULL,
    promised_date TEXT,
    notes TEXT,
    logged_by TEXT DEFAULT 'Engineer'
);

-- 10. Delivery Challans
CREATE TABLE IF NOT EXISTS delivery_challans (
    id SERIAL PRIMARY KEY,
    challan_no TEXT UNIQUE NOT NULL,
    challan_type TEXT NOT NULL,
    date TEXT NOT NULL,
    vendor_id INTEGER REFERENCES vendors(id),
    batch_id INTEGER REFERENCES batches(id),
    item_code TEXT NOT NULL,
    process_name TEXT,
    quantity INTEGER,
    weight_or_length DOUBLE PRECISION,
    unit TEXT,
    transporter TEXT,
    vehicle_no TEXT,
    remarks TEXT,
    status TEXT DEFAULT 'Open'
);

-- 11. Assemblies Master
CREATE TABLE IF NOT EXISTS assemblies (
    id SERIAL PRIMARY KEY,
    assembly_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    customer TEXT,
    drawing_no TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Assembly BOM
CREATE TABLE IF NOT EXISTS assembly_bom (
    id SERIAL PRIMARY KEY,
    assembly_id INTEGER NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
    item_code TEXT NOT NULL REFERENCES items(item_code),
    consumption_qty DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    unit TEXT DEFAULT 'pcs',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(assembly_id, item_code)
);

-- 13. Assembly Monthly Production Plans
CREATE TABLE IF NOT EXISTS assembly_monthly_plans (
    id SERIAL PRIMARY KEY,
    year_month TEXT NOT NULL,
    assembly_id INTEGER NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
    target_quantity INTEGER NOT NULL DEFAULT 0,
    working_days INTEGER DEFAULT 25,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(year_month, assembly_id)
);

-- 14. Assembly Daywise Production Plans
CREATE TABLE IF NOT EXISTS assembly_daily_plans (
    id SERIAL PRIMARY KEY,
    plan_date TEXT NOT NULL,
    assembly_id INTEGER NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
    planned_quantity INTEGER NOT NULL DEFAULT 0,
    actual_quantity INTEGER DEFAULT NULL,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plan_date, assembly_id)
);

-- 15. Stock Amendments Audit Log
CREATE TABLE IF NOT EXISTS stock_amendments (
    id SERIAL PRIMARY KEY,
    amendment_no TEXT UNIQUE NOT NULL,
    target_type TEXT NOT NULL,
    item_code TEXT,
    stage_sequence INTEGER,
    stage_name TEXT,
    raw_material_code TEXT,
    adjustment_type TEXT NOT NULL,
    quantity DOUBLE PRECISION NOT NULL,
    previous_stock DOUBLE PRECISION NOT NULL,
    new_stock DOUBLE PRECISION NOT NULL,
    reason TEXT NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Users Table for Authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'Engineer',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SEED DEFAULT USERS
-- =============================================
-- Passwords: admin123, engineer123, rajtamil123, supervisor123 (SHA-256 hashed)
INSERT INTO users (username, password_hash, full_name, role) VALUES
    ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'System Administrator', 'Admin'),
    ('engineer', 'b9a2e01ef58d02aca55e2d5413caff64da79f8e2efc42e6da46a7e0890dd57a3', 'Lead Jobwork Engineer', 'Engineer'),
    ('rajtamil', '5b2e2649dd3e6dc87a53e7c2f5302de17de57caa2352d3e7c6bcda2c0dcbb3b4', 'Rajtamil', 'Chief Operating Officer'),
    ('supervisor', 'f8c46e11b25d7da8ee7a3e7ad4d0fa38c1dd5c0dd0c6a1e6cb0de0d7be6d5c3a', 'Shopfloor Supervisor', 'Supervisor')
ON CONFLICT (username) DO NOTHING;

-- ==============================================================================
-- RAJTAMIL JOBWORK & SUBCONTRACT ENGINEERING OS
-- SUPABASE POSTGRESQL DATABASE SCHEMA & INITIAL SEED DATA
-- Copy and paste this script directly into Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. Raw Materials Master
CREATE TABLE IF NOT EXISTS raw_materials (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    form TEXT NOT NULL,           -- Round Bar, Flat, Plate, Hex, Tube
    unit TEXT NOT NULL,           -- kg, meters, mm, MT
    stock_quantity NUMERIC DEFAULT 0,
    heat_number TEXT,
    unit_cost NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Manufactured Items Master (Item code is constant: CM001)
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    item_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    drawing_no TEXT,
    revision TEXT DEFAULT 'A',
    material_code TEXT,
    raw_material_name TEXT,
    weight NUMERIC DEFAULT 0,
    default_quantity INTEGER DEFAULT 100,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
    rating NUMERIC DEFAULT 4.5,
    notes TEXT,
    vendor_type TEXT DEFAULT 'Local'
);

-- 4. Process Routes (Multiple routes possible for 1 item)
CREATE TABLE IF NOT EXISTS process_routes (
    id SERIAL PRIMARY KEY,
    item_code TEXT NOT NULL,
    route_name TEXT NOT NULL,
    is_default INTEGER DEFAULT 1,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Route Stages (Sequential steps in a route)
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
    quantity_per_unit NUMERIC NOT NULL,
    unit TEXT DEFAULT 'pcs',
    notes TEXT
);

-- 7. Batches / Job Cards
CREATE TABLE IF NOT EXISTS batches (
    id SERIAL PRIMARY KEY,
    batch_no TEXT UNIQUE NOT NULL,
    item_code TEXT NOT NULL,
    route_id INTEGER NOT NULL REFERENCES process_routes(id),
    current_stage_sequence INTEGER NOT NULL,
    current_process TEXT NOT NULL,
    current_vendor_id INTEGER REFERENCES vendors(id),
    is_inhouse INTEGER DEFAULT 0,
    quantity_total INTEGER NOT NULL,
    quantity_accepted INTEGER NOT NULL,
    quantity_rejected INTEGER DEFAULT 0,
    raw_material_code TEXT,
    raw_material_quantity NUMERIC,
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
    weight_or_length NUMERIC,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Assembly BOM
CREATE TABLE IF NOT EXISTS assembly_bom (
    id SERIAL PRIMARY KEY,
    assembly_id INTEGER NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
    item_code TEXT NOT NULL,
    consumption_qty NUMERIC NOT NULL DEFAULT 1.0,
    unit TEXT DEFAULT 'pcs',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
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
    quantity NUMERIC NOT NULL,
    previous_stock NUMERIC NOT NULL,
    new_stock NUMERIC NOT NULL,
    reason TEXT NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Users Table for Authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'Engineer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================

-- Default Users (Password: username123 or username)
INSERT INTO users (username, password_hash, full_name, role)
VALUES 
  ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'System Administrator', 'Admin'),
  ('engineer', '264e1c255bcfe1ff1cbefbf7ff37df5c5e8c156968032644265cc2f90117b079', 'Lead Jobwork Engineer', 'Engineer'),
  ('rajtamil', '60249210cfa0b322a30bbdf3228a472c3d5e2cfbe9c9ee0abf8b80d0d938b8fa', 'Rajtamil', 'Chief Operating Officer'),
  ('supervisor', 'ca390971b9c9f2ec405a39cb6ffbc3eb1b708d727bca5e396dc70a24148e6580', 'Shopfloor Supervisor', 'Supervisor')
ON CONFLICT (username) DO NOTHING;

-- Default Vendors
INSERT INTO vendors (code, name, contact_person, phone, email, address, processes_offered, default_lead_time_days, rating, vendor_type)
VALUES
  ('VND-001', 'Sri Krishna Forgings', 'K. Balaji', '+91 98401 23456', 'balaji@srikrishnaforgings.com', 'SIDCO Industrial Estate, Ambattur, Chennai', 'Forging, Normalizing, Shot Blasting', 3, 4.8, 'Trip'),
  ('VND-002', 'Precision Heat Treaters', 'S. Ramesh', '+91 94440 98765', 'ramesh@precisionheat.in', 'Phase II, Peenya Industrial Area, Bangalore', 'Hardening, Tempering, Nitriding', 4, 4.6, 'Trip'),
  ('VND-003', 'Balaji CNC Works', 'M. Saravanan', '+91 97890 11223', 'works@balajicnc.co.in', 'Coimbatore Auto Hub, Ganapathy, Coimbatore', 'CNC Turning, VMC Milling, Wire EDM', 5, 4.9, 'Local'),
  ('VND-004', 'Apex Surface Finishers', 'D. Anand', '+91 98844 55667', 'anand@apexfinish.com', 'SIPCOT, Sriperumbudur, Tamil Nadu', 'Zinc Plating, Blackodising, Passivation', 2, 4.4, 'Local')
ON CONFLICT (code) DO NOTHING;

-- Default Manufactured Items
INSERT INTO items (item_code, name, drawing_no, revision, material_code, raw_material_name, weight, default_quantity, notes)
VALUES
  ('CM001', 'Heavy Duty Drive Flange', 'DRW-CM-001', 'B', 'RM-EN8-01', 'EN8 Round Bar Dia 50mm', 3.5, 100, 'Standard drive component'),
  ('CM002', 'Spline Input Shaft', 'DRW-CM-002', 'C', 'RM-EN19-02', 'EN19 Alloy Steel Bar Dia 35mm', 2.8, 150, 'High torque spline shaft'),
  ('CM003', 'Intermediate Pinion', 'DRW-CM-003', 'A', 'RM-20MNCR5-01', '20MnCr5 Case Carburizing Steel', 1.9, 200, 'Gearbox intermediate gear')
ON CONFLICT (item_code) DO NOTHING;

import sqlite3
from datetime import datetime, timedelta
import os
from database import get_db, init_db

def seed_database():
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if items already seeded
    cursor.execute("SELECT COUNT(*) FROM items")
    items_count = cursor.fetchone()[0]
    
    # Always check and seed assemblies if missing
    seed_assemblies_if_needed(cursor, conn)
    
    if items_count > 0:
        print("Database items already seeded. Skipping initial base seed.")
        conn.close()
        return

    today = datetime.now()
    today_str = today.strftime("%Y-%m-%d")

    # 1. Seed Raw Materials (Weight / Length / Form)
    raw_materials = [
        ("RM-EN8-RD50", "EN8 Carbon Steel Round Bar Ø50mm", "EN8 / 080M40", "Round Bar", "kg", 2450.0, "HT-9842-A", 68.5, "Standard forged bar stock for pinion shafts and axles"),
        ("RM-SS304-FLAT", "SS304 Stainless Flat Bar 50x12mm", "AISI 304", "Flat Bar", "meters", 380.0, "SS-4410-B", 245.0, "Corrosion resistant mounting flange stock"),
        ("RM-MS-PL12", "Mild Steel Plate 12mm thickness", "IS 2062 Gr.B", "Plate", "kg", 4200.0, "TATA-7712", 58.0, "Used for structural brackets and gusset plates"),
        ("RM-20MNCR5-RD75", "20MnCr5 Case Hardening Round Bar Ø75mm", "20MnCr5 / SAE 5120", "Round Bar", "kg", 1850.0, "JSW-9021", 82.0, "Automotive gear steel for hobbing and carburizing"),
        ("RM-AL6061-T6", "Aluminium 6061-T6 Extruded Rod Ø40mm", "Al 6061-T6", "Round Bar", "meters", 210.0, "HIND-3011", 310.0, "Aerospace and fixture components")
    ]
    cursor.executemany("""
    INSERT INTO raw_materials (code, name, grade, form, unit, stock_quantity, heat_number, unit_cost, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, raw_materials)

    # 2. Seed Vendors (Specialized sub-contractors with lead times)
    vendors = [
        ("VND-SUN", "Sun Forgings & Stampings Ltd", "Ramesh Patel", "+91 98450 11223", "ramesh@sunforgings.com", "Plot 42, Industrial Estate Phase 2", "Forging, Upsetting, Billet Cutting", 5, 4.7, "Specializes in closed die forgings up to 25 kg"),
        ("VND-APEX", "Apex Heat Treaters & Metallurgical Services", "Mohan Sharma", "+91 98220 33445", "mohan@apexheattreat.com", "Plot 18, MIDC Central Road", "Normalizing, Annealing, Case Hardening, Quenching", 3, 4.8, "Equipped with SQF furnace and continuous mesh belt"),
        ("VND-VORTEX", "Vortex Shot Blasters & Cleaners", "Suresh Kumar", "+91 98765 44332", "info@vortexshotblast.in", "Shed No 9, GIDC Sector 3", "Shot Blasting, Sand Blasting, Pickling", 2, 4.5, "Tumble blast and hanger blast machines"),
        ("VND-STAR", "Star Precision Gears & Hobbing Works", "Rajesh M.", "+91 97110 55667", "orders@stargears.com", "C-12, Ambattur Industrial Estate", "Gear Hobbing, Shaping, Tooth Rounding", 4, 4.9, "Liebherr CNC hobbers with high pitch accuracy"),
        ("VND-ION", "Ion-Nitride Advanced Surface Tech", "Dr. S. Verma", "+91 99001 88990", "tech@ion-nitride.com", "E-4, Peenya 2nd Stage", "Plasma Nitriding, Gas Nitriding, Black Oxide", 4, 4.8, "Depth control up to 0.4mm without distortion"),
        ("VND-ARC", "ArcMaster Precision Welding & Fabrication", "Anand Rao", "+91 94430 77889", "anand@arcmaster.com", "W-7, Guindy Engineering Zone", "TIG, MIG, Robotic Welding, Stress Relieving", 3, 4.6, "ASME & AWS certified welders"),
        ("VND-METRO", "Metro BandSaw & Material Cutting Hub", "Karthik R.", "+91 98840 66778", "cutting@metrobandsaw.com", "Near Raw Material Yard 4", "Cold Saw Cutting, CNC Band Saw", 1, 4.4, "High speed batch cutting with bundle clamping")
    ]
    cursor.executemany("""
    INSERT INTO vendors (code, name, contact_person, phone, email, address, processes_offered, default_lead_time_days, rating, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, vendors)

    # 3. Seed Items (Item code constant across all states)
    items = [
        ("CM001", "Heavy Duty Flanged Pinion Shaft", "DWG-CM-001-RevC", "C", "RM-EN8-RD50", 250, "Critical automotive transmission component. Strict concentricity and hardness specs."),
        ("CM002", "Mounting Flange Collar", "DWG-CM-002-RevA", "A", "RM-SS304-FLAT", 300, "Stainless steel welded flange with tapped holes"),
        ("PL-10", "Stiffener Gusset Bracket Plate", "DWG-PL-010-B", "B", "RM-MS-PL12", 500, "Laser cut & beveled structural gusset plate for welded spindle"),
        ("CM-WELD-01", "Precision Spindle Sub-Assembly (Welded)", "DWG-SA-WELD-01", "D", "RM-MS-PL12", 50, "Heavy welded assembly combining Pinion (CM001), Flanges (CM002), and Gussets (PL-10)"),
        ("GB-702", "Helical Drive Gear Blank", "DWG-GB-702-Rev1", "1", "RM-20MNCR5-RD75", 120, "Precision ground gear blank ready for tooth cutting")
    ]
    cursor.executemany("""
    INSERT INTO items (item_code, name, drawing_no, revision, material_code, default_quantity, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, items)

    # 4. Seed Process Routes
    # Requirement 2: Multiple process routes for a single item (Standard vs Express)
    routes = [
        ("CM001", "Standard Forging & Heat Treat Route", 1, "Full 8-stage manufacturing route starting from Raw Material to Nitriding"),
        ("CM001", "Express Direct-Bar CNC Route", 0, "Fast-track bypass route for urgent small batches: Bar Machining direct without Forging"),
        ("CM-WELD-01", "Fabricated Spindle Assembly Route", 1, "Multi-component route with Welding stage consuming CM001, CM002, and PL-10"),
        ("CM002", "Stainless Flange Route", 1, "Waterjet cutting, CNC turning and drilling"),
        ("PL-10", "Gusset Plate Route", 1, "Plasma cutting, edge deburring, surface grinding")
    ]
    cursor.executemany("""
    INSERT INTO process_routes (item_code, route_name, is_default, description)
    VALUES (?, ?, ?, ?)
    """, routes)

    # Route IDs
    cursor.execute("SELECT id, item_code, route_name FROM process_routes")
    route_map = {(row[1], row[2]): row[0] for row in cursor.fetchall()}

    cm001_standard_id = route_map[("CM001", "Standard Forging & Heat Treat Route")]
    cm001_express_id = route_map[("CM001", "Express Direct-Bar CNC Route")]
    cm_weld_id = route_map[("CM-WELD-01", "Fabricated Spindle Assembly Route")]
    cm002_id = route_map[("CM002", "Stainless Flange Route")]

    # Vendor IDs
    cursor.execute("SELECT id, code FROM vendors")
    vendor_map = {row[1]: row[0] for row in cursor.fetchall()}

    # 5. Seed Route Stages
    # Requirement 4: rawmaterial -> cutting -> forging -> normalizing -> shot blasting -> machining -> hobbing -> Nitriding -> finished product
    cm001_stages = [
        (cm001_standard_id, 1, "Cutting", vendor_map["VND-METRO"], 0, 1, 0, "Bandsaw cut blanks to 220mm length with 2mm cut-off allowance"),
        (cm001_standard_id, 2, "Forging", vendor_map["VND-SUN"], 0, 5, 0, "Closed die hot forging at 1150°C to shape flange and shaft taper"),
        (cm001_standard_id, 3, "Normalizing", vendor_map["VND-APEX"], 0, 3, 0, "Furnace normalize at 880°C to refine grain structure and relieve forging stress"),
        (cm001_standard_id, 4, "Shot Blasting", vendor_map["VND-VORTEX"], 0, 2, 0, "Steel shot blasting to Grade Sa 2.5 to remove all furnace scale"),
        (cm001_standard_id, 5, "Machining", None, 1, 4, 0, "In-House CNC Turning & 4-Axis VMC milling of flange bolt circle"),
        (cm001_standard_id, 6, "Hobbing", vendor_map["VND-STAR"], 0, 4, 0, "Precision tooth cutting Module 3.5, 24 teeth, DIN 7 class"),
        (cm001_standard_id, 7, "Nitriding", vendor_map["VND-ION"], 0, 4, 0, "Plasma nitriding for case depth 0.35mm, surface hardness 62 HRC min"),
        (cm001_standard_id, 8, "Finished Product", None, 1, 1, 0, "Final CMM metrology inspection, anti-rust oiling, and carton packaging")
    ]
    cursor.executemany("""
    INSERT INTO route_stages (route_id, sequence_no, process_name, vendor_id, is_inhouse, lead_time_days, is_welding_stage, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, cm001_stages)

    # CM001 Express Route stages
    cm001_express_stages = [
        (cm001_express_id, 1, "Cutting", vendor_map["VND-METRO"], 0, 1, 0, "Cut Ø75 bar direct"),
        (cm001_express_id, 2, "CNC Heavy Turning", None, 1, 3, 0, "Turn profile directly from solid bar in-house"),
        (cm001_express_id, 3, "Hobbing", vendor_map["VND-STAR"], 0, 4, 0, "Gear hobbing"),
        (cm001_express_id, 4, "Nitriding", vendor_map["VND-ION"], 0, 4, 0, "Plasma nitriding"),
        (cm001_express_id, 5, "Finished Product", None, 1, 1, 0, "Final inspection")
    ]
    cursor.executemany("""
    INSERT INTO route_stages (route_id, sequence_no, process_name, vendor_id, is_inhouse, lead_time_days, is_welding_stage, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, cm001_express_stages)

    # CM-WELD-01 Route with WELDING STAGE
    # Requirement 8: If item have Welding in a process route, multiple items with variable quantity used
    weld_stages = [
        (cm_weld_id, 1, "Child Parts Staging", None, 1, 1, 0, "Assemble all pre-machined child components"),
        (cm_weld_id, 2, "Welding", vendor_map["VND-ARC"], 0, 3, 1, "TIG Welding of CM001 pin, CM002 flange, and PL-10 gussets on rotary fixture"),
        (cm_weld_id, 3, "Stress Relieving", vendor_map["VND-APEX"], 0, 2, 0, "Post-weld heat treatment at 600°C for 2 hours to avoid weld cracking"),
        (cm_weld_id, 4, "Finish Machining", None, 1, 3, 0, "In-House final boring of bearing seats after weld stabilization"),
        (cm_weld_id, 5, "Finished Product", None, 1, 1, 0, "DP testing on welds and final dimensional sign-off")
    ]
    cursor.executemany("""
    INSERT INTO route_stages (route_id, sequence_no, process_name, vendor_id, is_inhouse, lead_time_days, is_welding_stage, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, weld_stages)

    # CM002 Route Stages (Flange Collar - Terminates with Finished Product for Production Assembly)
    cm002_stages = [
        (cm002_id, 1, "Cutting", None, 1, 1, 0, "Band saw billet cutting"),
        (cm002_id, 2, "Machining", None, 1, 2, 0, "CNC turning & facing"),
        (cm002_id, 3, "Nitriding", vendor_map["VND-ION"], 0, 3, 0, "Surface hardening"),
        (cm002_id, 4, "Finished Product", None, 1, 1, 0, "Final CMM inspection & Finished Product ready for production assembly")
    ]
    cursor.executemany("""
    INSERT INTO route_stages (route_id, sequence_no, process_name, vendor_id, is_inhouse, lead_time_days, is_welding_stage, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, cm002_stages)

    # Get stage id for Welding
    cursor.execute("SELECT id FROM route_stages WHERE route_id = ? AND is_welding_stage = 1", (cm_weld_id,))
    weld_stage_id = cursor.fetchone()[0]

    # 6. Seed Welding BOM (Variable quantity child items per parent unit)
    welding_boms = [
        (weld_stage_id, "CM-WELD-01", "CM001", 1.0, "pcs", "Main forged & pre-machined pinion shaft (1 per assembly)"),
        (weld_stage_id, "CM-WELD-01", "CM002", 2.0, "pcs", "Mounting flange collars welded on both ends (2 per assembly)"),
        (weld_stage_id, "CM-WELD-01", "PL-10", 4.0, "pcs", "Stiffener gussets welded at 90 deg quadrants (4 per assembly)")
    ]
    cursor.executemany("""
    INSERT INTO welding_boms (route_stage_id, parent_item_code, child_item_code, quantity_per_unit, unit, notes)
    VALUES (?, ?, ?, ?, ?, ?)
    """, welding_boms)

    # 7. Seed Active Batches (Demonstrating all dashboard states & follow-up)
    # Batch 1: CM001 at Nitriding (Ion-Nitride Tech) - CRITICAL, due in 1 day
    b1_start = (today - timedelta(days=12)).strftime("%Y-%m-%d")
    b1_sent = (today - timedelta(days=3)).strftime("%Y-%m-%d")
    b1_exp = (today + timedelta(days=1)).strftime("%Y-%m-%d")

    # Batch 2: CM001 at Forging (Sun Forgings) - CRITICAL & OVERDUE by 2 days!
    b2_start = (today - timedelta(days=9)).strftime("%Y-%m-%d")
    b2_sent = (today - timedelta(days=7)).strftime("%Y-%m-%d")
    b2_exp = (today - timedelta(days=2)).strftime("%Y-%m-%d")

    # Batch 3: CM-WELD-01 at Welding (ArcMaster) - Requires child items
    b3_start = (today - timedelta(days=4)).strftime("%Y-%m-%d")
    b3_sent = (today - timedelta(days=2)).strftime("%Y-%m-%d")
    b3_exp = (today + timedelta(days=1)).strftime("%Y-%m-%d")

    # Batch 4: CM001 at Cutting (Metro Cutting) - Raw material issued
    b4_start = (today - timedelta(days=1)).strftime("%Y-%m-%d")
    b4_sent = today_str
    b4_exp = (today + timedelta(days=1)).strftime("%Y-%m-%d")

    # Batch 5: CM002 at In-House Machining
    b5_start = (today - timedelta(days=2)).strftime("%Y-%m-%d")
    b5_sent = (today - timedelta(days=1)).strftime("%Y-%m-%d")
    b5_exp = (today + timedelta(days=3)).strftime("%Y-%m-%d")

    batches = [
        ("BATCH-2026-001", "CM001", cm001_standard_id, 7, "Nitriding", vendor_map["VND-ION"], 0, 250, 248, 2, "RM-EN8-RD50", 520.0, "kg", "With Vendor", 1, b1_start, b1_sent, b1_exp, None, "DC-OUT-2026-041", "Export customer urgent shipment. High hardness required."),
        ("BATCH-2026-002", "CM001", cm001_standard_id, 2, "Forging", vendor_map["VND-SUN"], 0, 500, 500, 0, "RM-EN8-RD50", 1080.0, "kg", "With Vendor", 1, b2_start, b2_sent, b2_exp, None, "DC-OUT-2026-035", "OVERDUE! Delay reported by vendor due to power outage. Follow up actively."),
        ("BATCH-2026-003", "CM-WELD-01", cm_weld_id, 2, "Welding", vendor_map["VND-ARC"], 0, 50, 50, 0, "RM-MS-PL12", 340.0, "kg", "With Vendor", 0, b3_start, b3_sent, b3_exp, None, "DC-OUT-2026-048", "Welding 50 spindle assemblies using CM001, CM002 and PL-10 components."),
        ("BATCH-2026-004", "CM001", cm001_standard_id, 1, "Cutting", vendor_map["VND-METRO"], 0, 150, 150, 0, "RM-EN8-RD50", 315.0, "kg", "With Vendor", 0, b4_start, b4_sent, b4_exp, None, "DC-OUT-2026-052", "Raw material sent for cutting into 150 billets."),
        ("BATCH-2026-005", "CM002", cm002_id, 2, "Machining", None, 1, 300, 295, 5, "RM-SS304-FLAT", 120.0, "meters", "In Process", 0, b5_start, b5_sent, b5_exp, None, "INT-WO-092", "In-house CNC turning and drilling on lathe 2")
    ]
    cursor.executemany("""
    INSERT INTO batches (batch_no, item_code, route_id, current_stage_sequence, current_process, current_vendor_id, is_inhouse, quantity_total, quantity_accepted, quantity_rejected, raw_material_code, raw_material_quantity, raw_material_unit, status, is_critical, date_started, date_sent_to_vendor, expected_delivery_date, actual_delivery_date, challan_no, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, batches)

    # Query batch ids
    cursor.execute("SELECT id, batch_no FROM batches")
    batch_map = {row[1]: row[0] for row in cursor.fetchall()}
    b1_id = batch_map["BATCH-2026-001"]
    b2_id = batch_map["BATCH-2026-002"]
    b3_id = batch_map["BATCH-2026-003"]
    b4_id = batch_map["BATCH-2026-004"]

    # 8. Seed Batch History for BATCH-2026-001 (showing its trail through Cutting -> Forging -> Normalizing -> Shot Blasting -> Machining -> Hobbing)
    history = [
        (b1_id, 1, "Cutting", vendor_map["VND-METRO"], 0, 250, 250, 0, (today - timedelta(days=12)).strftime("%Y-%m-%d"), (today - timedelta(days=11)).strftime("%Y-%m-%d"), "DC-IN-001", "DC-OUT-001", "Cut perfectly to 220mm"),
        (b1_id, 2, "Forging", vendor_map["VND-SUN"], 0, 250, 250, 0, (today - timedelta(days=11)).strftime("%Y-%m-%d"), (today - timedelta(days=7)).strftime("%Y-%m-%d"), "DC-IN-002", "DC-OUT-002", "Forging grain flow inspected ok"),
        (b1_id, 3, "Normalizing", vendor_map["VND-APEX"], 0, 250, 250, 0, (today - timedelta(days=7)).strftime("%Y-%m-%d"), (today - timedelta(days=5)).strftime("%Y-%m-%d"), "DC-IN-003", "DC-OUT-003", "Hardness 180-200 HB achieved"),
        (b1_id, 4, "Shot Blasting", vendor_map["VND-VORTEX"], 0, 250, 250, 0, (today - timedelta(days=5)).strftime("%Y-%m-%d"), (today - timedelta(days=4)).strftime("%Y-%m-%d"), "DC-IN-004", "DC-OUT-004", "Scale free surface"),
        (b1_id, 5, "Machining", None, 1, 250, 249, 1, (today - timedelta(days=4)).strftime("%Y-%m-%d"), (today - timedelta(days=3)).strftime("%Y-%m-%d"), "INT-01", "INT-02", "1 pc tool chip scrap"),
        (b1_id, 6, "Hobbing", vendor_map["VND-STAR"], 0, 249, 248, 1, (today - timedelta(days=3)).strftime("%Y-%m-%d"), (today - timedelta(days=3)).strftime("%Y-%m-%d"), "DC-IN-005", "DC-OUT-005", "Tooth runout within 0.015mm")
    ]
    cursor.executemany("""
    INSERT INTO batch_history (batch_id, stage_sequence, process_name, vendor_id, is_inhouse, quantity_in, quantity_out, quantity_rejected, date_in, date_out, challan_in, challan_out, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, history)

    # 9. Seed Vendor Delivery Follow-up Logs (Requirement: follow up for delivery when sent to vendor)
    followups = [
        (b2_id, vendor_map["VND-SUN"], "DC-OUT-2026-035", (today - timedelta(days=3)).strftime("%Y-%m-%d"), "Ramesh Patel", "Call", "Forging billets pre-heated, forging on 2-ton hammer scheduled for tomorrow.", (today - timedelta(days=2)).strftime("%Y-%m-%d"), "Initial check-in call"),
        (b2_id, vendor_map["VND-SUN"], "DC-OUT-2026-035", (today - timedelta(days=1)).strftime("%Y-%m-%d"), "Ramesh Patel", "WhatsApp", "Power substation maintenance caused 24h shutdown. 380/500 pieces forged. Quenching now.", today_str, "Delay warning issued to vendor"),
        (b2_id, vendor_map["VND-SUN"], "DC-OUT-2026-035", today_str, "Ramesh Patel", "Call", "Vendor promised remaining 120 pcs will be forged by 3 PM and dispatched by tonight's truck.", (today + timedelta(days=1)).strftime("%Y-%m-%d"), "URGENT delivery follow-up - promised tomorrow morning dispatch")
    ]
    cursor.executemany("""
    INSERT INTO vendor_followups (batch_id, vendor_id, challan_no, date_contacted, contact_person, method, vendor_status_update, promised_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, followups)

    # 10. Seed Delivery Challans (Outward DC for tracking materials sent to vendor)
    challans = [
        ("DC-OUT-2026-035", "Outward to Vendor", (today - timedelta(days=7)).strftime("%Y-%m-%d"), vendor_map["VND-SUN"], b2_id, "CM001", "Forging", 500, 1080.0, "kg", "VRL Logistics", "KA-01-E-9041", "Material sent: 1080 kg of cut billets for forging into CM001 shaft", "Open"),
        ("DC-OUT-2026-041", "Outward to Vendor", (today - timedelta(days=3)).strftime("%Y-%m-%d"), vendor_map["VND-ION"], b1_id, "CM001", "Nitriding", 248, 515.0, "kg", "Direct Tempo", "TN-09-AK-3312", "Finish hobbed gears sent for plasma nitriding 0.35mm depth", "Open"),
        ("DC-OUT-2026-048", "Outward to Vendor", (today - timedelta(days=2)).strftime("%Y-%m-%d"), vendor_map["VND-ARC"], b3_id, "CM-WELD-01", "Welding", 50, 340.0, "kg", "Internal Transport", "DL-1V-5544", "Sent: 50 pcs CM001 + 100 pcs CM002 + 200 pcs PL-10 for weld assembly", "Open"),
        ("DC-OUT-2026-052", "Outward to Vendor", today_str, vendor_map["VND-METRO"], b4_id, "CM001", "Cutting", 150, 315.0, "kg", "Tempo", "MH-12-Q-7788", "Raw bar stock RM-EN8-RD50 sent for cutting into billets", "Open")
    ]
    cursor.executemany("""
    INSERT INTO delivery_challans (challan_no, challan_type, date, vendor_id, batch_id, item_code, process_name, quantity, weight_or_length, unit, transporter, vehicle_no, remarks, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, challans)

    # 11. Seed Assemblies & Assembly BOM (Consumption Mapping)
    seed_assemblies_if_needed(cursor, conn)

    conn.commit()
    conn.close()
    print("Database successfully seeded with realistic industrial jobwork data.")

def seed_assemblies_if_needed(cursor, conn):
    today = datetime.now()
    cursor.execute("SELECT COUNT(*) FROM assemblies")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO assemblies (assembly_code, name, description, customer, drawing_no)
        VALUES 
        ('CM101A6', 'Heavy Transmission Drive Assembly', 'Main gearbox pinion and flange assembly', 'Apex Transmissions', 'DWG-ASM-101A6'),
        ('CM101A7', 'Extended Reduction Spindle Assembly', 'High-torque dual-flange reduction spindle', 'Apex Transmissions', 'DWG-ASM-101A7')
        """)
        
        cursor.execute("SELECT id, assembly_code FROM assemblies")
        asm_map = {row[1]: row[0] for row in cursor.fetchall()}
        
        # User requirement:
        # cm001 used for CM101A6 with consumption quantity is 1
        # cm002 used for CM101A6 and CM101A7 with consumption quantity is 2 for a single assembly
        cursor.execute("""
        INSERT INTO assembly_bom (assembly_id, item_code, consumption_qty, unit, notes)
        VALUES
        (?, 'CM001', 1.0, 'pcs', 'Main flanged pinion shaft (1 pc/assembly)'),
        (?, 'CM002', 2.0, 'pcs', 'Dual collar mounting flanges (2 pcs/assembly)'),
        (?, 'CM002', 2.0, 'pcs', 'Front and rear spacer flanges (2 pcs/assembly)')
        """, (asm_map['CM101A6'], asm_map['CM101A6'], asm_map['CM101A7']))

        # Seed Current Month Production Plans
        current_ym = today.strftime("%Y-%m")
        cursor.execute("""
        INSERT INTO assembly_monthly_plans (year_month, assembly_id, target_quantity, working_days, notes)
        VALUES
        (?, ?, 250, 25, 'Standard monthly OEM delivery commitment'),
        (?, ?, 200, 25, 'Scheduled export shipment')
        """, (current_ym, asm_map['CM101A6'], current_ym, asm_map['CM101A7']))

        # Distribute daywise plan for working days of current month
        import calendar
        year, month = today.year, today.month
        num_days = calendar.monthrange(year, month)[1]
        
        daily_entries = []
        for day in range(1, num_days + 1):
            d_date = datetime(year, month, day)
            # Working days: Monday (0) to Friday/Saturday (0-5)
            if d_date.weekday() < 6:
                date_str = d_date.strftime("%Y-%m-%d")
                daily_entries.append((date_str, asm_map['CM101A6'], 10, 'Target: 10 units/day'))
                daily_entries.append((date_str, asm_map['CM101A7'], 8, 'Target: 8 units/day'))

        cursor.executemany("""
        INSERT INTO assembly_daily_plans (plan_date, assembly_id, planned_quantity, notes)
        VALUES (?, ?, ?, ?)
        """, daily_entries)
        conn.commit()
        print("Assemblies, BOM mappings (CM001, CM002), and Production Plans successfully seeded.")

if __name__ == "__main__":
    seed_database()


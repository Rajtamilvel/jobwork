import sqlite3

conn = sqlite3.connect('f:/jo1/backend/jobwork.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()
c.execute("SELECT id, batch_no, item_code, current_stage_sequence, current_process, current_vendor_id, quantity_total, quantity_accepted, status, challan_no FROM batches WHERE batch_no LIKE '%2026-002%'")
for r in c.fetchall():
    print(dict(r))

c.execute("SELECT * FROM batch_history WHERE batch_id = 2")
for r in c.fetchall():
    print("History:", dict(r))

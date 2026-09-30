import sqlite3
import os
import sys
from datetime import datetime, timedelta, timezone

def main():
    print("Connecting to vigitra.db with timeout...", flush=True)
    conn = sqlite3.connect('vigitra.db', timeout=15)
    c = conn.cursor()

    c.execute('SELECT id FROM cameras')
    cam_ids = [r[0] for r in c.fetchall()] or [1]

    evidence_dir = 'storage/evidence'
    ev_files = []
    if os.path.exists(evidence_dir):
        ev_files = [f'/storage/evidence/{f}' for f in os.listdir(evidence_dir) if f.endswith(('.jpg', '.png'))]
    if not ev_files:
        ev_files = ['/sample_traffic.mp4']

    violations_to_seed = [
        # WITHOUT_HELMET
        ('WITHOUT_HELMET', 'TNXX1234', 0.94, 'Review', 15),
        ('WITHOUT_HELMET', 'TNXX5678', 0.97, 'Verified', 32),
        ('WITHOUT_HELMET', 'TNXX9012', 0.91, 'Review', 48),
        ('WITHOUT_HELMET', 'KA05MN3821', 0.96, 'Verified', 65),
        ('WITHOUT_HELMET', 'TN07CK7788', 0.93, 'Pending', 90),
        ('WITHOUT_HELMET', 'KA51Z1234', 0.95, 'Review', 120),

        # WITHOUT_SEATBELT
        ('WITHOUT_SEATBELT', 'TN01AB1234', 0.92, 'Review', 25),
        ('WITHOUT_SEATBELT', 'DL02CP9012', 0.95, 'Verified', 55),
        ('WITHOUT_SEATBELT', 'TS08EE8899', 0.89, 'Pending', 80),
        ('WITHOUT_SEATBELT', 'TNXX1001', 0.94, 'Verified', 110),

        # SIGNAL_JUMP
        ('SIGNAL_JUMP', 'TN01AB1234', 0.98, 'Verified', 10),
        ('SIGNAL_JUMP', 'MH12DE5678', 0.95, 'Review', 40),
        ('SIGNAL_JUMP', 'HR26BC9999', 0.96, 'Verified', 70),
        ('SIGNAL_JUMP', 'KL07CD3333', 0.93, 'Pending', 105),
        ('SIGNAL_JUMP', 'TNXX1003', 0.97, 'Review', 135),

        # WRONG_LANE
        ('WRONG_LANE', 'WB02EF7777', 0.91, 'Review', 35),
        ('WRONG_LANE', 'TS09FA9999', 0.94, 'Verified', 75),
        ('WRONG_LANE', 'GA01C8888', 0.88, 'Pending', 115),

        # WRONG_WAY
        ('WRONG_WAY', 'OR02XY4321', 0.96, 'Verified', 20),
        ('WRONG_WAY', 'MP09AB3456', 0.93, 'Review', 60),
        ('WRONG_WAY', 'CH01AB3333', 0.95, 'Verified', 130),

        # SPEED_VIOLATION
        ('SPEED_VIOLATION', 'DL02CP9012', 0.99, 'Verified', 18),
        ('SPEED_VIOLATION', 'KA02MB8080', 0.95, 'Review', 50),
        ('SPEED_VIOLATION', 'HR51AU2345', 0.92, 'Pending', 95),
        ('SPEED_VIOLATION', 'TS09FA9999', 0.97, 'Verified', 140),

        # ILLEGAL_PARKING
        ('ILLEGAL_PARKING', 'GJ01AB5555', 0.94, 'Review', 45),
        ('ILLEGAL_PARKING', 'MH14GH9000', 0.90, 'Pending', 85),
        ('ILLEGAL_PARKING', 'KL11BH2020', 0.95, 'Verified', 125),

        # STOLEN_VEHICLES
        ('STOLEN_VEHICLES', 'KA05MN3821', 0.98, 'Verified', 12),
        ('STOLEN_VEHICLES', 'TN09BZ9999', 0.96, 'Verified', 62),
        ('STOLEN_VEHICLES', 'TNXX1002', 0.95, 'Review', 100),

        # CHALLAN_DEFAULTER
        ('CHALLAN_DEFAULTER', 'TN01AB1234', 0.97, 'Verified', 8),
        ('CHALLAN_DEFAULTER', 'TNXX1004', 0.93, 'Review', 72),

        # SECURITY_WATCHLIST
        ('SECURITY_WATCHLIST', 'MH12PQ9999', 0.99, 'Verified', 14),
        ('SECURITY_WATCHLIST', 'DL03CC4455', 0.94, 'Review', 88)
    ]

    now = datetime.now(timezone.utc)
    seeded_count = 0
    for idx, (cat, plate, conf, stat, min_ago) in enumerate(violations_to_seed):
        t = (now - timedelta(minutes=min_ago)).strftime('%Y-%m-%d %H:%M:%S.%f')
        cam_id = cam_ids[idx % len(cam_ids)]
        ev_img = ev_files[idx % len(ev_files)]
        
        c.execute('SELECT id FROM violations WHERE violation_type = ? AND license_plate = ?', (cat, plate))
        if not c.fetchone():
            c.execute('''
                INSERT INTO violations (violation_type, camera_id, license_plate, confidence, evidence_image, status, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (cat, cam_id, plate, conf, ev_img, stat, t))
            seeded_count += 1

    conn.commit()
    print(f"Successfully seeded {seeded_count} violations into vigitra.db", flush=True)

    c.execute('SELECT violation_type, count(*) FROM violations GROUP BY violation_type')
    for r in c.fetchall():
        print(f"  {r[0]}: {r[1]}", flush=True)
    conn.close()

if __name__ == '__main__':
    main()

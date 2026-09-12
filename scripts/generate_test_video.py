import cv2
import numpy as np
import os
import shutil

def draw_front_angle_vehicle(frame, x, y, scale, vtype, plate, color, step=0, is_emergency=False):
    """
    Renders a realistic front-angle vehicle (as captured by a camera elevated on a signal post).
    Shows: Front windshield with gradient, vehicle hood, dual headlights with beam glow,
    front radiator grille, front bumper, and centered front Indian license plate.
    """
    height, width = frame.shape[:2]
    
    # Scale width & height based on distance perspective
    base_w = 200 if vtype == "BUS" else 170 if vtype == "SUV" else 150
    base_h = 150 if vtype == "BUS" else 125 if vtype == "SUV" else 105
    
    vw = max(24, int(base_w * scale))
    vh = max(18, int(base_h * scale))
    vx = int(x - vw // 2)
    vy = int(y - vh * 0.75)
    
    if vy + vh >= height or vx + vw >= width or vx < 0:
        return

    # 1. Headlight Beams illuminating asphalt
    beam_h = int(90 * scale)
    beam_w = int(45 * scale)
    left_light_x = vx + int(vw * 0.18)
    right_light_x = vx + int(vw * 0.82)
    light_y = vy + int(vh * 0.65)
    
    pts_left = np.array([[left_light_x, light_y],
                         [left_light_x - beam_w, light_y + beam_h],
                         [left_light_x + int(beam_w * 0.4), light_y + beam_h]], np.int32)
    pts_right = np.array([[right_light_x, light_y],
                          [right_light_x - int(beam_w * 0.4), light_y + beam_h],
                          [right_light_x + beam_w, light_y + beam_h]], np.int32)
    
    overlay = frame.copy()
    cv2.fillPoly(overlay, [pts_left], (180, 230, 255))
    cv2.fillPoly(overlay, [pts_right], (180, 230, 255))
    cv2.addWeighted(overlay, 0.25, frame, 0.75, 0, frame)

    # 2. Vehicle Body Shadow
    cv2.ellipse(frame, (int(x), vy + vh), (int(vw * 0.55), int(vh * 0.15)), 0, 0, 360, (15, 15, 15), -1)

    # 3. Front Tires
    tire_w = max(3, int(16 * scale))
    tire_h = max(4, int(24 * scale))
    cv2.rectangle(frame, (vx + int(vw * 0.08), vy + vh - tire_h),
                  (vx + int(vw * 0.08) + tire_w, vy + vh), (10, 10, 10), -1)
    cv2.rectangle(frame, (vx + vw - int(vw * 0.08) - tire_w, vy + vh - tire_h),
                  (vx + vw - int(vw * 0.08), vy + vh), (10, 10, 10), -1)

    # 4. Lower Body / Bumper
    body_col = (250, 250, 250) if is_emergency else color
    cv2.rectangle(frame, (vx + int(vw * 0.06), vy + int(vh * 0.45)),
                  (vx + int(vw * 0.94), vy + int(vh * 0.95)), body_col, -1)

    # 5. Windshield Glass (Slanted front perspective)
    ws_w = int(vw * 0.72)
    ws_h = int(vh * 0.38)
    ws_x = vx + int((vw - ws_w) // 2)
    ws_y = vy + int(vh * 0.14)
    
    ws_pts = np.array([
        [ws_x + int(ws_w * 0.18), ws_y],
        [ws_x + int(ws_w * 0.82), ws_y],
        [ws_x + ws_w, ws_y + ws_h],
        [ws_x, ws_y + ws_h]
    ], np.int32)
    cv2.fillPoly(frame, [ws_pts], (40, 30, 25)) # Deep tinted glass

    # Roof
    roof_pts = np.array([
        [ws_x + int(ws_w * 0.18), ws_y],
        [ws_x + int(ws_w * 0.82), ws_y],
        [ws_x + int(ws_w * 0.76), vy + 2],
        [ws_x + int(ws_w * 0.24), vy + 2]
    ], np.int32)
    cv2.fillPoly(frame, [roof_pts], body_col)

    # 6. Radiator Grille
    grille_w = int(vw * 0.46)
    grille_h = int(vh * 0.20)
    grille_x = vx + int((vw - grille_w) // 2)
    grille_y = vy + int(vh * 0.58)
    cv2.rectangle(frame, (grille_x, grille_y), (grille_x + grille_w, grille_y + grille_h), (25, 25, 25), -1)
    cv2.rectangle(frame, (grille_x, grille_y), (grille_x + grille_w, grille_y + grille_h), (80, 80, 80), 1)

    # 7. Dual Headlights
    lamp_w = max(4, int(18 * scale))
    lamp_h = max(3, int(10 * scale))
    lamp_y = vy + int(vh * 0.52)
    cv2.rectangle(frame, (vx + int(vw * 0.10), lamp_y),
                  (vx + int(vw * 0.10) + lamp_w, lamp_y + lamp_h), (120, 255, 255), -1)
    cv2.rectangle(frame, (vx + vw - int(vw * 0.10) - lamp_w, lamp_y),
                  (vx + vw - int(vw * 0.10), lamp_y + lamp_h), (120, 255, 255), -1)

    # 8. Emergency Strobe Lightbar (If Ambulance/Police)
    if is_emergency:
        bar_y = max(0, vy - int(8 * scale))
        bar_h = max(3, int(7 * scale))
        strobe_col = (0, 0, 255) if (step // 6) % 2 == 0 else (255, 0, 0)
        cv2.rectangle(frame, (vx + int(vw * 0.32), bar_y),
                      (vx + int(vw * 0.68), bar_y + bar_h), strobe_col, -1)
        # Red cross on hood
        cross_s = max(4, int(14 * scale))
        cx = vx + vw // 2
        cy = vy + int(vh * 0.44)
        cv2.rectangle(frame, (cx - cross_s // 2, cy - cross_s // 6), (cx + cross_s // 2, cy + cross_s // 6), (0, 0, 220), -1)
        cv2.rectangle(frame, (cx - cross_s // 6, cy - cross_s // 2), (cx + cross_s // 6, cy + cross_s // 2), (0, 0, 220), -1)

    # 9. Centered Front Indian License Plate (HSRP format)
    plate_w = max(26, int(vw * 0.44))
    plate_h = max(9, int(vh * 0.16))
    plate_x = vx + int((vw - plate_w) // 2)
    plate_y = vy + int(vh * 0.78)

    cv2.rectangle(frame, (plate_x, plate_y), (plate_x + plate_w, plate_y + plate_h), (255, 255, 255), -1)
    cv2.rectangle(frame, (plate_x, plate_y), (plate_x + plate_w, plate_y + plate_h), (0, 0, 0), 1)
    # Blue IND band on left
    ind_w = max(2, int(plate_w * 0.15))
    cv2.rectangle(frame, (plate_x, plate_y), (plate_x + ind_w, plate_y + plate_h), (200, 50, 20), -1)

    if scale > 0.42:
        cv2.putText(frame, plate, (plate_x + ind_w + 2, plate_y + plate_h - 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.28 * scale / 0.6, (0, 0, 0), 1)


def draw_perspective_road_and_signal(frame, step=0):
    """Draws front-angle asphalt road with perspective convergence, stop line, zebra crossing, and signal post."""
    height, width = frame.shape[:2]
    horizon_y = int(height * 0.35)
    
    # 1. Sky & Horizon
    cv2.rectangle(frame, (0, 0), (width, horizon_y), (35, 25, 20), -1)
    # Distant skyline
    skyline = [(0.05, 0.08, 35), (0.16, 0.07, 50), (0.28, 0.09, 30),
               (0.68, 0.08, 45), (0.78, 0.09, 55), (0.88, 0.08, 38)]
    for bx, bw, bh in skyline:
        cv2.rectangle(frame, (int(width * bx), horizon_y - bh),
                      (int(width * (bx + bw)), horizon_y), (25, 18, 15), -1)
    
    # 2. Road Surface Trapezoid
    road_top_w = int(width * 0.28)
    road_bot_w = int(width * 0.94)
    cx = width // 2
    
    top_l, top_r = cx - road_top_w // 2, cx + road_top_w // 2
    bot_l, bot_r = cx - road_bot_w // 2, cx + road_bot_w // 2
    
    road_pts = np.array([[top_l, horizon_y], [top_r, horizon_y], [bot_r, height], [bot_l, height]], np.int32)
    cv2.fillPoly(frame, [road_pts], (38, 38, 38)) # Dark asphalt

    # Curbs & Yellow Edge Lines
    cv2.line(frame, (top_l, horizon_y), (bot_l, height), (0, 180, 240), 2)
    cv2.line(frame, (top_r, horizon_y), (bot_r, height), (0, 180, 240), 2)

    # 3. Converging Lane Dividers (3 Lanes)
    for l in [1, 2]:
        ratio = l / 3.0
        tl = top_l + int((top_r - top_l) * ratio)
        bl = bot_l + int((bot_r - bot_l) * ratio)
        
        segments = 14
        for s in range(segments):
            t1 = (s / segments) + ((step * 0.008) % (1 / segments))
            t2 = min(1.0, t1 + 0.035 * (0.3 + 0.7 * t1))
            if t1 >= 1.0:
                continue
            sy1 = int(horizon_y + (height - horizon_y) * t1)
            sx1 = int(tl + (bl - tl) * t1)
            sy2 = int(horizon_y + (height - horizon_y) * t2)
            sx2 = int(tl + (bl - tl) * t2)
            cv2.line(frame, (sx1, sy1), (sx2, sy2), (220, 220, 220), max(1, int(4 * t1)))

    # 4. Stop Line & Zebra Crossing
    stop_y = int(height * 0.82)
    s_left = int(top_l + (bot_l - top_l) * ((stop_y - horizon_y) / (height - horizon_y)))
    s_right = int(top_r + (bot_r - top_r) * ((stop_y - horizon_y) / (height - horizon_y)))
    cv2.line(frame, (s_left, stop_y), (s_right, stop_y), (255, 255, 255), 5)
    
    # Zebra Crossing Stripes
    zebra_y1 = stop_y + 10
    zebra_y2 = min(height - 6, stop_y + 45)
    for zi in range(12):
        zt = zi / 12.0
        zx1 = int(s_left + (s_right - s_left) * zt)
        zx2 = int(bot_l + (bot_r - bot_l) * zt)
        cv2.line(frame, (zx1, zebra_y1), (zx2, zebra_y2), (180, 180, 180), 6)

    # 5. Signal Post Mast & Cantilever on Right Shoulder
    pole_x = min(width - 15, bot_r + 20)
    pole_top_y = horizon_y - 70
    cv2.rectangle(frame, (pole_x, pole_top_y), (pole_x + 8, height), (70, 70, 70), -1)
    arm_end = max(cx + 40, top_r)
    cv2.rectangle(frame, (arm_end, pole_top_y), (pole_x + 8, pole_top_y + 6), (50, 50, 50), -1)
    
    # Signal Head (Red, Amber, Green)
    sh_x = arm_end + 30
    sh_y = pole_top_y + 8
    cv2.rectangle(frame, (sh_x, sh_y), (sh_x + 20, sh_y + 50), (15, 15, 15), -1)
    cv2.rectangle(frame, (sh_x, sh_y), (sh_x + 20, sh_y + 50), (70, 70, 70), 1)
    # Green signal active
    cv2.circle(frame, (sh_x + 10, sh_y + 10), 5, (20, 20, 60), -1)
    cv2.circle(frame, (sh_x + 10, sh_y + 25), 5, (20, 60, 60), -1)
    cv2.circle(frame, (sh_x + 10, sh_y + 40), 5, (0, 220, 60), -1)


def create_urban_traffic_video(output_path: str = "sample_traffic_urban.mp4", duration_sec: int = 12, fps: int = 30):
    print(f"Generating Urban Traffic Front-Angle Video: {output_path}...")
    width, height = 640, 480
    fourcc = cv2.VideoWriter.fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    total_frames = duration_sec * fps
    horizon_y = int(height * 0.35)
    cx = width // 2
    top_l, top_r = cx - int(width * 0.14), cx + int(width * 0.14)
    bot_l, bot_r = cx - int(width * 0.47), cx + int(width * 0.47)

    vehicles = [
        {"lane": 0, "speed": 0.0042, "offset": 0.05, "vtype": "CAR", "plate": "TN01AB1234", "color": (180, 80, 40)},
        {"lane": 1, "speed": 0.0031, "offset": 0.38, "vtype": "BUS", "plate": "KA05MN3821", "color": (40, 140, 220)},
        {"lane": 2, "speed": 0.0048, "offset": 0.65, "vtype": "SUV", "plate": "TN09BZ9999", "color": (50, 160, 60)},
        {"lane": 1, "speed": 0.0039, "offset": 0.85, "vtype": "CAR", "plate": "DL02CP9012", "color": (160, 60, 180)}
    ]

    for frame_idx in range(total_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        draw_perspective_road_and_signal(frame, step=frame_idx)

        # Draw vehicles sorted by distance
        active_v = []
        for v in vehicles:
            t = (frame_idx * v["speed"] + v["offset"]) % 1.0
            if 0.05 < t < 0.98:
                active_v.append((t, v))
        active_v.sort(key=lambda x: x[0])

        for t, v in active_v:
            y = horizon_y + (height - horizon_y) * t
            scale = 0.22 + 0.78 * (t ** 1.45)
            lane_ratio = (v["lane"] + 0.5) / 3.0
            tl = top_l + (top_r - top_l) * lane_ratio
            bl = bot_l + (bot_r - bot_l) * lane_ratio
            x = tl + (bl - tl) * t
            draw_front_angle_vehicle(frame, x, y, scale, v["vtype"], v["plate"], v["color"], step=frame_idx)

        # Real CCTV Camera Watermark (Signal Post Elevation 5.8m)
        cv2.putText(frame, "CAM-01 ANNA SALAI NORTH • SIGNAL POST ELEV 5.8m • LIVE", (15, 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 200), 1)
        out.write(frame)

    out.release()
    print("Urban traffic video generated successfully.")


def create_highway_traffic_video(output_path: str = "sample_traffic_highway.mp4", duration_sec: int = 12, fps: int = 30):
    print(f"Generating Highway Traffic Front-Angle Video: {output_path}...")
    width, height = 640, 480
    fourcc = cv2.VideoWriter.fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    total_frames = duration_sec * fps
    horizon_y = int(height * 0.35)
    cx = width // 2
    top_l, top_r = cx - int(width * 0.14), cx + int(width * 0.14)
    bot_l, bot_r = cx - int(width * 0.47), cx + int(width * 0.47)

    vehicles = [
        {"lane": 0, "speed": 0.0055, "offset": 0.02, "vtype": "SUV", "plate": "KA01TR9999", "color": (80, 80, 180)},
        {"lane": 1, "speed": 0.0068, "offset": 0.30, "vtype": "CAR", "plate": "HR26BC9999", "color": (200, 120, 50)},
        {"lane": 2, "speed": 0.0060, "offset": 0.60, "vtype": "CAR", "plate": "MH12DE5678", "color": (50, 180, 120)}
    ]

    for frame_idx in range(total_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        draw_perspective_road_and_signal(frame, step=frame_idx)

        active_v = []
        for v in vehicles:
            t = (frame_idx * v["speed"] + v["offset"]) % 1.0
            if 0.05 < t < 0.98:
                active_v.append((t, v))
        active_v.sort(key=lambda x: x[0])

        for t, v in active_v:
            y = horizon_y + (height - horizon_y) * t
            scale = 0.22 + 0.78 * (t ** 1.45)
            lane_ratio = (v["lane"] + 0.5) / 3.0
            tl = top_l + (top_r - top_l) * lane_ratio
            bl = bot_l + (bot_r - bot_l) * lane_ratio
            x = tl + (bl - tl) * t
            draw_front_angle_vehicle(frame, x, y, scale, v["vtype"], v["plate"], v["color"], step=frame_idx)

        cv2.putText(frame, "CAM-04 EXPRESSWAY HIGHWAY • FRONT-FACING APPROACH", (15, 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 120), 1)
        out.write(frame)

    out.release()
    print("Highway traffic video generated successfully.")


def create_emergency_traffic_video(output_path: str = "sample_traffic_emergency.mp4", duration_sec: int = 12, fps: int = 30):
    print(f"Generating Emergency Green Wave Front-Angle Video: {output_path}...")
    width, height = 640, 480
    fourcc = cv2.VideoWriter.fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    total_frames = duration_sec * fps
    horizon_y = int(height * 0.35)
    cx = width // 2
    top_l, top_r = cx - int(width * 0.14), cx + int(width * 0.14)
    bot_l, bot_r = cx - int(width * 0.47), cx + int(width * 0.47)

    vehicles = [
        {"lane": 1, "speed": 0.0065, "offset": 0.08, "vtype": "AMBULANCE", "plate": "TN07EM108", "color": (255, 255, 255), "is_emergency": True},
        {"lane": 0, "speed": 0.0035, "offset": 0.42, "vtype": "CAR", "plate": "KA05MN3821", "color": (160, 80, 40), "is_emergency": False},
        {"lane": 2, "speed": 0.0038, "offset": 0.70, "vtype": "CAR", "plate": "TN01EM9999", "color": (60, 60, 180), "is_emergency": False}
    ]

    for frame_idx in range(total_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        draw_perspective_road_and_signal(frame, step=frame_idx)

        active_v = []
        for v in vehicles:
            t = (frame_idx * v["speed"] + v["offset"]) % 1.0
            if 0.05 < t < 0.98:
                active_v.append((t, v))
        active_v.sort(key=lambda x: x[0])

        for t, v in active_v:
            y = horizon_y + (height - horizon_y) * t
            scale = 0.22 + 0.78 * (t ** 1.45)
            lane_ratio = (v["lane"] + 0.5) / 3.0
            tl = top_l + (top_r - top_l) * lane_ratio
            bl = bot_l + (bot_r - bot_l) * lane_ratio
            x = tl + (bl - tl) * t
            draw_front_angle_vehicle(frame, x, y, scale, v["vtype"], v["plate"], v["color"], step=frame_idx, is_emergency=v.get("is_emergency", False))

        cv2.putText(frame, "CAM-03 EMERGENCY PREEMPTION CORRIDOR • SIGNAL POST #03", (15, 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 120, 255), 1)
        out.write(frame)

    out.release()
    print("Emergency green wave traffic video generated successfully.")


def create_congested_traffic_video(output_path: str = "sample_traffic_congested.mp4", duration_sec: int = 12, fps: int = 30):
    print(f"Generating Congested Traffic Front-Angle Video: {output_path}...")
    width, height = 640, 480
    fourcc = cv2.VideoWriter.fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    total_frames = duration_sec * fps
    horizon_y = int(height * 0.35)
    cx = width // 2
    top_l, top_r = cx - int(width * 0.14), cx + int(width * 0.14)
    bot_l, bot_r = cx - int(width * 0.47), cx + int(width * 0.47)

    vehicles = [
        {"lane": 0, "speed": 0.0018, "offset": 0.12, "vtype": "CAR", "plate": "TN09XY1111", "color": (50, 50, 180)},
        {"lane": 1, "speed": 0.0015, "offset": 0.28, "vtype": "BUS", "plate": "KA03AB2222", "color": (180, 100, 30)},
        {"lane": 2, "speed": 0.0017, "offset": 0.45, "vtype": "SUV", "plate": "KL07CD3333", "color": (60, 160, 60)},
        {"lane": 0, "speed": 0.0016, "offset": 0.62, "vtype": "CAR", "plate": "AP09EF4444", "color": (140, 140, 50)},
        {"lane": 1, "speed": 0.0014, "offset": 0.78, "vtype": "CAR", "plate": "MH04EV4040", "color": (100, 50, 180)}
    ]

    for frame_idx in range(total_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        draw_perspective_road_and_signal(frame, step=frame_idx)

        active_v = []
        for v in vehicles:
            t = (frame_idx * v["speed"] + v["offset"]) % 1.0
            if 0.05 < t < 0.98:
                active_v.append((t, v))
        active_v.sort(key=lambda x: x[0])

        for t, v in active_v:
            y = horizon_y + (height - horizon_y) * t
            scale = 0.22 + 0.78 * (t ** 1.45)
            lane_ratio = (v["lane"] + 0.5) / 3.0
            tl = top_l + (top_r - top_l) * lane_ratio
            bl = bot_l + (bot_r - bot_l) * lane_ratio
            x = tl + (bl - tl) * t
            draw_front_angle_vehicle(frame, x, y, scale, v["vtype"], v["plate"], v["color"], step=frame_idx)

        cv2.putText(frame, "CAM-02 BOTTLENECK CONGESTION • FRONT-FACING APPROACH", (15, 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 80, 255), 1)
        out.write(frame)

    out.release()
    print("Congested traffic video generated successfully.")


def create_rainy_night_video(output_path: str = "sample_traffic_rainy.mp4", duration_sec: int = 12, fps: int = 30):
    print(f"Generating Night/Rain ANPR Front-Angle Video: {output_path}...")
    width, height = 640, 480
    fourcc = cv2.VideoWriter.fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    total_frames = duration_sec * fps
    horizon_y = int(height * 0.35)
    cx = width // 2
    top_l, top_r = cx - int(width * 0.14), cx + int(width * 0.14)
    bot_l, bot_r = cx - int(width * 0.47), cx + int(width * 0.47)

    for frame_idx in range(total_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        draw_perspective_road_and_signal(frame, step=frame_idx)

        # Night rain streaks
        np.random.seed(frame_idx)
        for _ in range(40):
            rx = np.random.randint(0, width)
            ry = np.random.randint(0, height)
            cv2.line(frame, (rx, ry), (rx - 4, ry + 12), (90, 90, 110), 1)

        t = ((frame_idx * 0.0045 + 0.35) % 1.0)
        if 0.05 < t < 0.98:
            y = horizon_y + (height - horizon_y) * t
            scale = 0.22 + 0.78 * (t ** 1.45)
            lane_ratio = 0.5
            tl = top_l + (top_r - top_l) * lane_ratio
            bl = bot_l + (bot_r - bot_l) * lane_ratio
            x = tl + (bl - tl) * t
            draw_front_angle_vehicle(frame, x, y, scale, "CAR", "KA05MN3821", (40, 40, 50), step=frame_idx)

        cv2.putText(frame, "CAM-05 NIGHT/RAIN LOW-LIGHT ANPR • FRONT-FACING APPROACH", (15, 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (180, 255, 255), 1)
        out.write(frame)

    out.release()
    print("Night/Rain ANPR video generated successfully.")


def create_junction_4way_video(output_path: str = "sample_traffic_junction.mp4", duration_sec: int = 12, fps: int = 30):
    return create_urban_traffic_video(output_path, duration_sec, fps)


def generate_all_sample_videos():
    vids = [
        "sample_traffic_urban.mp4",
        "sample_traffic_highway.mp4",
        "sample_traffic_congested.mp4",
        "sample_traffic_emergency.mp4",
        "sample_traffic_rainy.mp4",
        "sample_traffic_junction.mp4"
    ]
    create_urban_traffic_video("sample_traffic_urban.mp4")
    create_highway_traffic_video("sample_traffic_highway.mp4")
    create_congested_traffic_video("sample_traffic_congested.mp4")
    create_emergency_traffic_video("sample_traffic_emergency.mp4")
    create_rainy_night_video("sample_traffic_rainy.mp4")
    create_junction_4way_video("sample_traffic_junction.mp4")
    create_urban_traffic_video("sample_traffic.mp4")

    # Copy generated front-angle videos to backend/ and frontend/public/videos/
    dest_dirs = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "videos"))
    ]
    for d in dest_dirs:
        os.makedirs(d, exist_ok=True)
        for v in vids + ["sample_traffic.mp4"]:
            if os.path.exists(v):
                shutil.copy2(v, os.path.join(d, v))
                print(f"Copied {v} -> {d}")

if __name__ == "__main__":
    generate_all_sample_videos()

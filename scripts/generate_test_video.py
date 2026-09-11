import cv2
import numpy as np
import os

def create_urban_traffic_video(output_path: str = "sample_traffic_urban.mp4", duration_sec: int = 12, fps: int = 30):
    print(f"Generating Urban Traffic Test Video: {output_path}...")
    width, height = 640, 480
    fourcc = cv2.VideoWriter.fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    total_frames = duration_sec * fps

    for frame_idx in range(total_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:] = (45, 45, 45) # Asphalt road

        # Road lanes
        cv2.line(frame, (213, 0), (213, height), (255, 255, 255), 2)
        cv2.line(frame, (426, 0), (426, height), (255, 255, 255), 2)
        for y in range(0, height, 40):
            cv2.line(frame, (320, y), (320, y + 20), (0, 255, 255), 3)

        # Vehicle 1: Sedan (TN01AB1234)
        v1_y = (frame_idx * 4) % height
        cv2.rectangle(frame, (100, v1_y), (180, v1_y + 90), (220, 100, 50), -1)
        cv2.putText(frame, "CAR", (110, v1_y + 40), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.rectangle(frame, (110, v1_y + 65), (170, v1_y + 85), (255, 255, 255), -1)
        cv2.putText(frame, "TN01AB1234", (112, v1_y + 80), cv2.FONT_HERSHEY_SIMPLEX, 0.32, (0, 0, 0), 1)

        # Vehicle 2: Ambulance (KA05MN3821)
        v2_y = (frame_idx * 5 + 100) % height
        cv2.rectangle(frame, (350, v2_y), (440, v2_y + 110), (50, 50, 240), -1)
        cv2.rectangle(frame, (370, v2_y + 10), (420, v2_y + 40), (255, 255, 255), -1)
        light_color = (0, 0, 255) if (frame_idx // 5) % 2 == 0 else (255, 0, 0)
        cv2.circle(frame, (395, v2_y + 25), 8, light_color, -1)
        cv2.putText(frame, "AMBULANCE", (355, v2_y + 70), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
        cv2.rectangle(frame, (365, v2_y + 85), (425, v2_y + 105), (255, 255, 255), -1)
        cv2.putText(frame, "KA05MN3821", (367, v2_y + 98), cv2.FONT_HERSHEY_SIMPLEX, 0.32, (0, 0, 0), 1)

        # Vehicle 3: Bus (DL02CP9012)
        v3_y = height - ((frame_idx * 3) % height)
        cv2.rectangle(frame, (480, v3_y), (580, v3_y + 140), (60, 180, 60), -1)
        cv2.putText(frame, "BUS", (500, v3_y + 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.rectangle(frame, (500, v3_y + 115), (560, v3_y + 135), (255, 255, 255), -1)
        cv2.putText(frame, "DL02CP9012", (502, v3_y + 128), cv2.FONT_HERSHEY_SIMPLEX, 0.32, (0, 0, 0), 1)

        # Header
        cv2.putText(frame, "CAM-01 URBAN DOWNTOWN JUNCTION", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 2)
        out.write(frame)

    out.release()
    print("Urban traffic video generated successfully.")

def create_highway_traffic_video(output_path: str = "sample_traffic_highway.mp4", duration_sec: int = 12, fps: int = 30):
    print(f"Generating Highway Traffic Test Video: {output_path}...")
    width, height = 640, 480
    fourcc = cv2.VideoWriter.fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    total_frames = duration_sec * fps

    for frame_idx in range(total_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:] = (35, 35, 35)

        for x in [160, 320, 480]:
            cv2.line(frame, (x, 0), (x, height), (255, 255, 255), 2)

        t_y = (frame_idx * 7) % height
        cv2.rectangle(frame, (40, t_y), (140, t_y + 150), (180, 80, 40), -1)
        cv2.putText(frame, "TRUCK", (55, t_y + 70), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.rectangle(frame, (50, t_y + 120), (130, t_y + 140), (255, 255, 255), -1)
        cv2.putText(frame, "KA01TR9999", (52, t_y + 135), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 0, 0), 1)

        c_y = (frame_idx * 9 + 50) % height
        cv2.rectangle(frame, (200, c_y), (280, c_y + 90), (40, 180, 220), -1)
        cv2.putText(frame, "CAR", (215, c_y + 45), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.rectangle(frame, (210, c_y + 65), (270, c_y + 85), (255, 255, 255), -1)
        cv2.putText(frame, "HR26BC9999", (212, c_y + 80), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 0, 0), 1)

        s_y = height - ((frame_idx * 8 + 120) % height)
        cv2.rectangle(frame, (350, s_y), (440, s_y + 100), (90, 90, 90), -1)
        cv2.putText(frame, "SUV", (370, s_y + 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.rectangle(frame, (365, s_y + 75), (425, s_y + 95), (255, 255, 255), -1)
        cv2.putText(frame, "MH12DE5678", (367, s_y + 90), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 0, 0), 1)

        cv2.putText(frame, "CAM-04 EXPRESSWAY HIGHWAY TOLL", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 2)
        out.write(frame)

    out.release()
    print("Highway traffic video generated successfully.")

def create_congested_traffic_video(output_path: str = "sample_traffic_congested.mp4", duration_sec: int = 12, fps: int = 30):
    print(f"Generating Congested Traffic Test Video: {output_path}...")
    width, height = 640, 480
    fourcc = cv2.VideoWriter.fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    total_frames = duration_sec * fps

    for frame_idx in range(total_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:] = (50, 50, 50)

        v_positions = [
            (80, 50, "TN09XY1111", (30, 30, 200), "CAR"),
            (80, 160, "KA03AB2222", (200, 100, 30), "BUS"),
            (80, 320, "KL07CD3333", (50, 180, 50), "CAR"),
            (250, 80, "AP09EF4444", (150, 150, 50), "CAR"),
            (250, 200, "MH04EV4040", (100, 50, 180), "VAN"),
            (250, 330, "DL05CP5555", (40, 140, 200), "CAR"),
            (420, 100, "TN07AB7777", (180, 40, 140), "BUS"),
            (420, 280, "KA01MN8888", (80, 80, 80), "CAR")
        ]

        for vx, vy_base, plate, color, vtype in v_positions:
            vy = vy_base + (frame_idx // 4) % 30
            vh = 110 if vtype == "BUS" else 80
            vw = 70
            cv2.rectangle(frame, (vx, vy), (vx + vw, vy + vh), color, -1)
            cv2.putText(frame, vtype, (vx + 10, vy + 35), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
            cv2.rectangle(frame, (vx + 5, vy + vh - 22), (vx + vw - 5, vy + vh - 4), (255, 255, 255), -1)
            cv2.putText(frame, plate, (vx + 7, vy + vh - 9), cv2.FONT_HERSHEY_SIMPLEX, 0.26, (0, 0, 0), 1)

        cv2.putText(frame, "CAM-02 HEAVY BOTTLENECK CONGESTION", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255), 2)
        out.write(frame)

    out.release()
    print("Congested traffic video generated successfully.")

def create_emergency_traffic_video(output_path: str = "sample_traffic_emergency.mp4", duration_sec: int = 12, fps: int = 30):
    print(f"Generating Emergency Green Wave Test Video: {output_path}...")
    width, height = 640, 480
    fourcc = cv2.VideoWriter.fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    total_frames = duration_sec * fps

    for frame_idx in range(total_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:] = (40, 40, 40)

        cv2.line(frame, (213, 0), (213, height), (0, 255, 0), 3) # Green Wave Lane
        cv2.line(frame, (426, 0), (426, height), (255, 255, 255), 2)

        a_y = (frame_idx * 8) % height
        cv2.rectangle(frame, (80, a_y), (180, a_y + 120), (40, 40, 230), -1)
        cv2.rectangle(frame, (100, a_y + 10), (160, a_y + 45), (255, 255, 255), -1)
        light_color = (0, 0, 255) if (frame_idx // 3) % 2 == 0 else (255, 255, 0)
        cv2.circle(frame, (130, a_y + 25), 10, light_color, -1)
        cv2.putText(frame, "AMBULANCE", (85, a_y + 75), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
        cv2.rectangle(frame, (90, a_y + 90), (170, a_y + 112), (255, 255, 255), -1)
        cv2.putText(frame, "KA05MN3821", (93, a_y + 106), cv2.FONT_HERSHEY_SIMPLEX, 0.32, (0, 0, 0), 1)

        p_y = (a_y + 160) % height
        cv2.rectangle(frame, (90, p_y), (170, p_y + 85), (200, 30, 30), -1)
        light_p = (255, 0, 0) if (frame_idx // 3) % 2 == 0 else (0, 0, 255)
        cv2.circle(frame, (130, p_y + 20), 7, light_p, -1)
        cv2.putText(frame, "POLICE", (105, p_y + 50), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
        cv2.rectangle(frame, (100, p_y + 60), (160, p_y + 80), (255, 255, 255), -1)
        cv2.putText(frame, "TN01EM9999", (102, p_y + 74), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 0, 0), 1)

        cv2.putText(frame, "CAM-03 EMERGENCY PREEMPTION CORRIDOR", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 2)
        out.write(frame)

    out.release()
    print("Emergency green wave traffic video generated successfully.")

def create_rainy_night_video(output_path: str = "sample_traffic_rainy.mp4", duration_sec: int = 12, fps: int = 30):
    print(f"Generating Night/Rain ANPR Test Video: {output_path}...")
    width, height = 640, 480
    fourcc = cv2.VideoWriter.fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    total_frames = duration_sec * fps

    for frame_idx in range(total_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:] = (15, 15, 25) # Dark rainy asphalt

        # Rain streaks
        np.random.seed(frame_idx)
        for _ in range(30):
            rx = np.random.randint(0, width)
            ry = np.random.randint(0, height)
            cv2.line(frame, (rx, ry), (rx - 5, ry + 15), (100, 100, 120), 1)

        # Vehicle under headlight glare (KA05MN3821)
        v_y = (frame_idx * 5) % height
        cv2.rectangle(frame, (240, v_y), (340, v_y + 100), (40, 40, 50), -1)
        # Bright headlights with glare
        cv2.circle(frame, (260, v_y + 15), 14, (200, 255, 255), -1)
        cv2.circle(frame, (320, v_y + 15), 14, (200, 255, 255), -1)
        # Illuminated High-Contrast License Plate
        cv2.rectangle(frame, (265, v_y + 70), (335, v_y + 92), (255, 255, 255), -1)
        cv2.putText(frame, "KA05MN3821", (268, v_y + 86), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 0), 2)

        cv2.putText(frame, "CAM-05 LOW-VISIBILITY NIGHT/RAIN ANPR", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 255, 255), 2)
        out.write(frame)

    out.release()
    print("Night/Rain ANPR video generated successfully.")

def create_junction_4way_video(output_path: str = "sample_traffic_junction.mp4", duration_sec: int = 12, fps: int = 30):
    print(f"Generating 4-Way Signal Junction Test Video: {output_path}...")
    width, height = 640, 480
    fourcc = cv2.VideoWriter.fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    total_frames = duration_sec * fps

    for frame_idx in range(total_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:] = (40, 40, 40)

        # Draw 4-way crossroad
        cv2.rectangle(frame, (220, 0), (420, height), (60, 60, 60), -1)
        cv2.rectangle(frame, (0, 160), (width, 320), (60, 60, 60), -1)

        # Traffic Signal Light Status (Green on North-South, Red on East-West)
        phase_color = (0, 255, 0) if (frame_idx // 90) % 2 == 0 else (0, 0, 255)
        cv2.circle(frame, (200, 140), 12, phase_color, -1)
        cv2.circle(frame, (440, 340), 12, phase_color, -1)

        # Vehicles queueing
        v1_y = (frame_idx * 4) % 150
        cv2.rectangle(frame, (240, v1_y), (310, v1_y + 70), (220, 120, 40), -1)
        cv2.rectangle(frame, (248, v1_y + 50), (302, v1_y + 66), (255, 255, 255), -1)
        cv2.putText(frame, "TN01AB1234", (250, v1_y + 62), cv2.FONT_HERSHEY_SIMPLEX, 0.28, (0, 0, 0), 1)

        cv2.putText(frame, "CAM-06 4-WAY ADAPTIVE SIGNAL JUNCTION", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)
        out.write(frame)

    out.release()
    print("4-Way Signal Junction video generated successfully.")

def generate_all_sample_videos():
    create_urban_traffic_video("sample_traffic_urban.mp4")
    create_highway_traffic_video("sample_traffic_highway.mp4")
    create_congested_traffic_video("sample_traffic_congested.mp4")
    create_emergency_traffic_video("sample_traffic_emergency.mp4")
    create_rainy_night_video("sample_traffic_rainy.mp4")
    create_junction_4way_video("sample_traffic_junction.mp4")
    
    create_urban_traffic_video("sample_traffic.mp4")

if __name__ == "__main__":
    generate_all_sample_videos()

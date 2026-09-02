import subprocess
import sys
import os
import time

def main():
    print("=" * 60)
    print("  VIGITRA – Intelligent Adaptive Traffic System  ")
    print("=" * 60)

    # 1. Generate test video & Seed Database
    print("[1/3] Generating test traffic video & seeding database...")
    subprocess.run([sys.executable, "scripts/generate_test_video.py"], check=True)
    subprocess.run([sys.executable, "scripts/seed_db.py"], check=True)

    print("[2/3] Starting FastAPI Backend on http://127.0.0.1:8000...")
    env = os.environ.copy()
    env["PYTHONPATH"] = "backend"
    
    backend_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
        env=env
    )

    time.sleep(2)

    print("[3/3] Starting React Vite Frontend on http://127.0.0.1:5173...")
    node_dist = r"C:\Users\vishn\node_dist"
    env["PATH"] = node_dist + ";" + env.get("PATH", "")
    npm_cmd = os.path.join(node_dist, "npm.cmd")

    frontend_process = subprocess.Popen(
        [npm_cmd, "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"],
        cwd="frontend",
        env=env
    )

    print("\n" + "=" * 60)
    print("  VIGITRA is RUNNING SUCCESSFULLY!  ")
    print("  - Frontend Dashboard: http://127.0.0.1:5173")
    print("  - FastAPI OpenAPI:   http://127.0.0.1:8000/docs")
    print("  - Admin Credentials: admin / admin123")
    print("=" * 60 + "\n")

    try:
        backend_process.wait()
        frontend_process.wait()
    except KeyboardInterrupt:
        print("\nShutting down VIGITRA servers...")
        backend_process.terminate()
        frontend_process.terminate()

if __name__ == "__main__":
    main()

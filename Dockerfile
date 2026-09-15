FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV and video streaming
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Pre-install CPU-only PyTorch to prevent downloading heavy CUDA dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download lightweight YOLOv8 nano model weights into container image layer
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

COPY backend/ .

RUN mkdir -p /app/storage/recordings /app/storage/evidence /app/uploads

EXPOSE 8000

ENV PORT=8000
ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]

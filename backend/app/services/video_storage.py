import os
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.models import VideoRecording, EvidenceRecord, DataRetentionSetting

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "videos")
EVIDENCE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "evidence")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EVIDENCE_DIR, exist_ok=True)

class VideoStorageService:
    """
    Manages local video & evidence image file storage, sha256 checksums,
    metadata registration in PostgreSQL, and automated retention cleanup policies.
    """

    def calculate_file_hash(self, file_path: str) -> str:
        """Calculates sha256 checksum of a stored video file."""
        if not os.path.exists(file_path):
            return "0000000000000000000000000000000000000000000000000000000000000000"
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    def register_recording(
        self,
        db: Session,
        camera_id: int,
        device_id: Optional[str],
        location: str,
        duration_sec: float,
        file_name: str,
        recording_type: str = "CONTINUOUS",
        created_by: str = "SYSTEM"
    ) -> VideoRecording:
        now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
        rec_num = db.query(VideoRecording).count() + 1
        record_id = f"REC-{now_dt.strftime('%Y%m%d')}-{rec_num:03d}"
        file_path = os.path.join(UPLOAD_DIR, file_name)

        # Retention expiry default 30 days
        expiry = now_dt + timedelta(days=30)
        file_hash = self.calculate_file_hash(file_path)

        rec = VideoRecording(
            record_id=record_id,
            camera_id=camera_id,
            device_id=device_id,
            start_time=now_dt,
            end_time=now_dt + timedelta(seconds=duration_sec),
            file_reference=f"/uploads/videos/{file_name}",
            file_size_mb=round(duration_sec * 0.12, 1),
            duration_sec=duration_sec,
            location=location,
            recording_type=recording_type,
            created_by=created_by,
            retention_expiry=expiry,
            file_hash=file_hash
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        logger.info(f"[VideoStorageService] Registered video recording {record_id} ({file_name})")
        return rec

    def cleanup_expired_recordings(self, db: Session) -> int:
        """Deletes expired video files according to configured data retention policy."""
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        expired = db.query(VideoRecording).filter(
            VideoRecording.retention_expiry.isnot(None),
            VideoRecording.retention_expiry <= now
        ).all()

        deleted_count = 0
        for rec in expired:
            full_path = os.path.join(os.path.dirname(__file__), "..", "..", rec.file_reference.lstrip("/"))
            if os.path.exists(full_path):
                try:
                    os.remove(full_path)
                except Exception as e:
                    logger.error(f"Error removing expired video file {full_path}: {e}")
            db.delete(rec)
            deleted_count += 1

        db.commit()
        logger.info(f"[VideoStorageService] Cleaned up {deleted_count} expired video recordings.")
        return deleted_count

video_storage = VideoStorageService()

import time
import logging
from typing import Dict, Any, Tuple, Optional
from collections import defaultdict
from app.core.config import settings

logger = logging.getLogger(__name__)

class TemporalPlateTracker:
    """
    Temporal confirmation and duplicate plate prevention tracker (Sections 8 & 9).
    Requires consecutive matching frames before confirming an ANPR observation.
    Maintains passage event cooldowns so a single vehicle passing through the camera
    creates exactly ONE confirmed ANPR passage event instead of multiple duplicates.
    """

    def __init__(
        self,
        min_consecutive_matches: Optional[int] = None,
        temporal_match_window: Optional[float] = None,
        event_cooldown_seconds: Optional[float] = None
    ):
        self.min_matches = min_consecutive_matches or settings.ANPR_MIN_CONSECUTIVE_MATCHES
        self.match_window = temporal_match_window or settings.ANPR_TEMPORAL_MATCH_WINDOW
        self.cooldown_seconds = event_cooldown_seconds or settings.ANPR_EVENT_COOLDOWN_SECONDS

        # Key: (device_id, plate_number) -> list of sighting timestamps and scores
        self.recent_sightings: Dict[Tuple[str, str], list] = defaultdict(list)
        # Key: (device_id, plate_number) -> last confirmed event epoch timestamp
        self.cooldown_registry: Dict[Tuple[str, str], float] = {}

    def process_sighting(
        self,
        device_id: str,
        plate_number: str,
        confidence: float,
        visual_score: float,
        tracking_id: Optional[str] = None
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Evaluates a plate detection for temporal confirmation and cooldown protection.
        
        Returns:
            (is_new_confirmed_event: bool, status: str, meta: Dict[str, Any])
            status can be:
            - "CONFIRMED": Enough consecutive matches achieved, cooldown initiated.
            - "TEMPORAL_PENDING": Consecutive frame count < min_matches.
            - "COOLDOWN_ACTIVE": Already confirmed within the cooldown window (duplicate suppressed).
        """
        now = time.time()
        key = (device_id, plate_number)

        # 1. Check if vehicle is currently under active cooldown
        last_event_time = self.cooldown_registry.get(key, 0.0)
        cooldown_elapsed = now - last_event_time
        if cooldown_elapsed < self.cooldown_seconds:
            remaining = round(self.cooldown_seconds - cooldown_elapsed, 1)
            return False, "COOLDOWN_ACTIVE", {
                "cooldown_remaining_sec": remaining,
                "message": f"Duplicate plate event suppressed. Active cooldown for {plate_number} ({remaining}s remaining)."
            }

        # 2. Prune old sightings outside the temporal match window
        sightings = self.recent_sightings[key]
        self.recent_sightings[key] = [s for s in sightings if (now - s["timestamp"]) <= self.match_window]

        # 3. Add current sighting
        self.recent_sightings[key].append({
            "timestamp": now,
            "confidence": confidence,
            "visual_score": visual_score,
            "tracking_id": tracking_id
        })

        match_count = len(self.recent_sightings[key])
        avg_conf = round(sum(s["confidence"] for s in self.recent_sightings[key]) / match_count, 2)
        avg_visual = round(sum(s["visual_score"] for s in self.recent_sightings[key]) / match_count, 2)

        # 4. Check if confirmation threshold is met (consecutive match count or meets min plate confidence)
        if match_count >= self.min_matches or confidence >= settings.ANPR_MIN_PLATE_CONFIDENCE:
            # Confirmed event! Set cooldown
            self.cooldown_registry[key] = now
            self.recent_sightings[key] = []
            logger.info(
                f"[TemporalTracker] Plate {plate_number} CONFIRMED on {device_id} "
                f"({match_count} consecutive frames, conf: {avg_conf}, visual: {avg_visual})"
            )
            return True, "CONFIRMED", {
                "consecutive_matches": match_count,
                "aggregate_confidence": avg_conf,
                "visual_validation_score": avg_visual,
                "cooldown_applied_sec": self.cooldown_seconds
            }

        # Still gathering temporal confirmation
        return False, "TEMPORAL_PENDING", {
            "consecutive_matches": match_count,
            "required_matches": self.min_matches,
            "current_confidence": confidence,
            "visual_validation_score": visual_score
        }

    def reset_cooldown(self, device_id: str, plate_number: str):
        """Manually clears cooldown for testing or explicit operator reset."""
        key = (device_id, plate_number)
        if key in self.cooldown_registry:
            del self.cooldown_registry[key]

temporal_tracker = TemporalPlateTracker()

"""
Temporal ANPR Confirmation & Duplicate Suppression Tracker.
Requires consecutive matching frames within a temporal window before confirming an ANPR passage event.
Applies passage cooldowns so that a single vehicle creates exactly one event.
Thread-safe for concurrent camera feeds and mobile patrol streams.
"""

import time
import logging
import threading
from typing import Dict, Any, Tuple, Optional, List
from collections import defaultdict
from app.core.config import settings

logger = logging.getLogger(__name__)


class TemporalPlateTracker:
    """
    Temporal confirmation and duplicate plate prevention tracker.
    Suppresses rapid duplicate notifications for the same vehicle while in camera view.
    """

    def __init__(
        self,
        min_consecutive_matches: Optional[int] = None,
        temporal_match_window: Optional[float] = None,
        event_cooldown_seconds: Optional[float] = None,
    ) -> None:
        self.min_matches: int = min_consecutive_matches or settings.ANPR_MIN_CONSECUTIVE_MATCHES
        self.match_window: float = temporal_match_window or settings.ANPR_TEMPORAL_MATCH_WINDOW
        self.cooldown_seconds: float = event_cooldown_seconds or settings.ANPR_EVENT_COOLDOWN_SECONDS

        # Key: (device_id, plate_number) -> list of sighting timestamps and scores
        self.recent_sightings: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
        # Key: (device_id, plate_number) -> last confirmed event epoch timestamp
        self.cooldown_registry: Dict[Tuple[str, str], float] = {}
        self._lock = threading.Lock()

    def process_sighting(
        self,
        device_id: str,
        plate_number: str,
        confidence: float,
        visual_score: float,
        tracking_id: Optional[str] = None,
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Evaluates a plate detection for temporal confirmation and cooldown protection.
        Thread-safe under high-velocity camera capture loops.

        Returns:
            (is_new_confirmed_event: bool, status: str, metadata: Dict[str, Any])
        """
        now = time.time()
        key = (device_id, plate_number)

        with self._lock:
            # 1. Periodic cleanup of expired cooldowns to prevent memory leaks
            if len(self.cooldown_registry) > 500:
                self._prune_expired(now)

            # 2. Check if vehicle is currently under active cooldown
            last_event_time = self.cooldown_registry.get(key, 0.0)
            cooldown_elapsed = now - last_event_time
            if cooldown_elapsed < self.cooldown_seconds:
                remaining = round(self.cooldown_seconds - cooldown_elapsed, 1)
                return False, "COOLDOWN_ACTIVE", {
                    "cooldown_remaining_sec": remaining,
                    "message": f"Duplicate plate event suppressed. Active cooldown for {plate_number} ({remaining}s remaining).",
                }

            # 3. Prune old sightings outside the temporal match window
            sightings = self.recent_sightings[key]
            self.recent_sightings[key] = [
                s for s in sightings if (now - s["timestamp"]) <= self.match_window
            ]

            # 4. Record current sighting
            self.recent_sightings[key].append({
                "timestamp": now,
                "confidence": confidence,
                "visual_score": visual_score,
                "tracking_id": tracking_id,
            })

            match_count = len(self.recent_sightings[key])
            avg_conf = round(sum(s["confidence"] for s in self.recent_sightings[key]) / match_count, 2)
            avg_visual = round(sum(s["visual_score"] for s in self.recent_sightings[key]) / match_count, 2)

            # 5. Check if confirmation threshold is met
            if match_count >= self.min_matches or confidence >= settings.ANPR_MIN_PLATE_CONFIDENCE:
                self.cooldown_registry[key] = now
                self.recent_sightings[key] = []
                logger.info(
                    "[TemporalTracker] Plate %s CONFIRMED on %s (%d frames, conf: %.2f, visual: %.2f)",
                    plate_number,
                    device_id,
                    match_count,
                    avg_conf,
                    avg_visual,
                )
                return True, "CONFIRMED", {
                    "consecutive_matches": match_count,
                    "aggregate_confidence": avg_conf,
                    "visual_validation_score": avg_visual,
                    "cooldown_applied_sec": self.cooldown_seconds,
                }

            # Still gathering temporal confirmation
            return False, "TEMPORAL_PENDING", {
                "consecutive_matches": match_count,
                "required_matches": self.min_matches,
                "current_confidence": confidence,
                "visual_validation_score": visual_score,
            }

    def _prune_expired(self, now: float) -> None:
        """Removes expired entries from cooldown registry to bound memory usage."""
        expired_keys = [
            k for k, last_time in self.cooldown_registry.items()
            if (now - last_time) >= (self.cooldown_seconds * 2)
        ]
        for k in expired_keys:
            del self.cooldown_registry[k]

    def reset_cooldown(self, device_id: str, plate_number: str) -> None:
        """Manually clears cooldown for testing or explicit operator reset."""
        key = (device_id, plate_number)
        with self._lock:
            self.cooldown_registry.pop(key, None)
            self.recent_sightings.pop(key, None)


temporal_tracker = TemporalPlateTracker()

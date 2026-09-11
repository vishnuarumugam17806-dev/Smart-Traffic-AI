import logging
import time
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.models import Signal, SignalDecision, AuditLog, TrafficMeasurement, Camera, CongestionLevelEnum

logger = logging.getLogger(__name__)

# Configurable weights for multi-factor priority score calculation
WEIGHTS = {
    "density": 1.5,
    "queue_length": 2.0,
    "waiting_time": 0.5,
    "queue_growth": 1.2,
    "emergency": 150.0,
    "pedestrian": 2.5,
    "downstream_congestion": 2.0,
    "fairness": 0.8
}

class AdaptiveSignalOptimizer:
    """
    Multi-Factor AI Decision Engine for Adaptive Signal Optimization.
    Calculates deterministic Priority Scores considering:
    1. Vehicle density
    2. Queue length & growth rate
    3. Waiting time & starvation penalty
    4. Emergency vehicle preemption
    5. Pedestrian crossing demand
    6. Downstream road congestion penalty
    """

    def calculate_priority_score(
        self,
        vehicle_count: int,
        queue_length: int,
        waiting_time: float,
        queue_growth_rate: float,
        time_since_last_green: float,
        emergency_detected: bool,
        pedestrian_waiting: int = 0,
        downstream_congestion: float = 0.0
    ) -> float:
        """
        Calculates Priority Score for an approach using multi-factor weighted formula.
        PriorityScore = w1*Density + w2*Queue + w3*WaitingTime + w4*QueueGrowth + w5*Emergency + w6*Pedestrian - w7*DownstreamCongestion + StarvationBonus
        """
        score = (
            vehicle_count * WEIGHTS["density"] +
            queue_length * WEIGHTS["queue_length"] +
            waiting_time * WEIGHTS["waiting_time"] +
            queue_growth_rate * WEIGHTS["queue_growth"] +
            pedestrian_waiting * WEIGHTS["pedestrian"]
        )

        if emergency_detected:
            score += WEIGHTS["emergency"]

        # Anti-starvation bonus: boost priority if waiting time exceeds threshold
        if time_since_last_green > 60.0 or waiting_time > 60.0:
            score += 100.0 * (1.0 + (waiting_time - 60.0) / 60.0)

        # Downstream congestion penalty
        score -= downstream_congestion * WEIGHTS["downstream_congestion"]

        return max(0.0, round(score, 2))

    def calculate_dynamic_green(self, queue_length: int, vehicle_count: int, density_state: str) -> int:
        """
        Calculates dynamic green phase duration bounded strictly within safety limits (15s to 120s).
        LOW: 15-25s | MODERATE: 25-40s | HIGH/SEVERE: 40-60s (or up to 120s under extreme load).
        """
        if density_state == "LOW":
            duration = 15 + int(queue_length * 1.5)
            duration = min(25, max(15, duration))
        elif density_state == "MODERATE":
            duration = 25 + int(queue_length * 2.0 + vehicle_count * 0.3)
            duration = min(40, max(25, duration))
        else:  # HIGH or SEVERE
            duration = 40 + int(queue_length * 2.5 + vehicle_count * 0.5)
            duration = min(60, max(40, duration))

        return int(min(settings.MAX_GREEN_TIME, max(settings.MIN_GREEN_TIME, duration)))

    def optimize_signal(
        self,
        vehicle_count: int,
        queue_length: int,
        density_state: str,
        emergency_detected: bool = False,
        emergency_type: str = None
    ) -> Dict[str, Any]:
        """Calculates optimal green phase timing and generates explainable reasoning."""
        if emergency_detected:
            return {
                "recommended_green": 60,
                "recommended_red": 0,
                "recommended_phase": "GREEN_EMERGENCY",
                "priority_level": "CRITICAL_EMERGENCY",
                "reasoning": f"Emergency Priority Activated: Detected {emergency_type or 'Emergency Vehicle'}. Overriding normal cycle to clear intersection path immediately.",
                "confidence": 1.0,
                "emergency_override": True
            }

        green = self.calculate_dynamic_green(queue_length, vehicle_count, density_state)
        red = int(max(15, 120 - green))

        reasoning = (
            f"Traffic density classified as {density_state} with {vehicle_count} active vehicles "
            f"and a queue length of {queue_length}. Recommended green duration set to "
            f"{green}s (bounded within [{settings.MIN_GREEN_TIME}s, {settings.MAX_GREEN_TIME}s] safety limits)."
        )

        return {
            "recommended_green": green,
            "recommended_red": red,
            "recommended_phase": "GREEN",
            "priority_level": "NORMAL" if density_state in ["LOW", "MODERATE"] else "HIGH",
            "reasoning": reasoning,
            "confidence": 0.95,
            "emergency_override": False
        }


class SignalController:
    """
    Dynamic Multi-Side Intersection Signal Controller supporting 2, 3, or 4 approach junctions.
    Enforces safe state machine: GREEN -> YELLOW (3s) -> RED_CLEARANCE (2s) -> RED -> NEXT APPROACH GREEN.
    Supports Automatic Adaptive Priority Optimization, Manual Override per Approach, Emergency Preemption, and Anti-Starvation Fairness.
    """

    def __init__(self, intersection_id: int, num_approaches: int = 4, approaches_config: Optional[List[Dict[str, Any]]] = None):
        self.intersection_id = intersection_id
        self.num_approaches = num_approaches
        self.state = "GREEN"  # GREEN, YELLOW, RED_CLEARANCE
        self.countdown = 30
        self.mode = "AUTOMATIC"  # AUTOMATIC, MANUAL, EMERGENCY, FAILSAFE

        self.manual_target_approach = None
        self.manual_reason = None
        self.manual_user = None

        self.optimizer = AdaptiveSignalOptimizer()
        self.last_decision_time = datetime.utcnow()
        self.last_reasoning = f"System initialized in Automatic mode ({self.num_approaches}-approach junction)."
        self.elapsed_green_time = 0.0

        self.approaches: Dict[str, Dict[str, Any]] = {}
        self.configure_approaches(num_approaches, approaches_config)

        self.active_approach = list(self.approaches.keys())[0] if self.approaches else "NORTH"
        self.active_phase = self.active_approach

    @property
    def manual_target_phase(self):
        return getattr(self, '_manual_raw_phase', None) or self.manual_target_approach

    @manual_target_phase.setter
    def manual_target_phase(self, val):
        self._manual_raw_phase = val
        self.manual_target_approach = val

    def configure_approaches(self, num_approaches: int, approaches_config: Optional[List[Dict[str, Any]]] = None):
        self.num_approaches = num_approaches
        self.approaches = {}

        if approaches_config and len(approaches_config) > 0:
            for item in approaches_config[:num_approaches]:
                key = str(item.get("direction") or item.get("name") or f"APPROACH_{len(self.approaches)+1}").upper()
                self.approaches[key] = self._init_approach(
                    direction=key,
                    name=item.get("name") or f"{key.title()} Approach",
                    camera_id=item.get("camera_id")
                )
        else:
            default_keys = ["NORTH", "SOUTH"] if num_approaches == 2 else (["NORTH", "EAST", "WEST"] if num_approaches == 3 else ["NORTH", "EAST", "SOUTH", "WEST"])
            for k in default_keys:
                self.approaches[k] = self._init_approach(direction=k, name=f"{k.title()} Approach")

        if not hasattr(self, 'active_approach') or self.active_approach not in self.approaches:
            self.active_approach = list(self.approaches.keys())[0] if self.approaches else "NORTH"
            self.active_phase = self.active_approach

    def _init_approach(self, direction: str, name: str = "", camera_id: Optional[int] = None) -> Dict[str, Any]:
        return {
            "direction": direction,
            "name": name or f"{direction.title()} Approach",
            "camera_id": camera_id,
            "vehicle_count": 12.0,
            "queue_length": 5,
            "waiting_time": 0.0,
            "queue_growth_rate": 0.15,
            "flow_rate": 0.6,
            "time_since_last_green": 0.0,
            "pedestrian_waiting": 0,
            "emergency_detected": False,
            "emergency_type": None
        }

    def get_allowed_directions(self, phase: str) -> List[str]:
        if phase in self.approaches:
            return [phase]
        if phase == "NORTH_SOUTH":
            return [k for k in ["NORTH", "SOUTH"] if k in self.approaches]
        elif phase == "EAST_WEST":
            return [k for k in ["EAST", "WEST"] if k in self.approaches]
        return [list(self.approaches.keys())[0]] if self.approaches else []

    def get_approach_signal(self, approach_key: str) -> str:
        allowed = self.get_allowed_directions(self.active_phase)
        if approach_key in allowed:
            if self.state == "GREEN":
                return "GREEN"
            elif self.state == "YELLOW":
                return "YELLOW"
        return "RED"

    def tick(self, db: Session, dt: float = 1.5):
        """State machine tick executed every processing cycle (1.5s)."""
        allowed_dirs = self.get_allowed_directions(self.active_phase) if self.state == "GREEN" else []

        for name, app in self.approaches.items():
            if name not in allowed_dirs:
                app["time_since_last_green"] += dt
                if app["queue_length"] > 0:
                    app["waiting_time"] += dt
            else:
                app["time_since_last_green"] = 0.0
                app["waiting_time"] = 0.0

            arrival = app["queue_growth_rate"] * dt
            if app["emergency_detected"]:
                arrival += 1.0

            app["vehicle_count"] += arrival
            app["queue_length"] = int(app["vehicle_count"] * 0.8)

            if name in allowed_dirs and self.state == "GREEN":
                departure = app["flow_rate"] * dt
                app["vehicle_count"] = max(0.0, app["vehicle_count"] - departure)
                app["queue_length"] = int(app["vehicle_count"] * 0.8)

                if app["vehicle_count"] < 1.0 and app["emergency_detected"]:
                    app["emergency_detected"] = False
                    app["emergency_type"] = None
                    logger.info(f"Emergency vehicle cleared approach {name} at intersection {self.intersection_id}.")

        self.countdown = max(0, self.countdown - int(dt))
        if self.state == "GREEN":
            self.elapsed_green_time += dt

        if self.countdown <= 0:
            self._handle_state_transition(db)
        elif self.mode == "AUTOMATIC" and self.state == "GREEN" and self.elapsed_green_time >= settings.MIN_GREEN_TIME:
            self._reassess_green_phase(db)

    def _handle_state_transition(self, db: Session):
        if self.state == "GREEN":
            self.state = "YELLOW"
            self.countdown = settings.YELLOW_TIME
            logger.info(f"Intersection #{self.intersection_id} approach {self.active_approach} transitioning to YELLOW.")
        elif self.state == "YELLOW":
            self.state = "RED_CLEARANCE"
            self.countdown = settings.ALL_RED_TIME
            logger.info(f"Intersection #{self.intersection_id} transitioning to RED_CLEARANCE.")
        elif self.state == "RED_CLEARANCE":
            self.state = "GREEN"
            self.elapsed_green_time = 0.0

            if self.mode == "MANUAL" and self.manual_target_approach:
                self.active_approach = self.manual_target_approach
                self.active_phase = self.manual_target_approach
                self.countdown = 30
                self.last_reasoning = f"Manual override active: Forced green to {self.active_approach} Approach."
            else:
                self._run_optimization(db)

    def _reassess_green_phase(self, db: Session):
        """Continuously checks if waiting approach queue or starvation priority mandates early phase transition."""
        current_dirs = self.get_allowed_directions(self.active_phase)
        waiting_dirs = [k for k in self.approaches.keys() if k not in current_dirs]

        current_queue = sum(self.approaches[d]["queue_length"] for d in current_dirs)
        
        waiting_scores = {}
        for d in waiting_dirs:
            app = self.approaches[d]
            waiting_scores[d] = self.optimizer.calculate_priority_score(
                app["vehicle_count"],
                app["queue_length"],
                app["waiting_time"],
                app["queue_growth_rate"],
                app["time_since_last_green"],
                app["emergency_detected"],
                app.get("pedestrian_waiting", 0)
            )

        max_waiting_score = max(waiting_scores.values()) if waiting_scores else 0.0

        current_scores = [
            self.optimizer.calculate_priority_score(
                self.approaches[d]["vehicle_count"],
                self.approaches[d]["queue_length"],
                self.approaches[d]["waiting_time"],
                self.approaches[d]["queue_growth_rate"],
                self.approaches[d]["time_since_last_green"],
                self.approaches[d]["emergency_detected"],
                self.approaches[d].get("pedestrian_waiting", 0)
            ) for d in current_dirs
        ]
        current_score = sum(current_scores) if current_scores else 0.0

        if (current_queue == 0) or (max_waiting_score > current_score + 80.0):
            self.state = "YELLOW"
            self.countdown = settings.YELLOW_TIME
            self.last_reasoning = (
                f"Continuous Reassessment: Current approach queue cleared ({current_queue == 0}) or "
                f"waiting approach priority ({max_waiting_score:.1f}) exceeded current ({current_score:.1f}). Transitioning safely."
            )
            logger.info(f"Reassessment triggered phase transition for Intersection #{self.intersection_id}.")

    def _run_optimization(self, db: Session):
        """Dynamic Priority Optimization across ALL active approaches (2, 3, or 4 sides)."""
        scores: Dict[str, float] = {}
        for name, app in self.approaches.items():
            scores[name] = self.optimizer.calculate_priority_score(
                app["vehicle_count"],
                app["queue_length"],
                app["waiting_time"],
                app["queue_growth_rate"],
                app["time_since_last_green"],
                app["emergency_detected"],
                app.get("pedestrian_waiting", 0)
            )

        # Emergency override check
        emergency_approach = next((name for name, app in self.approaches.items() if app["emergency_detected"]), None)
        if emergency_approach:
            best_approach = emergency_approach
            highest_score = scores[best_approach]
        else:
            # Sort approaches by score descending
            sorted_approaches = sorted(scores.items(), key=lambda x: x[1], reverse=True)
            best_approach, highest_score = sorted_approaches[0]

        app_data = self.approaches[best_approach]
        queue_len = app_data["queue_length"]
        veh_count = int(app_data["vehicle_count"])
        density = "LOW" if queue_len < 3 else ("MODERATE" if queue_len < 10 else "HIGH")
        green_time = self.optimizer.calculate_dynamic_green(queue_len, veh_count, density)

        self.active_approach = best_approach
        self.active_phase = best_approach
        self.countdown = green_time

        scores_summary = ", ".join([f"{k}: {v:.1f}pts" for k, v in scores.items()])
        self.last_reasoning = (
            f"AI Decision: {best_approach} Approach awarded green for {green_time}s. "
            f"Highest Priority Score: {highest_score:.1f}pts (Scores: {scores_summary}). "
            f"Queue: {queue_len} vehicles, Count: {veh_count}."
        )

        self._log_decision(db, green_time)

    def _log_decision(self, db: Session, green_time: int):
        try:
            sig = db.query(Signal).filter(Signal.intersection_id == self.intersection_id).first()
            if sig:
                sig.current_phase = self.active_phase
                sig.green_duration = green_time
                sig.last_phase_change = datetime.now(timezone.utc).replace(tzinfo=None)
                db.add(sig)

                decision = SignalDecision(
                    signal_id=sig.id,
                    recommended_green=green_time,
                    recommended_red=int(max(15, 120 - green_time)),
                    recommended_phase=self.active_phase,
                    priority_level="HIGH" if self.mode == "EMERGENCY" else "NORMAL",
                    reasoning=self.last_reasoning,
                    confidence=0.98,
                    applied=True
                )
                db.add(decision)
                db.commit()
                db.refresh(decision)
        except Exception as e:
            logger.error(f"Error logging signal decision: {e}")
            db.rollback()

    def request_manual_control(self, db: Session, target: Optional[str] = None, reason: str = "", username: str = "SYSTEM", phase: Optional[str] = None) -> bool:
        raw_key = phase or target or "NORTH"
        target_key = raw_key.upper()
        self._manual_raw_phase = raw_key

        # If legacy phase, map to an approach
        if target_key not in self.approaches:
            if target_key == "NORTH_SOUTH":
                target_key = "NORTH" if "NORTH" in self.approaches else list(self.approaches.keys())[0]
            elif target_key == "EAST_WEST":
                target_key = "EAST" if "EAST" in self.approaches else list(self.approaches.keys())[0]
            else:
                return False

        self.mode = "MANUAL"
        self.manual_target_approach = target_key
        self.manual_reason = reason
        self.manual_user = username

        if self.active_approach != target_key and self.state == "GREEN":
            self.state = "YELLOW"
            self.countdown = settings.YELLOW_TIME
        else:
            self.active_approach = target_key
            self.active_phase = target_key
            self.state = "GREEN"
            self.countdown = 30
            self.elapsed_green_time = 0.0

        self.last_reasoning = f"MANUAL OVERRIDE applied by User {username}. Reason: {reason}. Forced Phase: {raw_key} ({target_key})."

        try:
            log = AuditLog(
                username=username,
                action="MANUAL_SIGNAL_OVERRIDE",
                details=f"Intersection #{self.intersection_id} forced to phase {raw_key} ({target_key}). Reason: {reason}."
            )
            db.add(log)
            db.commit()
        except Exception as e:
            logger.error(f"Error saving manual control audit log: {e}")
            db.rollback()

        return True

    def return_to_automatic(self, db: Session, username: str) -> bool:
        self.mode = "AUTOMATIC"
        self.manual_target_approach = None
        self.manual_reason = None
        self.manual_user = None

        self.last_reasoning = f"Returned to AUTOMATIC adaptive optimization mode by User {username}."

        try:
            log = AuditLog(
                username=username,
                action="RETURN_TO_AUTO_SIGNAL",
                details=f"Intersection #{self.intersection_id} reverted back to automatic optimization mode."
            )
            db.add(log)
            db.commit()
        except Exception as e:
            logger.error(f"Error logging return to auto: {e}")
            db.rollback()

        return True


class IntersectionsRegistry:
    def __init__(self):
        self.controllers: Dict[int, SignalController] = {}

    def get_controller(self, intersection_id: int, db: Optional[Session] = None) -> SignalController:
        if intersection_id not in self.controllers:
            num_approaches = 4
            approaches_config = None
            if db:
                from app.models.models import Intersection
                inter = db.query(Intersection).filter(Intersection.id == intersection_id).first()
                if inter:
                    num_approaches = inter.num_approaches or 4
                    approaches_config = inter.approaches_config

            self.controllers[intersection_id] = SignalController(
                intersection_id=intersection_id,
                num_approaches=num_approaches,
                approaches_config=approaches_config
            )
        return self.controllers[intersection_id]

    def update_junction_config(self, intersection_id: int, num_approaches: int, approaches_config: Optional[List[Dict[str, Any]]] = None):
        controller = self.get_controller(intersection_id)
        controller.configure_approaches(num_approaches, approaches_config)
        return controller

signal_registry = IntersectionsRegistry()
signal_optimizer = AdaptiveSignalOptimizer()


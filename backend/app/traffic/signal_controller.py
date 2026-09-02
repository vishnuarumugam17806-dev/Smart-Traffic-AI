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
    Intersection Signal Controller enforcing a strict state machine:
    GREEN -> YELLOW (3s) -> RED_CLEARANCE (2s) -> RED -> NEXT PHASE GREEN.
    Supports Automatic Adaptive Mode, Manual Override, Emergency Preemption, and Anti-Starvation Fairness.
    """

    def __init__(self, intersection_id: int):
        self.intersection_id = intersection_id
        self.active_phase = "NORTH_SOUTH"  # NORTH_SOUTH, EAST_WEST
        self.state = "GREEN"  # GREEN, YELLOW, RED_CLEARANCE
        self.countdown = 30
        self.mode = "AUTOMATIC"  # AUTOMATIC, MANUAL, EMERGENCY, FAILSAFE

        self.manual_target_phase = None
        self.manual_reason = None
        self.manual_user = None

        self.approaches = {
            "NORTH": self._init_approach("NORTH"),
            "SOUTH": self._init_approach("SOUTH"),
            "EAST": self._init_approach("EAST"),
            "WEST": self._init_approach("WEST")
        }

        self.optimizer = AdaptiveSignalOptimizer()
        self.last_decision_time = datetime.utcnow()
        self.last_reasoning = "System initialized in Automatic mode."
        self.elapsed_green_time = 0.0

    def _init_approach(self, direction: str) -> Dict[str, Any]:
        return {
            "direction": direction,
            "vehicle_count": 8,
            "queue_length": 3,
            "waiting_time": 0.0,
            "queue_growth_rate": 0.15,
            "flow_rate": 0.6,
            "time_since_last_green": 0.0,
            "pedestrian_waiting": 1,
            "emergency_detected": False,
            "emergency_type": None
        }

    def get_allowed_directions(self, phase: str) -> List[str]:
        if phase == "NORTH_SOUTH":
            return ["NORTH", "SOUTH"]
        else:
            return ["EAST", "WEST"]

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
            logger.info(f"Intersection #{self.intersection_id} phase {self.active_phase} transitioning to YELLOW.")
        elif self.state == "YELLOW":
            self.state = "RED_CLEARANCE"
            self.countdown = settings.ALL_RED_TIME
            logger.info(f"Intersection #{self.intersection_id} transitioning to RED_CLEARANCE.")
        elif self.state == "RED_CLEARANCE":
            self.state = "GREEN"
            self.elapsed_green_time = 0.0

            if self.mode == "MANUAL" and self.manual_target_phase:
                self.active_phase = self.manual_target_phase
                self.countdown = 30
                self.last_reasoning = f"Manual override active: Phase forced to {self.active_phase}."
            else:
                self._run_optimization(db)

    def _reassess_green_phase(self, db: Session):
        """Continuously checks if waiting approach queue or starvation priority mandates early phase transition."""
        current_dirs = self.get_allowed_directions(self.active_phase)
        waiting_phase = "EAST_WEST" if self.active_phase == "NORTH_SOUTH" else "NORTH_SOUTH"
        waiting_dirs = self.get_allowed_directions(waiting_phase)

        current_queue = sum(self.approaches[d]["queue_length"] for d in current_dirs)
        waiting_priority_score = sum(
            self.optimizer.calculate_priority_score(
                self.approaches[d]["vehicle_count"],
                self.approaches[d]["queue_length"],
                self.approaches[d]["waiting_time"],
                self.approaches[d]["queue_growth_rate"],
                self.approaches[d]["time_since_last_green"],
                self.approaches[d]["emergency_detected"],
                self.approaches[d].get("pedestrian_waiting", 0)
            ) for d in waiting_dirs
        )

        current_priority_score = sum(
            self.optimizer.calculate_priority_score(
                self.approaches[d]["vehicle_count"],
                self.approaches[d]["queue_length"],
                self.approaches[d]["waiting_time"],
                self.approaches[d]["queue_growth_rate"],
                self.approaches[d]["time_since_last_green"],
                self.approaches[d]["emergency_detected"],
                self.approaches[d].get("pedestrian_waiting", 0)
            ) for d in current_dirs
        )

        if (current_queue == 0) or (waiting_priority_score > current_priority_score + 80.0):
            self.state = "YELLOW"
            self.countdown = settings.YELLOW_TIME
            self.last_reasoning = (
                f"Continuous Reassessment: Queue cleared ({current_queue == 0}) or "
                f"waiting priority score ({waiting_priority_score:.1f}) exceeded current ({current_priority_score:.1f}). Transitioning safely."
            )
            logger.info(f"Reassessment triggered phase transition for Intersection #{self.intersection_id}.")

    def _run_optimization(self, db: Session):
        ns_dirs = ["NORTH", "SOUTH"]
        ew_dirs = ["EAST", "WEST"]

        ns_score = sum(
            self.optimizer.calculate_priority_score(
                self.approaches[d]["vehicle_count"],
                self.approaches[d]["queue_length"],
                self.approaches[d]["waiting_time"],
                self.approaches[d]["queue_growth_rate"],
                self.approaches[d]["time_since_last_green"],
                self.approaches[d]["emergency_detected"],
                self.approaches[d].get("pedestrian_waiting", 0)
            ) for d in ns_dirs
        )

        ew_score = sum(
            self.optimizer.calculate_priority_score(
                self.approaches[d]["vehicle_count"],
                self.approaches[d]["queue_length"],
                self.approaches[d]["waiting_time"],
                self.approaches[d]["queue_growth_rate"],
                self.approaches[d]["time_since_last_green"],
                self.approaches[d]["emergency_detected"],
                self.approaches[d].get("pedestrian_waiting", 0)
            ) for d in ew_dirs
        )

        selected_phase = "NORTH_SOUTH" if ns_score >= ew_score else "EAST_WEST"
        selected_dirs = ns_dirs if selected_phase == "NORTH_SOUTH" else ew_dirs

        max_queue = max(self.approaches[d]["queue_length"] for d in selected_dirs)
        tot_count = sum(self.approaches[d]["vehicle_count"] for d in selected_dirs)

        density = "LOW" if max_queue < 3 else ("MODERATE" if max_queue < 10 else "HIGH")
        green_time = self.optimizer.calculate_dynamic_green(max_queue, int(tot_count), density)

        self.active_phase = selected_phase
        self.countdown = green_time

        self.last_reasoning = (
            f"AI Decision: Phase {selected_phase} awarded green for {green_time}s. "
            f"Priority Score: {max(ns_score, ew_score):.1f} vs {min(ns_score, ew_score):.1f}. "
            f"Queue: {max_queue} vehicles, average arrival rate: {sum(self.approaches[d]['queue_growth_rate'] for d in selected_dirs)/2.0:.2f} veh/s."
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

    def request_manual_control(self, db: Session, phase: str, reason: str, username: str) -> bool:
        if phase not in ["NORTH_SOUTH", "EAST_WEST"]:
            return False

        self.mode = "MANUAL"
        self.manual_target_phase = phase
        self.manual_reason = reason
        self.manual_user = username

        if self.active_phase != phase and self.state == "GREEN":
            self.state = "YELLOW"
            self.countdown = settings.YELLOW_TIME
        else:
            self.active_phase = phase
            self.state = "GREEN"
            self.countdown = 30
            self.elapsed_green_time = 0.0

        self.last_reasoning = f"MANUAL OVERRIDE applied by User {username}. Reason: {reason}. Forced Phase: {phase}."

        try:
            log = AuditLog(
                username=username,
                action="MANUAL_SIGNAL_OVERRIDE",
                details=f"Intersection #{self.intersection_id} forced to phase {phase}. Reason: {reason}."
            )
            db.add(log)
            db.commit()
        except Exception as e:
            logger.error(f"Error saving manual control audit log: {e}")
            db.rollback()

        return True

    def return_to_automatic(self, db: Session, username: str) -> bool:
        self.mode = "AUTOMATIC"
        self.manual_target_phase = None
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

    def get_controller(self, intersection_id: int) -> SignalController:
        if intersection_id not in self.controllers:
            self.controllers[intersection_id] = SignalController(intersection_id)
        return self.controllers[intersection_id]

signal_registry = IntersectionsRegistry()
signal_optimizer = AdaptiveSignalOptimizer()

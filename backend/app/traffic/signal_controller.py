import logging
import time
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.models import Signal, SignalDecision, AuditLog, Intersection, CongestionLevelEnum

logger = logging.getLogger(__name__)

# Centralized weights dictionary directly synchronized with settings
WEIGHTS = {
    "queue_weight": settings.QUEUE_WEIGHT,          # 0.45
    "vehicle_weight": settings.VEHICLE_WEIGHT,      # 0.25
    "wait_weight": settings.WAIT_WEIGHT,            # 0.20
    "density_weight": settings.DENSITY_WEIGHT,      # 0.10
    "max_allowed_wait": settings.MAX_ALLOWED_WAIT,  # 120.0s
    "waiting_bonus_weight": settings.WAITING_BONUS_WEIGHT,
    # Legacy alias keys for backwards compatibility
    "density": settings.DENSITY_WEIGHT,
    "queue_length": settings.QUEUE_WEIGHT,
    "waiting_time": settings.WAIT_WEIGHT,
    "queue_growth": 0.1,
    "emergency": 150.0,
    "pedestrian": 2.5,
    "downstream_congestion": 2.0,
    "fairness": settings.WAITING_BONUS_WEIGHT
}

class AdaptiveSignalOptimizer:
    """
    Production-grade Multi-Factor AI Decision Engine for Adaptive Signal Optimization.
    Calculates deterministic Priority Scores considering:
    1. Queue length (45% weight - primary factor for accumulated waiting traffic)
    2. Vehicle count (25% weight)
    3. Waiting time (20% weight)
    4. Traffic density (10% weight)
    5. Anti-starvation fairness bonus
    6. Emergency vehicle preemption
    """

    def normalize_queue(self, queue_length: float) -> float:
        """Normalizes queue length to [0.0, 1.0] using configured MAX_EXPECTED_QUEUE."""
        return min(1.0, max(0.0, float(queue_length) / float(settings.MAX_EXPECTED_QUEUE)))

    def normalize_vehicle_count(self, vehicle_count: float) -> float:
        """Normalizes vehicle count to [0.0, 1.0] using configured MAX_EXPECTED_VEHICLES."""
        return min(1.0, max(0.0, float(vehicle_count) / float(settings.MAX_EXPECTED_VEHICLES)))

    def normalize_waiting_time(self, waiting_time: float) -> float:
        """Normalizes waiting time to [0.0, 1.0] using MAX_ALLOWED_WAIT."""
        return min(1.0, max(0.0, float(waiting_time) / float(settings.MAX_ALLOWED_WAIT)))

    def normalize_density(self, density: Any) -> float:
        """Maps categorical density or percentage to normalized [0.0, 1.0]."""
        if isinstance(density, (int, float)):
            return min(1.0, max(0.0, float(density) / 100.0 if density > 1.0 else float(density)))
        d_str = str(density).upper()
        if "SEVERE" in d_str or "CRITICAL" in d_str:
            return 1.0
        elif "HIGH" in d_str:
            return 0.8
        elif "MODERATE" in d_str or "MEDIUM" in d_str:
            return 0.5
        return 0.2

    def calculate_demand_score(
        self,
        queue_length: float,
        vehicle_count: float,
        waiting_time: float,
        density: Any
    ) -> float:
        """
        Calculates normalized demand score for an approach:
        demand_score = queue_norm * 0.45 + vehicle_norm * 0.25 + waiting_norm * 0.20 + density_norm * 0.10
        Weights sum to 1.0. Score is cleanly bounded in [0.0, 1.0].
        """
        q_norm = self.normalize_queue(queue_length)
        v_norm = self.normalize_vehicle_count(vehicle_count)
        w_norm = self.normalize_waiting_time(waiting_time)
        d_norm = self.normalize_density(density)

        demand = (
            q_norm * settings.QUEUE_WEIGHT +
            v_norm * settings.VEHICLE_WEIGHT +
            w_norm * settings.WAIT_WEIGHT +
            d_norm * settings.DENSITY_WEIGHT
        )
        return round(min(1.0, max(0.0, demand)), 4)

    def calculate_waiting_fairness_bonus(self, waiting_time: float) -> float:
        """Gradually increases priority as waiting time grows, preventing approach neglect."""
        ratio = min(1.0, max(0.0, float(waiting_time) / float(settings.MAX_ALLOWED_WAIT)))
        return round(ratio * settings.WAITING_BONUS_WEIGHT, 4)

    def calculate_starvation_prevention_bonus(self, waiting_time: float) -> float:
        """
        Anti-starvation safety guarantee.
        If an approach has waited >= 50% of MAX_ALLOWED_WAIT, exponentially escalates priority
        so that it is guaranteed service regardless of competing traffic volume.
        """
        threshold = settings.MAX_ALLOWED_WAIT * 0.50
        if waiting_time > threshold:
            excess = (waiting_time - threshold) / (settings.MAX_ALLOWED_WAIT - threshold + 1e-5)
            return round(min(1.5, max(0.0, excess * 1.5)), 4)
        return 0.0

    def calculate_priority_score(
        self,
        vehicle_count: float,
        queue_length: float,
        waiting_time: float,
        queue_growth_rate: float = 0.0,
        time_since_last_green: float = 0.0,
        emergency_detected: bool = False,
        pedestrian_waiting: int = 0,
        downstream_congestion: float = 0.0,
        density_state: Optional[str] = None
    ) -> float:
        """
        Calculates Priority Score for an approach:
        priority_score = demand_score + waiting_fairness_bonus + starvation_prevention_bonus (+ emergency)
        """
        effective_wait = max(float(waiting_time), float(time_since_last_green))
        d_state = density_state or ("HIGH" if queue_length > 10 else ("MODERATE" if queue_length > 3 else "LOW"))

        demand_score = self.calculate_demand_score(
            queue_length=queue_length,
            vehicle_count=vehicle_count,
            waiting_time=effective_wait,
            density=d_state
        )

        fairness_bonus = self.calculate_waiting_fairness_bonus(effective_wait)
        starvation_bonus = self.calculate_starvation_prevention_bonus(effective_wait)

        # Scale priority score to a clean points scale [0 - 100] for display & comparison
        base_priority = (demand_score + fairness_bonus + starvation_bonus) * 50.0

        if emergency_detected:
            base_priority += 200.0  # Immediate emergency preemption

        # Pedestrian bonus
        if pedestrian_waiting > 0:
            base_priority += min(15.0, pedestrian_waiting * 2.5)

        # Downstream congestion penalty
        if downstream_congestion > 0:
            base_priority -= min(20.0, downstream_congestion * 2.0)

        return round(max(0.0, base_priority), 2)

    def calculate_green_time(
        self,
        demand_score: float,
        approach_data: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Interpolates green duration between MIN_GREEN_TIME and MAX_GREEN_TIME based on demand:
        green_time = MIN_GREEN_TIME + (demand_score * (MAX_GREEN_TIME - MIN_GREEN_TIME))
        Clamped to [MIN_GREEN_TIME, MAX_GREEN_TIME].
        """
        raw_green = settings.MIN_GREEN_TIME + (demand_score * (settings.MAX_GREEN_TIME - settings.MIN_GREEN_TIME))
        clamped_green = max(settings.MIN_GREEN_TIME, min(settings.MAX_GREEN_TIME, int(round(raw_green))))
        return clamped_green

    def calculate_dynamic_green(self, queue_length: int, vehicle_count: int, density_state: str) -> int:
        """Backwards-compatible helper mapping queue and count to dynamic green duration."""
        demand = self.calculate_demand_score(queue_length, vehicle_count, 0.0, density_state)
        return self.calculate_green_time(demand)

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

        demand_score = self.calculate_demand_score(queue_length, vehicle_count, 0.0, density_state)
        green = self.calculate_green_time(demand_score)
        red = int(max(settings.MIN_GREEN_TIME, 120 - green))

        reasoning = (
            f"Traffic demand calculated at {demand_score:.2f} (Queue: {queue_length} veh [weight {settings.QUEUE_WEIGHT*100:.0f}%], "
            f"Vehicles: {vehicle_count} [weight {settings.VEHICLE_WEIGHT*100:.0f}%], Density: {density_state}). "
            f"Optimal green phase allocated: {green}s (bounded within [{settings.MIN_GREEN_TIME}s, {settings.MAX_GREEN_TIME}s])."
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
    Generic Dynamic Intersection Signal Controller supporting 2, 3, 4, or N approach junctions.
    Strictly enforces safe transitions: GREEN -> YELLOW (3s) -> RED_CLEARANCE (2s) -> RED -> NEXT APPROACH GREEN.
    Never allows simultaneous conflicting green phases.
    Balances high traffic demand, waiting time fairness, anti-starvation rules, and safety bounds.
    """

    def __init__(
        self,
        intersection_id: int,
        num_approaches: int = 4,
        approaches_config: Optional[List[Dict[str, Any]]] = None
    ):
        self.intersection_id = intersection_id
        self.num_approaches = num_approaches
        self.state = "GREEN"  # GREEN, YELLOW, RED_CLEARANCE
        self.countdown = 30
        self.mode = "AUTOMATIC"  # AUTOMATIC, MANUAL, EMERGENCY, FAILSAFE

        self.manual_target_approach: Optional[str] = None
        self.manual_reason: Optional[str] = None
        self.manual_user: Optional[str] = None

        self.optimizer = AdaptiveSignalOptimizer()
        self.last_decision_time = datetime.now(timezone.utc).replace(tzinfo=None)
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
        """Configures the active approaches for this junction (2, 3, 4, or N)."""
        self.num_approaches = num_approaches
        self.approaches = {}

        if approaches_config and len(approaches_config) > 0:
            for item in approaches_config[:num_approaches]:
                key = str(item.get("direction") or item.get("id") or item.get("name") or f"APPROACH_{len(self.approaches)+1}").upper()
                self.approaches[key] = self._init_approach(
                    direction=key,
                    name=item.get("name") or f"{key.title()} Approach",
                    camera_id=item.get("camera_id")
                )
        else:
            default_keys = (
                ["NORTH", "SOUTH"] if num_approaches == 2
                else (["NORTH", "EAST", "WEST"] if num_approaches == 3
                      else ["NORTH", "EAST", "SOUTH", "WEST"][:num_approaches])
            )
            for k in default_keys:
                self.approaches[k] = self._init_approach(direction=k, name=f"{k.title()} Approach")

        if not hasattr(self, 'active_approach') or self.active_approach not in self.approaches:
            self.active_approach = list(self.approaches.keys())[0] if self.approaches else "NORTH"
            self.active_phase = self.active_approach

    def _init_approach(self, direction: str, name: str = "", camera_id: Optional[int] = None) -> Dict[str, Any]:
        """Initializes a rich approach data record adhering to Section 2 specification."""
        now_str = datetime.now(timezone.utc).isoformat()
        return {
            "direction": direction,
            "name": name or f"{direction.title()} Approach",
            "camera_id": camera_id,
            "camera_status": "DATA_AVAILABLE",  # DATA_AVAILABLE, DATA_STALE, CAMERA_OFFLINE, NO_DETECTION
            "vehicle_count": 14.0,
            "queue_length": 5,
            "traffic_density": "MODERATE",
            "average_speed": 38.5,
            "waiting_time": 0.0,
            "time_since_last_green": 0.0,
            "queue_growth_rate": 0.15,
            "flow_rate": 0.8,
            "demand_score": 0.25,
            "priority_score": 25.0,
            "green_duration": 30,
            "detection_radius_m": getattr(settings, "DETECTION_RADIUS_M", 20.0),
            "passed_radius_count": 0,
            "last_passed_radius_time": None,
            "is_queue_available": True,
            "queue_timestamp": now_str,
            "last_observation_time": now_str,
            "pedestrian_waiting": 0,
            "emergency_detected": False,
            "emergency_type": None
        }

    def update_approach_observation(
        self,
        approach_key: str,
        vehicle_count: float,
        queue_length: int,
        traffic_density: str,
        average_speed: float = 35.0,
        camera_status: str = "DATA_AVAILABLE",
        is_queue_available: bool = True
    ):
        """Updates approach traffic inputs derived from camera/AI detection (Section 2 & 22)."""
        key = approach_key.upper()
        if key in self.approaches:
            app = self.approaches[key]
            app["vehicle_count"] = max(0.0, float(vehicle_count))
            app["queue_length"] = max(0, int(queue_length))
            app["traffic_density"] = traffic_density
            app["average_speed"] = average_speed
            app["camera_status"] = camera_status
            app["is_queue_available"] = is_queue_available
            now_str = datetime.now(timezone.utc).isoformat()
            app["queue_timestamp"] = now_str
            app["last_observation_time"] = now_str

    def vehicle_passed_radius(
        self,
        db: Session,
        approach_key: Optional[str] = None,
        vehicle_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Invoked when a vehicle passes the intersection detection radius.
        Decrements approach occupancy. If no vehicles remain on the approach,
        automatically triggers an immediate safe transition to the next approach.
        """
        key = (approach_key or self.active_approach).upper()
        if key not in self.approaches:
            key = self.active_approach

        app = self.approaches[key]
        now_str = datetime.now(timezone.utc).isoformat()

        # Record vehicle pass and decrement count
        app["passed_radius_count"] = app.get("passed_radius_count", 0) + 1
        app["last_passed_radius_time"] = now_str
        app["vehicle_count"] = max(0.0, float(app["vehicle_count"]) - 1.0)
        app["queue_length"] = max(0, int(app["vehicle_count"] * 0.75))

        switched = False
        reason = ""

        # If this approach is active GREEN and now has NO vehicles remaining
        if self.mode == "AUTOMATIC" and self.state == "GREEN" and key == self.active_approach:
            if app["vehicle_count"] <= 0.05:
                app["vehicle_count"] = 0.0
                app["queue_length"] = 0
                self.state = "YELLOW"
                self.countdown = settings.YELLOW_TIME
                switched = True
                reason = (
                    f"Vehicle passed intersection radius (20m). Approach {key} has 0 vehicles remaining. "
                    f"Signal automatically changing and switching to next approach."
                )
                self.last_reasoning = reason
                logger.info(f"[Radius Auto-Switch] {reason}")

        return {
            "intersection_id": self.intersection_id,
            "approach": key,
            "vehicle_id": vehicle_id,
            "vehicles_remaining": round(app["vehicle_count"], 1),
            "queue_length": app["queue_length"],
            "passed_radius_count": app["passed_radius_count"],
            "auto_switched_to_next": switched,
            "state": self.state,
            "countdown": self.countdown,
            "reasoning": reason or f"Vehicle passed radius on {key} approach ({app['vehicle_count']:.0f} remaining)."
        }

    def clear_approach_vehicles(self, db: Session, approach_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Simulates all vehicles on the approach passing the radius (0 vehicles remaining).
        Triggers instant automatic phase change to the next approach if active.
        """
        key = (approach_key or self.active_approach).upper()
        if key not in self.approaches:
            key = self.active_approach

        app = self.approaches[key]
        app["passed_radius_count"] = app.get("passed_radius_count", 0) + max(1, int(app["vehicle_count"]))
        app["vehicle_count"] = 0.0
        app["queue_length"] = 0
        app["last_passed_radius_time"] = datetime.now(timezone.utc).isoformat()

        switched = False
        if self.mode == "AUTOMATIC" and self.state == "GREEN" and key == self.active_approach:
            self.state = "YELLOW"
            self.countdown = settings.YELLOW_TIME
            switched = True
            self.last_reasoning = (
                f"Radius Clearance: All vehicles passed radius. 0 vehicles remaining on {key}. "
                f"Automatically switching signal to next approach."
            )
            logger.info(f"[Radius Auto-Switch] {self.last_reasoning}")

        return {
            "intersection_id": self.intersection_id,
            "approach": key,
            "vehicles_remaining": 0,
            "auto_switched_to_next": switched,
            "state": self.state,
            "countdown": self.countdown,
            "reasoning": self.last_reasoning
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
        """Authoritative backend signal state for approach."""
        allowed = self.get_allowed_directions(self.active_phase)
        if approach_key in allowed:
            if self.state == "GREEN":
                return "GREEN"
            elif self.state == "YELLOW":
                return "YELLOW"
        return "RED"

    def tick(self, db: Session, dt: float = 1.5):
        """
        State machine tick executed every cycle.
        Maintains waiting times, accumulates green duration, triggers reassessment, and advances states.
        """
        allowed_dirs = self.get_allowed_directions(self.active_phase) if self.state == "GREEN" else []

        for name, app in self.approaches.items():
            if name not in allowed_dirs:
                app["time_since_last_green"] += dt
                if app["queue_length"] > 0:
                    app["waiting_time"] += dt
            else:
                app["time_since_last_green"] = 0.0
                app["waiting_time"] = 0.0

            # Natural traffic flow simulation if no active live stream updates arrival
            arrival = app["queue_growth_rate"] * dt
            if app["emergency_detected"]:
                arrival += 1.0
            app["vehicle_count"] += arrival
            app["queue_length"] = int(app["vehicle_count"] * 0.75)

            if name in allowed_dirs and self.state == "GREEN":
                departure = app["flow_rate"] * dt
                app["vehicle_count"] = max(0.0, app["vehicle_count"] - departure)
                app["queue_length"] = int(app["vehicle_count"] * 0.75)

                if app["vehicle_count"] < 1.0 and app["emergency_detected"]:
                    app["emergency_detected"] = False
                    app["emergency_type"] = None
                    logger.info(f"Emergency vehicle cleared approach {name} at intersection {self.intersection_id}.")

            # Compute current priority scores for real-time monitoring
            demand = self.optimizer.calculate_demand_score(
                queue_length=app["queue_length"],
                vehicle_count=app["vehicle_count"],
                waiting_time=app["waiting_time"],
                density=app.get("traffic_density", "MODERATE")
            )
            app["demand_score"] = demand
            app["priority_score"] = self.optimizer.calculate_priority_score(
                vehicle_count=app["vehicle_count"],
                queue_length=app["queue_length"],
                waiting_time=app["waiting_time"],
                queue_growth_rate=app["queue_growth_rate"],
                time_since_last_green=app["time_since_last_green"],
                emergency_detected=app["emergency_detected"],
                pedestrian_waiting=app.get("pedestrian_waiting", 0),
                density_state=app.get("traffic_density", "MODERATE")
            )

        self.countdown = max(0, self.countdown - int(dt))
        if self.state == "GREEN":
            self.elapsed_green_time += dt

        if self.countdown <= 0:
            self._handle_state_transition(db)
        elif self.mode == "AUTOMATIC" and self.state == "GREEN":
            # Radius Clearance Check: If all vehicles on the active green approach have passed the radius
            # (leaving 0 vehicles and 0 queue), immediately trigger safe transition to next approach.
            active_app = self.approaches.get(self.active_approach, {})
            curr_v = active_app.get("vehicle_count", 0.0)
            curr_q = active_app.get("queue_length", 0)
            if curr_v <= 0.05 and curr_q == 0 and self.elapsed_green_time >= 2.0:
                self.state = "YELLOW"
                self.countdown = settings.YELLOW_TIME
                self.last_reasoning = (
                    f"Radius Auto-Switch: All vehicles passed detection radius (20m). Approach {self.active_approach} "
                    f"has 0 vehicles remaining. Automatically switching signal to next approach."
                )
                logger.info(f"Approach {self.active_approach} empty inside radius. Triggered auto-switch to next approach.")
            elif self.elapsed_green_time >= settings.MIN_GREEN_TIME:
                self._reassess_green_phase(db)

    def _handle_state_transition(self, db: Session):
        """
        Enforces safe transitions (Section 18):
        CURRENT GREEN -> YELLOW (3s) -> RED_CLEARANCE (2s) -> NEXT APPROACH GREEN.
        """
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
                self._log_decision(db, self.countdown, self.active_approach, 100.0, 1.0, self.last_reasoning)
            else:
                self._run_optimization(db)

    def _reassess_green_phase(self, db: Session):
        """
        Do not waste green time (Section 17):
        If the current green approach clears its queue after MIN_GREEN_TIME,
        and other competing approaches have waiting queues or high waiting time,
        transition early through YELLOW safely.
        """
        active_app = self.approaches.get(self.active_approach, {})
        current_queue = active_app.get("queue_length", 0)

        waiting_dirs = [k for k in self.approaches.keys() if k != self.active_approach]
        if not waiting_dirs:
            return

        waiting_demand = sum(self.approaches[d]["queue_length"] for d in waiting_dirs)
        max_waiting_time = max((self.approaches[d]["waiting_time"] for d in waiting_dirs), default=0.0)

        # Calculate scores for comparison
        current_score = active_app.get("priority_score", 0.0)
        max_waiting_score = max((self.approaches[d].get("priority_score", 0.0) for d in waiting_dirs), default=0.0)

        # Trigger early safe termination if queue empty or waiting priority significantly overtakes
        if (current_queue == 0 and (waiting_demand > 0 or max_waiting_time > 20.0)) or (max_waiting_score > current_score + 40.0):
            self.state = "YELLOW"
            self.countdown = settings.YELLOW_TIME
            self.last_reasoning = (
                f"Continuous Reassessment (Do Not Waste Green): Active {self.active_approach} queue cleared ({current_queue == 0}) "
                f"after {int(self.elapsed_green_time)}s. Waiting approaches demand: {waiting_demand} veh "
                f"(max wait: {int(max_waiting_time)}s, score: {max_waiting_score:.1f}pts vs current {current_score:.1f}pts). "
                f"Transitioning safely via Yellow clearance."
            )
            logger.info(f"Reassessment triggered early safe phase transition for Intersection #{self.intersection_id}.")

    def _run_optimization(self, db: Session):
        """
        Dynamic Priority Optimization across ALL active approaches (2, 3, 4, or N sides).
        Operates generically without hard-coded directional sequences (Section 11-15).
        """
        if not self.approaches:
            return

        priority_scores: Dict[str, float] = {}
        demand_scores: Dict[str, float] = {}

        for name, app in self.approaches.items():
            demand = self.optimizer.calculate_demand_score(
                queue_length=app["queue_length"],
                vehicle_count=app["vehicle_count"],
                waiting_time=app["waiting_time"],
                density=app.get("traffic_density", "MODERATE")
            )
            score = self.optimizer.calculate_priority_score(
                vehicle_count=app["vehicle_count"],
                queue_length=app["queue_length"],
                waiting_time=app["waiting_time"],
                queue_growth_rate=app.get("queue_growth_rate", 0.0),
                time_since_last_green=app.get("time_since_last_green", 0.0),
                emergency_detected=app.get("emergency_detected", False),
                pedestrian_waiting=app.get("pedestrian_waiting", 0),
                density_state=app.get("traffic_density", "MODERATE")
            )
            app["demand_score"] = demand
            app["priority_score"] = score
            demand_scores[name] = demand
            priority_scores[name] = score

        # 1. Emergency Preemption Check
        emergency_approach = next((name for name, app in self.approaches.items() if app.get("emergency_detected")), None)
        if emergency_approach:
            best_approach = emergency_approach
            highest_score = priority_scores[best_approach]
            best_demand = demand_scores[best_approach]
            green_time = 60
            reasoning = f"Emergency Preemption: Detected emergency vehicle on {best_approach} approach. Overriding normal cycle for immediate green corridor."
        else:
            # 2. Select approach with highest priority score
            sorted_approaches = sorted(priority_scores.items(), key=lambda x: x[1], reverse=True)

            # If current active approach has 0 queue (cleared), advance to another approach
            other_approaches = [a for a in sorted_approaches if a[0] != self.active_approach]
            curr_app_queue = self.approaches.get(self.active_approach, {}).get("queue_length", 0)
            if other_approaches and curr_app_queue == 0:
                best_approach, highest_score = other_approaches[0]
            else:
                best_approach, highest_score = sorted_approaches[0]

            best_demand = demand_scores[best_approach]
            app_data = self.approaches[best_approach]

            # 3. Calculate interpolated green duration clamped between MIN_GREEN_TIME and MAX_GREEN_TIME
            green_time = self.optimizer.calculate_green_time(best_demand, app_data)

            scores_summary = ", ".join([
                f"{k}: {priority_scores[k]:.1f}pts (Q:{self.approaches[k]['queue_length']}, W:{int(self.approaches[k]['waiting_time'])}s)"
                for k in priority_scores
            ])
            reasoning = (
                f"Adaptive AI Decision: {best_approach} approach awarded {green_time}s green. "
                f"Priority Score: {highest_score:.1f}pts (Demand: {best_demand:.2f} | "
                f"Queue: {app_data['queue_length']} veh, Count: {int(app_data['vehicle_count'])}, Wait: {int(app_data['waiting_time'])}s). "
                f"Evaluated [{self.num_approaches}-approach]: {scores_summary}."
            )

        self.active_approach = best_approach
        self.active_phase = best_approach
        self.countdown = green_time
        self.last_reasoning = reasoning

        # Reset waiting time of selected approach upon grant of green
        if best_approach in self.approaches:
            self.approaches[best_approach]["waiting_time"] = 0.0
            self.approaches[best_approach]["time_since_last_green"] = 0.0
            self.approaches[best_approach]["green_duration"] = green_time

        self._log_decision(db, green_time, best_approach, highest_score, best_demand, reasoning)

    def _log_decision(
        self,
        db: Session,
        green_time: int,
        approach: str,
        priority_score: float,
        demand_score: float,
        reasoning: str
    ):
        """Stores decision with complete audit and explainability parameters (Section 31)."""
        try:
            sig = db.query(Signal).filter(Signal.intersection_id == self.intersection_id).first()
            if not sig:
                sig = Signal(
                    intersection_id=self.intersection_id,
                    current_phase=approach,
                    green_duration=green_time,
                    red_duration=int(max(settings.MIN_GREEN_TIME, 120 - green_time)),
                    yellow_duration=settings.YELLOW_TIME,
                    is_adaptive=True
                )
                db.add(sig)
                db.commit()
                db.refresh(sig)
            else:
                sig.current_phase = approach
                sig.green_duration = green_time
                sig.last_phase_change = datetime.now(timezone.utc).replace(tzinfo=None)
                db.add(sig)

            app_data = self.approaches.get(approach, {})
            decision = SignalDecision(
                signal_id=sig.id,
                junction_id=self.intersection_id,
                approach_id=approach,
                vehicle_count=float(app_data.get("vehicle_count", 0.0)),
                queue_length=int(app_data.get("queue_length", 0)),
                traffic_density=str(app_data.get("traffic_density", "MODERATE")),
                waiting_time=float(app_data.get("waiting_time", 0.0)),
                demand_score=float(demand_score),
                priority_score=float(priority_score),
                green_duration=int(green_time),
                signal_state="GREEN",
                mode=self.mode,
                decision_reason=reasoning,
                recommended_green=int(green_time),
                recommended_red=int(max(settings.MIN_GREEN_TIME, 120 - green_time)),
                recommended_phase=approach,
                priority_level="HIGH" if priority_score > 60 else "NORMAL",
                reasoning=reasoning,
                confidence=0.98,
                applied=True,
                timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
            )
            db.add(decision)
            db.commit()
        except Exception as e:
            logger.error(f"Error logging signal decision for Intersection #{self.intersection_id}: {e}")
            db.rollback()

    def request_manual_control(
        self,
        db: Session,
        target: Optional[str] = None,
        reason: str = "",
        username: str = "OPERATOR",
        phase: Optional[str] = None
    ) -> bool:
        """
        Validates manual operator control and enforces safety interlocks (Section 19).
        Never permits instant unsafe switches; commands transition via YELLOW clearance.
        """
        raw_key = phase or target or "NORTH"
        target_key = raw_key.upper()
        self._manual_raw_phase = raw_key

        if target_key not in self.approaches:
            if target_key == "NORTH_SOUTH":
                target_key = "NORTH" if "NORTH" in self.approaches else list(self.approaches.keys())[0]
            elif target_key == "EAST_WEST":
                target_key = "EAST" if "EAST" in self.approaches else list(self.approaches.keys())[0]
            else:
                logger.warning(f"Invalid manual approach {target_key} requested for Intersection #{self.intersection_id}.")
                return False

        old_state = f"{self.active_approach} ({self.state})"
        self.mode = "MANUAL"
        self.manual_target_approach = target_key
        self.manual_reason = reason
        self.manual_user = username

        # If another approach is currently green, transition safely through YELLOW
        if self.active_approach != target_key and self.state == "GREEN":
            self.state = "YELLOW"
            self.countdown = settings.YELLOW_TIME
            self.last_reasoning = f"MANUAL OVERRIDE: Requested {target_key} by {username}. Transitioning safely through YELLOW."
        else:
            self.active_approach = target_key
            self.active_phase = target_key
            self.state = "GREEN"
            self.countdown = 30
            self.elapsed_green_time = 0.0
            self.last_reasoning = f"MANUAL OVERRIDE: Operator {username} forced GREEN to {target_key}. Reason: {reason}."

        try:
            log = AuditLog(
                username=username,
                action="MANUAL_SIGNAL_OVERRIDE",
                details=(
                    f"Intersection #{self.intersection_id} approach {target_key} forced by {username}. "
                    f"Old: {old_state} -> New: {target_key} (GREEN). Reason: {reason}."
                )
            )
            db.add(log)
            db.commit()
        except Exception as e:
            logger.error(f"Error logging manual control audit log: {e}")
            db.rollback()

        return True

    def return_to_automatic(self, db: Session, username: str = "OPERATOR") -> bool:
        """Reverts junction back to automatic adaptive optimization mode (Section 19 & 20)."""
        self.mode = "AUTOMATIC"
        self.manual_target_approach = None
        self.manual_reason = None
        self.manual_user = None

        self.last_reasoning = f"Returned to AUTOMATIC adaptive optimization mode by {username}."

        try:
            log = AuditLog(
                username=username,
                action="RETURN_TO_AUTO_SIGNAL",
                details=f"Intersection #{self.intersection_id} returned to automatic adaptive optimization mode."
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

    def update_junction_config(
        self,
        intersection_id: int,
        num_approaches: int,
        approaches_config: Optional[List[Dict[str, Any]]] = None
    ):
        controller = self.get_controller(intersection_id)
        controller.configure_approaches(num_approaches, approaches_config)
        return controller


signal_registry = IntersectionsRegistry()
signal_optimizer = AdaptiveSignalOptimizer()

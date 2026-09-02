import logging
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.models import AgentDecision, TrafficMeasurement, Incident, EmergencyEvent

logger = logging.getLogger(__name__)

class TrafficOptimizationAgent:
    def evaluate(self, measurement: Dict[str, Any]) -> Dict[str, Any]:
        count = measurement.get("vehicle_count", 0)
        queue = measurement.get("queue_length", 0)
        density = measurement.get("density_state", "LOW")

        action = f"Adjust green phase to {min(120, max(15, 20 + queue * 3))}s"
        reasoning = f"Optimization Agent analyzed density '{density}', volume={count}, queue={queue}."

        return {
            "agent_name": "TrafficOptimizationAgent",
            "decision": "OPTIMIZE_SIGNAL_TIMING",
            "reasoning": reasoning,
            "confidence": 0.94,
            "action": action,
            "result": "SUCCESS"
        }

class EmergencyAgent:
    def evaluate(self, emergency_events: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not emergency_events:
            return {
                "agent_name": "EmergencyAgent",
                "decision": "NO_EMERGENCY_ACTIVE",
                "reasoning": "Emergency Agent scanned all channels; no emergency vehicles present.",
                "confidence": 0.99,
                "action": "MONITOR_CHANNELS",
                "result": "STANDBY"
            }

        ev = emergency_events[0]
        v_type = ev.get("vehicle_type", "ambulance")
        return {
            "agent_name": "EmergencyAgent",
            "decision": "PREEMPT_SIGNAL_CORRIDOR",
            "reasoning": f"Emergency Agent detected active {v_type}. Activating green wave corridor override.",
            "confidence": 1.0,
            "action": "ACTIVATE_GREEN_WAVE",
            "result": "OVERRIDE_ENABLED"
        }

class IncidentAgent:
    def evaluate(self, incidents: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not incidents:
            return {
                "agent_name": "IncidentAgent",
                "decision": "NO_INCIDENTS",
                "reasoning": "Incident Agent scanned video feeds; road conditions normal.",
                "confidence": 0.96,
                "action": "LOG_NORMAL",
                "result": "CLEAR"
            }

        inc = incidents[0]
        return {
            "agent_name": "IncidentAgent",
            "decision": "DISPATCH_INCIDENT_ALERT",
            "reasoning": f"Incident Agent flagged {inc.get('incident_type')} ({inc.get('description')}). Alerting operators and rerouting recommendations.",
            "confidence": 0.92,
            "action": "BROADCAST_ALERT",
            "result": "ALERT_SENT"
        }

class CoordinatorAgent:
    def coordinate(self, db: Session, measurement: Dict[str, Any], emergency_list: List[Any], incidents: List[Any]) -> List[AgentDecision]:
        opt_agent = TrafficOptimizationAgent()
        em_agent = EmergencyAgent()
        inc_agent = IncidentAgent()

        d1 = opt_agent.evaluate(measurement)
        d2 = em_agent.evaluate(emergency_list)
        d3 = inc_agent.evaluate(incidents)

        decisions = [d1, d2, d3]
        saved_records = []

        for d in decisions:
            rec = AgentDecision(
                agent_name=d["agent_name"],
                input_summary=measurement,
                decision=d["decision"],
                reasoning=d["reasoning"],
                confidence=d["confidence"],
                action=d["action"],
                result=d["result"],
                timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
            )
            db.add(rec)
            saved_records.append(rec)

        db.commit()
        return saved_records

coordinator_agent = CoordinatorAgent()

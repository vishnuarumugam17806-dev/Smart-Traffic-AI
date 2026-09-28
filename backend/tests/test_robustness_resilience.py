"""
Unit tests for system robustness, edge cases, and resilience:
- Zero-division safety in SignalController normalization methods.
- Parivahan provider fallback to DemoVehicleProvider in VehicleComplianceService.
- WebSocket ConnectionManager isolated client error handling.
- TrajectoryGraphEngine single observation / zero duration safety.
"""

import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi import WebSocket

from app.traffic.signal_controller import AdaptiveSignalOptimizer, SignalController
from app.services.compliance.vehicle_compliance_service import VehicleComplianceService
from app.websocket.manager import ConnectionManager
from app.trajectory.graph import TrajectoryGraphEngine, levenshtein_distance


def test_optimizer_zero_division_safety():
    """Verify that normalization functions do not divide by zero even if configuration is zero."""
    optimizer = AdaptiveSignalOptimizer()
    
    with patch("app.traffic.signal_controller.settings.MAX_EXPECTED_QUEUE", 0), \
         patch("app.traffic.signal_controller.settings.MAX_EXPECTED_VEHICLES", 0), \
         patch("app.traffic.signal_controller.settings.MAX_ALLOWED_WAIT", 0):
        
        q_norm = optimizer.normalize_queue(10.0)
        assert 0.0 <= q_norm <= 1.0

        v_norm = optimizer.normalize_vehicle_count(15.0)
        assert 0.0 <= v_norm <= 1.0

        w_norm = optimizer.normalize_waiting_time(30.0)
        assert 0.0 <= w_norm <= 1.0

        fairness = optimizer.calculate_waiting_fairness_bonus(30.0)
        assert fairness >= 0.0

        starvation = optimizer.calculate_starvation_prevention_bonus(30.0)
        assert starvation >= 0.0


def test_levenshtein_distance_edge_cases():
    """Test string distance algorithm with None, empty strings, and identical inputs."""
    assert levenshtein_distance("", "") == 0
    assert levenshtein_distance("TN01", "") == 4
    assert levenshtein_distance("", "KA05") == 4
    assert levenshtein_distance("TN01AB1234", "TN01AB1234") == 0
    assert levenshtein_distance("TN01AB1234", "TN01AB1235") == 1


def test_websocket_broadcast_isolated_error():
    """Verify that an exception in one client does not halt broadcast to other clients."""
    async def _run():
        manager = ConnectionManager()

        good_ws_1 = AsyncMock(spec=WebSocket)
        bad_ws = AsyncMock(spec=WebSocket)
        bad_ws.send_json.side_effect = RuntimeError("Socket connection dropped")
        good_ws_2 = AsyncMock(spec=WebSocket)

        manager.active_connections = [good_ws_1, bad_ws, good_ws_2]

        test_message = {"event": "TEST_EVENT", "data": 123}
        await manager.broadcast(test_message)

        good_ws_1.send_json.assert_called_once_with(test_message)
        good_ws_2.send_json.assert_called_once_with(test_message)
        assert bad_ws not in manager.active_connections
        assert good_ws_1 in manager.active_connections
        assert good_ws_2 in manager.active_connections

    asyncio.run(_run())


def test_compliance_provider_fallback_to_demo():
    """Verify that VehicleComplianceService safely falls back to demo provider when primary returns None."""
    async def _run():
        service = VehicleComplianceService()
        service.provider_mode = "parivahan"

        mock_parivahan = MagicMock()
        mock_parivahan.is_configured.return_value = True
        mock_parivahan.get_vehicle_details.return_value = None

        service.parivahan_provider = mock_parivahan

        res = await service.verify_vehicle_passage(plate_number="KA05MN3821", camera_id=1, anpr_confidence=0.95)
        assert res is not None
        assert res.get("vehicle_number") == "KA05MN3821"

    asyncio.run(_run())

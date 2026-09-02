import pytest
from app.traffic.signal_controller import signal_optimizer

def test_signal_safety_boundaries():
    # Test low density
    res_low = signal_optimizer.optimize_signal(vehicle_count=2, queue_length=0, density_state="LOW")
    assert res_low["recommended_green"] >= 15
    assert res_low["recommended_green"] <= 120

    # Test severe density
    res_severe = signal_optimizer.optimize_signal(vehicle_count=50, queue_length=25, density_state="SEVERE")
    assert res_severe["recommended_green"] <= 120
    assert res_severe["recommended_green"] >= 15

def test_emergency_override():
    res_em = signal_optimizer.optimize_signal(
        vehicle_count=20,
        queue_length=10,
        density_state="HIGH",
        emergency_detected=True,
        emergency_type="ambulance"
    )
    assert res_em["emergency_override"] is True
    assert res_em["recommended_phase"] == "GREEN_EMERGENCY"
    assert "Emergency Priority" in res_em["reasoning"]

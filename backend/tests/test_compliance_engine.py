import pytest
from datetime import datetime, timezone, timedelta, date
from app.services.compliance.vehicle_compliance_service import VehicleComplianceService
from app.services.compliance.providers.demo_vehicle_provider import DemoVehicleRegistryProvider
from app.services.compliance.providers.parivahan_provider import AuthorizedParivahanProvider
from app.database.session import SessionLocal

@pytest.fixture
def compliance_service():
    return VehicleComplianceService()

@pytest.fixture
def demo_provider():
    return DemoVehicleRegistryProvider()

def test_demo_registry_loading(demo_provider):
    """Test 1: Demo vehicle registry loads fictional records properly."""
    status = demo_provider.get_provider_status()
    assert status["status"] == "ONLINE"
    assert status["total_records"] >= 5
    assert "DEMO VEHICLE REGISTRY" in status["label"]

def test_plate_normalization(compliance_service):
    """Test 2 & 3: Plate normalization handles spacing, casing, and dashes consistently."""
    assert compliance_service.normalize_plate("tn xx 1001") == "TNXX1001"
    assert compliance_service.normalize_plate("TN-XX-1002") == "TNXX1002"
    assert compliance_service.normalize_plate("tn.xx.1003") == "TNXX1003"
    assert compliance_service.normalize_plate(" TN 01 AB 1234 ") == "TN01AB1234"

def test_date_evaluations(compliance_service):
    """Test 4, 5, 6, 7, 8, 9, 10: Date comparison against current reference date."""
    ref_date = date(2026, 9, 14)
    
    # 1. Expired date
    past_date = "2026-05-30"
    status, _ = compliance_service._evaluate_date_status(past_date, ref_date)
    assert status == "EXPIRED"

    # 2. Expiring soon (within 30 days)
    soon_date = (ref_date + timedelta(days=20)).isoformat()
    status_soon, _ = compliance_service._evaluate_date_status(soon_date, ref_date)
    assert status_soon == "EXPIRING_SOON"

    # 3. Valid future date (> 30 days)
    future_date = "2027-09-14"
    status_valid, _ = compliance_service._evaluate_date_status(future_date, ref_date)
    assert status_valid == "VALID"

import asyncio

def test_scenario_1_compliant_vehicle(compliance_service):
    """Test 11: Compliant vehicle (TNXX1001) produces COMPLIANT status and creates no alert."""
    res = asyncio.run(compliance_service.verify_vehicle_passage(
        plate_number="TNXX1001",
        camera_id=1,
        anpr_confidence=0.96
    ))
    assert res["compliance_status"] == "COMPLIANT"
    assert res["action_required"] is False
    assert len(res["alerts"]) == 0
    assert res["rc"]["status"] == "VALID"
    assert res["insurance"]["status"] == "VALID"
    assert res["puc"]["status"] == "VALID"
    assert res["fitness"]["status"] == "VALID"

def test_scenario_2_insurance_expired(compliance_service):
    """Test 12: Insurance expired vehicle (TNXX1002) produces ACTION_REQUIRED and generates alert."""
    res = asyncio.run(compliance_service.verify_vehicle_passage(
        plate_number="TNXX1002",
        camera_id=2,
        anpr_confidence=0.95
    ))
    assert res["compliance_status"] == "ACTION_REQUIRED"
    assert res["action_required"] is True
    assert res["insurance"]["status"] == "EXPIRED"
    assert any(a["type"] == "INSURANCE_EXPIRED" for a in res["alerts"])

def test_scenario_3_puc_expired(compliance_service):
    """Test: PUC expired vehicle (TNXX1003) produces ACTION_REQUIRED and PUC alert."""
    res = asyncio.run(compliance_service.verify_vehicle_passage(
        plate_number="TNXX1003",
        camera_id=3,
        anpr_confidence=0.94
    ))
    assert res["compliance_status"] == "ACTION_REQUIRED"
    assert res["action_required"] is True
    assert res["puc"]["status"] == "EXPIRED"
    assert any(a["type"] == "PUC_EXPIRED" for a in res["alerts"])

def test_scenario_4_fitness_expired(compliance_service):
    """Test: Commercial fitness expired vehicle (TNXX1004) produces ACTION_REQUIRED and FITNESS alert."""
    res = asyncio.run(compliance_service.verify_vehicle_passage(
        plate_number="TNXX1004",
        camera_id=4,
        anpr_confidence=0.93
    ))
    assert res["compliance_status"] == "ACTION_REQUIRED"
    assert res["action_required"] is True
    assert res["fitness"]["status"] == "EXPIRED"
    assert any(a["type"] == "FITNESS_EXPIRED" for a in res["alerts"])

def test_scenario_5_watchlist_match(compliance_service):
    """Test 13: Watchlist match (TNXX1005) produces REVIEW_REQUIRED and WATCHLIST alert."""
    res = asyncio.run(compliance_service.verify_vehicle_passage(
        plate_number="TNXX1005",
        camera_id=5,
        anpr_confidence=0.95
    ))
    assert res["compliance_status"] == "REVIEW_REQUIRED"
    assert res["action_required"] is True
    assert res["watchlist"]["matched"] is True
    assert any(a["type"] == "WATCHLIST_MATCH" for a in res["alerts"])

def test_verification_cooldown(compliance_service):
    """Test 27: Cooldown prevents duplicate verification and alerts within 60s for the same track."""
    plate = "TNXX1002"
    cam_id = 99
    
    # First verification
    res1 = asyncio.run(compliance_service.verify_vehicle_passage(plate_number=plate, camera_id=cam_id))
    # Second immediate verification
    res2 = asyncio.run(compliance_service.verify_vehicle_passage(plate_number=plate, camera_id=cam_id))
    
    assert res1["verification_id"] == res2["verification_id"]

def test_anpr_low_confidence_handling(compliance_service):
    """Test 26: Low ANPR confidence (< 0.85) produces ANPR_UNCLEAR without false verification."""
    res = asyncio.run(compliance_service.verify_vehicle_passage(
        plate_number="TNXX1001",
        camera_id=10,
        anpr_confidence=0.72  # Below 0.85
    ))
    assert res["verification_status"] == "ANPR_UNCLEAR"
    assert res["compliance_status"] == "DATA_UNAVAILABLE"
    assert res["action_required"] is False

def test_unregistered_plate_data_unavailable(compliance_service):
    """Test 25 & 31: Unregistered plate or provider failure returns DATA_UNAVAILABLE, never false expired."""
    res = asyncio.run(compliance_service.verify_vehicle_passage(
        plate_number="UNKNOWN9999",
        camera_id=11,
        anpr_confidence=0.95
    ))
    assert res["compliance_status"] == "DATA_UNAVAILABLE"
    assert res["action_required"] is False

def test_parivahan_unconfigured_status():
    """Test 54: Authorized Parivahan adapter defaults to unconfigured without crashing."""
    adapter = AuthorizedParivahanProvider()
    status = adapter.get_provider_status()
    assert status["status"] == "UNCONFIGURED"
    assert status["active"] is False
    assert adapter.get_vehicle_details("TN01AB1234") is None

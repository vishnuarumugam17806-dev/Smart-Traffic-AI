import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from app.database.mongodb import mongo_manager
from .vehicle_data_provider import VehicleDataProvider

logger = logging.getLogger(__name__)

# Standard Fictional Hackathon Demonstration Records
DEFAULT_DEMO_RECORDS: List[Dict[str, Any]] = [
    {
        "vehicle_number": "TNXX1001",
        "registration_status": "ACTIVE",
        "vehicle_class": "MOTOR CAR (LMV)",
        "manufacturer": "TATA MOTORS",
        "model": "NEXON EV PRIME",
        "registration_date": "2023-03-15",
        "fuel_type": "ELECTRIC",
        "rc": {
            "status": "VALID",
            "valid_until": "2038-03-14"
        },
        "insurance": {
            "status": "VALID",
            "provider": "ICICI LOMBARD GIC LTD",
            "policy_number": "POL-99281-DEMO",
            "valid_until": "2027-03-14"
        },
        "puc": {
            "status": "VALID",
            "valid_until": "2027-03-14"
        },
        "fitness": {
            "status": "VALID",
            "valid_until": "2038-03-14"
        },
        "permit": None,
        "watchlist": {
            "matched": False,
            "reference": None,
            "reason": None
        },
        "owner_reference": "DEMO-OWNER-1001",
        "authorized_owner_display_name": "Demo Citizen A (Fictional)",
        "notes": "Scenario 1: Fully Compliant Vehicle Demonstration"
    },
    {
        "vehicle_number": "TNXX1002",
        "registration_status": "ACTIVE",
        "vehicle_class": "MOTOR CAR (LMV)",
        "manufacturer": "HYUNDAI MOTOR INDIA",
        "model": "CRETA SX DIESEL",
        "registration_date": "2021-05-30",
        "fuel_type": "DIESEL",
        "rc": {
            "status": "VALID",
            "valid_until": "2036-05-29"
        },
        "insurance": {
            "status": "EXPIRED",
            "provider": "NEW INDIA ASSURANCE CO",
            "policy_number": "POL-44102-EXP",
            "valid_until": "2026-05-30"  # Expired ~3.5 months ago
        },
        "puc": {
            "status": "VALID",
            "valid_until": "2026-11-20"
        },
        "fitness": {
            "status": "VALID",
            "valid_until": "2036-05-29"
        },
        "permit": None,
        "watchlist": {
            "matched": False,
            "reference": None,
            "reason": None
        },
        "owner_reference": "DEMO-OWNER-1002",
        "authorized_owner_display_name": "Demo Citizen B (Fictional)",
        "notes": "Scenario 2: Insurance Expired Demonstration (ACTION REQUIRED)"
    },
    {
        "vehicle_number": "TNXX1003",
        "registration_status": "ACTIVE",
        "vehicle_class": "MOTOR CAR (LMV)",
        "manufacturer": "MARUTI SUZUKI INDIA",
        "model": "SWIFT DZIRE VXI",
        "registration_date": "2022-08-11",
        "fuel_type": "PETROL/CNG",
        "rc": {
            "status": "VALID",
            "valid_until": "2037-08-10"
        },
        "insurance": {
            "status": "VALID",
            "provider": "HDFC ERGO GENERAL INSURANCE",
            "policy_number": "POL-77301-VALID",
            "valid_until": "2027-08-10"
        },
        "puc": {
            "status": "EXPIRED",
            "valid_until": "2026-08-10"  # Expired ~1 month ago
        },
        "fitness": {
            "status": "VALID",
            "valid_until": "2037-08-10"
        },
        "permit": None,
        "watchlist": {
            "matched": False,
            "reference": None,
            "reason": None
        },
        "owner_reference": "DEMO-OWNER-1003",
        "authorized_owner_display_name": "Demo Citizen C (Fictional)",
        "notes": "Scenario 3: Emission/PUC Certificate Expired Demonstration (ACTION REQUIRED)"
    },
    {
        "vehicle_number": "TNXX1004",
        "registration_status": "ACTIVE",
        "vehicle_class": "LIGHT COMMERCIAL VEHICLE (GOODS)",
        "manufacturer": "MAHINDRA & MAHINDRA",
        "model": "BOLERO MAXI TRUCK PLUS",
        "registration_date": "2020-07-16",
        "fuel_type": "DIESEL",
        "rc": {
            "status": "VALID",
            "valid_until": "2035-07-15"
        },
        "insurance": {
            "status": "VALID",
            "provider": "ORIENTAL INSURANCE CO",
            "policy_number": "POL-55209-COMM",
            "valid_until": "2027-01-20"
        },
        "puc": {
            "status": "VALID",
            "valid_until": "2026-12-15"
        },
        "fitness": {
            "status": "EXPIRED",
            "valid_until": "2026-07-15"  # Annual commercial fitness expired 2 months ago
        },
        "permit": {
            "status": "VALID",
            "permit_type": "STATE GOODS CARRIER",
            "valid_until": "2027-07-15"
        },
        "watchlist": {
            "matched": False,
            "reference": None,
            "reason": None
        },
        "owner_reference": "DEMO-LOGISTICS-1004",
        "authorized_owner_display_name": "Demo Logistics Services (Fictional)",
        "notes": "Scenario 4: Commercial Vehicle Fitness Expired Demonstration (ACTION REQUIRED)"
    },
    {
        "vehicle_number": "TNXX1005",
        "registration_status": "ACTIVE",
        "vehicle_class": "MOTOR CAR (LMV)",
        "manufacturer": "MAHINDRA",
        "model": "SCORPIO-N Z8L",
        "registration_date": "2023-11-05",
        "fuel_type": "DIESEL",
        "rc": {
            "status": "VALID",
            "valid_until": "2038-11-04"
        },
        "insurance": {
            "status": "VALID",
            "provider": "BAJAJ ALLIANZ GENERAL INSURANCE",
            "policy_number": "POL-11942-PREM",
            "valid_until": "2027-11-04"
        },
        "puc": {
            "status": "VALID",
            "valid_until": "2026-11-04"
        },
        "fitness": {
            "status": "VALID",
            "valid_until": "2038-11-04"
        },
        "permit": None,
        "watchlist": {
            "matched": True,
            "reference": "FIR-CH-2026-9042",
            "reason": "Authorized Watchlist Match: Flagged in High-Value Cargo Theft Investigation"
        },
        "owner_reference": "DEMO-WATCHLIST-1005",
        "authorized_owner_display_name": "Demo Record Under Review (Fictional)",
        "notes": "Scenario 5: Watchlist Match Demonstration (REVIEW REQUIRED)"
    },
    # Mapping for existing sample traffic video vehicles
    {
        "vehicle_number": "TN01AB1234",
        "registration_status": "ACTIVE",
        "vehicle_class": "MOTOR CAR (LMV)",
        "manufacturer": "HYUNDAI",
        "model": "VERNA SX",
        "registration_date": "2022-04-14",
        "fuel_type": "PETROL",
        "rc": {"status": "VALID", "valid_until": "2037-04-13"},
        "insurance": {"status": "VALID", "provider": "ICICI LOMBARD", "policy_number": "POL-TN01-1234", "valid_until": "2027-04-13"},
        "puc": {"status": "VALID", "valid_until": "2026-12-31"},
        "fitness": {"status": "VALID", "valid_until": "2037-04-13"},
        "permit": None,
        "watchlist": {"matched": False, "reference": None, "reason": None},
        "owner_reference": "DEMO-OWNER-TN01",
        "authorized_owner_display_name": "Rohan Sharma (Demo)",
        "notes": "Existing Sample Video Vehicle 1"
    },
    {
        "vehicle_number": "KA05MN3821",
        "registration_status": "ACTIVE",
        "vehicle_class": "SPECIAL PURPOSE (AMBULANCE)",
        "manufacturer": "FORCE MOTORS",
        "model": "TRAVELLER AMBULANCE",
        "registration_date": "2021-09-20",
        "fuel_type": "DIESEL",
        "rc": {"status": "VALID", "valid_until": "2036-09-19"},
        "insurance": {"status": "VALID", "provider": "NEW INDIA ASSURANCE", "policy_number": "POL-KA05-3821", "valid_until": "2027-09-19"},
        "puc": {"status": "VALID", "valid_until": "2027-03-31"},
        "fitness": {"status": "VALID", "valid_until": "2027-09-19"},
        "permit": {"status": "VALID", "permit_type": "EMERGENCY PREEMPTION PERMIT", "valid_until": "2028-09-19"},
        "watchlist": {"matched": True, "reference": "HOTLIST-STOLEN-AMB", "reason": "Authorized Watchlist Match: Stolen Vehicle Alert"},
        "owner_reference": "DEMO-OWNER-KA05",
        "authorized_owner_display_name": "Apollo City Hospital Care (Demo)",
        "notes": "Existing Sample Video Vehicle 2"
    },
    {
        "vehicle_number": "DL02CP9012",
        "registration_status": "ACTIVE",
        "vehicle_class": "BUS (PASSENGER)",
        "manufacturer": "ASHOK LEYLAND",
        "model": "CITY BUS 240HP",
        "registration_date": "2019-11-10",
        "fuel_type": "CNG",
        "rc": {"status": "VALID", "valid_until": "2034-11-09"},
        "insurance": {"status": "VALID", "provider": "NATIONAL INSURANCE", "policy_number": "POL-DL02-9012", "valid_until": "2027-05-15"},
        "puc": {"status": "VALID", "valid_until": "2026-10-15"},
        "fitness": {"status": "VALID", "valid_until": "2026-10-10"},  # Expiring in ~26 days (EXPIRING SOON)
        "permit": {"status": "VALID", "permit_type": "STAGE CARRIAGE", "valid_until": "2027-11-09"},
        "watchlist": {"matched": False, "reference": None, "reason": None},
        "owner_reference": "DEMO-OWNER-DL02",
        "authorized_owner_display_name": "Delhi Transport Logistics (Demo)",
        "notes": "Existing Sample Video Vehicle 3 (Fitness Expiring Soon)"
    }
]

class DemoVehicleRegistryProvider(VehicleDataProvider):
    """
    Demonstration Vehicle Registry Provider.
    Queries MongoDB collection 'demo_vehicle_registry' if Atlas is connected,
    with an in-memory persistent cache fallback so testing and judging is 100% reliable.
    """

    def __init__(self):
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._init_registry()

    def _init_registry(self):
        """Pre-populates memory cache and seeds MongoDB collection if available."""
        for rec in DEFAULT_DEMO_RECORDS:
            clean_plate = rec["vehicle_number"].upper().replace(" ", "").replace("-", "")
            self._memory_cache[clean_plate] = rec

        # Attempt to seed MongoDB Atlas collection if connected
        try:
            db = mongo_manager.get_sync_db()
            if db is not None:
                collection = db["demo_vehicle_registry"]
                for rec in DEFAULT_DEMO_RECORDS:
                    clean_plate = rec["vehicle_number"].upper().replace(" ", "").replace("-", "")
                    collection.update_one(
                        {"vehicle_number": clean_plate},
                        {"$set": {**rec, "vehicle_number": clean_plate, "updated_at": datetime.now(timezone.utc)}},
                        upsert=True
                    )
                # Create unique index on vehicle_number
                collection.create_index("vehicle_number", unique=True)
                logger.info("[DemoVehicleRegistryProvider] Seeded MongoDB collection 'demo_vehicle_registry'.")
        except Exception as e:
            logger.info(f"[DemoVehicleRegistryProvider] Note: Using robust in-memory registry fallback ({e})")

    def seed_registry(self) -> int:
        """Forces re-seeding of the demo vehicle registry."""
        self._init_registry()
        return len(self._memory_cache)

    def get_provider_status(self) -> Dict[str, Any]:
        has_mongo = mongo_manager.get_sync_db() is not None
        return {
            "provider": "DEMO_VEHICLE_REGISTRY",
            "status": "ONLINE",
            "active": True,
            "storage": "MONGODB_ATLAS" if has_mongo else "LOCAL_PERSISTENT_CACHE",
            "total_records": len(self._memory_cache),
            "label": "DEMO VEHICLE REGISTRY (Fictional Data)",
            "message": "Demo vehicle data provider active for judging demonstration."
        }

    def get_vehicle_details(self, vehicle_number: str) -> Optional[Dict[str, Any]]:
        clean_plate = vehicle_number.upper().replace(" ", "").replace("-", "")

        # 1. Try MongoDB Atlas
        try:
            db = mongo_manager.get_sync_db()
            if db is not None:
                collection = db["demo_vehicle_registry"]
                doc = collection.find_one({"vehicle_number": clean_plate})
                if doc:
                    doc.pop("_id", None)
                    doc["source"] = "DEMO_VEHICLE_REGISTRY"
                    return doc
        except Exception as e:
            logger.debug(f"[DemoVehicleRegistryProvider] MongoDB query failed, using memory cache: {e}")

        # 2. Memory cache fallback
        if clean_plate in self._memory_cache:
            data = dict(self._memory_cache[clean_plate])
            data["source"] = "DEMO_VEHICLE_REGISTRY"
            return data

        # Return None if plate is not registered in demo DB
        return None

demo_vehicle_provider = DemoVehicleRegistryProvider()

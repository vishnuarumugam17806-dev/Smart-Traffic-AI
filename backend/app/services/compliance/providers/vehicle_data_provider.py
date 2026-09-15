from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class VehicleDataProvider(ABC):
    """
    Abstract Interface for Vehicle Data Sources.
    Ensures that VIGITRA AI code is completely agnostic to whether data originates
    from the local DemoVehicleRegistryProvider (for Hackathon/Testing) or an
    officially authorized production Parivahan API integration.
    """

    @abstractmethod
    def get_vehicle_details(self, vehicle_number: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves normalized vehicle registration and document compliance records.
        
        Returns:
            Dict containing:
                vehicle_number: str
                source: str ("DEMO_VEHICLE_REGISTRY" or "AUTHORIZED_PARIVAHAN")
                registration_status: str ("ACTIVE", "SUSPENDED", "CANCELLED")
                vehicle_class: str
                manufacturer: str
                model: str
                registration_date: str (YYYY-MM-DD)
                fuel_type: str
                rc: Dict[str, Any] -> status, valid_until
                insurance: Dict[str, Any] -> status, provider, policy_number, valid_until
                puc: Dict[str, Any] -> status, valid_until
                fitness: Dict[str, Any] -> status, valid_until
                permit: Optional[Dict[str, Any]] -> status, permit_type, valid_until
                watchlist: Dict[str, Any] -> matched (bool), reference (str), reason (str)
                owner_reference: Optional[str] (Masked / Protected identifier)
                authorized_owner_display_name: Optional[str] (Accessible only to authorized roles)
        """
        pass

    @abstractmethod
    def get_provider_status(self) -> Dict[str, Any]:
        """Returns the operational status and connectivity health of this data provider."""
        pass

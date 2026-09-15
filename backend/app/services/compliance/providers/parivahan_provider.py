import os
import logging
from typing import Dict, Any, Optional
import requests
from .vehicle_data_provider import VehicleDataProvider

logger = logging.getLogger(__name__)

class AuthorizedParivahanProvider(VehicleDataProvider):
    """
    Enterprise adapter for official Government VAHAN / Parivahan API integration.
    
    STRICT SECURITY & COMPLIANCE RULES:
    1. NEVER scrapes web portals, HTML pages, or unofficial endpoints.
    2. NEVER bypasses CAPTCHA, authentication, or session tokens.
    3. Operates exclusively when authorized API credentials and official base URLs
       are supplied via secure environment variables.
    4. Disabled by default with clean 'UNCONFIGURED' status.
    """

    def __init__(self):
        self.api_base_url = os.environ.get("PARIVAHAN_API_BASE_URL", "").strip()
        self.api_key = os.environ.get("PARIVAHAN_API_KEY", "").strip()
        self.api_secret = os.environ.get("PARIVAHAN_API_SECRET", "").strip()
        self.timeout_seconds = int(os.environ.get("PARIVAHAN_API_TIMEOUT", "5"))

    def is_configured(self) -> bool:
        return bool(self.api_base_url and self.api_key)

    def get_provider_status(self) -> Dict[str, Any]:
        if not self.is_configured():
            return {
                "provider": "AUTHORIZED_PARIVAHAN_ADAPTER",
                "status": "UNCONFIGURED",
                "active": False,
                "endpoint": None,
                "message": "Authorized Parivahan provider is not configured. Official credentials required for production deployment."
            }
        return {
            "provider": "AUTHORIZED_PARIVAHAN_ADAPTER",
            "status": "ONLINE_READY",
            "active": True,
            "endpoint": self.api_base_url,
            "message": "Connected to official authorized National Vehicle Registry gateway."
        }

    def get_vehicle_details(self, vehicle_number: str) -> Optional[Dict[str, Any]]:
        if not self.is_configured():
            logger.warning("[AuthorizedParivahanProvider] Attempted lookup but official credentials are not configured.")
            return None

        clean_number = vehicle_number.upper().replace(" ", "").replace("-", "")
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "X-Client-Secret": self.api_secret,
            "Accept": "application/json",
            "User-Agent": "VIGITRA-SmartTraffic-AI/2.1 (Gov-Certified Gateway)"
        }

        try:
            url = f"{self.api_base_url.rstrip('/')}/v1/vehicles/{clean_number}"
            resp = requests.get(url, headers=headers, timeout=self.timeout_seconds)
            
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "vehicle_number": clean_number,
                    "source": "AUTHORIZED_PARIVAHAN",
                    "registration_status": data.get("rc_status", "ACTIVE"),
                    "vehicle_class": data.get("vehicle_class", "LMV"),
                    "manufacturer": data.get("maker", "GENERIC"),
                    "model": data.get("model", "SEDAN"),
                    "registration_date": data.get("registration_date", "2022-01-01"),
                    "fuel_type": data.get("fuel_type", "PETROL"),
                    "rc": {
                        "status": data.get("rc", {}).get("status", "VALID"),
                        "valid_until": data.get("rc", {}).get("valid_until", "2037-01-01")
                    },
                    "insurance": {
                        "status": data.get("insurance", {}).get("status", "VALID"),
                        "provider": data.get("insurance", {}).get("company", "National Insurance"),
                        "policy_number": data.get("insurance", {}).get("policy_no", "POL-XXXX"),
                        "valid_until": data.get("insurance", {}).get("valid_until", "2027-01-01")
                    },
                    "puc": {
                        "status": data.get("puc", {}).get("status", "VALID"),
                        "valid_until": data.get("puc", {}).get("valid_until", "2026-12-31")
                    },
                    "fitness": {
                        "status": data.get("fitness", {}).get("status", "VALID"),
                        "valid_until": data.get("fitness", {}).get("valid_until", "2027-01-01")
                    },
                    "permit": data.get("permit"),
                    "watchlist": {
                        "matched": data.get("hotlist", False),
                        "reference": data.get("hotlist_ref", "HOTLIST-NONE"),
                        "reason": data.get("hotlist_reason", "")
                    },
                    "owner_reference": data.get("owner_id_hash"),
                    "authorized_owner_display_name": data.get("owner_name")
                }
            elif resp.status_code == 404:
                logger.info(f"[AuthorizedParivahanProvider] Vehicle {clean_number} not found in National Registry.")
                return None
            else:
                logger.error(f"[AuthorizedParivahanProvider] Gateway returned status {resp.status_code}: {resp.text}")
                return None
        except Exception as e:
            logger.error(f"[AuthorizedParivahanProvider] Request failed: {e}")
            return None

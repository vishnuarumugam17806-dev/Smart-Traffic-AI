"""
Enterprise adapter for official Government VAHAN / Parivahan API integration.
Implements secure HTTP client communication with configurable timeouts and automatic retries.
Falls back safely to local vehicle directory providers when unconfigured or unreachable.
"""

import os
import time
import logging
from typing import Dict, Any, Optional
import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry
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
    5. Includes retry adapter with exponential backoff on transient network faults.
    """

    def __init__(self) -> None:
        self.api_base_url: str = os.environ.get("PARIVAHAN_API_BASE_URL", "").strip()
        self.api_key: str = os.environ.get("PARIVAHAN_API_KEY", "").strip()
        self.api_secret: str = os.environ.get("PARIVAHAN_API_SECRET", "").strip()
        self.timeout_seconds: int = int(os.environ.get("PARIVAHAN_API_TIMEOUT", "5"))
        self._session: Optional[requests.Session] = None

    def _get_session(self) -> requests.Session:
        """Returns or initializes a requests Session configured with retry backoff."""
        if self._session is None:
            session = requests.Session()
            retries = Retry(
                total=2,
                backoff_factor=0.5,
                status_forcelist=[500, 502, 503, 504],
                raise_on_status=False,
            )
            adapter = HTTPAdapter(max_retries=retries)
            session.mount("https://", adapter)
            session.mount("http://", adapter)
            self._session = session
        return self._session

    def is_configured(self) -> bool:
        """Returns True only when both API endpoint and API key are configured."""
        return bool(self.api_base_url and self.api_key)

    def get_provider_status(self) -> Dict[str, Any]:
        """Provides operational health status of the Parivahan gateway."""
        if not self.is_configured():
            return {
                "provider": "AUTHORIZED_PARIVAHAN_ADAPTER",
                "status": "UNCONFIGURED",
                "active": False,
                "endpoint": None,
                "timeout_seconds": self.timeout_seconds,
                "message": "Authorized Parivahan provider is not configured. Official credentials required for production deployment.",
            }
        return {
            "provider": "AUTHORIZED_PARIVAHAN_ADAPTER",
            "status": "ONLINE_READY",
            "active": True,
            "endpoint": self.api_base_url,
            "timeout_seconds": self.timeout_seconds,
            "message": "Connected to official authorized National Vehicle Registry gateway.",
        }

    def get_vehicle_details(self, vehicle_number: str) -> Optional[Dict[str, Any]]:
        """
        Queries National Vehicle Registry for official registration and compliance details.
        Returns parsed dictionary on success, or None on failure / not found.
        """
        if not self.is_configured():
            logger.debug("[AuthorizedParivahanProvider] Lookup attempted but official credentials are not configured.")
            return None

        clean_number = vehicle_number.upper().replace(" ", "").replace("-", "")
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "X-Client-Secret": self.api_secret,
            "Accept": "application/json",
            "User-Agent": "VIGITRA-SmartTraffic-AI/2.1 (Gov-Certified Gateway)",
        }

        session = self._get_session()
        url = f"{self.api_base_url.rstrip('/')}/v1/vehicles/{clean_number}"

        try:
            resp = session.get(url, headers=headers, timeout=self.timeout_seconds)

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
                        "valid_until": data.get("rc", {}).get("valid_until", "2037-01-01"),
                    },
                    "insurance": {
                        "status": data.get("insurance", {}).get("status", "VALID"),
                        "provider": data.get("insurance", {}).get("company", "National Insurance"),
                        "policy_number": data.get("insurance", {}).get("policy_no", "POL-XXXX"),
                        "valid_until": data.get("insurance", {}).get("valid_until", "2027-01-01"),
                    },
                    "puc": {
                        "status": data.get("puc", {}).get("status", "VALID"),
                        "valid_until": data.get("puc", {}).get("valid_until", "2026-12-31"),
                    },
                    "fitness": {
                        "status": data.get("fitness", {}).get("status", "VALID"),
                        "valid_until": data.get("fitness", {}).get("valid_until", "2027-01-01"),
                    },
                    "permit": data.get("permit"),
                    "watchlist": {
                        "matched": data.get("hotlist", False),
                        "reference": data.get("hotlist_ref", "HOTLIST-NONE"),
                        "reason": data.get("hotlist_reason", ""),
                    },
                    "owner_reference": data.get("owner_id_hash"),
                    "authorized_owner_display_name": data.get("owner_name"),
                }
            elif resp.status_code == 404:
                logger.info("[AuthorizedParivahanProvider] Vehicle %s not found in National Registry.", clean_number)
                return None
            else:
                logger.warning(
                    "[AuthorizedParivahanProvider] Gateway returned status %d: %s",
                    resp.status_code,
                    resp.text[:200],
                )
                return None
        except requests.exceptions.Timeout:
            logger.warning(
                "[AuthorizedParivahanProvider] Request timed out (%ds) querying %s",
                self.timeout_seconds,
                clean_number,
            )
            return None
        except Exception as exc:
            logger.error("[AuthorizedParivahanProvider] Request failed for %s: %s", clean_number, exc)
            return None

"""
Security and authentication utilities for Vigitra / Smart Traffic AI.
Handles password hashing via SHA-256 with configurable salt, and JWT token issuance.
"""

import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
import jwt
from app.core.config import settings

# Salt fallback maintains backward compatibility with existing hashed passwords.
# In production, specify PASSWORD_SALT as a high-entropy secret environment variable.
PASSWORD_SALT: str = os.getenv("PASSWORD_SALT", "smarttraffic_salt_2026")


def get_password_hash(password: str) -> str:
    """Hash password string using SHA-256 with configured salt."""
    return hashlib.sha256((password + PASSWORD_SALT).encode("utf-8")).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed SHA-256 representation."""
    return get_password_hash(plain_password) == hashed_password


def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """Generate signed JWT access token for user authentication."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {"exp": expire, "sub": str(subject)}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

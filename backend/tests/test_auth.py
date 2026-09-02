import pytest
from app.core import security
from app.models.models import User, RoleEnum

def test_password_hashing():
    pwd = "secretpassword123"
    hashed = security.get_password_hash(pwd)
    assert hashed != pwd
    assert security.verify_password(pwd, hashed) is True
    assert security.verify_password("wrongpassword", hashed) is False

def test_jwt_token_generation():
    token = security.create_access_token("admin_user")
    assert token is not None
    assert isinstance(token, str)

from datetime import timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core import security
from app.core.config import settings
from app.database.session import get_db
from app.models.models import User, RoleEnum
from app.schemas.schemas import UserCreate, UserOut, Token, UserApprove
from app.api.deps import get_current_user, require_role

router = APIRouter()

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    # Generate username/email if police registration
    username = user_in.username
    if not username and user_in.police_id:
        username = f"police_{user_in.police_id.lower().replace(' ', '_')}"
    
    if not username:
        raise HTTPException(status_code=400, detail="Username or Police ID is required")
        
    email = user_in.email or f"{username}@police.gov.in"

    existing = db.query(User).filter(
        (User.username == username) | 
        (User.email == email) |
        (user_in.police_id is not None and User.police_id == user_in.police_id)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username, Police ID, or email already registered")

    role = user_in.role or (RoleEnum.ADMIN if username == "admin" else RoleEnum.FIELD_OPERATOR)

    user = User(
        username=username,
        email=email,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name or username,
        role=role,
        police_id=user_in.police_id,
        area_jurisdiction=user_in.area_jurisdiction,
        mobile_number=user_in.mobile_number,
        is_approved=True if role == RoleEnum.ADMIN else True  # Pre-approve for immediate testing accessibility
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login", response_model=Token)
async def login(request: Request, db: Session = Depends(get_db)):
    identifier = None
    password = None

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            identifier = body.get("username") or body.get("police_id") or body.get("mobile_number")
            password = body.get("password")
        except Exception:
            pass
    
    if not identifier or not password:
        try:
            form = await request.form()
            identifier = form.get("username") or form.get("police_id") or form.get("mobile_number")
            password = form.get("password")
        except Exception:
            pass

    if not identifier or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Credentials (username, Police ID, or Mobile) and password are required"
        )

    # Search by username, police_id, or mobile_number
    user = db.query(User).filter(
        (User.username == identifier) |
        (User.police_id == identifier) |
        (User.mobile_number == identifier) |
        (User.email == identifier)
    ).first()

    if not user or not security.verify_password(str(password), str(user.hashed_password)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/Police ID or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account")
    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Police Officer account pending Admin approval")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=str(user.username), expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/users", response_model=List[UserOut])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    return db.query(User).all()

@router.patch("/users/{user_id}/approve", response_model=UserOut)
def approve_user(
    user_id: int,
    approve_in: UserApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_approved = approve_in.is_approved
    db.commit()
    db.refresh(user)
    return user


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token
)
from app.schemas.auth import LoginRequest, LoginResponse, RefreshTokenRequest, RegisterRequest
from app.models.user import User, UserRole
from app.models.partner import Partner
from app.services.audit_service import AuditService
from datetime import datetime

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login with CNPJ, username and password"""
    
    # Find user by CNPJ and username
    user = db.query(User).filter(
        User.cnpj == request.cnpj,
        User.username == request.username
    ).first()
    
    if not user or not verify_password(request.password, user.hashed_password):
        # Log failed attempt
        AuditService.log_action(
            db=db,
            action="login_failed",
            entity_type="user",
            entity_id=None,
            changes={"cnpj": request.cnpj, "username": request.username}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Check MFA if enabled
    if user.mfa_enabled and not request.mfa_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="MFA code required"
        )
    
    # TODO: Verify MFA code if provided
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Create tokens
    token_data = {"sub": user.id, "role": user.role.value}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    # Log successful login
    AuditService.log_action(
        db=db,
        user_id=user.id,
        action="login_success",
        entity_type="user",
        entity_id=user.id
    )
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role.value,
            "cnpj": user.cnpj
        }
    )


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Refresh access token using refresh token"""
    
    payload = decode_token(request.refresh_token)
    
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    # Create new tokens
    token_data = {"sub": user.id, "role": user.role.value}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role.value,
            "cnpj": user.cnpj
        }
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register new partner user"""
    
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.username == request.username) | 
        (User.email == request.email) |
        (User.cnpj == request.cnpj)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this username, email or CNPJ already exists"
        )
    
    # Create user
    user = User(
        cnpj=request.cnpj,
        username=request.username,
        email=request.email,
        hashed_password=get_password_hash(request.password),
        phone=request.phone,
        role=UserRole.PARTNER
    )
    db.add(user)
    db.flush()
    
    # Create partner
    partner = Partner(
        user_id=user.id,
        cnpj=request.cnpj,
        company_name=request.company_name
    )
    db.add(partner)
    
    db.commit()
    
    # Log registration
    AuditService.log_action(
        db=db,
        user_id=user.id,
        action="user_registered",
        entity_type="user",
        entity_id=user.id
    )
    
    return {"message": "User registered successfully", "user_id": user.id}

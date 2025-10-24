from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class LoginRequest(BaseModel):
    cnpj: str = Field(..., min_length=14, max_length=14)
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8)
    mfa_code: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RegisterRequest(BaseModel):
    cnpj: str = Field(..., min_length=14, max_length=14)
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    phone: Optional[str] = None
    company_name: str = Field(..., min_length=3)

from pydantic import BaseModel, EmailStr, Field
from typing import Any, Optional, List
import datetime
from uuid import UUID

class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    currency: Optional[str] = "INR"
    current_age: Optional[int] = Field(28, ge=0)
    target_retirement_age: Optional[int] = Field(50, ge=0)
    monthly_income: Optional[float] = Field(0.0, ge=0)
    monthly_expense: Optional[float] = Field(0.0, ge=0)
    target_savings_rate: Optional[float] = Field(30.0, ge=0)
    emergency_fund_amount: Optional[float] = Field(0.0, ge=0)
    health_dependents: Optional[List[dict[str, Any]]] = []

class UserLogin(BaseModel):
    username_or_email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserOut"

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    currency: Optional[str] = None
    current_age: Optional[int] = Field(None, ge=0)
    target_retirement_age: Optional[int] = Field(None, ge=0)
    monthly_income: Optional[float] = Field(None, ge=0)
    monthly_expense: Optional[float] = Field(None, ge=0)
    target_savings_rate: Optional[float] = Field(None, ge=0)
    emergency_fund_amount: Optional[float] = Field(None, ge=0)
    dependents_count: Optional[int] = Field(None, ge=0)
    health_dependents: Optional[List[dict[str, Any]]] = None
    is_onboarded: Optional[bool] = None

class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6)

class UserOut(BaseModel):
    id: UUID | str
    email: str
    username: str
    full_name: Optional[str] = None
    currency: str = "INR"
    current_age: int = 28
    target_retirement_age: int = 50
    monthly_income: float = 0.0
    monthly_expense: float = 0.0
    target_savings_rate: float = 30.0
    emergency_fund_amount: float = 0.0
    dependents_count: int = 0
    health_dependents: List[dict[str, Any]] = []
    is_onboarded: bool = False
    created_at: Optional[datetime.datetime] = None

TokenResponse.model_rebuild()

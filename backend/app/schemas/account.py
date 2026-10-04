from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
import datetime

class AccountBase(BaseModel):
    name: str
    account_type: str = Field(..., description="SAVINGS, CURRENT, CREDIT_CARD, WALLET, FIXED_DEPOSIT, INVESTMENT, OTHER")
    balance: float = 0.0
    currency: Optional[str] = "INR"
    institution: Optional[str] = None
    is_active: Optional[bool] = True

class AccountCreate(AccountBase):
    pass

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    account_type: Optional[str] = None
    balance: Optional[float] = None
    institution: Optional[str] = None
    is_active: Optional[bool] = None

class AccountOut(AccountBase):
    id: UUID | str
    user_id: UUID | str
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

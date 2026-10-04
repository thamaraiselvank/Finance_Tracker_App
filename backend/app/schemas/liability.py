from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
import datetime

class LiabilityBase(BaseModel):
    name: str
    liability_type: str = Field(..., description="HOME_LOAN, PERSONAL_LOAN, CAR_LOAN, EDUCATION_LOAN, CREDIT_CARD, GOLD_LOAN, BUSINESS_LOAN, OTHER")
    principal_amount: float = Field(..., ge=0)
    current_outstanding: float = Field(..., ge=0)
    interest_rate_pct: float = Field(..., ge=0)
    tenure_months: int = Field(..., gt=0)
    emi_amount: Optional[float] = 0.0
    start_date: Optional[datetime.date] = None
    lender: Optional[str] = None
    notes: Optional[str] = None

class LiabilityCreate(LiabilityBase):
    pass

class LiabilityUpdate(BaseModel):
    name: Optional[str] = None
    liability_type: Optional[str] = None
    principal_amount: Optional[float] = None
    current_outstanding: Optional[float] = None
    interest_rate_pct: Optional[float] = None
    tenure_months: Optional[int] = None
    emi_amount: Optional[float] = None
    start_date: Optional[datetime.date] = None
    lender: Optional[str] = None
    notes: Optional[str] = None

class LiabilityOut(LiabilityBase):
    id: UUID | str
    user_id: UUID | str
    paid_percentage: float = 0.0
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
import datetime

class DebtBase(BaseModel):
    debt_name: str = Field(..., min_length=1, max_length=255)
    debt_type: str = Field(..., description="CREDIT_CARD, PERSONAL_LOAN, HOME_LOAN, CAR_LOAN, EDUCATION_LOAN, GOLD_LOAN, BUSINESS_LOAN, OTHER")
    principal_amount: float = Field(..., gt=0)
    current_outstanding: float = Field(..., ge=0)
    interest_rate_pct: float = Field(..., ge=0)
    tenure_months: Optional[int] = None
    monthly_emi: Optional[float] = Field(None, ge=0)
    start_date: Optional[datetime.date] = None
    creditor_name: Optional[str] = None

class DebtCreate(DebtBase):
    pass

class DebtUpdate(BaseModel):
    debt_name: Optional[str] = None
    debt_type: Optional[str] = None
    principal_amount: Optional[float] = Field(None, gt=0)
    current_outstanding: Optional[float] = Field(None, ge=0)
    interest_rate_pct: Optional[float] = Field(None, ge=0)
    tenure_months: Optional[int] = None
    monthly_emi: Optional[float] = Field(None, ge=0)
    priority_payoff: Optional[bool] = None
    payoff_strategy: Optional[str] = None

class DebtOut(DebtBase):
    id: UUID | str
    user_id: UUID | str
    end_date: Optional[datetime.date] = None
    priority_payoff: bool = False
    payoff_strategy: str = "STANDARD"
    total_interest_paid: float = 0.0
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

class DebtPayoffPlan(BaseModel):
    debt_id: UUID | str
    debt_name: str
    current_outstanding: float
    monthly_payment: float
    total_interest_if_minimum: float
    months_to_payoff: int
    payoff_date: datetime.date
    interest_saved_with_extra_payment: Optional[float] = None

class DebtSummary(BaseModel):
    total_outstanding: float = 0.0
    total_monthly_emi: float = 0.0
    total_interest_rate_avg: float = 0.0
    debt_to_income_ratio: float = 0.0
    number_of_debts: int = 0
    high_priority_debts: int = 0
    estimated_debt_free_date: Optional[datetime.date] = None

class DebtAvailancheStrategy(BaseModel):
    """Debt payoff strategy: Pay highest interest first"""
    recommended_order: list[DebtPayoffPlan]
    total_interest_saved: float
    months_to_complete: int

class DebtSnowballStrategy(BaseModel):
    """Debt payoff strategy: Pay smallest amount first"""
    recommended_order: list[DebtPayoffPlan]
    motivation_wins: int
    months_to_complete: int

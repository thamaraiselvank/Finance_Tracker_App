from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
import datetime

class InsuranceBase(BaseModel):
    policy_name: str
    insurance_type: str = Field(..., description="HEALTH, TERM, MOTOR, HOME, OTHER")
    sum_insured: float = Field(..., ge=0)
    annual_premium: float = Field(0.0, ge=0)
    policy_start_date: Optional[datetime.date] = None
    renewal_date: Optional[datetime.date] = None
    dependents_covered: Optional[int] = 0
    insurer_name: Optional[str] = None
    is_active: Optional[bool] = True
    notes: Optional[str] = None

class InsuranceCreate(InsuranceBase):
    pass

class InsuranceUpdate(BaseModel):
    policy_name: Optional[str] = None
    insurance_type: Optional[str] = None
    sum_insured: Optional[float] = None
    annual_premium: Optional[float] = None
    policy_start_date: Optional[datetime.date] = None
    renewal_date: Optional[datetime.date] = None
    dependents_covered: Optional[int] = None
    insurer_name: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

class InsuranceOut(InsuranceBase):
    id: UUID | str
    user_id: UUID | str
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

class EssentialsCheckSummary(BaseModel):
    overall_health_score: float = 0.0 # 0 to 10
    health_score_status: str = "Good" # "Critical", "Risky", "Getting There", "Good", "Excellent"
    
    # Emergency Fund
    liquid_assets: float = 0.0
    monthly_expense: float = 0.0
    emergency_runway_months: float = 0.0
    emergency_fund_status: str = "Risky"
    
    # Savings Rate
    savings_rate_pct: float = 0.0
    intended_savings_rate_pct: float = 30.0
    savings_rate_status: str = "Risky"
    monthly_income: float = 0.0
    actual_monthly_expense: float = 0.0
    time_to_fi_years: float = 0.0
    
    # Term Insurance
    term_cover: float = 0.0
    ideal_term_cover: float = 0.0
    term_cover_status: str = "Risky"
    term_cover_formula: str = "25 * Annual Expense"
    
    # Health Insurance
    health_cover: float = 0.0
    recommended_health_cover: float = 1000000.0 # e.g. 10 Lakhs
    health_cover_status: str = "Risky"
    dependents_count: int = 0
    
    # Debt Ratio
    debt_ratio_pct: float = 0.0
    total_assets: float = 0.0
    total_liabilities: float = 0.0
    debt_ratio_status: str = "Good"

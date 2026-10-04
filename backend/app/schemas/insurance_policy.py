from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
import datetime

class InsurancePolicyBase(BaseModel):
    policy_name: str = Field(..., min_length=1, max_length=255)
    policy_type: str = Field(..., description="HEALTH, TERM_LIFE, MOTOR, HOME, TRAVEL, CRITICAL_ILLNESS, OTHER")
    sum_insured: float = Field(..., gt=0)
    annual_premium: float = Field(..., ge=0)
    policy_number: Optional[str] = None
    coverage_type: Optional[str] = None
    dependents_covered: int = Field(0, ge=0)
    insurer_name: Optional[str] = None
    payment_frequency: str = Field("YEARLY", description="MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY")
    payment_status: str = Field("PENDING", description="PAID or PENDING")
    next_payment_date: Optional[datetime.date] = None
    last_payment_date: Optional[datetime.date] = None

class InsurancePolicyCreate(InsurancePolicyBase):
    start_date: Optional[datetime.date] = None
    renewal_date: Optional[datetime.date] = None

class InsurancePolicyUpdate(BaseModel):
    policy_name: Optional[str] = None
    policy_type: Optional[str] = None
    sum_insured: Optional[float] = None
    annual_premium: Optional[float] = None
    policy_number: Optional[str] = None
    coverage_type: Optional[str] = None
    dependents_covered: Optional[int] = None
    insurer_name: Optional[str] = None
    payment_frequency: Optional[str] = None
    payment_status: Optional[str] = None
    next_payment_date: Optional[datetime.date] = None
    last_payment_date: Optional[datetime.date] = None
    renewal_date: Optional[datetime.date] = None
    status: Optional[str] = None

class InsurancePolicyOut(InsurancePolicyBase):
    id: UUID | str
    user_id: UUID | str
    start_date: Optional[datetime.date] = None
    maturity_date: Optional[datetime.date] = None
    renewal_date: Optional[datetime.date] = None
    agent_name: Optional[str] = None
    status: str = "ACTIVE"
    document_url: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

class InsuranceAuditResult(BaseModel):
    policy_id: UUID | str
    policy_name: str
    policy_type: str
    current_coverage: float
    recommended_coverage: float
    coverage_gap: float
    gap_percentage: float
    adequacy_status: str  # Adequate, Partial, Inadequate, Over-insured
    recommendation: Optional[str] = None

class InsuranceClaim(BaseModel):
    claim_number: str
    claim_date: datetime.date
    amount_claimed: float
    amount_approved: Optional[float] = None
    status: str  # Pending, Approved, Rejected, Paid
    claim_type: str

class HealthInsuranceAudit(BaseModel):
    current_coverage: float
    family_members: int
    recommended_coverage: float
    gap: float
    critical_illness_covered: bool
    cashless_hospitals: int
    waiting_period_days: int
    assessment: str

class TermLifeInsuranceCalculator(BaseModel):
    current_age: int
    monthly_income: float
    dependents: int
    years_to_retirement: int
    existing_cover: float
    recommended_cover: float
    coverage_gap: float
    annual_premium_estimate: float
    rationale: str

class InsuranceSummary(BaseModel):
    total_policies: int = 0
    active_policies: int = 0
    total_sum_insured: float = 0.0
    total_annual_premium: float = 0.0
    upcoming_renewals: int = 0
    health_coverage_adequate: bool
    life_coverage_adequate: bool
    critical_gaps: List[str] = []
    next_renewal_date: Optional[datetime.date] = None

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

# SIP Calculator
class SipCalculatorInput(BaseModel):
    monthly_investment: float = Field(..., gt=0)
    expected_return_rate_pct: float = Field(..., gt=0, le=100)
    time_period_years: int = Field(..., gt=0, le=60)
    annual_step_up_pct: Optional[float] = Field(0.0, ge=0, le=100)

class SipYearlyBreakdown(BaseModel):
    year: int
    yearly_investment: float
    total_invested: float
    future_value: float
    returns_earned: float

class SipCalculatorResult(BaseModel):
    total_invested: float
    estimated_returns: float
    total_value: float
    yearly_schedule: List[SipYearlyBreakdown] = []

# Lumpsum Calculator
class LumpsumCalculatorInput(BaseModel):
    total_investment: float = Field(..., gt=0)
    expected_return_rate_pct: float = Field(..., gt=0, le=100)
    time_period_years: int = Field(..., gt=0, le=60)

class LumpsumCalculatorResult(BaseModel):
    total_invested: float
    estimated_returns: float
    total_value: float
    yearly_schedule: List[Dict[str, Any]] = []

# CAGR Calculator
class CagrCalculatorInput(BaseModel):
    initial_value: float = Field(..., gt=0)
    final_value: float = Field(..., gt=0)
    duration_years: float = Field(..., gt=0)

class CagrCalculatorResult(BaseModel):
    cagr_percentage: float
    absolute_growth_percentage: float
    total_gain: float

# XIRR Calculator
class XirrCashFlow(BaseModel):
    date: str # YYYY-MM-DD
    amount: float # Negative for investments, positive for returns/redemptions/current value

class XirrCalculatorInput(BaseModel):
    cash_flows: List[XirrCashFlow]

class XirrCalculatorResult(BaseModel):
    xirr_percentage: float
    total_invested: float
    current_value: float
    net_profit: float

# EMI Calculator
class EmiCalculatorInput(BaseModel):
    loan_amount: float = Field(..., gt=0)
    interest_rate_pct: float = Field(..., gt=0)
    tenure_months: int = Field(..., gt=0)

class EmiAmortizationRow(BaseModel):
    month: int
    emi: float
    principal_paid: float
    interest_paid: float
    remaining_balance: float

class EmiCalculatorResult(BaseModel):
    monthly_emi: float
    total_interest: float
    total_payment: float
    principal_percentage: float
    interest_percentage: float
    amortization_schedule: List[EmiAmortizationRow] = []

# SWP Calculator
class SwpCalculatorInput(BaseModel):
    total_investment: float = Field(..., gt=0)
    monthly_withdrawal: float = Field(..., gt=0)
    expected_return_rate_pct: float = Field(..., gt=0)
    annual_inflation_pct: Optional[float] = Field(0.0, ge=0)
    time_period_years: int = Field(..., gt=0)

class SwpCalculatorResult(BaseModel):
    total_withdrawn: float
    final_balance: float
    depleted_in_years: Optional[float] = None
    schedule: List[Dict[str, Any]] = []

# FIRE / Retirement Calculator
class FireCalculatorInput(BaseModel):
    current_age: int = Field(..., ge=18, le=80)
    target_retirement_age: int = Field(..., ge=18, le=80)
    life_expectancy: Optional[int] = Field(85, ge=50, le=100)
    monthly_expense: float = Field(..., gt=0)
    current_portfolio_value: Optional[float] = Field(0.0, ge=0)
    existing_monthly_investment: Optional[float] = Field(0.0, ge=0)
    expected_pre_retire_return_pct: Optional[float] = Field(12.0, gt=0)
    expected_post_retire_return_pct: Optional[float] = Field(8.0, gt=0)
    expected_inflation_pct: Optional[float] = Field(6.0, ge=0)

class FireMilestone(BaseModel):
    type: str # Lean FIRE, Standard FIRE (25x), Fat FIRE (33x)
    required_corpus: float
    years_to_reach: float
    projected_age: int

class FireCalculatorResult(BaseModel):
    current_annual_expense: float
    future_annual_expense_at_retirement: float
    standard_fire_corpus: float # 25x or inflation-adjusted
    lean_fire_corpus: float # 75% of standard
    fat_fire_corpus: float # 150% of standard
    projected_corpus_at_retire_age: float
    shortfall_or_surplus: float
    required_monthly_sip: float
    can_retire_at_target_age: bool
    estimated_fire_age: int
    milestones: List[FireMilestone] = []
    yearly_progression: List[Dict[str, Any]] = []

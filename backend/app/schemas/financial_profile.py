from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
import datetime

class FinancialProfileBase(BaseModel):
    risk_tolerance: str = Field(..., description="CONSERVATIVE, MODERATE, AGGRESSIVE")
    investment_experience: str = Field(..., description="BEGINNER, INTERMEDIATE, ADVANCED")
    time_horizon_years: int = Field(10, ge=1, le=70)
    total_dependents: int = Field(0, ge=0)
    major_financial_goals: Optional[str] = None

class FinancialProfileCreate(FinancialProfileBase):
    pass

class FinancialProfileUpdate(BaseModel):
    risk_tolerance: Optional[str] = None
    investment_experience: Optional[str] = None
    time_horizon_years: Optional[int] = None
    total_dependents: Optional[int] = None
    major_financial_goals: Optional[str] = None

class FinancialProfileOut(FinancialProfileBase):
    id: UUID | str
    user_id: UUID | str
    current_liquidity: float = 0.0
    networth: float = 0.0
    debt_to_income_ratio: float = 0.0
    financial_health_score: int = 0
    profile_completed: bool = False
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

class FinancialHealthScore(BaseModel):
    score: int = Field(0, ge=0, le=100)
    grade: str  # A, B, C, D, F
    emergency_fund_status: str  # Excellent, Good, Fair, Poor
    debt_health: str  # Healthy, Warning, Critical
    savings_rate: str  # Excellent, Good, Fair, Poor
    investment_readiness: str  # Ready, On Track, Needs Work
    insurance_adequacy: str  # Adequate, Partial, Inadequate
    overall_assessment: str

class PortfolioRecommendation(BaseModel):
    profile_type: str  # Conservative, Moderate, Aggressive
    equity_allocation: float
    debt_allocation: float
    gold_allocation: float
    other_allocation: float
    rationale: str
    suggested_funds: list[str] = []

class OnboardingQuestionnaireResponse(BaseModel):
    # Basic Information
    current_age: int
    target_retirement_age: int
    monthly_income: float
    
    # Financial Goals
    primary_goal: str
    secondary_goals: list[str] = []
    goal_timeframes: dict = {}  # goal -> months
    
    # Financial Health
    current_debt: float
    monthly_debt_payments: float
    current_savings: float
    emergency_fund_months: float
    
    # Insurance
    life_insurance_coverage: float
    health_insurance_coverage: float
    dependents_count: int
    
    # Investment
    current_investments: float
    investment_experience: str
    risk_tolerance: str
    
    # Additional
    major_purchases_planned: Optional[str] = None
    additional_notes: Optional[str] = None

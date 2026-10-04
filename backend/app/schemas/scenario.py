from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from uuid import UUID
import datetime

class ScenarioBase(BaseModel):
    scenario_name: str = Field(..., min_length=1, max_length=255)
    scenario_type: str = Field(..., description="INCOME_CHANGE, EXPENSE_CHANGE, INVESTMENT_RETURN, JOB_LOSS, INHERITANCE, EMERGENCY, CUSTOM")
    description: Optional[str] = None
    assumptions: Dict[str, Any]

class ScenarioCreate(ScenarioBase):
    pass

class ScenarioUpdate(BaseModel):
    scenario_name: Optional[str] = None
    description: Optional[str] = None
    assumptions: Optional[Dict[str, Any]] = None
    is_favorite: Optional[bool] = None

class ScenarioOut(ScenarioBase):
    id: UUID | str
    user_id: UUID | str
    results: Optional[Dict[str, Any]] = None
    is_favorite: bool = False
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

class ScenarioResult(BaseModel):
    scenario_id: UUID | str
    scenario_name: str
    scenario_type: str
    
    # Financial Projections
    projected_networth: float
    projected_retirement_age: Optional[int] = None
    projected_monthly_expense: float
    projected_liquid_assets: float
    
    # Goal Impact
    goals_achievable: int
    goals_delayed: int
    estimated_goal_completion_date: Optional[Dict[str, datetime.date]] = None
    
    # Risk Analysis
    emergency_fund_coverage: float
    debt_impact: float
    investment_impact: float
    
    # Recommendations
    required_adjustments: list[str] = []
    alternative_strategies: list[str] = []

class IncomeChangeScenario(BaseModel):
    """What if income changes?"""
    current_income: float
    new_income: float
    change_percentage: float
    start_date: datetime.date
    duration_months: Optional[int] = None

class ExpenseChangeScenario(BaseModel):
    """What if expenses increase/decrease?"""
    current_expense: float
    new_expense: float
    change_percentage: float
    affected_categories: list[str] = []

class InvestmentReturnScenario(BaseModel):
    """What if investment returns change?"""
    current_portfolio_value: float
    current_return_percentage: float
    new_return_percentage: float
    time_horizon_years: int

class JobLossScenario(BaseModel):
    """What if job is lost?"""
    current_income: float
    income_replacement_percentage: float  # unemployment benefits, spouse income
    months_emergency_fund_covers: float
    additional_funds_needed: float
    months_to_secure_new_job: int

class EmergencyScenario(BaseModel):
    """What if emergency occurs?"""
    emergency_type: str  # Medical, Job Loss, Car Repair, etc.
    estimated_cost: float
    available_liquid_assets: float
    funding_gap: float
    suggested_funding_sources: list[str] = []
    impact_on_goals: str

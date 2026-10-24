from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
import datetime

class GoalBase(BaseModel):
    goal_name: str = Field(..., min_length=1, max_length=255)
    goal_type: str = Field(..., description="RETIREMENT, DOWN_PAYMENT, DEBT_PAYOFF, WEALTH_BUILD, EDUCATION, VACATION, BUSINESS, EMERGENCY_FUND, OTHER")
    target_amount: float = Field(..., gt=0)
    current_amount: float = Field(0.0, ge=0)
    target_date: datetime.date
    priority: int = Field(3, ge=1, le=5)
    description: Optional[str] = None
    allocated_monthly_savings: Optional[float] = Field(0.0, ge=0)

class GoalCreate(GoalBase):
    pass

class GoalUpdate(BaseModel):
    goal_name: Optional[str] = None
    goal_type: Optional[str] = None
    target_amount: Optional[float] = Field(None, gt=0)
    target_date: Optional[datetime.date] = None
    priority: Optional[int] = Field(None, ge=1, le=5)
    description: Optional[str] = None
    status: Optional[str] = None
    allocated_monthly_savings: Optional[float] = Field(None, ge=0)
    current_amount: Optional[float] = Field(None, ge=0)

class GoalOut(GoalBase):
    id: UUID | str
    user_id: UUID | str
    current_amount: float = 0.0
    status: str = "ACTIVE"
    suggested_monthly_savings: float = 0.0
    progress_percentage: float = 0.0
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

class GoalProgressSummary(BaseModel):
    total_goals: int = 0
    completed_goals: int = 0
    active_goals: int = 0
    total_target_amount: float = 0.0
    total_current_amount: float = 0.0
    total_monthly_allocation: float = 0.0

class GoalWithProjection(GoalOut):
    months_to_completion: Optional[int] = None
    on_track: bool = True
    projected_completion_date: Optional[datetime.date] = None

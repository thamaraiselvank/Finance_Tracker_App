from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from uuid import UUID
import datetime

class RecommendationBase(BaseModel):
    recommendation_type: str = Field(..., description="DEBT_PAYOFF, INVESTMENT, SAVINGS, INSURANCE, BUDGET, GOAL, TAX, LIFESTYLE, EMERGENCY, OTHER")
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=10)
    urgency: str = Field("MEDIUM", description="LOW, MEDIUM, HIGH, CRITICAL")
    impact_timeframe: Optional[str] = None

class RecommendationCreate(RecommendationBase):
    potential_savings: Optional[float] = None
    action_url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class RecommendationUpdate(BaseModel):
    status: Optional[str] = None
    potential_savings: Optional[float] = None

class RecommendationOut(RecommendationBase):
    id: UUID | str
    user_id: UUID | str
    potential_savings: float = 0.0
    status: str = "ACTIVE"
    action_url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

class RecommendationSummary(BaseModel):
    total_recommendations: int = 0
    critical_recommendations: int = 0
    high_recommendations: int = 0
    total_potential_savings: float = 0.0
    top_recommendations: list[RecommendationOut] = []
    completed_recommendations: int = 0

class AIInsight(BaseModel):
    category: str
    title: str
    severity: str  # success, info, warning, error
    summary: str
    actionable_advice: str
    estimated_impact: Optional[float] = None
    reference_data: Optional[Dict[str, Any]] = None

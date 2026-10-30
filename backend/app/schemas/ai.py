from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
import datetime

class AiInsightCard(BaseModel):
    category: str # "Savings", "Emergency Fund", "Debt", "Investments", "Insurance", "FIRE"
    title: str
    severity: str # "danger", "warning", "info", "success"
    summary: str
    actionable_advice: str
    impact_amount: Optional[float] = None

class AiFinancialAuditResponse(BaseModel):
    overall_health_rating: str # "Excellent", "Good", "Needs Attention", "Critical"
    score: float # 0 to 10
    summary_paragraph: str
    key_strengths: List[str] = []
    top_vulnerabilities: List[str] = []
    insights: List[AiInsightCard] = []
    fire_verdict: str
    recommended_next_steps: List[str] = []

class AiChatPrompt(BaseModel):
    question: str = Field(..., min_length=1, max_length=1200)
    conversation_id: Optional[UUID] = None


class AiQuotaStatus(BaseModel):
    limit: int
    used: int
    remaining: int
    resets_at: datetime.datetime
    timezone: str


class AiChatResponse(BaseModel):
    answer: str
    suggested_actions: List[str] = []
    conversation_id: Optional[UUID] = None
    quota: Optional[AiQuotaStatus] = None

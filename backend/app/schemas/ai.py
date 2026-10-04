from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

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
    question: str
    context: Optional[Dict[str, Any]] = None

class AiChatResponse(BaseModel):
    answer: str
    suggested_actions: List[str] = []

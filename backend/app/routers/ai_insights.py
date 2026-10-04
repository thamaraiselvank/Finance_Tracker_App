from fastapi import APIRouter, Depends
from app.core.security import get_current_user_id
from app.schemas.ai import (
    AiFinancialAuditResponse,
    AiChatPrompt,
    AiChatResponse
)
from app.services.ai_advisor import generate_financial_audit, answer_financial_query

router = APIRouter(prefix="/ai", tags=["AI Financial Advisor"])

@router.get("/audit", response_model=AiFinancialAuditResponse)
def get_ai_financial_audit(user_id: str = Depends(get_current_user_id)):
    """Performs deep AI financial health audit across spending, emergency runway, insurance, debts, and FIRE readiness."""
    return generate_financial_audit(user_id)

@router.post("/chat", response_model=AiChatResponse)
def chat_with_ai_advisor(payload: AiChatPrompt, user_id: str = Depends(get_current_user_id)):
    """Answers tailored financial questions correlating user's live portfolio and cash flows."""
    return answer_financial_query(user_id, payload.question)

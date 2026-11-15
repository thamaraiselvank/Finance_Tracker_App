from fastapi import APIRouter, Depends
from app.core.security import get_current_user_id
from app.schemas.ai import (
    AiFinancialAuditResponse,
    AiChatPrompt,
    AiChatResponse
)
from app.schemas.financial_assessment import AssessmentRecommendationRequest, FinancialAssessmentResult
from app.services.ai_advisor import (
    create_ai_conversation,
    chat_in_conversation,
    generate_financial_audit,
    get_current_ai_conversation,
    list_ai_conversations,
    get_ai_conversation,
)
from fastapi import HTTPException
from app.services.ai_quota import enforce_burst_limit, get_daily_quota
from app.services.financial_assessment import generate_assessment_recommendations

router = APIRouter(prefix="/ai", tags=["AI Financial Advisor"])


@router.post("/financial-assessment", response_model=FinancialAssessmentResult)
def get_financial_assessment_recommendations(
    payload: AssessmentRecommendationRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Score and provide AI coaching from only the user's validated assessment answers."""
    return generate_assessment_recommendations(user_id, payload)

@router.get("/audit", response_model=AiFinancialAuditResponse)
def get_ai_financial_audit(user_id: str = Depends(get_current_user_id)):
    """Performs deep AI financial health audit across spending, emergency runway, insurance, debts, and FIRE readiness."""
    return generate_financial_audit(user_id)

@router.post("/chat", response_model=AiChatResponse)
def chat_with_ai_advisor(payload: AiChatPrompt, user_id: str = Depends(get_current_user_id)):
    """Answers tailored financial questions correlating user's live portfolio and cash flows."""
    return chat_in_conversation(
        user_id,
        payload.question,
        str(payload.conversation_id) if payload.conversation_id else None,
    )


@router.get("/conversations/current")
def get_current_conversation(user_id: str = Depends(get_current_user_id)):
    """Return the user's most recently updated private advisor conversation."""
    return get_current_ai_conversation(user_id)


@router.post("/conversations")
def start_conversation(user_id: str = Depends(get_current_user_id)):
    """Start a new private advisor conversation."""
    enforce_burst_limit(user_id)
    return create_ai_conversation(user_id)


@router.get("/conversations")
def list_conversations(user_id: str = Depends(get_current_user_id)):
    return list_ai_conversations(user_id)


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str, user_id: str = Depends(get_current_user_id)):
    conversation = get_ai_conversation(user_id, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conversation


@router.get("/quota")
def get_ai_quota(user_id: str = Depends(get_current_user_id)):
    """Return the authenticated user's daily AI request allowance and reset time."""
    return get_daily_quota(user_id)

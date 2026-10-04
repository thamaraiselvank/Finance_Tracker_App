from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
import datetime

class MessageBase(BaseModel):
    role: str = Field(..., description="user, assistant")
    content: str = Field(..., min_length=1)
    timestamp: Optional[datetime.datetime] = None

class ConversationMessage(MessageBase):
    message_id: Optional[UUID | str] = None
    metadata: Optional[Dict[str, Any]] = None

class AIConversationBase(BaseModel):
    conversation_title: Optional[str] = None

class AIConversationCreate(AIConversationBase):
    messages: Optional[List[ConversationMessage]] = None
    context: Optional[Dict[str, Any]] = None

class AIConversationOut(AIConversationBase):
    id: UUID | str
    user_id: UUID | str
    messages: List[ConversationMessage] = []
    context: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

class AIAdvisorMessage(BaseModel):
    """Single message in advisor conversation"""
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime.datetime = datetime.datetime.now()
    tone: Optional[str] = "neutral"  # helpful, warning, encouraging, educational
    action_items: Optional[List[str]] = None

class AIAdvisorContext(BaseModel):
    """Context for AI advisor to generate responses"""
    user_financial_profile: Optional[Dict[str, Any]] = None
    recent_transactions: Optional[List[Dict[str, Any]]] = None
    active_goals: Optional[List[Dict[str, Any]]] = None
    debts: Optional[List[Dict[str, Any]]] = None
    recent_recommendations: Optional[List[Dict[str, Any]]] = None

class FinancialQuestion(BaseModel):
    question: str = Field(..., min_length=5)
    context: Optional[str] = None
    question_category: Optional[str] = None  # budgeting, investing, debt, goals, insurance, tax, general

class AIAdvisorResponse(BaseModel):
    response_text: str
    confidence_level: float = Field(0.0, ge=0.0, le=1.0)
    citations: List[str] = []
    recommended_actions: List[str] = []
    follow_up_questions: List[str] = []
    external_resources: Optional[List[Dict[str, str]]] = None

class EducationalContent(BaseModel):
    topic: str
    content_type: str  # article, video, calculator, interactive
    title: str
    summary: str
    difficulty_level: str  # Beginner, Intermediate, Advanced
    estimated_read_time_minutes: int
    content_url: Optional[str] = None
    key_takeaways: List[str] = []

class ConversationSummary(BaseModel):
    conversation_id: UUID | str
    title: str
    message_count: int
    topics_discussed: List[str]
    action_items_identified: List[str]
    recommendations_made: List[str]
    created_date: datetime.date
    last_updated: datetime.date

class ChatbotCapability(BaseModel):
    """Supported capabilities of the AI advisor"""
    category: str  # budgeting, investing, goal_planning, debt_management, insurance, tax, learning
    description: str
    example_questions: List[str]
    can_calculate: bool = False
    can_recommend: bool = False
    can_educate: bool = False
    can_plan: bool = False

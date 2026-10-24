from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
import datetime

class TransactionBase(BaseModel):
    account_id: Optional[UUID | str] = None
    category_id: Optional[UUID | str] = None
    subcategory_id: Optional[UUID | str] = None
    type: str = Field(..., description="INCOME, EXPENSE, or TRANSFER")
    amount: float = Field(..., gt=0)
    date: datetime.date = Field(default_factory=datetime.date.today)
    description: str
    notes: Optional[str] = None
    tags: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    account_id: Optional[UUID | str] = None
    category_id: Optional[UUID | str] = None
    subcategory_id: Optional[UUID | str] = None
    type: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    date: Optional[datetime.date] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None

class TransactionOut(TransactionBase):
    id: UUID | str
    user_id: UUID | str
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    subcategory_name: Optional[str] = None
    account_name: Optional[str] = None
    created_at: Optional[datetime.datetime] = None

class TransactionFilter(BaseModel):
    type: Optional[str] = None
    category_id: Optional[UUID | str] = None
    account_id: Optional[UUID | str] = None
    start_date: Optional[datetime.date] = None
    end_date: Optional[datetime.date] = None
    search: Optional[str] = None
    limit: int = 50
    offset: int = 0

class TransactionSummary(BaseModel):
    total_income: float = 0.0
    total_expense: float = 0.0
    net_savings: float = 0.0
    monthly_avg_income: float = 0.0
    monthly_avg_expense: float = 0.0
    recent_transactions: List[TransactionOut] = []

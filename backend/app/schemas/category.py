from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
import datetime

class SubcategoryBase(BaseModel):
    name: str

class SubcategoryCreate(SubcategoryBase):
    pass

class SubcategoryOut(SubcategoryBase):
    id: UUID | str
    category_id: UUID | str
    created_at: Optional[datetime.datetime] = None

class CategoryBase(BaseModel):
    name: str
    type: str = Field(..., description="INCOME, EXPENSE, or TRANSFER")
    icon: Optional[str] = "Tag"
    color: Optional[str] = "#10B981"

class CategoryCreate(CategoryBase):
    subcategories: Optional[List[str]] = []

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None

class CategoryOut(CategoryBase):
    id: UUID | str
    user_id: Optional[UUID | str] = None
    is_system: bool = False
    subcategories: List[SubcategoryOut] = []
    created_at: Optional[datetime.datetime] = None

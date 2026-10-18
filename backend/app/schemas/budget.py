from pydantic import BaseModel, Field


class BudgetUpsert(BaseModel):
    category_id: str
    monthly_limit: float = Field(..., ge=0)
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)


class BudgetOut(BaseModel):
    category_id: str
    category_name: str
    monthly_limit: float | None = None
    spent: float = 0
    remaining: float | None = None
    over_budget: bool = False
import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


FlowType = Literal["INCOME", "EXPENSE"]
SourceType = Literal[
    "BILL", "SUBSCRIPTION", "EMI", "INSURANCE_PREMIUM", "SALARY", "RENTAL_INCOME",
    "DIVIDEND", "INTEREST", "OTHER",
]
Frequency = Literal["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]


class ScheduleFields(BaseModel):
    account_id: UUID | str
    category_id: Optional[UUID | str] = None
    asset_id: Optional[UUID | str] = None
    description: str = Field(..., min_length=1, max_length=255)
    flow_type: FlowType
    source_type: SourceType = "OTHER"
    amount: float = Field(..., gt=0, le=9999999999999.99)
    amount_is_estimate: bool = False
    frequency: Frequency = "MONTHLY"
    interval_count: int = Field(1, ge=1, le=12)
    start_date: datetime.date
    end_date: Optional[datetime.date] = None
    liability_id: Optional[UUID | str] = None
    debt_id: Optional[UUID | str] = None
    insurance_policy_id: Optional[UUID | str] = None

    @model_validator(mode="after")
    def validate_schedule(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("End date must be on or after the start date.")
        income_sources = {"SALARY", "RENTAL_INCOME", "DIVIDEND", "INTEREST", "OTHER"}
        expense_sources = {"BILL", "SUBSCRIPTION", "EMI", "INSURANCE_PREMIUM", "OTHER"}
        allowed = income_sources if self.flow_type == "INCOME" else expense_sources
        if self.source_type not in allowed:
            raise ValueError("Choose a source type that matches income or expense.")
        if self.asset_id and self.flow_type != "INCOME":
            raise ValueError("An asset can only be linked to expected income.")
        linked_records = [self.liability_id, self.debt_id, self.insurance_policy_id]
        if sum(value is not None for value in linked_records) > 1:
            raise ValueError("A schedule can link to only one debt or insurance policy.")
        if (self.liability_id or self.debt_id) and (self.flow_type != "EXPENSE" or self.source_type != "EMI"):
            raise ValueError("Debt schedules must be expenses with the EMI type.")
        if self.insurance_policy_id and (self.flow_type != "EXPENSE" or self.source_type != "INSURANCE_PREMIUM"):
            raise ValueError("Insurance schedules must be expenses with the insurance premium type.")
        return self


class ScheduleCreate(ScheduleFields):
    pass


class ScheduleUpdate(BaseModel):
    account_id: Optional[UUID | str] = None
    category_id: Optional[UUID | str] = None
    asset_id: Optional[UUID | str] = None
    description: Optional[str] = Field(None, min_length=1, max_length=255)
    flow_type: Optional[FlowType] = None
    source_type: Optional[SourceType] = None
    amount: Optional[float] = Field(None, gt=0, le=9999999999999.99)
    amount_is_estimate: Optional[bool] = None
    frequency: Optional[Frequency] = None
    interval_count: Optional[int] = Field(None, ge=1, le=12)
    start_date: Optional[datetime.date] = None
    end_date: Optional[datetime.date] = None
    is_active: Optional[bool] = None


class CompleteOccurrence(BaseModel):
    actual_amount: Optional[float] = Field(None, gt=0, le=9999999999999.99)
    actual_date: Optional[datetime.date] = None
    transaction_id: Optional[UUID | str] = None

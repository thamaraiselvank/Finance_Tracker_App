from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Literal
from uuid import UUID
import datetime
from pydantic import model_validator

class TaxSettingBase(BaseModel):
    financial_year: str = Field(..., description="e.g., 'FY2023-24'")
    tax_regime: str = Field("NEW", description="OLD, NEW")
    annual_income: float = Field(0.0, ge=0)

class TaxSettingCreate(TaxSettingBase):
    pass

class TaxSettingUpdate(BaseModel):
    tax_regime: Optional[str] = None
    annual_income: Optional[float] = None
    section_80c_invested: Optional[float] = None
    section_80d_invested: Optional[float] = None
    home_loan_interest: Optional[float] = None

class TaxSettingOut(TaxSettingBase):
    id: UUID | str
    user_id: UUID | str
    section_80c_limit: float = 150000.0
    section_80c_invested: float = 0.0
    section_80c_remaining: float = 150000.0
    section_80d_limit: float = 100000.0
    section_80d_invested: float = 0.0
    section_80d_remaining: float = 100000.0
    home_loan_interest: float = 0.0
    estimated_tax_liability: float = 0.0
    tax_calculator_result: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

class TaxSavingInvestmentRecommendation(BaseModel):
    section: str  # 80C, 80D, 24(b), etc.
    limit: float
    invested: float
    remaining: float
    recommended_investment: float
    suggested_instruments: list[str]  # ELSS, PPF, LIC, etc.
    priority: str  # High, Medium, Low
    benefit_amount: float

class TaxCalculationResult(BaseModel):
    financial_year: str
    tax_regime: str
    annual_income: float
    taxable_income: float
    standard_deduction: float
    section_80c_deduction: float
    section_80d_deduction: float
    home_loan_interest_deduction: float
    other_deductions: float
    gross_tax: float
    health_and_education_cess: float
    total_tax_liability: float
    effective_tax_rate: float
    estimated_refund: float

class TaxSavingSummary(BaseModel):
    tax_regime: str
    annual_income: float
    estimated_tax_without_planning: float
    estimated_tax_with_planning: float
    tax_savings: float
    savings_percentage: float
    time_to_utilize_section_80c: str
    time_to_utilize_section_80d: str
    overall_assessment: str
    immediate_actions: list[str] = []

class TaxOptimizationStrategy(BaseModel):
    strategy_name: str
    annual_tax_saving: float
    investment_required: float
    roi_months: int
    risk_level: str
    instruments_needed: list[str]
    deadline: datetime.date
    priority: str

class InvestmentForTaxSaving(BaseModel):
    instrument: str  # ELSS, PPF, NPS, LIC, etc.
    section: str
    investment_amount: float
    tax_benefit: float
    lock_in_period: int  # months
    min_return_percentage: float
    recommended: bool = False


class IndiaTaxEstimateInput(BaseModel):
    tax_year: str = Field("2026-27", min_length=7, max_length=10)
    age: int = Field(30, ge=18, le=120)
    residential_status: Literal["resident", "non_resident"] = "resident"
    salary_income: float = Field(0, ge=0, le=1_000_000_000)
    interest_income: float = Field(0, ge=0, le=1_000_000_000)
    dividend_income: float = Field(0, ge=0, le=1_000_000_000)
    rental_taxable_income: float = Field(0, ge=0, le=1_000_000_000)
    business_taxable_income: float = Field(0, ge=0, le=1_000_000_000)
    other_regular_income: float = Field(0, ge=0, le=1_000_000_000)
    section_80c: float = Field(0, ge=0, le=1_000_000_000)
    employee_pf_contribution: float = Field(0, ge=0, le=1_000_000_000)
    section_80d: float = Field(0, ge=0, le=1_000_000_000)
    home_loan_interest_self_occupied: float = Field(0, ge=0, le=1_000_000_000)
    other_old_regime_deductions: float = Field(0, ge=0, le=1_000_000_000)
    employer_nps_deduction_new: float = Field(0, ge=0, le=1_000_000_000)
    tax_already_paid: float = Field(0, ge=0, le=1_000_000_000)

    @model_validator(mode="after")
    def require_income_or_paid_tax(self):
        values = (
            self.salary_income, self.interest_income, self.dividend_income,
            self.rental_taxable_income, self.business_taxable_income,
            self.other_regular_income, self.tax_already_paid,
        )
        if not any(values):
            raise ValueError("Enter at least one income amount or tax already paid.")
        return self

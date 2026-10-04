from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from uuid import UUID
import datetime

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

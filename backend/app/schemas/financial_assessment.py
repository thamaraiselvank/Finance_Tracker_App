from typing import Literal

from pydantic import BaseModel, Field, model_validator


class FinancialAssessmentAnswers(BaseModel):
    income_sources: list[Literal["salary", "self_employed", "business", "freelance", "investment", "rental", "pension", "other"]] = Field(min_length=1, max_length=8)
    monthly_net_income: float = Field(ge=0, le=1_000_000_000)
    income_stability: Literal["regular", "mostly_regular", "variable", "seasonal"]
    essential_monthly_spending: float = Field(gt=0, le=1_000_000_000)
    month_end_pattern: Literal["save_regularly", "save_sometimes", "break_even", "withdraw_or_borrow"]
    liquid_savings: float = Field(ge=0, le=1_000_000_000)
    debt_status: Literal["yes", "no", "not_sure"]
    debt_outstanding: float | None = Field(None, ge=0, le=1_000_000_000)
    monthly_debt_payment: float | None = Field(None, ge=0, le=1_000_000_000)
    debt_payment_pattern: Literal["on_time", "sometimes_late", "missed_recently"] | None = None
    upcoming_large_expense: Literal["yes", "no", "not_sure"] | None = None
    unexpected_expense_plan: Literal["savings", "monthly_cashflow", "borrow", "not_sure"] | None = None
    health_cover: Literal["personal", "employer", "both", "none", "not_sure"]
    has_dependents: bool
    term_cover: Literal["adequate", "some", "none", "not_sure", "not_applicable"]
    planning_confidence: Literal["confident", "somewhat", "need_help", "not_sure"]
    investment_types: list[Literal["cash_deposit", "stocks", "mutual_funds", "bonds", "gold", "property", "retirement", "crypto", "other"]] = Field(default_factory=list, max_length=9)
    gold_share: Literal["none", "under_10", "10_to_25", "26_to_50", "over_50", "not_sure", "not_applicable"]
    market_reaction: Literal["sell", "wait", "invest_more", "not_sure"]
    goal_priority: Literal["emergency_fund", "debt_repayment", "home", "education", "retirement", "wealth_building", "family", "other"]
    goal_horizon: Literal["under_1_year", "1_to_3_years", "3_to_10_years", "over_10_years", "not_sure"]

    @model_validator(mode="after")
    def validate_conditional_answers(self):
        if self.debt_status == "yes" and (
            self.debt_outstanding is None
            or self.monthly_debt_payment is None
            or self.debt_payment_pattern is None
        ):
            raise ValueError("For existing debt, provide the approximate balance, monthly payment, and payment pattern.")
        if self.debt_status == "no" and (
            self.upcoming_large_expense is None or self.unexpected_expense_plan is None
        ):
            raise ValueError("If you have no debt, answer the upcoming and unexpected expense questions instead.")
        if self.has_dependents and self.term_cover == "not_applicable":
            raise ValueError("Choose a term-cover status when someone depends on your income.")
        if not self.has_dependents and self.term_cover != "not_applicable":
            raise ValueError("Term cover should be marked not applicable when nobody depends on your income.")
        if "gold" not in self.investment_types and self.gold_share not in {"none", "not_sure", "not_applicable"}:
            raise ValueError("Choose gold in your investment types before selecting a gold allocation.")
        return self


class AssessmentRecommendation(BaseModel):
    priority: Literal["first", "next", "later"]
    area: str = Field(max_length=40)
    title: str = Field(max_length=100)
    why: str = Field(max_length=350)
    actions: list[str] = Field(min_length=1, max_length=3)
    app_tool: Literal["Money", "Goals", "Debts", "Insurance", "Wealth", "Tax", "Learn", "Profile", "None"]
    progress_check: str = Field(max_length=180)


class AssessmentRecommendationRequest(BaseModel):
    answers: FinancialAssessmentAnswers


class AssessmentAIContent(BaseModel):
    summary: str = Field(max_length=700)
    strengths: list[str] = Field(max_length=3)
    recommendations: list[AssessmentRecommendation] = Field(max_length=4)


class FinancialAssessmentResult(BaseModel):
    score: int = Field(ge=0, le=100)
    rating: Literal["Strong foundation", "Building", "Needs attention"]
    data_confidence: Literal["high", "medium", "low"]
    pillar_scores: dict[str, int]
    summary: str
    strengths: list[str] = Field(max_length=3)
    recommendations: list[AssessmentRecommendation] = Field(max_length=4)
    disclaimer: str

import datetime
from fastapi import APIRouter, Depends
from app.core.security import get_current_user_id
from app.core.database import fetch_one
from app.schemas.calculator import (
    SipCalculatorInput, SipCalculatorResult,
    LumpsumCalculatorInput, LumpsumCalculatorResult,
    CagrCalculatorInput, CagrCalculatorResult,
    XirrCalculatorInput, XirrCalculatorResult,
    EmiCalculatorInput, EmiCalculatorResult,
    SwpCalculatorInput, SwpCalculatorResult,
    FireCalculatorInput, FireCalculatorResult
)
from app.services.finance_math import (
    calculate_sip,
    calculate_lumpsum,
    calculate_cagr,
    calculate_xirr,
    calculate_emi,
    calculate_swp,
    calculate_fire
)

router = APIRouter(prefix="/calculators", tags=["Calculators"])

@router.post("/sip", response_model=SipCalculatorResult)
def run_sip_calculator(payload: SipCalculatorInput):
    return calculate_sip(
        monthly_investment=payload.monthly_investment,
        expected_return_rate_pct=payload.expected_return_rate_pct,
        time_period_years=payload.time_period_years,
        annual_step_up_pct=payload.annual_step_up_pct or 0.0
    )

@router.post("/lumpsum", response_model=LumpsumCalculatorResult)
def run_lumpsum_calculator(payload: LumpsumCalculatorInput):
    return calculate_lumpsum(
        total_investment=payload.total_investment,
        expected_return_rate_pct=payload.expected_return_rate_pct,
        time_period_years=payload.time_period_years
    )

@router.post("/cagr", response_model=CagrCalculatorResult)
def run_cagr_calculator(payload: CagrCalculatorInput):
    return calculate_cagr(
        initial_value=payload.initial_value,
        final_value=payload.final_value,
        duration_years=payload.duration_years
    )

@router.post("/xirr", response_model=XirrCalculatorResult)
def run_xirr_calculator(payload: XirrCalculatorInput):
    parsed_cfs = []
    tot_inv = 0.0
    cur_val = 0.0
    for cf in payload.cash_flows:
        try:
            dt = datetime.date.fromisoformat(cf.date)
            parsed_cfs.append((dt, cf.amount))
            if cf.amount < 0:
                tot_inv += abs(cf.amount)
            else:
                cur_val += cf.amount
        except Exception:
            continue
            
    xirr_rate = calculate_xirr(parsed_cfs)
    return {
        "xirr_percentage": xirr_rate,
        "total_invested": round(tot_inv, 2),
        "current_value": round(cur_val, 2),
        "net_profit": round(cur_val - tot_inv, 2)
    }

@router.post("/emi", response_model=EmiCalculatorResult)
def run_emi_calculator(payload: EmiCalculatorInput):
    return calculate_emi(
        loan_amount=payload.loan_amount,
        annual_interest_rate_pct=payload.interest_rate_pct,
        tenure_months=payload.tenure_months
    )

@router.post("/swp", response_model=SwpCalculatorResult)
def run_swp_calculator(payload: SwpCalculatorInput):
    return calculate_swp(
        total_investment=payload.total_investment,
        monthly_withdrawal=payload.monthly_withdrawal,
        expected_return_rate_pct=payload.expected_return_rate_pct,
        annual_inflation_pct=payload.annual_inflation_pct or 0.0,
        time_period_years=payload.time_period_years
    )

@router.post("/fire", response_model=FireCalculatorResult)
def run_fire_calculator(payload: FireCalculatorInput):
    return calculate_fire(
        current_age=payload.current_age,
        target_retirement_age=payload.target_retirement_age,
        life_expectancy=payload.life_expectancy or 85,
        monthly_expense=payload.monthly_expense,
        current_portfolio=payload.current_portfolio_value or 0.0,
        existing_monthly_investment=payload.existing_monthly_investment or 0.0,
        expected_pre_retire_return_pct=payload.expected_pre_retire_return_pct or 12.0,
        expected_post_retire_return_pct=payload.expected_post_retire_return_pct or 8.0,
        expected_inflation_pct=payload.expected_inflation_pct or 6.0
    )

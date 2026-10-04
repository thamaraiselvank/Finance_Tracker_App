import math
import datetime
from typing import List, Dict, Any, Tuple, Optional

def calculate_sip(monthly_investment: float, expected_return_rate_pct: float, time_period_years: int, annual_step_up_pct: float = 0.0) -> Dict[str, Any]:
    """Calculates SIP future value with optional annual step-up percentage."""
    monthly_rate = (expected_return_rate_pct / 100.0) / 12.0
    total_months = time_period_years * 12
    
    current_sip = monthly_investment
    total_invested = 0.0
    corpus = 0.0
    yearly_schedule = []
    
    for year in range(1, time_period_years + 1):
        year_invested = 0.0
        for month in range(1, 13):
            corpus = (corpus + current_sip) * (1 + monthly_rate)
            total_invested += current_sip
            year_invested += current_sip
            
        returns_earned = corpus - total_invested
        yearly_schedule.append({
            "year": year,
            "yearly_investment": round(year_invested, 2),
            "total_invested": round(total_invested, 2),
            "future_value": round(corpus, 2),
            "returns_earned": round(returns_earned, 2)
        })
        
        # Apply annual step up for next year
        if annual_step_up_pct > 0:
            current_sip = current_sip * (1 + (annual_step_up_pct / 100.0))
            
    return {
        "total_invested": round(total_invested, 2),
        "estimated_returns": round(corpus - total_invested, 2),
        "total_value": round(corpus, 2),
        "yearly_schedule": yearly_schedule
    }

def calculate_lumpsum(total_investment: float, expected_return_rate_pct: float, time_period_years: int) -> Dict[str, Any]:
    """Calculates lumpsum investment growth: A = P * (1 + r)^t"""
    r = expected_return_rate_pct / 100.0
    yearly_schedule = []
    
    for year in range(1, time_period_years + 1):
        fv = total_investment * math.pow(1 + r, year)
        yearly_schedule.append({
            "year": year,
            "total_invested": round(total_investment, 2),
            "future_value": round(fv, 2),
            "returns_earned": round(fv - total_investment, 2)
        })
        
    final_val = total_investment * math.pow(1 + r, time_period_years)
    return {
        "total_invested": round(total_investment, 2),
        "estimated_returns": round(final_val - total_investment, 2),
        "total_value": round(final_val, 2),
        "yearly_schedule": yearly_schedule
    }

def calculate_cagr(initial_value: float, final_value: float, duration_years: float) -> Dict[str, Any]:
    """Calculates Compound Annual Growth Rate: CAGR = (Final / Initial)^(1/t) - 1"""
    if initial_value <= 0 or duration_years <= 0:
        return {"cagr_percentage": 0.0, "absolute_growth_percentage": 0.0, "total_gain": 0.0}
        
    cagr = math.pow(final_value / initial_value, 1.0 / duration_years) - 1.0
    abs_growth = ((final_value - initial_value) / initial_value) * 100.0
    return {
        "cagr_percentage": round(cagr * 100.0, 2),
        "absolute_growth_percentage": round(abs_growth, 2),
        "total_gain": round(final_value - initial_value, 2)
    }

def calculate_xirr(cash_flows: List[Tuple[datetime.date, float]], guess: float = 0.1) -> float:
    """Calculates XIRR using Newton-Raphson method for irregular cash flows."""
    if len(cash_flows) < 2:
        return 0.0
        
    # Sort cash flows by date
    sorted_cf = sorted(cash_flows, key=lambda x: x[0])
    start_date = sorted_cf[0][0]
    
    # Precompute time deltas in years
    dated_amounts = [
        ((cf_date - start_date).days / 365.0, amount)
        for cf_date, amount in sorted_cf
    ]
    
    # Check if there is at least one negative and one positive flow
    amounts = [amt for _, amt in dated_amounts]
    if not (any(a < 0 for a in amounts) and any(a > 0 for a in amounts)):
        return 0.0
        
    rate = guess
    max_iterations = 100
    tolerance = 1e-6
    
    for _ in range(max_iterations):
        f_val = 0.0
        df_val = 0.0
        for t, amount in dated_amounts:
            try:
                denom = math.pow(1.0 + rate, t)
                f_val += amount / denom
                if t > 0:
                    df_val -= (t * amount) / (denom * (1.0 + rate))
            except (OverflowError, ZeroDivisionError):
                return 0.0
                
        if abs(f_val) < tolerance:
            return round(rate * 100.0, 2)
            
        if abs(df_val) < 1e-9:
            break
            
        new_rate = rate - (f_val / df_val)
        if new_rate <= -1.0:
            rate = (rate - 1.0) / 2.0
        else:
            rate = new_rate
            
    return round(rate * 100.0, 2)

def calculate_emi(loan_amount: float, annual_interest_rate_pct: float, tenure_months: int) -> Dict[str, Any]:
    """Calculates EMI and complete month-by-month reducing balance amortization schedule."""
    if tenure_months <= 0 or loan_amount <= 0:
        return {
            "monthly_emi": 0.0, "total_interest": 0.0, "total_payment": 0.0,
            "principal_percentage": 0.0, "interest_percentage": 0.0, "amortization_schedule": []
        }
        
    monthly_rate = (annual_interest_rate_pct / 100.0) / 12.0
    
    if monthly_rate == 0:
        emi = loan_amount / tenure_months
    else:
        # Standard EMI formula: [P * r * (1+r)^n] / [(1+r)^n - 1]
        pow_factor = math.pow(1 + monthly_rate, tenure_months)
        emi = (loan_amount * monthly_rate * pow_factor) / (pow_factor - 1)
        
    schedule = []
    remaining_balance = loan_amount
    total_interest = 0.0
    
    for month in range(1, tenure_months + 1):
        interest_part = remaining_balance * monthly_rate
        principal_part = emi - interest_part
        
        # Last month adjustment
        if month == tenure_months or remaining_balance < principal_part:
            principal_part = remaining_balance
            emi = principal_part + interest_part
            remaining_balance = 0.0
        else:
            remaining_balance -= principal_part
            
        total_interest += interest_part
        schedule.append({
            "month": month,
            "emi": round(emi, 2),
            "principal_paid": round(principal_part, 2),
            "interest_paid": round(interest_part, 2),
            "remaining_balance": round(max(0.0, remaining_balance), 2)
        })
        
    total_payment = loan_amount + total_interest
    principal_pct = (loan_amount / total_payment) * 100.0 if total_payment > 0 else 100.0
    interest_pct = (total_interest / total_payment) * 100.0 if total_payment > 0 else 0.0
    
    return {
        "monthly_emi": round(emi, 2),
        "total_interest": round(total_interest, 2),
        "total_payment": round(total_payment, 2),
        "principal_percentage": round(principal_pct, 1),
        "interest_percentage": round(interest_pct, 1),
        "amortization_schedule": schedule
    }

def calculate_swp(total_investment: float, monthly_withdrawal: float, expected_return_rate_pct: float, annual_inflation_pct: float = 0.0, time_period_years: int = 20) -> Dict[str, Any]:
    """Calculates Systematic Withdrawal Plan with optional inflation-adjusted withdrawals."""
    monthly_return = (expected_return_rate_pct / 100.0) / 12.0
    balance = total_investment
    current_withdrawal = monthly_withdrawal
    total_withdrawn = 0.0
    depleted_in_years = None
    schedule = []
    
    for year in range(1, time_period_years + 1):
        year_withdrawn = 0.0
        for month in range(1, 13):
            if balance <= 0:
                if depleted_in_years is None:
                    depleted_in_years = round((year - 1) + (month / 12.0), 1)
                break
            actual_w = min(balance, current_withdrawal)
            balance = (balance - actual_w) * (1 + monthly_return)
            total_withdrawn += actual_w
            year_withdrawn += actual_w
            
        schedule.append({
            "year": year,
            "yearly_withdrawal": round(year_withdrawn, 2),
            "total_withdrawn": round(total_withdrawn, 2),
            "remaining_balance": round(max(0.0, balance), 2)
        })
        
        if annual_inflation_pct > 0:
            current_withdrawal = current_withdrawal * (1 + (annual_inflation_pct / 100.0))
            
    return {
        "total_withdrawn": round(total_withdrawn, 2),
        "final_balance": round(max(0.0, balance), 2),
        "depleted_in_years": depleted_in_years,
        "schedule": schedule
    }

def calculate_fire(
    current_age: int,
    target_retirement_age: int,
    monthly_expense: float,
    current_portfolio: float = 0.0,
    existing_monthly_investment: float = 0.0,
    expected_pre_retire_return_pct: float = 12.0,
    expected_post_retire_return_pct: float = 8.0,
    expected_inflation_pct: float = 6.0,
    life_expectancy: int = 85
) -> Dict[str, Any]:
    """
    Computes comprehensive FIRE (Financial Independence Retire Early) metrics:
    - Future inflation-adjusted annual expenses at retirement
    - Required corpus (Standard 25x/33x rule, Lean FIRE 75%, Fat FIRE 150%)
    - Projected corpus with existing investments
    - Shortfall / Surplus and Required Monthly SIP to hit target FIRE age
    """
    years_to_retirement = max(0, target_retirement_age - current_age)
    years_in_retirement = max(1, life_expectancy - target_retirement_age)
    
    current_annual_expense = monthly_expense * 12.0
    
    # Future annual expense at retirement adjusted for inflation
    inflation_multiplier = math.pow(1 + (expected_inflation_pct / 100.0), years_to_retirement)
    future_annual_expense = current_annual_expense * inflation_multiplier
    
    # Real rate of return in retirement: (1 + r) / (1 + i) - 1
    post_r = expected_post_retire_return_pct / 100.0
    inf_r = expected_inflation_pct / 100.0
    real_retire_rate = (post_r - inf_r) / (1 + inf_r) if (1 + inf_r) != 0 else post_r
    
    # 25x or inflation-adjusted present value of retirement annuity
    if abs(real_retire_rate) < 0.001:
        standard_corpus = future_annual_expense * years_in_retirement
    else:
        # Annuity formula for finite retirement years
        standard_corpus = future_annual_expense * ((1 - math.pow(1 + real_retire_rate, -years_in_retirement)) / real_retire_rate)
        
    # Standard rule fallback (e.g. min 25x future expense)
    standard_corpus = max(standard_corpus, future_annual_expense * 25.0)
    lean_corpus = standard_corpus * 0.75
    fat_corpus = standard_corpus * 1.50
    
    # Project existing portfolio and monthly investments
    pre_monthly_rate = (expected_pre_retire_return_pct / 100.0) / 12.0
    total_months = years_to_retirement * 12
    
    # Growth of existing corpus
    projected_lumpsum = current_portfolio * math.pow(1 + pre_monthly_rate, total_months)
    
    # Growth of existing SIP
    if pre_monthly_rate > 0 and total_months > 0:
        projected_sip = existing_monthly_investment * ((math.pow(1 + pre_monthly_rate, total_months) - 1) / pre_monthly_rate) * (1 + pre_monthly_rate)
    else:
        projected_sip = existing_monthly_investment * total_months
        
    total_projected_corpus = projected_lumpsum + projected_sip
    shortfall = standard_corpus - total_projected_corpus
    
    # Calculate required monthly SIP to bridge the shortfall
    if shortfall <= 0 or total_months <= 0:
        required_monthly_sip = 0.0
        can_retire = True
    else:
        if pre_monthly_rate > 0:
            required_monthly_sip = shortfall / (((math.pow(1 + pre_monthly_rate, total_months) - 1) / pre_monthly_rate) * (1 + pre_monthly_rate))
        else:
            required_monthly_sip = shortfall / total_months
        can_retire = False
        
    # Estimate actual age when FIRE will be achieved with current + planned pace
    yearly_progression = []
    sim_portfolio = current_portfolio
    est_fire_age = target_retirement_age
    found_fire = False
    
    for y in range(0, 50):
        sim_age = current_age + y
        if sim_age > 90:
            break
        # Target corpus needed at that age
        y_inf = math.pow(1 + inf_r, y)
        target_at_y = (current_annual_expense * y_inf) * 25.0
        
        yearly_progression.append({
            "age": sim_age,
            "year": y,
            "projected_portfolio": round(sim_portfolio, 2),
            "target_fire_corpus": round(target_at_y, 2),
            "is_fire_reached": sim_portfolio >= target_at_y
        })
        
        if sim_portfolio >= target_at_y and not found_fire:
            est_fire_age = sim_age
            found_fire = True
            
        # Grow portfolio for next year
        total_monthly_invest = existing_monthly_investment + (required_monthly_sip if can_retire else 0)
        for _ in range(12):
            sim_portfolio = (sim_portfolio + total_monthly_invest) * (1 + pre_monthly_rate)
            
    if not found_fire:
        est_fire_age = min(85, current_age + 45)
        
    milestones = [
        {"type": "Lean FIRE (Frugal / Baseline)", "required_corpus": round(lean_corpus, 2), "years_to_reach": max(0, est_fire_age - current_age - 3), "projected_age": max(current_age, est_fire_age - 3)},
        {"type": "Standard FIRE (25x Core Expense)", "required_corpus": round(standard_corpus, 2), "years_to_reach": max(0, est_fire_age - current_age), "projected_age": est_fire_age},
        {"type": "Fat FIRE (Luxurious Lifestyle)", "required_corpus": round(fat_corpus, 2), "years_to_reach": max(0, est_fire_age - current_age + 5), "projected_age": min(85, est_fire_age + 5)}
    ]
    
    return {
        "current_annual_expense": round(current_annual_expense, 2),
        "future_annual_expense_at_retirement": round(future_annual_expense, 2),
        "standard_fire_corpus": round(standard_corpus, 2),
        "lean_fire_corpus": round(lean_corpus, 2),
        "fat_fire_corpus": round(fat_corpus, 2),
        "projected_corpus_at_retire_age": round(total_projected_corpus, 2),
        "shortfall_or_surplus": round(total_projected_corpus - standard_corpus, 2),
        "required_monthly_sip": round(max(0.0, required_monthly_sip), 2),
        "can_retire_at_target_age": total_projected_corpus >= standard_corpus,
        "estimated_fire_age": est_fire_age,
        "milestones": milestones,
        "yearly_progression": yearly_progression[:35]
    }

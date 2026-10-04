import math
import json
from typing import Dict, Any, List
from app.core.database import fetch_all, fetch_one

def calculate_time_to_fi_from_savings_rate(savings_rate_pct: float, return_rate: float = 0.08, swr: float = 0.04) -> float:
    """
    Calculates estimated years to Financial Independence based solely on savings rate:
    Formula: ln(1 + (1-s)/s * (r/swr)) / ln(1+r)
    """
    if savings_rate_pct <= 0:
        return 99.0
    if savings_rate_pct >= 95:
        return 2.0
        
    s = savings_rate_pct / 100.0
    try:
        # Standard Networth Accumulation Formula
        # Years = ln( (1/swr) * (s / (1-s)) * r + 1 ) / ln(1+r)
        # Or simplified empirical FIRE model
        years = math.log(( (1 - s) / s ) * (return_rate / swr) + 1.0) / math.log(1.0 + return_rate)
        return round(max(1.0, min(75.0, years)), 1)
    except Exception:
        # Fallback table approximation
        if savings_rate_pct < 10: return 60.0
        if savings_rate_pct < 20: return 51.0
        if savings_rate_pct < 30: return 37.0
        if savings_rate_pct < 40: return 28.0
        if savings_rate_pct < 50: return 22.0
        if savings_rate_pct < 60: return 16.0
        if savings_rate_pct < 70: return 11.5
        if savings_rate_pct < 80: return 8.0
        return 5.0

def compute_user_financial_health(user_id: str) -> Dict[str, Any]:
    """
    Aggregates user transactions, assets, liabilities, insurance, and profile to compute
    the complete Essentials Financial Health Check matching the Finverse specs.
    """
    # 1. Fetch user profile
    user = fetch_one("SELECT * FROM users WHERE id = %s", (user_id,))
    if not user:
        return {}
        
    monthly_income_profile = float(user.get("monthly_income") or 0.0)
    monthly_expense_profile = float(user.get("monthly_expense") or 0.0)
    emergency_fund_amount = float(user.get("emergency_fund_amount") or 0.0)
    target_savings_rate = float(user.get("target_savings_rate") or 0.0)
    dependents_count = int(user.get("dependents_count") or 0)
    
    # 2. Fetch last 3 months average income and expense from transactions
    tx_stats = fetch_one("""
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) as total_income,
            COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) as total_expense,
            COUNT(DISTINCT DATE_TRUNC('month', date)) as active_months
        FROM transactions 
        WHERE user_id = %s AND date >= CURRENT_DATE - INTERVAL '90 days'
    """, (user_id,))
    
    active_months = max(1, int(tx_stats.get("active_months") or 1))
    avg_tx_income = float(tx_stats.get("total_income") or 0.0) / active_months
    avg_tx_expense = float(tx_stats.get("total_expense") or 0.0) / active_months
    
    # Use only stored profile values or real transaction history. Do not invent demo defaults.
    monthly_income = avg_tx_income if avg_tx_income > 0 else monthly_income_profile
    monthly_expense = avg_tx_expense if avg_tx_expense > 0 else monthly_expense_profile
    annual_expense = monthly_expense * 12.0
    
    # 3. Fetch assets breakdown
    assets = fetch_all("SELECT * FROM assets WHERE user_id = %s", (user_id,))
    total_assets = sum(float(a.get("current_value") or 0.0) for a in assets)
    
    # Liquid assets: Cash, Bank Accounts, Fixed Deposits, Liquid Mutual Funds
    liquid_classes = ['CASH_EQUIVALENT', 'FIXED_INCOME']
    liquid_assets = sum(
        float(a.get("current_value") or 0.0) 
        for a in assets 
        if a.get("asset_class") in liquid_classes or "liquid" in (a.get("sub_type") or "").lower() or "savings" in (a.get("name") or "").lower()
    )
    
    # Also fetch bank account balances
    accounts = fetch_all("SELECT * FROM accounts WHERE user_id = %s AND is_active = TRUE", (user_id,))
    bank_balances = sum(float(acc.get("balance") or 0.0) for acc in accounts)
    total_liquid = emergency_fund_amount if emergency_fund_amount > 0 else liquid_assets + bank_balances
    
    # 4. Fetch liabilities
    liabilities = fetch_all("SELECT * FROM liabilities WHERE user_id = %s", (user_id,))
    total_liabilities = sum(float(l.get("current_outstanding") or 0.0) for l in liabilities)
    
    net_worth = total_assets - total_liabilities
    
    # 5. Fetch insurances
    insurances = fetch_all("SELECT * FROM insurances WHERE user_id = %s AND is_active = TRUE", (user_id,))
    term_cover = sum(float(i.get("sum_insured") or 0.0) for i in insurances if i.get("insurance_type") == 'TERM')
    health_cover = sum(float(i.get("sum_insured") or 0.0) for i in insurances if i.get("insurance_type") == 'HEALTH')
    
    has_financial_data = any([
        monthly_income > 0,
        monthly_expense > 0,
        total_assets > 0,
        total_liabilities > 0,
        term_cover > 0,
        health_cover > 0,
        dependents_count > 0,
    ])
    if not has_financial_data:
        return {
            "overall_health_score": 0.0,
            "health_score_status": "No Data",
            "liquid_assets": 0.0,
            "monthly_expense": 0.0,
            "emergency_runway_months": 0.0,
            "emergency_fund_status": "No Data",
            "savings_rate_pct": 0.0,
            "intended_savings_rate_pct": target_savings_rate,
            "savings_rate_status": "No Data",
            "monthly_income": 0.0,
            "actual_monthly_expense": 0.0,
            "time_to_fi_years": 0.0,
            "term_cover": 0.0,
            "ideal_term_cover": 0.0,
            "term_cover_status": "No Data",
            "term_cover_formula": "25 * Annual Expense",
            "health_cover": 0.0,
            "recommended_health_cover": 0.0,
            "health_cover_status": "No Data",
            "dependents_count": 0,
            "debt_ratio_pct": 0.0,
            "total_assets": 0.0,
            "total_liabilities": 0.0,
            "debt_ratio_status": "No Data"
        }

    # --- CALCULATE 5 PILLARS ---
    
    # Pillar 1: Emergency Fund (Runway)
    emergency_runway_months = round(total_liquid / monthly_expense, 1) if monthly_expense > 0 else 0.0
    if emergency_runway_months >= 6.0:
        ef_score = 10.0
        ef_status = "Good"
    elif emergency_runway_months >= 3.0:
        ef_score = 6.0
        ef_status = "Moderate"
    else:
        ef_score = max(1.0, emergency_runway_months * 1.5)
        ef_status = "Risky"
        
    # Pillar 2: Savings Rate
    actual_savings = max(0.0, monthly_income - monthly_expense)
    savings_rate_pct = round((actual_savings / monthly_income) * 100.0, 1) if monthly_income > 0 else 0.0
    time_to_fi = calculate_time_to_fi_from_savings_rate(savings_rate_pct) if monthly_income > 0 and monthly_expense > 0 else 0.0
    
    displayed_savings_rate = target_savings_rate if target_savings_rate > 0 else savings_rate_pct
    if displayed_savings_rate >= 40.0:
        sr_score = 10.0
        sr_status = "Excellent"
    elif displayed_savings_rate >= 20.0:
        sr_score = 7.0
        sr_status = "Good"
    elif displayed_savings_rate >= 10.0:
        sr_score = 4.0
        sr_status = "Getting There"
    else:
        sr_score = 2.0
        sr_status = "Risky"
        
    # Pillar 3: Term Insurance Adequacy (Formula: 25 * Annual Expense - Net Worth)
    ideal_term_cover = max(0.0, round(25.0 * annual_expense, 2))
    if ideal_term_cover == 0 and monthly_expense == 0:
        term_score = 0.0
        term_status = "No Data"
    elif ideal_term_cover == 0 or term_cover >= ideal_term_cover:
        term_score = 10.0
        term_status = "Good"
    elif term_cover >= ideal_term_cover * 0.6:
        term_score = 6.0
        term_status = "Moderate"
    else:
        term_score = 2.0
        term_status = "Risky"
        
    # Pillar 4: Health Insurance Adequacy (Min 5L for single, 10L+ for family)
    dependent_details = user.get("health_dependents") or []
    if isinstance(dependent_details, str):
        try:
            dependent_details = json.loads(dependent_details)
        except json.JSONDecodeError:
            dependent_details = []
    recommended_health_cover = max(500000.0, sum(float(item.get("cover") or 0) for item in dependent_details)) if dependent_details else (1000000.0 if dependents_count > 0 else 500000.0)
    if recommended_health_cover <= 0:
        health_score = 0.0
        health_status = "No Data"
    elif health_cover >= recommended_health_cover:
        health_score = 10.0
        health_status = "Good"
    elif health_cover >= 500000.0:
        health_score = 6.0
        health_status = "Moderate"
    else:
        health_score = 2.0
        health_status = "Risky"
        
    # Pillar 5: Debt Ratio (% of assets debt-funded)
    debt_ratio_pct = round((total_liabilities / total_assets) * 100.0, 1) if total_assets > 0 else (100.0 if total_liabilities > 0 else 0.0)
    if total_assets == 0 and total_liabilities == 0:
        debt_score = 0.0
        debt_status = "No Data"
    elif debt_ratio_pct <= 20.0:
        debt_score = 10.0
        debt_status = "Good"
    elif debt_ratio_pct <= 45.0:
        debt_score = 6.0
        debt_status = "Moderate"
    else:
        debt_score = 2.0
        debt_status = "Risky"
        
    # Aggregate Overall Health Score (Weighted average out of 10)
    # Weights: EF 25%, Savings 25%, Term 15%, Health 15%, Debt 20%
    overall_health_score = round(
        (ef_score * 0.25) +
        (sr_score * 0.25) +
        (term_score * 0.15) +
        (health_score * 0.15) +
        (debt_score * 0.20),
        1
    )
    
    if overall_health_score >= 8.0:
        overall_status = "Excellent"
    elif overall_health_score >= 6.0:
        overall_status = "Good"
    elif overall_health_score >= 4.0:
        overall_status = "Getting There"
    else:
        overall_status = "Risky"
        
    return {
        "overall_health_score": overall_health_score,
        "health_score_status": overall_status,
        
        # Emergency Fund
        "liquid_assets": round(total_liquid, 2),
        "monthly_expense": round(monthly_expense, 2),
        "emergency_runway_months": emergency_runway_months,
        "emergency_fund_status": ef_status,
        
        # Savings Rate
        "savings_rate_pct": displayed_savings_rate,
        "intended_savings_rate_pct": target_savings_rate,
        "savings_rate_status": sr_status,
        "monthly_income": round(monthly_income, 2),
        "actual_monthly_expense": round(monthly_expense, 2),
        "time_to_fi_years": time_to_fi,
        
        # Term Insurance
        "term_cover": round(term_cover, 2),
        "ideal_term_cover": round(ideal_term_cover, 2),
        "term_cover_status": term_status,
        "term_cover_formula": "25 * Annual Expense",
        
        # Health Insurance
        "health_cover": round(health_cover, 2),
        "recommended_health_cover": recommended_health_cover,
        "health_cover_status": health_status,
        "dependents_count": dependents_count,
        
        # Debt Ratio
        "debt_ratio_pct": debt_ratio_pct,
        "total_assets": round(total_assets, 2),
        "total_liabilities": round(total_liabilities, 2),
        "debt_ratio_status": debt_status
    }

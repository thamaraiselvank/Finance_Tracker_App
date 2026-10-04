from typing import Dict, Any, List
from app.core.database import fetch_all, fetch_one
from app.services.health_engine import compute_user_financial_health
from app.services.finance_math import calculate_fire

def generate_financial_audit(user_id: str) -> Dict[str, Any]:
    """Generates a deep AI-driven multi-pillar financial audit with actionable advice."""
    health = compute_user_financial_health(user_id)
    user = fetch_one("SELECT * FROM users WHERE id = %s", (user_id,))
    
    current_age = int(user.get("current_age") or 28) if user else 28
    target_retirement_age = int(user.get("target_retirement_age") or 50) if user else 50
    monthly_income = float(health.get("monthly_income") or 0.0)
    monthly_expense = float(health.get("actual_monthly_expense") or 0.0)
    liquid_assets = float(health.get("liquid_assets") or 0.0)
    runway_months = float(health.get("emergency_runway_months") or 0.0)
    total_assets = float(health.get("total_assets") or 0.0)
    total_liabilities = float(health.get("total_liabilities") or 0.0)
    term_cover = float(health.get("term_cover") or 0.0)
    ideal_term_cover = float(health.get("ideal_term_cover") or 0.0)
    health_cover = float(health.get("health_cover") or 0.0)
    recommended_health_cover = float(health.get("recommended_health_cover") or 1000000.0)
    savings_rate_pct = float(health.get("savings_rate_pct") or 0.0)
    
    # Run FIRE calculation
    fire_calc = calculate_fire(
        current_age=current_age,
        target_retirement_age=target_retirement_age,
        monthly_expense=monthly_expense if monthly_expense > 0 else 30000.0,
        current_portfolio=total_assets,
        existing_monthly_investment=max(0.0, monthly_income - monthly_expense)
    )
    
    insights: List[Dict[str, Any]] = []
    strengths: List[str] = []
    vulnerabilities: List[str] = []
    next_steps: List[str] = []
    
    # 1. Emergency Fund Audit
    if runway_months >= 6.0:
        strengths.append(f"Solid emergency runway of {runway_months} months of expenses.")
        insights.append({
            "category": "Emergency Fund",
            "title": "Healthy Liquid Cash Buffer",
            "severity": "success",
            "summary": f"You have ₹{liquid_assets:,.0f} in liquid reserves, covering {runway_months} months of baseline living costs.",
            "actionable_advice": "Maintain this in high-interest savings accounts, liquid debt funds, or sweep FDs. Avoid investing this portion in high-risk equities."
        })
    else:
        vulnerabilities.append(f"Low emergency runway ({runway_months} months). Recommended minimum is 6 months.")
        gap_ef = max(0.0, (6.0 * monthly_expense) - liquid_assets)
        insights.append({
            "category": "Emergency Fund",
            "title": "Vulnerable Liquidity Cushion",
            "severity": "danger" if runway_months < 3.0 else "warning",
            "summary": f"Your current liquid buffer of {runway_months} months is below the recommended 6 months safety net.",
            "actionable_advice": f"Allocate ₹{gap_ef:,.0f} towards liquid savings or sweep-in FDs over the next 3-6 months before ramping up illiquid assets.",
            "impact_amount": gap_ef
        })
        next_steps.append(f"Build emergency fund to at least ₹{(6.0 * monthly_expense):,.0f}.")
        
    # 2. Savings Rate & Cash Flow
    if savings_rate_pct >= 30.0:
        strengths.append(f"Commendable savings rate of {savings_rate_pct}% (industry benchmark is 20-30%).")
        insights.append({
            "category": "Savings",
            "title": "Strong Cash Accumulation Rate",
            "severity": "success",
            "summary": f"You are saving {savings_rate_pct}% of your monthly income.",
            "actionable_advice": "Channel surplus cash automatically on salary day into automated SIPs to prevent lifestyle creep."
        })
    else:
        vulnerabilities.append(f"Savings rate is {savings_rate_pct}%. Recommended target is at least 25-30%.")
        insights.append({
            "category": "Savings",
            "title": "Low Savings Rate / High Discretionary Spend",
            "severity": "warning",
            "summary": f"Currently saving {savings_rate_pct}% of income. At this rate, Financial Independence timeline is ~{health.get('time_to_fi_years', 40)} years.",
            "actionable_advice": "Audit discretionary shopping and dining out categories to recover 5-10% of monthly income."
        })
        next_steps.append("Increase monthly savings rate by 5-10% through automated investments.")
        
    # 3. Term Life & Health Insurance
    if term_cover < ideal_term_cover:
        term_gap = ideal_term_cover - term_cover
        vulnerabilities.append(f"Term insurance protection deficit of ₹{term_gap:,.0f}.")
        insights.append({
            "category": "Insurance",
            "title": "Significant Term Life Protection Gap",
            "severity": "danger",
            "summary": f"Your current term life cover is ₹{term_cover:,.0f}, while your dependents require an estimated ₹{ideal_term_cover:,.0f} (25x Annual Expense - Net Worth).",
            "actionable_advice": f"Procure a pure term life insurance policy for ₹{term_gap:,.0f}. Pure term plans are highly affordable.",
            "impact_amount": term_gap
        })
        next_steps.append(f"Apply for additional ₹{term_gap:,.0f} pure term insurance cover.")
    else:
        strengths.append("Term insurance coverage meets or exceeds your family's 25x expense requirement.")
        
    if health_cover < recommended_health_cover:
        health_gap = recommended_health_cover - health_cover
        vulnerabilities.append(f"Health insurance underinsured by ₹{health_gap:,.0f}.")
        insights.append({
            "category": "Insurance",
            "title": "Inadequate Health Cover Shield",
            "severity": "warning",
            "summary": f"Active health insurance cover is ₹{health_cover:,.0f} vs recommended ₹{recommended_health_cover:,.0f}.",
            "actionable_advice": "Take a 1 Crore Super Top-up health plan to protect against catastrophic medical inflation."
        })
        next_steps.append("Enhance health insurance with a Super Top-up policy.")
        
    # 4. Debt & Liabilities
    debt_ratio = float(health.get("debt_ratio_pct") or 0.0)
    if debt_ratio > 40.0:
        vulnerabilities.append(f"High Debt-to-Asset ratio of {debt_ratio}%.")
        insights.append({
            "category": "Debt",
            "title": "Heavy Debt Leverage",
            "severity": "danger",
            "summary": f"{debt_ratio}% of your asset base is financed through outstanding liabilities (₹{total_liabilities:,.0f}).",
            "actionable_advice": "Adopt the Avalanche Method: prioritize paying off high-interest loans (credit cards/personal loans > 12%) first."
        })
        next_steps.append("Accelerate prepayments on high-interest loans.")
    elif total_liabilities == 0:
        strengths.append("100% Debt-free! Zero outstanding liabilities.")
        
    # 5. FIRE & Retirement Projection
    if fire_calc.get("can_retire_at_target_age"):
        fire_verdict = f"On track to achieve Financial Independence by age {fire_calc.get('estimated_fire_age', target_retirement_age)}! Projected corpus: ₹{fire_calc.get('projected_corpus_at_retire_age', 0):,.0f}."
        insights.append({
            "category": "FIRE",
            "title": "On Track for Target Retirement",
            "severity": "success",
            "summary": fire_verdict,
            "actionable_advice": "Stay consistent with your asset allocation and rebalance annually between equity and debt."
        })
    else:
        req_sip = fire_calc.get("required_monthly_sip", 0.0)
        fire_verdict = f"Target retirement age {target_retirement_age} has a corpus shortfall of ₹{abs(fire_calc.get('shortfall_or_surplus', 0)):,.0f}. Additional monthly SIP of ₹{req_sip:,.0f} required."
        insights.append({
            "category": "FIRE",
            "title": "Retirement Target Gap Detected",
            "severity": "warning",
            "summary": f"To retire at age {target_retirement_age} with ₹{monthly_expense:,.0f}/month purchasing power, your required standard corpus is ₹{fire_calc.get('standard_fire_corpus', 0):,.0f}.",
            "actionable_advice": f"Increase equity SIP by ₹{req_sip:,.0f}/month with a 5-10% annual step-up to achieve early retirement comfortably.",
            "impact_amount": req_sip
        })
        next_steps.append(f"Boost monthly investment SIP by ₹{req_sip:,.0f}.")

    # Health score rating text
    score = float(health.get("overall_health_score") or 5.0)
    if score >= 8.0:
        rating = "Excellent"
        summary_text = "Your financial portfolio is robust and well-diversified with solid emergency reserves and sound insurance coverage."
    elif score >= 6.0:
        rating = "Good"
        summary_text = "You have established healthy financial foundations, with minor optimization opportunities in insurance or savings consistency."
    elif score >= 4.0:
        rating = "Needs Attention"
        summary_text = "Key vulnerabilities exist in your emergency runway, insurance adequacy, or debt load that need active rebalancing."
    else:
        rating = "Critical"
        summary_text = "Your financial structure has substantial risk exposure across liquidity, debt, and insurance. Immediate corrective steps are advised."

    return {
        "overall_health_rating": rating,
        "score": score,
        "summary_paragraph": summary_text,
        "key_strengths": strengths if strengths else ["Consistent transaction logging active"],
        "top_vulnerabilities": vulnerabilities if vulnerabilities else ["None identified - keep optimizing!"],
        "insights": insights,
        "fire_verdict": fire_verdict,
        "recommended_next_steps": next_steps[:4]
    }

def answer_financial_query(user_id: str, question: str) -> Dict[str, Any]:
    """Provides tailored answers correlating user's real financial data with the question."""
    audit = generate_financial_audit(user_id)
    health = compute_user_financial_health(user_id)
    q_lower = question.lower()
    
    if "fire" in q_lower or "retire" in q_lower:
        ans = f"Based on your profile, your estimated FIRE corpus requirement is ₹{audit.get('fire_verdict', '')}. {audit.get('summary_paragraph')}"
        actions = ["Review FIRE calculator", "Step-up monthly SIP by 10%"]
    elif "insurance" in q_lower or "term" in q_lower or "health" in q_lower:
        ans = f"Your current term cover is ₹{health.get('term_cover', 0):,.0f} (Ideal: ₹{health.get('ideal_term_cover', 0):,.0f}), and health cover is ₹{health.get('health_cover', 0):,.0f}. Check the Essentials tab for a full gap breakdown."
        actions = ["Explore pure term insurance", "Add Super Top-up health insurance"]
    elif "emergency" in q_lower or "liquid" in q_lower or "runway" in q_lower:
        ans = f"You currently have ₹{health.get('liquid_assets', 0):,.0f} in liquid assets, giving you a runway of {health.get('emergency_runway_months', 0)} months. We recommend maintaining at least 6 months of buffer."
        actions = ["Deposit emergency savings into Liquid Fund or Sweep FD"]
    elif "debt" in q_lower or "loan" in q_lower or "emi" in q_lower:
        ans = f"Your total debt outstanding is ₹{health.get('total_liabilities', 0):,.0f}, representing {health.get('debt_ratio_pct', 0)}% of your assets. We recommend prioritizing high-interest debts (>10%) first."
        actions = ["Use Debt Avalanche strategy", "Check Loan EMI Amortization schedule"]
    else:
        ans = f"Financial Health Assessment: Score {audit.get('score', 5)}/10 ({audit.get('overall_health_rating')}). {audit.get('summary_paragraph')} Key focus: {', '.join(audit.get('recommended_next_steps', ['Keep tracking expenses']))}."
        actions = audit.get('recommended_next_steps', [])
        
    return {
        "answer": ans,
        "suggested_actions": actions
    }

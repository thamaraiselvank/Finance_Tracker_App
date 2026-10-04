"""Insurance Planning Service - Calculate insurance needs and coverage recommendations"""
from typing import Dict, List
from app.core.database import fetch_one, fetch_all
import logging

logger = logging.getLogger("finverse.insurance_service")

def calculate_term_life_need(
    annual_income: float,
    dependents: int,
    existing_liabilities: float,
    years_to_retirement: int
) -> float:
    """
    Calculate recommended term life insurance cover
    Formula: (10x annual income) + (25L per dependent) + liabilities
    """
    # Base: 10x annual income
    base_cover = annual_income * 10
    
    # Add 25L per dependent (Indian standard)
    dependent_cover = 2_500_000 * dependents
    
    # Add to cover existing debts
    cover_for_liabilities = existing_liabilities * 1.2  # 20% buffer
    
    total_need = base_cover + dependent_cover + cover_for_liabilities
    
    return total_need

def calculate_health_insurance_need(
    family_members: int,
    annual_income: float,
    age: int = 30
) -> float:
    """
    Calculate recommended health insurance cover
    Base: 5-10x monthly income depending on family size and age
    """
    monthly_income = annual_income / 12
    
    # Base multiplier by family size
    if family_members == 1:
        multiplier = 5
    elif family_members == 2:
        multiplier = 8
    elif family_members == 3:
        multiplier = 10
    elif family_members == 4:
        multiplier = 12
    else:
        multiplier = 10 + (family_members - 4) * 2
    
    # Age adjustment
    if age > 50:
        multiplier *= 1.5
    elif age > 40:
        multiplier *= 1.25
    
    return monthly_income * multiplier

def calculate_critical_illness_cover_need(annual_income: float) -> float:
    """
    Calculate recommended critical illness cover
    Generally 2-3 years of income
    """
    return annual_income * 2.5

def assess_insurance_coverage(
    user_id: str,
    monthly_income: float,
    dependents: int,
    age: int = 30
) -> Dict:
    """
    Comprehensive insurance coverage assessment
    """
    try:
        # Get existing insurance
        policies = fetch_all("""
            SELECT policy_type, sum_insured FROM insurance_policies
            WHERE user_id = %s AND status = 'ACTIVE'
        """, (user_id,))
        
        # Group by type
        insurance_by_type = {}
        for policy in policies:
            policy_type = policy.get('policy_type')
            if policy_type not in insurance_by_type:
                insurance_by_type[policy_type] = 0
            insurance_by_type[policy_type] += policy.get('sum_insured', 0)
        
        # Get existing debts
        debts = fetch_one("""
            SELECT COALESCE(SUM(current_outstanding), 0) as total FROM debts WHERE user_id = %s
        """, (user_id,))
        
        total_debt = debts.get('total', 0) if debts else 0
        annual_income = monthly_income * 12
        family_members = dependents + 1  # +1 for self
        
        # Calculate needs
        term_life_need = calculate_term_life_need(annual_income, dependents, total_debt, 30)
        health_need = calculate_health_insurance_need(family_members, annual_income, age)
        critical_illness_need = calculate_critical_illness_cover_need(annual_income)
        
        # Get existing coverage
        term_life_coverage = insurance_by_type.get('TERM_LIFE', 0)
        health_coverage = insurance_by_type.get('HEALTH', 0) + insurance_by_type.get('CRITICAL_ILLNESS', 0)
        
        # Calculate gaps
        term_gap = max(0, term_life_need - term_life_coverage)
        health_gap = max(0, health_need - health_coverage)
        critical_gap = max(0, critical_illness_need - insurance_by_type.get('CRITICAL_ILLNESS', 0))
        
        # Assessment
        assessment = {
            'term_life': {
                'need': term_life_need,
                'coverage': term_life_coverage,
                'gap': term_gap,
                'coverage_percentage': (term_life_coverage / term_life_need * 100) if term_life_need > 0 else 0,
                'status': 'Adequate' if term_gap == 0 else 'Gap' if term_gap < term_life_need * 0.5 else 'Critical Gap',
                'priority': 'HIGH' if term_gap > 0 else 'LOW'
            },
            'health': {
                'need': health_need,
                'coverage': health_coverage,
                'gap': health_gap,
                'coverage_percentage': (health_coverage / health_need * 100) if health_need > 0 else 0,
                'status': 'Adequate' if health_gap == 0 else 'Gap' if health_gap < health_need * 0.5 else 'Critical Gap',
                'priority': 'HIGH' if health_gap > 0 else 'LOW'
            },
            'critical_illness': {
                'need': critical_illness_need,
                'coverage': insurance_by_type.get('CRITICAL_ILLNESS', 0),
                'gap': critical_gap,
                'coverage_percentage': (insurance_by_type.get('CRITICAL_ILLNESS', 0) / critical_illness_need * 100) if critical_illness_need > 0 else 0,
                'status': 'Adequate' if critical_gap == 0 else 'Gap' if critical_gap < critical_illness_need * 0.5 else 'Critical Gap',
                'priority': 'MEDIUM' if critical_gap > 0 else 'LOW'
            },
            'overall_health_score': calculate_insurance_health_score(term_gap, health_gap, critical_gap),
            'critical_gaps': [
                'Term Life Insurance' if term_gap > term_life_need * 0.5 else None,
                'Health Insurance' if health_gap > health_need * 0.5 else None,
                'Critical Illness Cover' if critical_gap > critical_illness_need * 0.5 else None
            ]
        }
        
        assessment['critical_gaps'] = [gap for gap in assessment['critical_gaps'] if gap]
        
        return assessment
    except Exception as e:
        logger.error(f"Error assessing insurance coverage: {e}")
        return {}

def calculate_insurance_health_score(term_gap: float, health_gap: float, critical_gap: float) -> int:
    """Calculate insurance coverage health score (0-100)"""
    score = 100
    
    # Deduct for gaps
    if term_gap > 0:
        score -= 40
    if health_gap > 0:
        score -= 30
    if critical_gap > 0:
        score -= 20
    
    return max(0, score)

def get_insurance_recommendations(user_id: str) -> List[Dict]:
    """
    Generate insurance recommendations
    """
    recommendations = []
    
    try:
        user = fetch_one("""
            SELECT monthly_income, current_age, dependents_count FROM users WHERE id = %s
        """, (user_id,))
        
        if not user:
            return []
        
        monthly_income = user.get('monthly_income', 0)
        age = user.get('current_age', 30)
        dependents = user.get('dependents_count', 0)
        
        # Get assessment
        assessment = assess_insurance_coverage(user_id, monthly_income, dependents, age)
        
        # Generate recommendations based on gaps
        if assessment.get('term_life', {}).get('gap', 0) > 0:
            gap = assessment['term_life']['gap']
            annual_premium_estimate = gap * 0.004  # Rough estimate: 0.4% annually
            
            recommendations.append({
                'title': 'Buy Term Life Insurance',
                'description': f'Coverage gap of ₹{gap:,.0f}. Recommended: {gap:,.0f} for 30 years',
                'urgency': 'CRITICAL' if gap > assessment['term_life']['need'] * 0.5 else 'HIGH',
                'estimated_annual_cost': annual_premium_estimate,
                'action': 'Get term life insurance quotes',
                'benefit': f'Protect your dependents with ₹{gap:,.0f} coverage'
            })
        
        if assessment.get('health', {}).get('gap', 0) > 0:
            gap = assessment['health']['gap']
            annual_premium_estimate = gap * 0.008  # Rough estimate: 0.8% annually
            
            recommendations.append({
                'title': 'Upgrade Health Insurance',
                'description': f'Current coverage gap: ₹{gap:,.0f}. Family needs ₹{assessment["health"]["need"]:,.0f}',
                'urgency': 'CRITICAL' if gap > assessment['health']['need'] * 0.5 else 'HIGH',
                'estimated_annual_cost': annual_premium_estimate,
                'action': 'Review health insurance policies',
                'benefit': 'Comprehensive health coverage for medical emergencies'
            })
        
        if assessment.get('critical_illness', {}).get('gap', 0) > 0:
            gap = assessment['critical_illness']['gap']
            annual_premium_estimate = gap * 0.006
            
            recommendations.append({
                'title': 'Add Critical Illness Cover',
                'description': f'Coverage gap: ₹{gap:,.0f}. Protects against major health events',
                'urgency': 'MEDIUM',
                'estimated_annual_cost': annual_premium_estimate,
                'action': 'Explore critical illness policies',
                'benefit': f'₹{gap:,.0f} protection for critical health conditions'
            })
        
        if not recommendations and assessment.get('overall_health_score', 0) >= 80:
            recommendations.append({
                'title': 'Insurance Coverage Excellent',
                'description': 'Your insurance coverage is well-balanced and adequate',
                'urgency': 'LOW',
                'action': 'Review coverage annually'
            })
        
        return recommendations
    except Exception as e:
        logger.error(f"Error generating insurance recommendations: {e}")
        return []

def estimate_monthly_premium(
    policy_type: str,
    sum_insured: float,
    age: int,
    tenure_years: int = 30
) -> float:
    """
    Rough estimate of monthly insurance premium
    Based on market data for India
    """
    monthly_premium = 0
    
    if policy_type == 'TERM_LIFE':
        # Term life: roughly 0.3-0.5% of cover annually
        annual_premium = sum_insured * 0.004
        if age > 50:
            annual_premium *= 2
        elif age > 40:
            annual_premium *= 1.5
        monthly_premium = annual_premium / 12
    
    elif policy_type == 'HEALTH':
        # Health: varies by cover and age
        # Base: ₹20 per ₹1000 cover
        annual_premium = (sum_insured / 1000) * 20
        if age > 50:
            annual_premium *= 3
        elif age > 40:
            annual_premium *= 2
        monthly_premium = annual_premium / 12
    
    elif policy_type == 'CRITICAL_ILLNESS':
        # Critical illness: roughly 0.5-1% of cover
        annual_premium = sum_insured * 0.006
        if age > 50:
            annual_premium *= 2
        monthly_premium = annual_premium / 12
    
    return round(monthly_premium, 2)

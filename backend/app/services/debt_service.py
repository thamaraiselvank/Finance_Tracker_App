"""Debt Management Service - Calculate payoff strategies and interest"""
from datetime import date, timedelta
from typing import Dict, List, Tuple, Optional
from app.core.database import fetch_one, fetch_all
import logging

logger = logging.getLogger("finverse.debt_service")

def calculate_monthly_interest(principal: float, annual_rate: float) -> float:
    """Calculate monthly interest amount"""
    return (principal * annual_rate / 100) / 12

def calculate_remaining_balance(
    principal: float,
    annual_rate: float,
    monthly_payment: float,
    months_elapsed: int
) -> float:
    """Calculate remaining balance after n months of payments"""
    balance = principal
    monthly_rate = annual_rate / 100 / 12
    
    for _ in range(months_elapsed):
        interest = balance * monthly_rate
        balance = balance + interest - monthly_payment
        if balance <= 0:
            return 0
    
    return max(0, balance)

def calculate_payoff_timeline(
    principal: float,
    annual_rate: float,
    monthly_payment: float
) -> Tuple[int, float]:
    """
    Calculate months to payoff and total interest paid
    Returns (months, total_interest)
    """
    balance = principal
    total_interest = 0
    months = 0
    monthly_rate = annual_rate / 100 / 12
    max_months = 600  # 50 years safety limit
    
    while balance > 0 and months < max_months:
        interest = balance * monthly_rate
        total_interest += interest
        balance = balance + interest - monthly_payment
        months += 1
        
        if balance < 0:
            balance = 0
            break
    
    return months, total_interest

def calculate_avalanche_payoff(debts: List[Dict]) -> Tuple[List[Dict], float, int]:
    """
    Calculate debt avalanche strategy (highest interest first)
    Returns (ordered_debts, total_interest_saved, months_to_payoff)
    """
    # Sort by interest rate (descending)
    sorted_debts = sorted(debts, key=lambda x: x.get('interest_rate_pct', 0), reverse=True)
    
    total_interest = 0
    total_months = 0
    result = []
    
    for debt in sorted_debts:
        principal = debt.get('current_outstanding', 0)
        annual_rate = debt.get('interest_rate_pct', 0)
        monthly_payment = debt.get('monthly_emi', 0)
        
        months, interest = calculate_payoff_timeline(principal, annual_rate, monthly_payment)
        total_interest += interest
        total_months = max(total_months, months)
        
        result.append({
            **debt,
            'months_to_payoff': months,
            'total_interest': interest,
            'payoff_date': date.today() + timedelta(days=months * 30)
        })
    
    return result, total_interest, total_months

def calculate_snowball_payoff(debts: List[Dict]) -> Tuple[List[Dict], int, int]:
    """
    Calculate debt snowball strategy (smallest balance first)
    Returns (ordered_debts, motivation_wins, months_to_payoff)
    """
    # Sort by outstanding balance (ascending)
    sorted_debts = sorted(debts, key=lambda x: x.get('current_outstanding', 0))
    
    total_months = 0
    result = []
    
    for debt in sorted_debts:
        principal = debt.get('current_outstanding', 0)
        annual_rate = debt.get('interest_rate_pct', 0)
        monthly_payment = debt.get('monthly_emi', 0)
        
        months, interest = calculate_payoff_timeline(principal, annual_rate, monthly_payment)
        total_months = max(total_months, months)
        
        result.append({
            **debt,
            'months_to_payoff': months,
            'total_interest': interest,
            'payoff_date': date.today() + timedelta(days=months * 30)
        })
    
    return result, len(sorted_debts), total_months

def calculate_extra_payment_impact(
    principal: float,
    annual_rate: float,
    monthly_payment: float,
    extra_monthly_payment: float
) -> Dict:
    """
    Calculate impact of extra payments on debt payoff
    """
    balance = principal
    total_payment = 0
    total_interest = 0
    months = 0
    monthly_rate = annual_rate / 100 / 12
    max_months = 600
    
    while balance > 0 and months < max_months:
        interest = balance * monthly_rate
        total_interest += interest
        total_payment += (monthly_payment + extra_monthly_payment)
        balance = balance + interest - (monthly_payment + extra_monthly_payment)
        months += 1
        
        if balance < 0:
            balance = 0
            break
    
    # Calculate savings vs standard payment
    _, standard_interest = calculate_payoff_timeline(principal, annual_rate, monthly_payment)
    interest_saved = standard_interest - total_interest
    
    return {
        'months_to_payoff': months,
        'total_interest': total_interest,
        'total_payment': total_payment,
        'payoff_date': date.today() + timedelta(days=months * 30),
        'interest_saved': interest_saved,
        'time_saved_months': calculate_payoff_timeline(principal, annual_rate, monthly_payment)[0] - months
    }

def get_debt_summary(user_id: str) -> Dict:
    """Get comprehensive debt summary"""
    try:
        debts = fetch_all("""
            SELECT id, debt_name, debt_type, principal_amount, current_outstanding,
                   interest_rate_pct, tenure_months, monthly_emi, priority_payoff
            FROM debts WHERE user_id = %s
        """, (user_id,))
        
        if not debts:
            return {
                'total_debts': 0,
                'total_outstanding': 0,
                'total_monthly_emi': 0,
                'average_interest_rate': 0,
                'weighted_interest_rate': 0,
                'high_priority_debts': 0,
                'total_interest_payable': 0,
                'estimated_debt_free_date': None,
                'debt_free_months': 0,
                'debt_to_income_ratio': 0
            }
        
        total_outstanding = sum(d.get('current_outstanding', 0) for d in debts)
        total_emi = sum(d.get('monthly_emi', 0) for d in debts)
        high_priority = sum(1 for d in debts if d.get('priority_payoff', False))
        
        # Calculate weighted average interest
        if total_outstanding > 0:
            weighted_interest = sum(
                d.get('current_outstanding', 0) * d.get('interest_rate_pct', 0) 
                for d in debts
            ) / total_outstanding
        else:
            weighted_interest = 0
        
        avg_interest = sum(d.get('interest_rate_pct', 0) for d in debts) / len(debts) if debts else 0
        
        # Calculate total interest payable
        total_interest = 0
        max_months = 0
        for debt in debts:
            _, interest = calculate_payoff_timeline(
                debt.get('current_outstanding', 0),
                debt.get('interest_rate_pct', 0),
                debt.get('monthly_emi', 0)
            )
            total_interest += interest
            months, _ = calculate_payoff_timeline(
                debt.get('current_outstanding', 0),
                debt.get('interest_rate_pct', 0),
                debt.get('monthly_emi', 0)
            )
            max_months = max(max_months, months)
        
        # Get user's monthly income for debt-to-income ratio
        user = fetch_one(
            "SELECT monthly_income FROM users WHERE id = %s",
            (user_id,)
        )
        
        monthly_income = user.get('monthly_income', 0) if user else 0
        debt_to_income = (total_emi / monthly_income * 100) if monthly_income > 0 else 0
        
        return {
            'total_debts': len(debts),
            'total_outstanding': total_outstanding,
            'total_monthly_emi': total_emi,
            'average_interest_rate': round(avg_interest, 2),
            'weighted_interest_rate': round(weighted_interest, 2),
            'high_priority_debts': high_priority,
            'total_interest_payable': total_interest,
            'estimated_debt_free_date': date.today() + timedelta(days=max_months * 30),
            'debt_free_months': max_months,
            'debt_to_income_ratio': round(debt_to_income, 2),
            'debts': debts
        }
    except Exception as e:
        logger.error(f"Error calculating debt summary: {e}")
        return {}

def get_debt_recommendations(user_id: str) -> List[Dict]:
    """
    Generate recommendations for debt management
    """
    recommendations = []
    
    try:
        summary = get_debt_summary(user_id)
        
        if summary.get('total_debts', 0) == 0:
            return [{
                'title': 'Debt-Free Status',
                'advice': 'Congratulations! You have no recorded debts. Focus on building wealth.',
                'urgency': 'LOW'
            }]
        
        # High-interest debt warning
        if summary.get('weighted_interest_rate', 0) > 12:
            recommendations.append({
                'title': 'High Interest Rate Alert',
                'advice': f'Your average interest rate is {summary.get("weighted_interest_rate", 0):.2f}%. Consider refinancing or consolidating.',
                'urgency': 'HIGH',
                'estimated_savings': f'Could save ₹{summary.get("total_outstanding", 0) * 0.05:,.0f} annually with 5% rate reduction'
            })
        
        # Debt-to-income ratio warning
        if summary.get('debt_to_income_ratio', 0) > 40:
            recommendations.append({
                'title': 'High Debt-to-Income Ratio',
                'advice': f'Your monthly EMI is {summary.get("debt_to_income_ratio", 0):.1f}% of your income. Focus on increasing income or reducing other expenses.',
                'urgency': 'HIGH'
            })
        
        # Avalanche vs Snowball recommendation
        if summary.get('total_debts', 0) > 1:
            recommendations.append({
                'title': 'Optimize Your Payoff Strategy',
                'advice': 'You have multiple debts. Try the Avalanche strategy to minimize total interest paid.',
                'urgency': 'MEDIUM',
                'action': 'Review recommended payoff strategies'
            })
        
        return recommendations
    except Exception as e:
        logger.error(f"Error generating debt recommendations: {e}")
        return []

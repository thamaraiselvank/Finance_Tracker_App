"""AI Recommendation Engine - Generate personalized financial recommendations"""
from typing import Dict, List, Optional
from datetime import date, datetime
from app.core.database import fetch_one, fetch_all, execute_returning
from app.services.goal_service import get_goal_recommendations as get_goal_recs
from app.services.debt_service import get_debt_recommendations as get_debt_recs
from app.services.insurance_service import get_insurance_recommendations as get_insurance_recs
import logging

logger = logging.getLogger("finverse.recommendation_engine")

def generate_ai_insights(user_id: str) -> List[Dict]:
    """
    Generate comprehensive AI insights based on user's financial profile
    """
    insights = []
    
    try:
        user = fetch_one("""
            SELECT monthly_income, monthly_expense, current_age, target_retirement_age,
                   dependents_count FROM users WHERE id = %s
        """, (user_id,))
        
        if not user:
            return insights
        
        monthly_income = user.get('monthly_income', 0)
        monthly_expense = user.get('monthly_expense', 0)
        current_age = user.get('current_age', 30)
        target_retirement_age = user.get('target_retirement_age', 60)
        dependents = user.get('dependents_count', 0)
        
        # 1. Cash Flow Analysis
        monthly_surplus = monthly_income - monthly_expense
        if monthly_surplus > 0:
            savings_rate = (monthly_surplus / monthly_income * 100) if monthly_income > 0 else 0
            
            if savings_rate >= 50:
                insights.append({
                    'category': 'Cash Flow',
                    'title': 'Excellent Savings Discipline',
                    'severity': 'success',
                    'summary': f'You\'re saving ₹{monthly_surplus:,.0f} monthly ({savings_rate:.1f}% of income)',
                    'actionable_advice': 'Great! Maintain this discipline and consider investing surplus funds wisely.',
                    'estimated_impact': f'₹{monthly_surplus * 12 * 20:,.0f} in 20 years (no returns)'
                })
            elif savings_rate >= 30:
                insights.append({
                    'category': 'Cash Flow',
                    'title': 'Good Savings Rate',
                    'severity': 'success',
                    'summary': f'Saving ₹{monthly_surplus:,.0f} monthly ({savings_rate:.1f}%)',
                    'actionable_advice': 'On track! Try to increase savings to 40% for faster wealth building.',
                    'estimated_impact': f'Increase to 40% = ₹{monthly_surplus * 1.33 * 12 * 20:,.0f} in 20 years'
                })
            else:
                insights.append({
                    'category': 'Cash Flow',
                    'title': 'Low Savings Rate',
                    'severity': 'warning',
                    'summary': f'Only saving ₹{monthly_surplus:,.0f} monthly ({savings_rate:.1f}%)',
                    'actionable_advice': 'Review expenses and cut non-essential spending. Target 30% savings rate.',
                    'estimated_impact': f'Reducing expenses by 10% would add ₹{monthly_income * 0.10:,.0f}/month to savings'
                })
        else:
            insights.append({
                'category': 'Cash Flow',
                'title': 'Negative Cash Flow',
                'severity': 'error',
                'summary': 'Expenses exceed income by ₹{monthly_expense - monthly_income:,.0f}',
                'actionable_advice': 'Immediate action needed: Create a budget, cut expenses, or increase income.',
                'estimated_impact': 'Risk of accumulating credit card debt'
            })
        
        # 2. Emergency Fund Analysis
        accounts = fetch_one("""
            SELECT COALESCE(SUM(balance), 0) as total FROM accounts
            WHERE user_id = %s AND account_type IN ('SAVINGS', 'CURRENT')
        """, (user_id,))
        
        liquid_assets = accounts.get('total', 0) if accounts else 0
        emergency_fund_months = liquid_assets / max(monthly_expense, 1) if monthly_expense > 0 else 0
        
        if emergency_fund_months >= 12:
            insights.append({
                'category': 'Emergency Fund',
                'title': 'Excellent Emergency Buffer',
                'severity': 'success',
                'summary': f'₹{liquid_assets:,.0f} covers {emergency_fund_months:.1f} months of expenses',
                'actionable_advice': 'Excellent position! You\'re well-protected against emergencies. Consider investing extra funds.',
                'estimated_impact': 'Protected against job loss, medical emergency, etc.'
            })
        elif emergency_fund_months >= 6:
            insights.append({
                'category': 'Emergency Fund',
                'title': 'Adequate Emergency Fund',
                'severity': 'success',
                'summary': f'₹{liquid_assets:,.0f} covers {emergency_fund_months:.1f} months',
                'actionable_advice': 'Good position! Continue building towards 12 months coverage.',
                'estimated_impact': f'Need ₹{(monthly_expense * 12) - liquid_assets:,.0f} more for optimal coverage'
            })
        elif emergency_fund_months >= 3:
            insights.append({
                'category': 'Emergency Fund',
                'title': 'Below Recommended Emergency Fund',
                'severity': 'warning',
                'summary': f'Only {emergency_fund_months:.1f} months covered (₹{liquid_assets:,.0f})',
                'actionable_advice': 'Build emergency fund to 6 months. Allocate 50% of monthly savings to this goal.',
                'estimated_impact': f'At current rate, reach 6 months in {(monthly_expense * 6 - liquid_assets) / max(monthly_surplus * 0.5, 1) / 12:.1f} months'
            })
        else:
            insights.append({
                'category': 'Emergency Fund',
                'title': 'Critical: Build Emergency Fund',
                'severity': 'error',
                'summary': f'Only {emergency_fund_months:.1f} months covered',
                'actionable_advice': 'PRIORITY: Build emergency fund to 3 months ASAP. Cut expenses if needed.',
                'estimated_impact': f'Target: ₹{monthly_expense * 3:,.0f}. Missing ₹{max(0, monthly_expense * 3 - liquid_assets):,.0f}'
            })
        
        # 3. Debt Analysis
        debts = fetch_one("""
            SELECT COALESCE(SUM(current_outstanding), 0) as total,
                   COALESCE(SUM(monthly_emi), 0) as emi,
                   COALESCE(AVG(interest_rate_pct), 0) as avg_rate
            FROM debts WHERE user_id = %s
        """, (user_id,))
        
        total_debt = debts.get('total', 0) if debts else 0
        monthly_emi = debts.get('emi', 0) if debts else 0
        avg_rate = debts.get('avg_rate', 0) if debts else 0
        
        if total_debt > 0:
            if avg_rate > 15:
                insights.append({
                    'category': 'Debt Management',
                    'title': 'High-Interest Debt Alert',
                    'severity': 'error',
                    'summary': f'Average interest rate: {avg_rate:.2f}%. Total debt: ₹{total_debt:,.0f}',
                    'actionable_advice': 'Prioritize paying off high-interest debt. Consider consolidation or refinancing.',
                    'estimated_impact': f'Could save ₹{total_debt * (avg_rate - 12) / 100 / 12:,.0f}/month with refinancing'
                })
            elif total_debt > monthly_income * 5:
                insights.append({
                    'category': 'Debt Management',
                    'title': 'High Debt Level',
                    'severity': 'warning',
                    'summary': f'Total debt {total_debt / monthly_income:.1f}x monthly income',
                    'actionable_advice': 'Use debt avalanche strategy. Focus on clearing debt while minimizing interest.',
                    'estimated_impact': f'Monthly EMI: ₹{monthly_emi:,.0f} ({monthly_emi / monthly_income * 100:.1f}% of income)'
                })
        else:
            insights.append({
                'category': 'Debt Management',
                'title': 'Debt-Free Status',
                'severity': 'success',
                'summary': 'No recorded debts!',
                'actionable_advice': 'Excellent! Focus on investing and building wealth.',
                'estimated_impact': 'All income available for savings and investments'
            })
        
        # 4. Retirement Planning
        years_to_retirement = target_retirement_age - current_age
        if years_to_retirement > 0:
            monthly_surplus = monthly_income - monthly_expense
            if monthly_surplus > 0:
                projected_retirement_corpus = monthly_surplus * 12 * years_to_retirement * 1.07 ** years_to_retirement  # 7% returns
                annual_need = monthly_expense * 12
                retirement_fund_need = annual_need * 25  # 25x rule
                
                if projected_retirement_corpus >= retirement_fund_need:
                    insights.append({
                        'category': 'Retirement Planning',
                        'title': 'On Track for Retirement',
                        'severity': 'success',
                        'summary': f'Projected corpus at {target_retirement_age}: ₹{projected_retirement_corpus:,.0f}',
                        'actionable_advice': f'You\'ll have {projected_retirement_corpus / annual_need:.1f}x your annual expenses - excellent!',
                        'estimated_impact': f'Years to retirement: {years_to_retirement}'
                    })
                else:
                    gap = retirement_fund_need - projected_retirement_corpus
                    insights.append({
                        'category': 'Retirement Planning',
                        'title': 'Retirement Fund Gap',
                        'severity': 'warning',
                        'summary': f'Projected gap: ₹{gap:,.0f}',
                        'actionable_advice': f'Increase savings or delay retirement. Need ₹{gap / years_to_retirement / 12:,.0f} extra per month.',
                        'estimated_impact': f'Years to retirement: {years_to_retirement}'
                    })
        
        return insights
    except Exception as e:
        logger.error(f"Error generating AI insights: {e}")
        return insights

def generate_recommendations_summary(user_id: str) -> Dict:
    """
    Generate comprehensive recommendations summary from all modules
    """
    try:
        # Collect recommendations from all services
        goal_recs = get_goal_recs(user_id)
        debt_recs = get_debt_recs(user_id)
        insurance_recs = get_insurance_recs(user_id)
        
        # Combine and prioritize
        all_recs = []
        
        for rec in goal_recs:
            all_recs.append({
                **rec,
                'category': 'Goals',
                'priority': 'HIGH' if rec.get('urgency') == 'HIGH' else 'MEDIUM'
            })
        
        for rec in debt_recs:
            all_recs.append({
                **rec,
                'category': 'Debt',
                'priority': 'HIGH' if rec.get('urgency') == 'HIGH' else 'MEDIUM'
            })
        
        for rec in insurance_recs:
            all_recs.append({
                **rec,
                'category': 'Insurance',
                'priority': 'HIGH' if rec.get('urgency') in ['CRITICAL', 'HIGH'] else 'MEDIUM'
            })
        
        # Sort by priority
        priority_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
        all_recs.sort(key=lambda x: priority_order.get(x.get('urgency', 'MEDIUM'), 2))
        
        # Generate action plan
        action_plan = []
        for i, rec in enumerate(all_recs[:5], 1):  # Top 5 recommendations
            action_plan.append({
                'step': i,
                'action': rec.get('title', 'Action'),
                'timeframe': 'Immediate' if i <= 2 else 'This Month' if i == 3 else 'This Quarter'
            })
        
        return {
            'total_recommendations': len(all_recs),
            'critical_recommendations': sum(1 for r in all_recs if r.get('urgency') == 'CRITICAL'),
            'high_recommendations': sum(1 for r in all_recs if r.get('urgency') == 'HIGH'),
            'top_recommendations': all_recs[:5],
            'action_plan': action_plan,
            'generated_at': datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}")
        return {}

def save_recommendation_to_db(
    user_id: str,
    recommendation_type: str,
    title: str,
    description: str,
    urgency: str = 'MEDIUM',
    potential_savings: float = 0
) -> Dict:
    """Save a recommendation to database"""
    try:
        rec = execute_returning("""
            INSERT INTO recommendations 
                (user_id, recommendation_type, title, description, urgency, potential_savings)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, user_id, recommendation_type, title, description, urgency,
                     potential_savings, status, created_at
        """, (user_id, recommendation_type, title, description, urgency, potential_savings))
        
        logger.info(f"Recommendation saved for user {user_id}: {rec.get('id')}")
        return rec
    except Exception as e:
        logger.error(f"Error saving recommendation: {e}")
        return {}

def get_user_recommendations(user_id: str, status_filter: str = None) -> List[Dict]:
    """Get recommendations for a user from database"""
    try:
        if status_filter:
            recs = fetch_all("""
                SELECT id, recommendation_type, title, description, urgency, potential_savings, status, created_at
                FROM recommendations WHERE user_id = %s AND status = %s
                ORDER BY urgency DESC, created_at DESC
            """, (user_id, status_filter))
        else:
            recs = fetch_all("""
                SELECT id, recommendation_type, title, description, urgency, potential_savings, status, created_at
                FROM recommendations WHERE user_id = %s AND status IN ('ACTIVE', 'ACKNOWLEDGED')
                ORDER BY urgency DESC, created_at DESC
            """, (user_id,))
        
        return recs or []
    except Exception as e:
        logger.error(f"Error fetching recommendations: {e}")
        return []

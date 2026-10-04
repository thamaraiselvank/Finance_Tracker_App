"""Goal Planning Service - Calculate goal projections and recommendations"""
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple
from app.core.database import fetch_one, fetch_all
import logging

logger = logging.getLogger("finverse.goal_service")

def calculate_monthly_savings_needed(
    target_amount: float,
    target_date: date,
    current_amount: float = 0.0,
    expected_return_percentage: float = 0.0
) -> float:
    """
    Calculate monthly savings needed to reach target amount
    Accounts for compound interest if applicable
    """
    if target_amount <= current_amount:
        return 0.0
    
    remaining = target_amount - current_amount
    months = max((target_date - date.today()).days // 30, 1)
    
    if expected_return_percentage <= 0:
        # Simple calculation without returns
        return remaining / months
    
    # With compound interest (monthly compounding)
    monthly_rate = expected_return_percentage / 100 / 12
    
    if monthly_rate == 0:
        return remaining / months
    
    # Future value of annuity formula: FV = PMT * [((1 + r)^n - 1) / r]
    # Solving for PMT: PMT = FV / [((1 + r)^n - 1) / r]
    numerator = remaining - (current_amount * ((1 + monthly_rate) ** months))
    denominator = (((1 + monthly_rate) ** months - 1) / monthly_rate)
    
    if denominator == 0:
        return remaining / months
    
    return max(0, numerator / denominator)

def project_goal_completion(
    target_amount: float,
    current_amount: float,
    monthly_savings: float,
    target_date: date,
    expected_return_percentage: float = 0.0
) -> Tuple[bool, Optional[date], float]:
    """
    Project if goal will be completed on time
    Returns (on_track, completion_date, projected_amount)
    """
    if monthly_savings <= 0 and current_amount >= target_amount:
        return True, date.today(), current_amount
    
    if monthly_savings <= 0:
        return False, None, current_amount
    
    monthly_rate = expected_return_percentage / 100 / 12
    current_balance = current_amount
    months = 0
    max_months = 600  # 50 years
    
    while current_balance < target_amount and months < max_months:
        current_balance = current_balance * (1 + monthly_rate) + monthly_savings
        months += 1
    
    completion_date = date.today() + timedelta(days=months * 30)
    on_track = completion_date <= target_date
    
    return on_track, completion_date, current_balance

def get_goal_progress_percentage(
    current_amount: float,
    target_amount: float
) -> float:
    """Calculate progress percentage towards goal"""
    if target_amount <= 0:
        return 0.0
    
    percentage = (current_amount / target_amount) * 100
    return min(100.0, percentage)

def calculate_goal_priority_score(
    goal_type: str,
    time_horizon_months: int,
    progress_percentage: float,
    urgency: str = "normal"
) -> int:
    """
    Calculate priority score for goals
    Used for recommending which goals to focus on
    Higher score = higher priority
    """
    score = 0
    
    # Goal type priority
    type_scores = {
        'EMERGENCY_FUND': 100,
        'DEBT_PAYOFF': 90,
        'RETIREMENT': 80,
        'DOWN_PAYMENT': 70,
        'EDUCATION': 60,
        'WEALTH_BUILD': 50,
        'VACATION': 30,
        'BUSINESS': 75,
        'OTHER': 40
    }
    score += type_scores.get(goal_type, 40)
    
    # Time urgency (shorter timeframe = higher priority)
    if time_horizon_months <= 6:
        score += 30
    elif time_horizon_months <= 12:
        score += 20
    elif time_horizon_months <= 24:
        score += 10
    
    # Completion status (behind schedule = higher priority)
    if progress_percentage < 25:
        score += 20
    elif progress_percentage < 50:
        score += 10
    
    return min(100, score)

def get_goal_recommendations(user_id: str) -> List[Dict]:
    """
    Generate recommendations for goal planning
    """
    recommendations = []
    
    try:
        # Get all user goals
        goals = fetch_all("""
            SELECT id, goal_name, goal_type, target_amount, current_amount, 
                   target_date, allocated_monthly_savings, suggested_monthly_savings
            FROM goals WHERE user_id = %s AND status = 'ACTIVE'
        """, (user_id,))
        
        if not goals:
            return [{
                'title': 'Set Your First Goal',
                'advice': 'Create a financial goal to start your journey',
                'urgency': 'HIGH'
            }]
        
        for goal in goals:
            progress = get_goal_progress_percentage(
                goal.get('current_amount', 0),
                goal.get('target_amount', 0)
            )
            
            allocated = goal.get('allocated_monthly_savings', 0) or 0
            suggested = goal.get('suggested_monthly_savings', 0) or 0
            
            if allocated < suggested * 0.8:
                recommendations.append({
                    'goal_id': goal.get('id'),
                    'goal_name': goal.get('goal_name'),
                    'title': f'Increase savings for {goal.get("goal_name")}',
                    'advice': f'Currently saving ₹{allocated:,.0f}/month. To stay on track, increase to ₹{suggested:,.0f}/month',
                    'urgency': 'HIGH' if goal.get('goal_type') in ['EMERGENCY_FUND', 'RETIREMENT'] else 'MEDIUM',
                    'action': f'Allocate an additional ₹{suggested - allocated:,.0f}/month'
                })
        
        return recommendations
    except Exception as e:
        logger.error(f"Error generating goal recommendations: {e}")
        return []

def rank_goals_by_priority(goals: List[Dict]) -> List[Dict]:
    """
    Rank goals by priority and return ordered list
    """
    ranked = []
    
    for goal in goals:
        priority_score = calculate_goal_priority_score(
            goal.get('goal_type'),
            max((goal.get('target_date') - date.today()).days // 30, 0),
            goal.get('progress_percentage', 0)
        )
        
        goal['priority_score'] = priority_score
        ranked.append(goal)
    
    return sorted(ranked, key=lambda x: x.get('priority_score', 0), reverse=True)

from fastapi import APIRouter, HTTPException, status, Depends
from app.core.database import fetch_one, execute_returning, execute_query
from app.core.security import get_current_user_id
from app.schemas.financial_profile import (
    FinancialProfileCreate, FinancialProfileUpdate, FinancialProfileOut,
    FinancialHealthScore, PortfolioRecommendation, OnboardingQuestionnaireResponse
)
import logging

logger = logging.getLogger("finverse.financial_profiles")

router = APIRouter(prefix="/financial-profile", tags=["Financial Profile"])

@router.post("/create", response_model=FinancialProfileOut)
def create_or_update_profile(
    payload: FinancialProfileCreate,
    user_id: str = Depends(get_current_user_id)
):
    """Create or update financial profile"""
    try:
        # Check if profile exists
        existing = fetch_one(
            "SELECT id FROM financial_profiles WHERE user_id = %s",
            (user_id,)
        )
        
        if existing:
            # Update existing profile
            profile = execute_returning("""
                UPDATE financial_profiles SET
                    risk_tolerance = %s,
                    investment_experience = %s,
                    time_horizon_years = %s,
                    total_dependents = %s,
                    major_financial_goals = %s,
                    profile_completed = TRUE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = %s
                RETURNING id, user_id, risk_tolerance, investment_experience, time_horizon_years,
                         total_dependents, major_financial_goals, current_liquidity, networth,
                         debt_to_income_ratio, financial_health_score, profile_completed,
                         created_at, updated_at
            """, (
                payload.risk_tolerance, payload.investment_experience,
                payload.time_horizon_years, payload.total_dependents,
                payload.major_financial_goals, user_id
            ))
        else:
            # Create new profile
            profile = execute_returning("""
                INSERT INTO financial_profiles 
                    (user_id, risk_tolerance, investment_experience, time_horizon_years,
                     total_dependents, major_financial_goals, profile_completed)
                VALUES (%s, %s, %s, %s, %s, %s, TRUE)
                RETURNING id, user_id, risk_tolerance, investment_experience, time_horizon_years,
                         total_dependents, major_financial_goals, current_liquidity, networth,
                         debt_to_income_ratio, financial_health_score, profile_completed,
                         created_at, updated_at
            """, (
                user_id, payload.risk_tolerance, payload.investment_experience,
                payload.time_horizon_years, payload.total_dependents,
                payload.major_financial_goals
            ))
        
        # Update user's is_onboarded status
        execute_query(
            "UPDATE users SET is_onboarded = TRUE WHERE id = %s",
            (user_id,)
        )
        
        logger.info(f"Financial profile created/updated for user {user_id}")
        return profile
    except Exception as e:
        logger.error(f"Error creating/updating profile: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/", response_model=FinancialProfileOut)
def get_profile(user_id: str = Depends(get_current_user_id)):
    """Get user's financial profile"""
    try:
        profile = fetch_one("""
            SELECT id, user_id, risk_tolerance, investment_experience, time_horizon_years,
                   total_dependents, major_financial_goals, current_liquidity, networth,
                   debt_to_income_ratio, financial_health_score, profile_completed,
                   created_at, updated_at
            FROM financial_profiles WHERE user_id = %s
        """, (user_id,))
        
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found. Please complete onboarding."
            )
        
        return profile
    except Exception as e:
        logger.error(f"Error fetching profile: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.put("/", response_model=FinancialProfileOut)
def update_profile(
    payload: FinancialProfileUpdate,
    user_id: str = Depends(get_current_user_id)
):
    """Update financial profile"""
    try:
        updates = []
        params = []
        
        for field in ['risk_tolerance', 'investment_experience', 'time_horizon_years',
                     'total_dependents', 'major_financial_goals']:
            value = getattr(payload, field, None)
            if value is not None:
                updates.append(f"{field} = %s")
                params.append(value)
        
        if not updates:
            return fetch_one(
                "SELECT * FROM financial_profiles WHERE user_id = %s",
                (user_id,)
            )
        
        params.append(user_id)
        
        updated = execute_returning(f"""
            UPDATE financial_profiles SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s
            RETURNING id, user_id, risk_tolerance, investment_experience, time_horizon_years,
                     total_dependents, major_financial_goals, current_liquidity, networth,
                     debt_to_income_ratio, financial_health_score, profile_completed,
                     created_at, updated_at
        """, params)
        
        logger.info(f"Profile updated for user {user_id}")
        return updated
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/health-score", response_model=FinancialHealthScore)
def calculate_health_score(user_id: str = Depends(get_current_user_id)):
    """Calculate financial health score"""
    try:
        user = fetch_one("""
            SELECT monthly_income, monthly_expense FROM users WHERE id = %s
        """, (user_id,))
        
        # Get financial data
        assets = fetch_one("""
            SELECT COALESCE(SUM(current_value), 0) as total FROM assets WHERE user_id = %s
        """, (user_id,))
        
        debts = fetch_one("""
            SELECT COALESCE(SUM(current_outstanding), 0) as total FROM debts WHERE user_id = %s
        """, (user_id,))
        
        liabilities = fetch_one("""
            SELECT COALESCE(SUM(current_outstanding), 0) as total FROM liabilities WHERE user_id = %s
        """, (user_id,))
        
        accounts = fetch_one("""
            SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE user_id = %s AND is_active = TRUE
        """, (user_id,))
        
        insurance = fetch_one("""
            SELECT COALESCE(SUM(sum_insured), 0) as total FROM insurance_policies WHERE user_id = %s AND status = 'ACTIVE'
        """, (user_id,))
        
        monthly_income = float(user.get('monthly_income') or 0) if user else 0.0
        monthly_expense = float(user.get('monthly_expense') or 0) if user else 0.0
        
        total_assets = float(assets.get('total') or 0) if assets else 0.0
        total_assets += float(accounts.get('total') or 0) if accounts else 0.0
        total_debt = float(debts.get('total') or 0) if debts else 0.0
        total_debt += float(liabilities.get('total') or 0) if liabilities else 0.0
        
        # Calculate scores
        emergency_fund = float(accounts.get('total') or 0) if accounts else 0.0
        emergency_fund_months = emergency_fund / max(monthly_expense, 1) if monthly_expense > 0 else 0
        
        # Emergency fund score (6 months is ideal)
        if emergency_fund_months >= 6:
            emergency_fund_status = "Excellent"
            emergency_score = 20
        elif emergency_fund_months >= 3:
            emergency_fund_status = "Good"
            emergency_score = 15
        elif emergency_fund_months >= 1:
            emergency_fund_status = "Fair"
            emergency_score = 10
        else:
            emergency_fund_status = "Poor"
            emergency_score = 5
        
        # Debt health score
        if total_debt == 0:
            debt_health = "Healthy"
            debt_score = 20
        else:
            debt_to_income = total_debt / max(monthly_income * 12, 1)
            if debt_to_income <= 1:
                debt_health = "Healthy"
                debt_score = 20
            elif debt_to_income <= 3:
                debt_health = "Warning"
                debt_score = 10
            else:
                debt_health = "Critical"
                debt_score = 5
        
        # Savings rate score
        monthly_saving = monthly_income - monthly_expense
        savings_rate = (monthly_saving / monthly_income * 100) if monthly_income > 0 else 0
        
        if savings_rate >= 30:
            savings_status = "Excellent"
            savings_score = 20
        elif savings_rate >= 20:
            savings_status = "Good"
            savings_score = 15
        elif savings_rate >= 10:
            savings_status = "Fair"
            savings_score = 10
        else:
            savings_status = "Poor"
            savings_score = 5
        
        # Investment readiness
        total_investments = float(assets.get('total') or 0) if assets else 0.0
        if total_investments > 0:
            investment_readiness = "Ready"
            investment_score = 15
        elif emergency_fund_months >= 3 and total_debt == 0:
            investment_readiness = "On Track"
            investment_score = 10
        else:
            investment_readiness = "Needs Work"
            investment_score = 5
        
        # Insurance adequacy
        insurance_cover = float(insurance.get('total') or 0) if insurance else 0.0
        required_coverage = monthly_income * 12 * 10
        
        if insurance_cover >= required_coverage:
            insurance_status = "Adequate"
            insurance_score = 15
        elif insurance_cover >= required_coverage * 0.5:
            insurance_status = "Partial"
            insurance_score = 10
        else:
            insurance_status = "Inadequate"
            insurance_score = 5
        
        # Calculate total score
        total_score = min(100, emergency_score + debt_score + savings_score + investment_score + insurance_score)
        
        # Determine grade
        if total_score >= 90:
            grade = "A"
        elif total_score >= 80:
            grade = "B"
        elif total_score >= 70:
            grade = "C"
        elif total_score >= 60:
            grade = "D"
        else:
            grade = "F"
        
        # Overall assessment
        if grade in ['A', 'B']:
            overall = "Excellent financial health. You're on track!"
        elif grade == 'C':
            overall = "Good financial health. Some areas need improvement."
        elif grade == 'D':
            overall = "Fair financial health. Focus on building emergency fund and reducing debt."
        else:
            overall = "Poor financial health. Immediate action needed on debt and savings."
        
        return {
            'score': total_score,
            'grade': grade,
            'emergency_fund_status': emergency_fund_status,
            'debt_health': debt_health,
            'savings_rate': savings_status,
            'investment_readiness': investment_readiness,
            'insurance_adequacy': insurance_status,
            'overall_assessment': overall
        }
    except Exception as e:
        logger.error(f"Error calculating health score: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/portfolio-recommendation", response_model=PortfolioRecommendation)
def get_portfolio_recommendation(user_id: str = Depends(get_current_user_id)):
    """Get portfolio allocation recommendation based on profile"""
    try:
        profile = fetch_one("""
            SELECT risk_tolerance, time_horizon_years FROM financial_profiles WHERE user_id = %s
        """, (user_id,))
        
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
        
        risk_tolerance = profile.get('risk_tolerance', 'MODERATE')
        time_horizon = profile.get('time_horizon_years', 10)
        
        # Asset allocation recommendations based on risk profile
        if risk_tolerance == 'CONSERVATIVE':
            return {
                'profile_type': 'Conservative',
                'equity_allocation': 30,
                'debt_allocation': 60,
                'gold_allocation': 10,
                'other_allocation': 0,
                'rationale': 'Focus on capital preservation with moderate growth potential',
                'suggested_funds': [
                    'Debt Mutual Funds',
                    'Government Securities',
                    'Fixed Deposits',
                    'Sovereign Gold Bonds'
                ]
            }
        elif risk_tolerance == 'AGGRESSIVE':
            return {
                'profile_type': 'Aggressive',
                'equity_allocation': 75,
                'debt_allocation': 15,
                'gold_allocation': 5,
                'other_allocation': 5,
                'rationale': 'Maximum growth potential with higher risk tolerance',
                'suggested_funds': [
                    'Large Cap Funds',
                    'Mid Cap Funds',
                    'Small Cap Funds',
                    'International Funds',
                    'Sectoral Funds',
                    'Gold Funds'
                ]
            }
        else:  # MODERATE
            return {
                'profile_type': 'Moderate',
                'equity_allocation': 60,
                'debt_allocation': 30,
                'gold_allocation': 10,
                'other_allocation': 0,
                'rationale': 'Balanced approach for growth with reasonable risk',
                'suggested_funds': [
                    'Large Cap Funds',
                    'Mid Cap Funds',
                    'Balanced Advantage Funds',
                    'Debt Mutual Funds',
                    'Sovereign Gold Bonds'
                ]
            }
    except Exception as e:
        logger.error(f"Error getting portfolio recommendation: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/onboarding-complete")
def complete_onboarding(
    payload: OnboardingQuestionnaireResponse,
    user_id: str = Depends(get_current_user_id)
):
    """Complete comprehensive onboarding questionnaire"""
    try:
        # Determine risk tolerance based on responses
        if payload.investment_experience == 'BEGINNER':
            risk_map = {
                'CONSERVATIVE': 'CONSERVATIVE',
                'MODERATE': 'CONSERVATIVE',
                'AGGRESSIVE': 'MODERATE'
            }
        else:
            risk_map = {
                'CONSERVATIVE': 'CONSERVATIVE',
                'MODERATE': 'MODERATE',
                'AGGRESSIVE': 'AGGRESSIVE'
            }
        
        risk_tolerance = risk_map.get(payload.risk_tolerance, 'MODERATE')
        
        # Create or update profile
        profile = execute_returning("""
            INSERT INTO financial_profiles 
                (user_id, risk_tolerance, investment_experience, time_horizon_years,
                 total_dependents, major_financial_goals, profile_completed)
            VALUES (%s, %s, %s, %s, %s, %s, TRUE)
            ON CONFLICT (user_id) DO UPDATE SET
                risk_tolerance = %s,
                investment_experience = %s,
                time_horizon_years = %s,
                total_dependents = %s,
                major_financial_goals = %s,
                profile_completed = TRUE,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id, user_id, risk_tolerance, investment_experience, time_horizon_years,
                     total_dependents, major_financial_goals, profile_completed,
                     created_at, updated_at
        """, (
            user_id, risk_tolerance, payload.investment_experience,
            payload.goal_timeframes.get('primary', 10),
            payload.dependents_count, ', '.join(payload.secondary_goals),
            risk_tolerance, payload.investment_experience,
            payload.goal_timeframes.get('primary', 10),
            payload.dependents_count, ', '.join(payload.secondary_goals)
        ))
        
        # Update user profile
        execute_query("""
            UPDATE users SET
                current_age = %s,
                target_retirement_age = %s,
                monthly_income = %s,
                monthly_expense = %s,
                emergency_fund_amount = %s,
                dependents_count = %s,
                is_onboarded = TRUE
            WHERE id = %s
        """, (
            payload.current_age,
            payload.target_retirement_age,
            payload.monthly_income,
            payload.monthly_income * 0.3,  # Default 30% monthly expense assumption
            payload.current_savings,
            payload.dependents_count,
            user_id
        ))
        
        logger.info(f"Onboarding completed for user {user_id}")
        
        return {
            'status': 'success',
            'message': 'Onboarding completed successfully',
            'profile_id': profile.get('id'),
            'next_steps': [
                'Complete expense tracking',
                'Add your assets and investments',
                'Record all debts and liabilities',
                'Update insurance policies',
                'Set your financial goals'
            ]
        }
    except Exception as e:
        logger.error(f"Error completing onboarding: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

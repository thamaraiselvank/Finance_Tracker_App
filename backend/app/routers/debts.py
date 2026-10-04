from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from uuid import UUID
from app.core.database import fetch_one, fetch_all, execute_returning, execute_query
from app.core.security import get_current_user_id
from app.schemas.debt import (
    DebtCreate, DebtUpdate, DebtOut, DebtSummary, 
    DebtPayoffPlan, DebtAvailancheStrategy, DebtSnowballStrategy
)
from datetime import datetime, date, timedelta
import logging

logger = logging.getLogger("finverse.debts")

router = APIRouter(prefix="/debts", tags=["Debts"])

@router.post("/", response_model=DebtOut)
def create_debt(payload: DebtCreate, user_id: str = Depends(get_current_user_id)):
    """Create a new debt record"""
    try:
        debt = execute_returning("""
            INSERT INTO debts (user_id, debt_name, debt_type, principal_amount, 
                             current_outstanding, interest_rate_pct, tenure_months, 
                             monthly_emi, start_date, creditor_name)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, user_id, debt_name, debt_type, principal_amount, current_outstanding,
                     interest_rate_pct, tenure_months, monthly_emi, start_date, end_date,
                     creditor_name, priority_payoff, payoff_strategy, total_interest_paid,
                     created_at, updated_at
        """, (
            user_id, payload.debt_name, payload.debt_type, payload.principal_amount,
            payload.current_outstanding, payload.interest_rate_pct, payload.tenure_months,
            payload.monthly_emi, payload.start_date, payload.creditor_name
        ))
        
        logger.info(f"Debt created: {debt.get('id')} for user {user_id}")
        return debt
    except Exception as e:
        logger.error(f"Error creating debt: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/", response_model=List[DebtOut])
def list_debts(user_id: str = Depends(get_current_user_id)):
    """Get all debts for user"""
    try:
        debts = fetch_all("""
            SELECT id, user_id, debt_name, debt_type, principal_amount, current_outstanding,
                   interest_rate_pct, tenure_months, monthly_emi, start_date, end_date,
                   creditor_name, priority_payoff, payoff_strategy, total_interest_paid,
                   created_at, updated_at
            FROM debts WHERE user_id = %s
            ORDER BY priority_payoff DESC, interest_rate_pct DESC
        """, (user_id,))
        return debts or []
    except Exception as e:
        logger.error(f"Error fetching debts: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{debt_id}", response_model=DebtOut)
def get_debt(debt_id: str, user_id: str = Depends(get_current_user_id)):
    """Get specific debt"""
    try:
        debt = fetch_one("""
            SELECT id, user_id, debt_name, debt_type, principal_amount, current_outstanding,
                   interest_rate_pct, tenure_months, monthly_emi, start_date, end_date,
                   creditor_name, priority_payoff, payoff_strategy, total_interest_paid,
                   created_at, updated_at
            FROM debts WHERE id = %s AND user_id = %s
        """, (debt_id, user_id))
        
        if not debt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debt not found")
        
        return debt
    except Exception as e:
        logger.error(f"Error fetching debt: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.put("/{debt_id}", response_model=DebtOut)
def update_debt(debt_id: str, payload: DebtUpdate, user_id: str = Depends(get_current_user_id)):
    """Update a debt"""
    try:
        existing = fetch_one("SELECT user_id FROM debts WHERE id = %s", (debt_id,))
        if not existing or existing.get('user_id') != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
        updates = []
        params = []
        
        for field in ['debt_name', 'debt_type', 'principal_amount', 'current_outstanding',
                     'interest_rate_pct', 'tenure_months', 'monthly_emi', 
                     'priority_payoff', 'payoff_strategy']:
            if getattr(payload, field, None) is not None:
                updates.append(f"{field} = %s")
                params.append(getattr(payload, field))
        
        if not updates:
            return fetch_one("SELECT * FROM debts WHERE id = %s", (debt_id,))
        
        params.append(debt_id)
        params.append(user_id)
        
        updated = execute_returning(f"""
            UPDATE debts SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND user_id = %s
            RETURNING id, user_id, debt_name, debt_type, principal_amount, current_outstanding,
                     interest_rate_pct, tenure_months, monthly_emi, start_date, end_date,
                     creditor_name, priority_payoff, payoff_strategy, total_interest_paid,
                     created_at, updated_at
        """, params)
        
        logger.info(f"Debt updated: {debt_id}")
        return updated
    except Exception as e:
        logger.error(f"Error updating debt: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete("/{debt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_debt(debt_id: str, user_id: str = Depends(get_current_user_id)):
    """Delete a debt"""
    try:
        execute_query("DELETE FROM debts WHERE id = %s AND user_id = %s", (debt_id, user_id))
        logger.info(f"Debt deleted: {debt_id}")
    except Exception as e:
        logger.error(f"Error deleting debt: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/summary/overview", response_model=DebtSummary)
def get_debt_summary(user_id: str = Depends(get_current_user_id)):
    """Get debt summary and statistics"""
    try:
        summary = fetch_one("""
            SELECT 
                COALESCE(SUM(current_outstanding), 0) as total_outstanding,
                COALESCE(SUM(monthly_emi), 0) as total_monthly_emi,
                COALESCE(AVG(interest_rate_pct), 0) as total_interest_rate_avg,
                COUNT(*) as number_of_debts,
                COALESCE(SUM(CASE WHEN priority_payoff = TRUE THEN 1 ELSE 0 END), 0) as high_priority_debts
            FROM debts WHERE user_id = %s
        """, (user_id,))
        
        # Get debt-to-income ratio
        user = fetch_one("""
            SELECT monthly_income FROM users WHERE id = %s
        """, (user_id,))
        
        monthly_income = user.get('monthly_income', 0) if user else 0
        monthly_emi = summary.get('total_monthly_emi', 0) if summary else 0
        
        debt_to_income = (monthly_emi / monthly_income * 100) if monthly_income > 0 else 0
        
        result = {
            'total_outstanding': summary.get('total_outstanding', 0) if summary else 0,
            'total_monthly_emi': summary.get('total_monthly_emi', 0) if summary else 0,
            'total_interest_rate_avg': summary.get('total_interest_rate_avg', 0) if summary else 0,
            'debt_to_income_ratio': debt_to_income,
            'number_of_debts': summary.get('number_of_debts', 0) if summary else 0,
            'high_priority_debts': summary.get('high_priority_debts', 0) if summary else 0,
            'estimated_debt_free_date': None
        }
        
        return result
    except Exception as e:
        logger.error(f"Error fetching debt summary: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

def calculate_payoff_months(principal: float, interest_rate: float, monthly_payment: float) -> int:
    """Calculate months to payoff using iterative approach"""
    if monthly_payment <= 0 or principal <= 0:
        return 0
    
    balance = principal
    months = 0
    max_months = 600  # 50 years max
    
    while balance > 0 and months < max_months:
        interest = balance * (interest_rate / 100 / 12)
        balance = balance + interest - monthly_payment
        months += 1
    
    return months

@router.get("/strategy/avalanche", response_model=DebtAvailancheStrategy)
def get_avalanche_strategy(user_id: str = Depends(get_current_user_id)):
    """Get debt avalanche payoff strategy (highest interest first)"""
    try:
        debts = fetch_all("""
            SELECT id, debt_name, current_outstanding, interest_rate_pct, monthly_emi
            FROM debts WHERE user_id = %s AND current_outstanding > 0
            ORDER BY interest_rate_pct DESC
        """, (user_id,))
        
        if not debts:
            return {
                'recommended_order': [],
                'total_interest_saved': 0.0,
                'months_to_complete': 0
            }
        
        plans = []
        total_months = 0
        total_interest_saved = 0.0
        
        for debt in debts:
            months = calculate_payoff_months(
                debt.get('current_outstanding', 0),
                debt.get('interest_rate_pct', 0),
                debt.get('monthly_emi', 0)
            )
            
            total_months += months
            payoff_date = date.today() + timedelta(days=months * 30)
            
            plan = {
                'debt_id': debt.get('id'),
                'debt_name': debt.get('debt_name'),
                'current_outstanding': debt.get('current_outstanding', 0),
                'monthly_payment': debt.get('monthly_emi', 0),
                'total_interest_if_minimum': debt.get('current_outstanding', 0) * (debt.get('interest_rate_pct', 0) / 100),
                'months_to_payoff': months,
                'payoff_date': payoff_date
            }
            plans.append(plan)
        
        return {
            'recommended_order': plans,
            'total_interest_saved': total_interest_saved,
            'months_to_complete': total_months
        }
    except Exception as e:
        logger.error(f"Error calculating avalanche strategy: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/strategy/snowball", response_model=DebtSnowballStrategy)
def get_snowball_strategy(user_id: str = Depends(get_current_user_id)):
    """Get debt snowball payoff strategy (smallest balance first)"""
    try:
        debts = fetch_all("""
            SELECT id, debt_name, current_outstanding, interest_rate_pct, monthly_emi
            FROM debts WHERE user_id = %s AND current_outstanding > 0
            ORDER BY current_outstanding ASC
        """, (user_id,))
        
        if not debts:
            return {
                'recommended_order': [],
                'motivation_wins': 0,
                'months_to_complete': 0
            }
        
        plans = []
        total_months = 0
        
        for debt in debts:
            months = calculate_payoff_months(
                debt.get('current_outstanding', 0),
                debt.get('interest_rate_pct', 0),
                debt.get('monthly_emi', 0)
            )
            
            total_months += months
            payoff_date = date.today() + timedelta(days=months * 30)
            
            plan = {
                'debt_id': debt.get('id'),
                'debt_name': debt.get('debt_name'),
                'current_outstanding': debt.get('current_outstanding', 0),
                'monthly_payment': debt.get('monthly_emi', 0),
                'total_interest_if_minimum': debt.get('current_outstanding', 0) * (debt.get('interest_rate_pct', 0) / 100),
                'months_to_payoff': months,
                'payoff_date': payoff_date
            }
            plans.append(plan)
        
        return {
            'recommended_order': plans,
            'motivation_wins': len(plans),
            'months_to_complete': total_months
        }
    except Exception as e:
        logger.error(f"Error calculating snowball strategy: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from uuid import UUID
import calendar
from datetime import date
from app.core.database import fetch_one, fetch_all, execute_returning, execute_query
from app.core.security import get_current_user_id
from app.schemas.debt import (
    DebtCreate, DebtUpdate, DebtOut, DebtSummary, 
    DebtPayoffPlan, DebtAvailancheStrategy, DebtSnowballStrategy
)
from app.services.debt_service import calculate_avalanche_payoff, calculate_snowball_payoff
import logging

logger = logging.getLogger("finverse.debts")

router = APIRouter(prefix="/debts", tags=["Debts"])


def _add_months(start_date: date, months: int) -> date:
    month_index = start_date.month - 1 + months
    year = start_date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(start_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


@router.post("/", response_model=DebtOut)
def create_debt(payload: DebtCreate, user_id: str = Depends(get_current_user_id)):
    """Create a new debt record"""
    try:
        end_date = payload.end_date
        if payload.start_date and payload.tenure_months and not end_date:
            end_date = _add_months(payload.start_date, payload.tenure_months)
        if payload.start_date and end_date and end_date <= payload.start_date:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date must be after the start date.")

        debt = execute_returning("""
            INSERT INTO debts (user_id, debt_name, debt_type, principal_amount, 
                             current_outstanding, interest_rate_pct, tenure_months, 
                             monthly_emi, start_date, end_date, total_interest_paid, creditor_name)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, user_id, debt_name, debt_type, principal_amount, current_outstanding,
                     interest_rate_pct, tenure_months, monthly_emi, start_date, end_date,
                     creditor_name, priority_payoff, payoff_strategy, total_interest_paid,
                     created_at, updated_at
        """, (
            user_id, payload.debt_name, payload.debt_type, payload.principal_amount,
            payload.current_outstanding, payload.interest_rate_pct, payload.tenure_months,
            payload.monthly_emi, payload.start_date, end_date,
            payload.total_interest_paid, payload.creditor_name
        ))
        
        logger.info(f"Debt created: {debt.get('id')} for user {user_id}")
        return debt
    except HTTPException:
        raise
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
        existing = fetch_one(
            "SELECT user_id, start_date, end_date, tenure_months FROM debts WHERE id = %s",
            (debt_id,)
        )
        if not existing or existing.get('user_id') != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
        provided_fields = payload.model_fields_set
        start_date = payload.start_date if 'start_date' in provided_fields else existing.get('start_date')
        tenure_months = payload.tenure_months if 'tenure_months' in provided_fields else existing.get('tenure_months')
        end_date = payload.end_date if 'end_date' in provided_fields else existing.get('end_date')
        if 'end_date' not in provided_fields and ('start_date' in provided_fields or 'tenure_months' in provided_fields):
            end_date = (
                _add_months(start_date, tenure_months)
                if start_date and tenure_months
                else None
            )
        if start_date and end_date and end_date <= start_date:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date must be after the start date.")

        updates = []
        params = []
        
        allowed_fields = {
            'debt_name', 'debt_type', 'principal_amount', 'current_outstanding',
            'interest_rate_pct', 'tenure_months', 'monthly_emi', 'start_date',
            'end_date', 'total_interest_paid', 'priority_payoff', 'payoff_strategy'
        }
        changes = payload.model_dump(exclude_unset=True)
        if 'end_date' not in provided_fields and ('start_date' in provided_fields or 'tenure_months' in provided_fields):
            changes['end_date'] = end_date
        for field, value in changes.items():
            if field in allowed_fields:
                updates.append(f"{field} = %s")
                params.append(value)
        
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
    except HTTPException:
        raise
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
        debt_summary = fetch_one("""
            SELECT
                COALESCE(SUM(current_outstanding), 0) as total_outstanding,
                COALESCE(SUM(monthly_emi), 0) as total_monthly_emi,
                COALESCE(AVG(interest_rate_pct), 0) as total_interest_rate_avg,
                COUNT(*) as number_of_debts,
                COALESCE(SUM(CASE WHEN priority_payoff = TRUE THEN 1 ELSE 0 END), 0) as high_priority_debts
            FROM debts WHERE user_id = %s
        """, (user_id,))
        liability_summary = fetch_one("""
            SELECT
                COALESCE(SUM(current_outstanding), 0) as total_outstanding,
                COALESCE(SUM(emi_amount), 0) as total_monthly_emi,
                COALESCE(AVG(interest_rate_pct), 0) as total_interest_rate_avg,
                COUNT(*) as number_of_debts
            FROM liabilities WHERE user_id = %s
        """, (user_id,))

        total_outstanding = float((debt_summary or {}).get('total_outstanding', 0) or 0.0) + float((liability_summary or {}).get('total_outstanding', 0) or 0.0)
        total_monthly_emi = float((debt_summary or {}).get('total_monthly_emi', 0) or 0.0) + float((liability_summary or {}).get('total_monthly_emi', 0) or 0.0)
        total_interest_rate_avg = (
            float((debt_summary or {}).get('total_interest_rate_avg', 0) or 0.0)
            + float((liability_summary or {}).get('total_interest_rate_avg', 0) or 0.0)
        ) / 2.0 if (debt_summary or liability_summary) else 0.0
        number_of_debts = int((debt_summary or {}).get('number_of_debts', 0) or 0) + int((liability_summary or {}).get('number_of_debts', 0) or 0)
        high_priority_debts = int((debt_summary or {}).get('high_priority_debts', 0) or 0)

        user = fetch_one("""
            SELECT monthly_income FROM users WHERE id = %s
        """, (user_id,))

        monthly_income = float((user or {}).get('monthly_income', 0) or 0.0)
        debt_to_income = (total_monthly_emi / monthly_income * 100) if monthly_income > 0 else 0

        result = {
            'total_outstanding': total_outstanding,
            'total_monthly_emi': total_monthly_emi,
            'total_interest_rate_avg': total_interest_rate_avg,
            'debt_to_income_ratio': debt_to_income,
            'number_of_debts': number_of_debts,
            'high_priority_debts': high_priority_debts,
            'estimated_debt_free_date': None
        }

        return result
    except Exception as e:
        logger.error(f"Error fetching debt summary: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/strategy/avalanche", response_model=DebtAvailancheStrategy)
def get_avalanche_strategy(user_id: str = Depends(get_current_user_id)):
    """Get debt avalanche payoff strategy (highest interest first)"""
    try:
        debts = fetch_all("""
            SELECT id, debt_name, current_outstanding, interest_rate_pct, monthly_emi, start_date
            FROM debts WHERE user_id = %s AND current_outstanding > 0
        """, (user_id,))
        ordered_debts, interest_saved, months_to_complete = calculate_avalanche_payoff(debts)
        return {
            'recommended_order': [{
                'debt_id': debt.get('id'),
                'debt_name': debt.get('debt_name'),
                'current_outstanding': debt.get('current_outstanding', 0),
                'interest_rate_pct': debt.get('interest_rate_pct', 0),
                'monthly_payment': debt.get('monthly_emi', 0),
                'total_interest_if_minimum': debt.get('total_interest_if_minimum', 0),
                'months_to_payoff': debt.get('months_to_payoff', 0),
                'payoff_date': debt.get('payoff_date'),
            } for debt in ordered_debts],
            'total_interest_saved': interest_saved,
            'months_to_complete': months_to_complete,
        }
    except Exception as e:
        logger.error(f"Error calculating avalanche strategy: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/strategy/snowball", response_model=DebtSnowballStrategy)
def get_snowball_strategy(user_id: str = Depends(get_current_user_id)):
    """Get debt snowball payoff strategy (smallest balance first)"""
    try:
        debts = fetch_all("""
            SELECT id, debt_name, current_outstanding, interest_rate_pct, monthly_emi, start_date
            FROM debts WHERE user_id = %s AND current_outstanding > 0
        """, (user_id,))
        ordered_debts, motivation_wins, months_to_complete = calculate_snowball_payoff(debts)
        return {
            'recommended_order': [{
                'debt_id': debt.get('id'),
                'debt_name': debt.get('debt_name'),
                'current_outstanding': debt.get('current_outstanding', 0),
                'interest_rate_pct': debt.get('interest_rate_pct', 0),
                'monthly_payment': debt.get('monthly_emi', 0),
                'total_interest_if_minimum': debt.get('total_interest_if_minimum', 0),
                'months_to_payoff': debt.get('months_to_payoff', 0),
                'payoff_date': debt.get('payoff_date'),
            } for debt in ordered_debts],
            'motivation_wins': motivation_wins,
            'months_to_complete': months_to_complete,
        }
    except Exception as e:
        logger.error(f"Error calculating snowball strategy: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from uuid import UUID
from app.core.database import fetch_one, fetch_all, execute_returning, execute_query
from app.core.security import get_current_user_id
from app.schemas.insurance_policy import (
    InsurancePolicyCreate, InsurancePolicyUpdate, InsurancePolicyOut,
    InsuranceAuditResult, HealthInsuranceAudit, TermLifeInsuranceCalculator,
    InsuranceSummary
)
from datetime import datetime, date, timedelta
import logging

logger = logging.getLogger("finverse.insurance_policies")

router = APIRouter(prefix="/insurance", tags=["Insurance"])

@router.post("/", response_model=InsurancePolicyOut)
def create_insurance_policy(payload: InsurancePolicyCreate, user_id: str = Depends(get_current_user_id)):
    """Create a new insurance policy"""
    try:
        policy = execute_returning("""
            INSERT INTO insurance_policies (user_id, policy_name, policy_type, sum_insured,
                                          annual_premium, policy_number, coverage_type,
                                          dependents_covered, insurer_name, start_date, renewal_date,
                                          payment_frequency, payment_status, next_payment_date, last_payment_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, user_id, policy_name, policy_type, sum_insured, annual_premium,
                     policy_number, start_date, maturity_date, renewal_date, coverage_type,
                     dependents_covered, insurer_name, payment_frequency, payment_status,
                     next_payment_date, last_payment_date, agent_name, status, document_url,
                     created_at, updated_at
        """, (
            user_id, payload.policy_name, payload.policy_type, payload.sum_insured,
            payload.annual_premium, payload.policy_number, payload.coverage_type,
            payload.dependents_covered, payload.insurer_name, payload.start_date,
            payload.renewal_date, payload.payment_frequency, payload.payment_status,
            payload.next_payment_date, payload.last_payment_date
        ))
        
        logger.info(f"Insurance policy created: {policy.get('id')} for user {user_id}")
        return policy
    except Exception as e:
        logger.error(f"Error creating insurance policy: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/", response_model=List[InsurancePolicyOut])
def list_insurance_policies(
    policy_type: Optional[str] = None,
    user_id: str = Depends(get_current_user_id)
):
    """Get all insurance policies for user"""
    try:
        if policy_type:
            policies = fetch_all("""
                SELECT id, user_id, policy_name, policy_type, sum_insured, annual_premium,
                       policy_number, start_date, maturity_date, renewal_date, coverage_type,
                       dependents_covered, insurer_name, payment_frequency, payment_status,
                       next_payment_date, last_payment_date, agent_name, status, document_url,
                       created_at, updated_at
                FROM insurance_policies WHERE user_id = %s AND policy_type = %s
                ORDER BY renewal_date ASC
            """, (user_id, policy_type))
        else:
            policies = fetch_all("""
                SELECT id, user_id, policy_name, policy_type, sum_insured, annual_premium,
                       policy_number, start_date, maturity_date, renewal_date, coverage_type,
                       dependents_covered, insurer_name, payment_frequency, payment_status,
                       next_payment_date, last_payment_date, agent_name, status, document_url,
                       created_at, updated_at
                FROM insurance_policies WHERE user_id = %s
                ORDER BY policy_type ASC, renewal_date ASC
            """, (user_id,))
        
        return policies or []
    except Exception as e:
        logger.error(f"Error fetching insurance policies: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{policy_id}", response_model=InsurancePolicyOut)
def get_insurance_policy(policy_id: str, user_id: str = Depends(get_current_user_id)):
    """Get specific insurance policy"""
    try:
        policy = fetch_one("""
            SELECT id, user_id, policy_name, policy_type, sum_insured, annual_premium,
                   policy_number, start_date, maturity_date, renewal_date, coverage_type,
                   dependents_covered, insurer_name, payment_frequency, payment_status,
                   next_payment_date, last_payment_date, agent_name, status, document_url,
                   created_at, updated_at
            FROM insurance_policies WHERE id = %s AND user_id = %s
        """, (policy_id, user_id))
        
        if not policy:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")
        
        return policy
    except Exception as e:
        logger.error(f"Error fetching insurance policy: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.put("/{policy_id}", response_model=InsurancePolicyOut)
def update_insurance_policy(
    policy_id: str,
    payload: InsurancePolicyUpdate,
    user_id: str = Depends(get_current_user_id)
):
    """Update insurance policy"""
    try:
        existing = fetch_one("SELECT user_id FROM insurance_policies WHERE id = %s", (policy_id,))
        if not existing or existing.get('user_id') != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
        updates = []
        params = []
        
        for field in ['policy_name', 'policy_type', 'sum_insured', 'annual_premium',
                     'policy_number', 'coverage_type', 'dependents_covered', 'insurer_name',
                     'payment_frequency', 'payment_status', 'next_payment_date',
                     'last_payment_date', 'renewal_date', 'status']:
            if getattr(payload, field, None) is not None:
                updates.append(f"{field} = %s")
                params.append(getattr(payload, field))
        
        if not updates:
            return fetch_one("SELECT * FROM insurance_policies WHERE id = %s", (policy_id,))
        
        params.append(policy_id)
        params.append(user_id)
        
        updated = execute_returning(f"""
            UPDATE insurance_policies SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND user_id = %s
            RETURNING id, user_id, policy_name, policy_type, sum_insured, annual_premium,
                     policy_number, start_date, maturity_date, renewal_date, coverage_type,
                     dependents_covered, insurer_name, payment_frequency, payment_status,
                     next_payment_date, last_payment_date, agent_name, status, document_url,
                     created_at, updated_at
        """, params)
        
        logger.info(f"Insurance policy updated: {policy_id}")
        return updated
    except Exception as e:
        logger.error(f"Error updating insurance policy: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_insurance_policy(policy_id: str, user_id: str = Depends(get_current_user_id)):
    """Delete insurance policy"""
    try:
        deleted = execute_query(
            "DELETE FROM insurance_policies WHERE id = %s AND user_id = %s",
            (policy_id, user_id)
        )
        if deleted == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")
        logger.info(f"Insurance policy deleted: {policy_id}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting insurance policy: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/summary/overview", response_model=InsuranceSummary)
def get_insurance_summary(user_id: str = Depends(get_current_user_id)):
    """Get insurance summary"""
    try:
        summary = fetch_one("""
            SELECT 
                COUNT(*) as total_policies,
                COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END), 0) as active_policies,
                COALESCE(SUM(sum_insured), 0) as total_sum_insured,
                COALESCE(SUM(annual_premium), 0) as total_annual_premium,
                COUNT(CASE WHEN renewal_date <= %s AND renewal_date >= CURRENT_DATE THEN 1 END) as upcoming_renewals
            FROM insurance_policies WHERE user_id = %s
        """, (date.today() + timedelta(days=30), user_id))
        
        result = {
            'total_policies': summary.get('total_policies', 0) if summary else 0,
            'active_policies': summary.get('active_policies', 0) if summary else 0,
            'total_sum_insured': summary.get('total_sum_insured', 0) if summary else 0,
            'total_annual_premium': summary.get('total_annual_premium', 0) if summary else 0,
            'upcoming_renewals': summary.get('upcoming_renewals', 0) if summary else 0,
            'health_coverage_adequate': False,
            'life_coverage_adequate': False,
            'critical_gaps': [],
            'next_renewal_date': None
        }
        
        # Check coverage adequacy
        health_coverage = fetch_one("""
            SELECT COALESCE(SUM(sum_insured), 0) as total FROM insurance_policies
            WHERE user_id = %s AND policy_type IN ('HEALTH', 'CRITICAL_ILLNESS')
        """, (user_id,))
        
        life_coverage = fetch_one("""
            SELECT COALESCE(SUM(sum_insured), 0) as total FROM insurance_policies
            WHERE user_id = %s AND policy_type = 'TERM_LIFE'
        """, (user_id,))
        
        user = fetch_one("SELECT monthly_income FROM users WHERE id = %s", (user_id,))
        monthly_income = user.get('monthly_income', 0) if user else 0
        
        # Health insurance should cover at least 5x monthly income
        result['health_coverage_adequate'] = health_coverage.get('total', 0) >= (monthly_income * 5) if health_coverage else False
        
        # Term life should cover at least 10x monthly income
        result['life_coverage_adequate'] = life_coverage.get('total', 0) >= (monthly_income * 10) if life_coverage else False
        
        if not result['health_coverage_adequate']:
            result['critical_gaps'].append("Health insurance coverage below recommended level")
        if not result['life_coverage_adequate']:
            result['critical_gaps'].append("No adequate term life insurance coverage")
        
        # Get next renewal date
        next_renewal = fetch_one("""
            SELECT renewal_date FROM insurance_policies
            WHERE user_id = %s AND renewal_date IS NOT NULL AND status = 'ACTIVE'
            ORDER BY renewal_date ASC LIMIT 1
        """, (user_id,))
        
        if next_renewal:
            result['next_renewal_date'] = next_renewal.get('renewal_date')
        
        return result
    except Exception as e:
        logger.error(f"Error fetching insurance summary: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/audit/health-insurance")
def audit_health_insurance(user_id: str = Depends(get_current_user_id)):
    """Audit health insurance coverage"""
    try:
        # Get user profile
        user = fetch_one("""
            SELECT monthly_income, dependents_count FROM users WHERE id = %s
        """, (user_id,))
        
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        # Get health insurance coverage
        health_policies = fetch_all("""
            SELECT sum_insured, policy_type FROM insurance_policies
            WHERE user_id = %s AND policy_type IN ('HEALTH', 'CRITICAL_ILLNESS')
        """, (user_id,))
        
        monthly_income = user.get('monthly_income', 0)
        family_members = user.get('dependents_count', 1) + 1  # +1 for self
        
        current_coverage = sum(p.get('sum_insured', 0) for p in health_policies) if health_policies else 0
        
        # Recommended: 10x monthly income for family of 4
        recommended_coverage = max(monthly_income * 5, 500000 * family_members)
        
        gap = max(0, recommended_coverage - current_coverage)
        
        return {
            'current_coverage': current_coverage,
            'family_members': family_members,
            'recommended_coverage': recommended_coverage,
            'gap': gap,
            'critical_illness_covered': any(p.get('policy_type') == 'CRITICAL_ILLNESS' for p in health_policies),
            'cashless_hospitals': 0,  # Would need additional data
            'waiting_period_days': 30,  # Standard
            'assessment': 'Adequate' if gap == 0 else 'Inadequate'
        }
    except Exception as e:
        logger.error(f"Error auditing health insurance: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/calculator/term-life")
def calculate_term_life_need(user_id: str = Depends(get_current_user_id)):
    """Calculate term life insurance recommendation"""
    try:
        user = fetch_one("""
            SELECT current_age, monthly_income, dependents_count, 
                   target_retirement_age FROM users WHERE id = %s
        """, (user_id,))
        
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        # Get existing term life coverage
        existing_cover = fetch_one("""
            SELECT COALESCE(SUM(sum_insured), 0) as total FROM insurance_policies
            WHERE user_id = %s AND policy_type = 'TERM_LIFE'
        """, (user_id,))
        
        current_age = user.get('current_age', 30)
        monthly_income = user.get('monthly_income', 0)
        dependents = user.get('dependents_count', 0)
        retirement_age = user.get('target_retirement_age', 60)
        years_to_retirement = max(1, retirement_age - current_age)
        
        # Recommended: 10x annual income + 25L per dependent
        annual_income = monthly_income * 12
        recommended_cover = (annual_income * 10) + (25_00_000 * dependents)
        
        existing = existing_cover.get('total', 0) if existing_cover else 0
        coverage_gap = max(0, recommended_cover - existing)
        
        # Estimate annual premium (roughly 0.3-0.5% of cover for 30 year term)
        annual_premium = recommended_cover * 0.004
        
        return {
            'current_age': current_age,
            'monthly_income': monthly_income,
            'dependents': dependents,
            'years_to_retirement': years_to_retirement,
            'existing_cover': existing,
            'recommended_cover': recommended_cover,
            'coverage_gap': coverage_gap,
            'annual_premium_estimate': annual_premium,
            'rationale': f"To cover {years_to_retirement} years of income and dependent support"
        }
    except Exception as e:
        logger.error(f"Error calculating term life: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

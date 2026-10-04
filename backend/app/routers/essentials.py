from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.core.database import fetch_all, fetch_one, execute_returning, execute_query
from app.core.security import get_current_user_id
from app.schemas.insurance import (
    InsuranceCreate,
    InsuranceOut,
    InsuranceUpdate,
    EssentialsCheckSummary
)
from app.services.health_engine import compute_user_financial_health

router = APIRouter(prefix="/essentials", tags=["Essentials & Financial Health"])

@router.get("/health-check", response_model=EssentialsCheckSummary)
def get_financial_health_check(user_id: str = Depends(get_current_user_id)):
    """Computes full Finverse-style essentials financial health check."""
    return compute_user_financial_health(user_id)

@router.get("/insurances", response_model=List[InsuranceOut])
def get_insurances(user_id: str = Depends(get_current_user_id)):
    insurances = fetch_all("SELECT * FROM insurances WHERE user_id = %s ORDER BY created_at ASC", (user_id,))
    return insurances

@router.post("/insurances", response_model=InsuranceOut)
def create_insurance(payload: InsuranceCreate, user_id: str = Depends(get_current_user_id)):
    new_ins = execute_returning("""
        INSERT INTO insurances (
            user_id, policy_name, insurance_type, sum_insured, annual_premium,
            policy_start_date, renewal_date, dependents_covered, insurer_name, is_active, notes
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
    """, (
        user_id,
        payload.policy_name,
        payload.insurance_type.upper(),
        payload.sum_insured,
        payload.annual_premium or 0.0,
        payload.policy_start_date,
        payload.renewal_date,
        payload.dependents_covered or 0,
        payload.insurer_name,
        payload.is_active if payload.is_active is not None else True,
        payload.notes
    ))
    return new_ins

@router.put("/insurances/{insurance_id}", response_model=InsuranceOut)
def update_insurance(insurance_id: str, payload: InsuranceUpdate, user_id: str = Depends(get_current_user_id)):
    ins = fetch_one("SELECT * FROM insurances WHERE id = %s AND user_id = %s", (insurance_id, user_id))
    if not ins:
        raise HTTPException(status_code=404, detail="Insurance policy not found.")
        
    updates = []
    params = []
    for field, val in payload.model_dump(exclude_unset=True).items():
        if field == "insurance_type" and val:
            val = val.upper()
        updates.append(f"{field} = %s")
        params.append(val)
        
    if not updates:
        return ins
        
    params.extend([insurance_id, user_id])
    updated = execute_returning(f"""
        UPDATE insurances 
        SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s AND user_id = %s
        RETURNING *
    """, tuple(params))
    return updated

@router.delete("/insurances/{insurance_id}")
def delete_insurance(insurance_id: str, user_id: str = Depends(get_current_user_id)):
    ins = fetch_one("SELECT * FROM insurances WHERE id = %s AND user_id = %s", (insurance_id, user_id))
    if not ins:
        raise HTTPException(status_code=404, detail="Insurance policy not found.")
        
    execute_query("DELETE FROM insurances WHERE id = %s AND user_id = %s", (insurance_id, user_id))
    return {"message": "Insurance policy deleted successfully."}

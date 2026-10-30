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

def _normalize_insurance_row(row: dict) -> dict:
    insurance_type = str((row.get("insurance_type") or row.get("policy_type") or "OTHER")).upper()
    if insurance_type in {"TERM", "TERM_LIFE", "LIFE"}:
        insurance_type = "TERM"
    elif insurance_type in {"HEALTH", "HEALTH_INSURANCE"}:
        insurance_type = "HEALTH"
    elif insurance_type in {"CRITICAL_ILLNESS", "CRITICAL_ILLNESS_INSURANCE"}:
        insurance_type = "CRITICAL_ILLNESS"
    return {
        **row,
        "policy_name": row.get("policy_name") or row.get("name") or "Insurance Policy",
        "insurance_type": insurance_type,
        "sum_insured": float(row.get("sum_insured") or 0.0),
        "annual_premium": float(row.get("annual_premium") or 0.0),
        "policy_start_date": row.get("policy_start_date") or row.get("start_date"),
        "renewal_date": row.get("renewal_date") or row.get("renewal_date"),
        "dependents_covered": int(row.get("dependents_covered") or 0),
        "insurer_name": row.get("insurer_name") or row.get("insurer") or row.get("lender"),
        "is_active": row.get("is_active") if row.get("is_active") is not None else str(row.get("status") or "ACTIVE").upper() in {"ACTIVE", "RENEWED", "PENDING"},
        "notes": row.get("notes") or row.get("policy_number") or None,
    }

@router.get("/health-check", response_model=EssentialsCheckSummary)
def get_financial_health_check(user_id: str = Depends(get_current_user_id)):
    """Computes full Finverse-style essentials financial health check."""
    return compute_user_financial_health(user_id)

@router.get("/insurances", response_model=List[InsuranceOut])
def get_insurances(user_id: str = Depends(get_current_user_id)):
    legacy_insurances = fetch_all("SELECT * FROM insurances WHERE user_id = %s ORDER BY created_at ASC", (user_id,))
    policy_rows = fetch_all("SELECT * FROM insurance_policies WHERE user_id = %s ORDER BY created_at ASC", (user_id,))
    merged = [_normalize_insurance_row(row) for row in legacy_insurances]
    merged.extend(_normalize_insurance_row(row) for row in policy_rows)
    merged.sort(key=lambda item: (item.get("created_at") or "", item.get("policy_name") or ""))
    return merged

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

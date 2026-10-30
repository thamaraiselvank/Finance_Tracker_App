from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.core.database import fetch_all, fetch_one, execute_returning, execute_query
from app.core.security import get_current_user_id
from app.schemas.liability import LiabilityCreate, LiabilityOut, LiabilityUpdate
from app.services.finance_math import calculate_emi

router = APIRouter(prefix="/liabilities", tags=["Liabilities & Loans"])

def hydrate_liability(l: dict) -> dict:
    princ = float(l.get("principal_amount") or 0.0)
    outst = float(l.get("current_outstanding") or 0.0)
    paid_pct = round(((princ - outst) / princ * 100.0), 1) if princ > 0 else 0.0
    return {
        **l,
        "principal_amount": princ,
        "current_outstanding": outst,
        "interest_rate_pct": float(l.get("interest_rate_pct") or 0.0),
        "emi_amount": float(l.get("emi_amount") or 0.0),
        "paid_percentage": max(0.0, min(100.0, paid_pct))
    }

def hydrate_debt_as_liability(d: dict) -> dict:
    principal = float(d.get("principal_amount") or d.get("current_outstanding") or 0.0)
    outstanding = float(d.get("current_outstanding") or principal)
    emi = float(d.get("monthly_emi") or d.get("emi_amount") or 0.0)
    return {
        "id": d.get("id"),
        "user_id": d.get("user_id"),
        "name": d.get("debt_name") or d.get("name") or "Debt",
        "liability_type": d.get("debt_type") or d.get("liability_type") or "LOAN",
        "principal_amount": principal,
        "current_outstanding": outstanding,
        "interest_rate_pct": float(d.get("interest_rate_pct") or 0.0),
        "tenure_months": int(d.get("tenure_months") or 0),
        "emi_amount": emi,
        "start_date": d.get("start_date"),
        "lender": d.get("creditor_name") or d.get("lender"),
        "notes": d.get("notes"),
        "created_at": d.get("created_at"),
        "updated_at": d.get("updated_at"),
        "source": "debt",
    }

@router.get("", response_model=List[LiabilityOut])
def get_liabilities(user_id: str = Depends(get_current_user_id)):
    raw = fetch_all("SELECT * FROM liabilities WHERE user_id = %s ORDER BY current_outstanding DESC", (user_id,))
    debt_rows = fetch_all("SELECT * FROM debts WHERE user_id = %s ORDER BY current_outstanding DESC", (user_id,))
    items = [hydrate_liability(l) for l in raw] + [hydrate_debt_as_liability(d) for d in debt_rows]
    items.sort(key=lambda item: float(item.get("current_outstanding") or 0.0), reverse=True)
    return items

@router.post("", response_model=LiabilityOut)
def create_liability(payload: LiabilityCreate, user_id: str = Depends(get_current_user_id)):
    emi = payload.emi_amount
    if (not emi or emi <= 0) and payload.principal_amount > 0 and payload.tenure_months > 0:
        emi_calc = calculate_emi(payload.principal_amount, payload.interest_rate_pct, payload.tenure_months)
        emi = emi_calc["monthly_emi"]
        
    outst = payload.current_outstanding if payload.current_outstanding > 0 else payload.principal_amount
    
    new_liab = execute_returning("""
        INSERT INTO liabilities (
            user_id, name, liability_type, principal_amount, current_outstanding,
            interest_rate_pct, tenure_months, emi_amount, start_date, lender, notes
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
    """, (
        user_id,
        payload.name,
        payload.liability_type.upper(),
        payload.principal_amount,
        outst,
        payload.interest_rate_pct,
        payload.tenure_months,
        emi or 0.0,
        payload.start_date,
        payload.lender,
        payload.notes
    ))
    return hydrate_liability(new_liab)

@router.get("/{liability_id}/amortization")
def get_liability_amortization(liability_id: str, user_id: str = Depends(get_current_user_id)):
    l = fetch_one("SELECT * FROM liabilities WHERE id = %s AND user_id = %s", (liability_id, user_id))
    if not l:
        raise HTTPException(status_code=404, detail="Liability not found.")
        
    calc = calculate_emi(
        loan_amount=float(l.get("principal_amount") or 0.0),
        annual_interest_rate_pct=float(l.get("interest_rate_pct") or 0.0),
        tenure_months=int(l.get("tenure_months") or 12)
    )
    return {
        "liability": hydrate_liability(l),
        **calc
    }

@router.put("/{liability_id}", response_model=LiabilityOut)
def update_liability(liability_id: str, payload: LiabilityUpdate, user_id: str = Depends(get_current_user_id)):
    l = fetch_one("SELECT * FROM liabilities WHERE id = %s AND user_id = %s", (liability_id, user_id))
    if not l:
        raise HTTPException(status_code=404, detail="Liability not found.")
        
    updates = []
    params = []
    for field, val in payload.model_dump(exclude_unset=True).items():
        if field == "liability_type" and val:
            val = val.upper()
        updates.append(f"{field} = %s")
        params.append(val)
        
    if not updates:
        return hydrate_liability(l)
        
    params.extend([liability_id, user_id])
    updated = execute_returning(f"""
        UPDATE liabilities 
        SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s AND user_id = %s
        RETURNING *
    """, tuple(params))
    return hydrate_liability(updated)

@router.delete("/{liability_id}")
def delete_liability(liability_id: str, user_id: str = Depends(get_current_user_id)):
    l = fetch_one("SELECT * FROM liabilities WHERE id = %s AND user_id = %s", (liability_id, user_id))
    if not l:
        raise HTTPException(status_code=404, detail="Liability not found.")
        
    execute_query("DELETE FROM liabilities WHERE id = %s AND user_id = %s", (liability_id, user_id))
    return {"message": "Liability deleted successfully."}

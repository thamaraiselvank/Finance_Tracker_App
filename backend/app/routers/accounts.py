from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.core.database import fetch_all, fetch_one, execute_returning, execute_query
from app.core.security import get_current_user_id
from app.schemas.account import AccountCreate, AccountOut, AccountUpdate

router = APIRouter(prefix="/accounts", tags=["Accounts"])

@router.get("", response_model=List[AccountOut])
def get_user_accounts(user_id: str = Depends(get_current_user_id)):
    accounts = fetch_all("""
        SELECT * FROM accounts WHERE user_id = %s ORDER BY created_at ASC
    """, (user_id,))
    return accounts

@router.post("", response_model=AccountOut)
def create_account(payload: AccountCreate, user_id: str = Depends(get_current_user_id)):
    new_acc = execute_returning("""
        INSERT INTO accounts (user_id, name, account_type, balance, currency, institution, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING *
    """, (
        user_id,
        payload.name,
        payload.account_type.upper(),
        payload.balance or 0.0,
        payload.currency or "INR",
        payload.institution,
        payload.is_active if payload.is_active is not None else True
    ))
    return new_acc

@router.put("/{account_id}", response_model=AccountOut)
def update_account(account_id: str, payload: AccountUpdate, user_id: str = Depends(get_current_user_id)):
    acc = fetch_one("SELECT * FROM accounts WHERE id = %s AND user_id = %s", (account_id, user_id))
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found.")
        
    updates = []
    params = []
    for field, val in payload.model_dump(exclude_unset=True).items():
        updates.append(f"{field} = %s")
        params.append(val)
        
    if not updates:
        return acc
        
    params.extend([account_id, user_id])
    updated = execute_returning(f"""
        UPDATE accounts 
        SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s AND user_id = %s
        RETURNING *
    """, tuple(params))
    return updated

@router.delete("/{account_id}")
def delete_account(account_id: str, user_id: str = Depends(get_current_user_id)):
    acc = fetch_one("SELECT * FROM accounts WHERE id = %s AND user_id = %s", (account_id, user_id))
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found.")
        
    execute_query("DELETE FROM accounts WHERE id = %s AND user_id = %s", (account_id, user_id))
    return {"message": "Account deleted successfully."}

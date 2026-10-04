import datetime
import json
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.database import fetch_one, execute_returning, execute_query
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user_id
)
from app.core.config import settings
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    RefreshTokenRequest,
    UserProfileUpdate,
    PasswordChange,
    UserOut
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

def user_response(user):
    response = {k: v for k, v in user.items() if k != "hashed_password"}
    if isinstance(response.get("health_dependents"), str):
        try:
            response["health_dependents"] = json.loads(response["health_dependents"])
        except json.JSONDecodeError:
            response["health_dependents"] = []
    return response

@router.post("/register", response_model=TokenResponse)
def register_user(payload: UserRegister):
    # Check if email or username already exists
    existing = fetch_one(
        "SELECT id FROM users WHERE email = %s OR username = %s",
        (payload.email.lower(), payload.username.lower())
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email or username already exists."
        )
        
    hashed_pwd = get_password_hash(payload.password)
    new_user = execute_returning("""
        INSERT INTO users (email, username, hashed_password, full_name, currency, current_age, target_retirement_age, monthly_income)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, email, username, full_name, currency, current_age, target_retirement_age, monthly_income, monthly_expense, target_savings_rate, emergency_fund_amount, dependents_count, health_dependents, is_onboarded, created_at
    """, (
        payload.email.lower(),
        payload.username.lower(),
        hashed_pwd,
        payload.full_name or payload.username,
        payload.currency or "INR",
        payload.current_age or 28,
        payload.target_retirement_age or 50,
        payload.monthly_income or 0.0
    ))
    
    if not new_user:
        raise HTTPException(status_code=500, detail="Failed to create user account.")
        
    user_id = str(new_user["id"])
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    
    # Store refresh token
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    execute_query("""
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES (%s, %s, %s)
    """, (user_id, refresh_token, expires_at))
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user_response(new_user)
    }

@router.post("/login", response_model=TokenResponse)
def login_user(payload: UserLogin):
    user = fetch_one("""
        SELECT * FROM users WHERE email = %s OR username = %s
    """, (payload.username_or_email.lower(), payload.username_or_email.lower()))
    
    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password."
        )
        
    user_id = str(user["id"])
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    execute_query("""
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES (%s, %s, %s)
    """, (user_id, refresh_token, expires_at))
    
    user_out = user_response(user)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user_out
    }

@router.post("/refresh", response_model=Dict[str, Any] if False else Any)
def refresh_access_token(payload: RefreshTokenRequest):
    token_payload = decode_token(payload.refresh_token)
    if token_payload.get("type") != "refresh":
        raise HTTPException(status_code=400, detail="Invalid refresh token type.")
        
    user_id = token_payload.get("sub")
    db_token = fetch_one("""
        SELECT * FROM refresh_tokens WHERE token_hash = %s AND revoked = FALSE AND expires_at > CURRENT_TIMESTAMP
    """, (payload.refresh_token,))
    
    if not db_token:
        raise HTTPException(status_code=401, detail="Refresh token is expired or revoked.")
        
    new_access_token = create_access_token(user_id)
    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

@router.get("/me", response_model=UserOut)
def get_current_user_profile(user_id: str = Depends(get_current_user_id)):
    user = fetch_one("SELECT * FROM users WHERE id = %s", (user_id,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user_response(user)

@router.put("/me", response_model=UserOut)
def update_current_user_profile(payload: UserProfileUpdate, user_id: str = Depends(get_current_user_id)):
    updates = []
    params = []
    
    for field, val in payload.model_dump(exclude_unset=True).items():
        if field == "health_dependents":
            updates.append("health_dependents = %s::jsonb")
            params.append(json.dumps(val))
        else:
            updates.append(f"{field} = %s")
            params.append(val)
        
    if not updates:
        user = fetch_one("SELECT * FROM users WHERE id = %s", (user_id,))
        return user_response(user)
        
    params.append(user_id)
    query = f"""
        UPDATE users 
        SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        RETURNING id, email, username, full_name, currency, current_age, target_retirement_age, monthly_income, monthly_expense, target_savings_rate, emergency_fund_amount, dependents_count, health_dependents, is_onboarded, created_at
    """
    updated_user = execute_returning(query, tuple(params))
    return user_response(updated_user)

@router.post("/change-password")
def change_password(payload: PasswordChange, user_id: str = Depends(get_current_user_id)):
    user = fetch_one("SELECT hashed_password FROM users WHERE id = %s", (user_id,))
    if not user or not verify_password(payload.old_password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
        
    new_hash = get_password_hash(payload.new_password)
    execute_query("UPDATE users SET hashed_password = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s", (new_hash, user_id))
    return {"message": "Password changed successfully."}

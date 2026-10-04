import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from app.core.database import fetch_all, fetch_one, execute_returning, execute_query, get_db_connection
from app.core.security import get_current_user_id
from app.schemas.transaction import (
    TransactionCreate,
    TransactionOut,
    TransactionUpdate,
    TransactionSummary
)

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.get("", response_model=List[TransactionOut])
def get_transactions(
    type: Optional[str] = Query(None, description="INCOME, EXPENSE, TRANSFER, or ALL"),
    category_id: Optional[str] = None,
    account_id: Optional[str] = None,
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id)
):
    query = """
        SELECT 
            t.*,
            c.name as category_name,
            c.icon as category_icon,
            c.color as category_color,
            sc.name as subcategory_name,
            a.name as account_name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.user_id = %s
    """
    params = [user_id]
    
    if type and type.upper() != "ALL":
        query += " AND t.type = %s"
        params.append(type.upper())
        
    if category_id:
        query += " AND t.category_id = %s"
        params.append(category_id)
        
    if account_id:
        query += " AND t.account_id = %s"
        params.append(account_id)
        
    if start_date:
        query += " AND t.date >= %s"
        params.append(start_date)
        
    if end_date:
        query += " AND t.date <= %s"
        params.append(end_date)
        
    if search:
        query += " AND (t.description ILIKE %s OR t.notes ILIKE %s OR t.tags ILIKE %s)"
        s_term = f"%{search}%"
        params.extend([s_term, s_term, s_term])
        
    query += " ORDER BY t.date DESC, t.created_at DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])
    
    records = fetch_all(query, tuple(params))
    return records

@router.get("/months")
def get_transaction_months(user_id: str = Depends(get_current_user_id)):
    rows = fetch_all("""
        SELECT
            EXTRACT(YEAR FROM date) as year,
            EXTRACT(MONTH FROM date) as month,
            COUNT(*) as transaction_count
        FROM transactions
        WHERE user_id = %s
        GROUP BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
        ORDER BY EXTRACT(YEAR FROM date) DESC, EXTRACT(MONTH FROM date) DESC
    """, (user_id,))

    months = []
    for row in rows:
        year = int(row["year"]) if row["year"] is not None else None
        month = int(row["month"]) if row["month"] is not None else None
        if year is None or month is None:
            continue
        months.append({
            "year": year,
            "month": month,
            "month_key": f"{year}-{month - 1}",
            "label": datetime.date(year, month, 1).strftime("%B"),
            "transaction_count": int(row["transaction_count"] or 0),
        })
    return months

@router.get("/summary", response_model=TransactionSummary)
def get_transactions_summary(
    month: Optional[int] = None,
    year: Optional[int] = None,
    user_id: str = Depends(get_current_user_id)
):
    now = datetime.date.today()
    sel_month = month or now.month
    sel_year = year or now.year
    
    # Calculate for selected month
    month_stats = fetch_one("""
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) as total_income,
            COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) as total_expense
        FROM transactions
        WHERE user_id = %s 
          AND EXTRACT(MONTH FROM date) = %s 
          AND EXTRACT(YEAR FROM date) = %s
    """, (user_id, sel_month, sel_year))
    
    tot_income = float(month_stats.get("total_income") or 0.0) if month_stats else 0.0
    tot_expense = float(month_stats.get("total_expense") or 0.0) if month_stats else 0.0
    
    # Calculate 3-month rolling monthly average
    avg_stats = fetch_one("""
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) / 3.0 as avg_income,
            COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) / 3.0 as avg_expense
        FROM transactions
        WHERE user_id = %s AND date >= CURRENT_DATE - INTERVAL '90 days'
    """, (user_id,))
    
    avg_inc = float(avg_stats.get("avg_income") or tot_income) if avg_stats else tot_income
    avg_exp = float(avg_stats.get("avg_expense") or tot_expense) if avg_stats else tot_expense
    
    # Recent 10 transactions
    recent_txs = fetch_all("""
        SELECT 
            t.*,
            c.name as category_name,
            c.icon as category_icon,
            c.color as category_color,
            sc.name as subcategory_name,
            a.name as account_name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.user_id = %s
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT 10
    """, (user_id,))
    
    return {
        "total_income": round(tot_income, 2),
        "total_expense": round(tot_expense, 2),
        "net_savings": round(tot_income - tot_expense, 2),
        "monthly_avg_income": round(avg_inc if avg_inc > 0 else tot_income, 2),
        "monthly_avg_expense": round(avg_exp if avg_exp > 0 else tot_expense, 2),
        "recent_transactions": recent_txs
    }

@router.post("", response_model=TransactionOut)
def create_transaction(payload: TransactionCreate, user_id: str = Depends(get_current_user_id)):
    tx = execute_returning("""
        INSERT INTO transactions (user_id, account_id, category_id, subcategory_id, type, amount, date, description, notes, tags)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
    """, (
        user_id,
        payload.account_id,
        payload.category_id,
        payload.subcategory_id,
        payload.type.upper(),
        payload.amount,
        payload.date or datetime.date.today(),
        payload.description,
        payload.notes,
        payload.tags
    ))
    
    if not tx:
        raise HTTPException(status_code=500, detail="Failed to create transaction.")
        
    if payload.account_id:
        if payload.type.upper() == 'INCOME':
            execute_query("UPDATE accounts SET balance = balance + %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s AND user_id = %s", (payload.amount, payload.account_id, user_id))
        elif payload.type.upper() == 'EXPENSE':
            execute_query("UPDATE accounts SET balance = balance - %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s AND user_id = %s", (payload.amount, payload.account_id, user_id))

    # Return with hydrated joins
    hydrated = fetch_one("""
        SELECT 
            t.*,
            c.name as category_name,
            c.icon as category_icon,
            c.color as category_color,
            sc.name as subcategory_name,
            a.name as account_name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.id = %s
    """, (tx["id"],))
    return hydrated or tx

@router.put("/{transaction_id}", response_model=TransactionOut)
def update_transaction(transaction_id: str, payload: TransactionUpdate, user_id: str = Depends(get_current_user_id)):
    tx = fetch_one("SELECT * FROM transactions WHERE id = %s AND user_id = %s", (transaction_id, user_id))
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
        
    updates = []
    params = []
    for field, val in payload.model_dump(exclude_unset=True).items():
        if field == "type" and val:
            val = val.upper()
        updates.append(f"{field} = %s")
        params.append(val)
        
    if not updates:
        return tx
        
    params.extend([transaction_id, user_id])
    execute_query(f"""
        UPDATE transactions 
        SET {', '.join(updates)}
        WHERE id = %s AND user_id = %s
    """, tuple(params))
    
    return fetch_one("""
        SELECT 
            t.*,
            c.name as category_name,
            c.icon as category_icon,
            c.color as category_color,
            sc.name as subcategory_name,
            a.name as account_name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.id = %s
    """, (transaction_id,))

@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: str, user_id: str = Depends(get_current_user_id)):
    tx = fetch_one("SELECT * FROM transactions WHERE id = %s AND user_id = %s", (transaction_id, user_id))
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
        
    execute_query("DELETE FROM transactions WHERE id = %s AND user_id = %s", (transaction_id, user_id))
    return {"message": "Transaction deleted successfully."}

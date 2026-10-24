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
    account_id: Optional[str] = None,
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    user_id: str = Depends(get_current_user_id)
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date.")

    now = datetime.date.today()
    sel_month = month or now.month
    sel_year = year or now.year
    month_conditions = ["user_id = %s"]
    month_params = [user_id]
    if start_date:
        month_conditions.append("date >= %s")
        month_params.append(start_date)
    else:
        month_conditions.append("EXTRACT(MONTH FROM date) = %s")
        month_conditions.append("EXTRACT(YEAR FROM date) = %s")
        month_params.extend([sel_month, sel_year])
    if end_date:
        month_conditions.append("date <= %s")
        month_params.append(end_date)

    average_conditions = ["user_id = %s", "date >= CURRENT_DATE - INTERVAL '90 days'"]
    average_params = [user_id]

    if account_id:
        month_conditions.append("account_id = %s")
        month_params.append(account_id)
        average_conditions.append("account_id = %s")
        average_params.append(account_id)
    
    # Calculate for selected month
    month_stats = fetch_one(f"""
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) as total_income,
            COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) as total_expense
        FROM transactions
        WHERE {" AND ".join(month_conditions)}
    """, tuple(month_params))
    
    tot_income = float(month_stats.get("total_income") or 0.0) if month_stats else 0.0
    tot_expense = float(month_stats.get("total_expense") or 0.0) if month_stats else 0.0
    
    # Calculate 3-month rolling monthly average
    avg_stats = fetch_one(f"""
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) / 3.0 as avg_income,
            COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) / 3.0 as avg_expense
        FROM transactions
        WHERE {" AND ".join(average_conditions)}
    """, tuple(average_params))
    
    avg_inc = float(avg_stats.get("avg_income") or 0.0) if avg_stats else 0.0
    avg_exp = float(avg_stats.get("avg_expense") or 0.0) if avg_stats else 0.0
    
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
        "monthly_avg_income": round(avg_inc, 2),
        "monthly_avg_expense": round(avg_exp, 2),
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

@router.delete("/all")
def delete_all_transactions(user_id: str = Depends(get_current_user_id)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE accounts AS account
                SET balance = account.balance - COALESCE(tx.income, 0) + COALESCE(tx.expense, 0),
                    updated_at = CURRENT_TIMESTAMP
                FROM (
                    SELECT
                        account_id,
                        SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) AS income,
                        SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS expense
                    FROM transactions
                    WHERE user_id = %s AND account_id IS NOT NULL
                    GROUP BY account_id
                ) AS tx
                WHERE account.id = tx.account_id AND account.user_id = %s
            """, (user_id, user_id))
            cur.execute("DELETE FROM transactions WHERE user_id = %s", (user_id,))
            deleted_count = cur.rowcount

    return {
        "message": f"Deleted {deleted_count} transactions.",
        "deleted_count": deleted_count,
    }


@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: str, user_id: str = Depends(get_current_user_id)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM transactions WHERE id = %s AND user_id = %s FOR UPDATE",
                (transaction_id, user_id),
            )
            tx = cur.fetchone()
            if not tx:
                raise HTTPException(status_code=404, detail="Transaction not found.")

            if tx["account_id"] and tx["type"] in ("INCOME", "EXPENSE"):
                balance_delta = -tx["amount"] if tx["type"] == "INCOME" else tx["amount"]
                cur.execute("""
                    UPDATE accounts
                    SET balance = balance + %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s AND user_id = %s
                """, (balance_delta, tx["account_id"], user_id))

            cur.execute(
                "DELETE FROM transactions WHERE id = %s AND user_id = %s",
                (transaction_id, user_id),
            )

    return {"message": "Transaction deleted successfully."}

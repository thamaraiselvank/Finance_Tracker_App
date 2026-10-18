import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.database import execute_returning, fetch_all, fetch_one
from app.core.security import get_current_user_id
from app.schemas.budget import BudgetOut, BudgetUpsert

router = APIRouter(prefix="/budgets", tags=["Budgets"])


@router.get("", response_model=list[BudgetOut])
def get_budgets(
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2000, le=2100),
    user_id: str = Depends(get_current_user_id),
):
    today = datetime.date.today()
    month = month or today.month
    year = year or today.year
    start_date = datetime.date(year, month, 1)
    next_year = year + (month == 12)
    next_month = 1 if month == 12 else month + 1
    end_date = datetime.date(next_year, next_month, 1)

    rows = fetch_all(
        """
        SELECT c.id AS category_id, c.name AS category_name,
               b.monthly_limit,
               COALESCE(SUM(t.amount), 0) AS spent
        FROM categories c
        LEFT JOIN budgets b
          ON b.category_id = c.id AND b.user_id = %s AND b.month = %s AND b.year = %s
        LEFT JOIN transactions t
          ON t.category_id = c.id AND t.user_id = %s AND t.type = 'EXPENSE'
         AND t.date >= %s AND t.date < %s
        WHERE c.type = 'EXPENSE' AND (c.user_id = %s OR c.is_system = TRUE)
        GROUP BY c.id, c.name, b.monthly_limit
        ORDER BY c.name ASC
        """,
        (user_id, month, year, user_id, start_date, end_date, user_id),
    )

    result = []
    for row in rows:
        limit = float(row["monthly_limit"]) if row["monthly_limit"] is not None else None
        spent = float(row["spent"] or 0)
        result.append({
            "category_id": str(row["category_id"]),
            "category_name": row["category_name"],
            "monthly_limit": limit,
            "spent": spent,
            "remaining": limit - spent if limit is not None else None,
            "over_budget": limit is not None and spent > limit,
        })
    return result


@router.put("", response_model=BudgetOut)
def save_budget(payload: BudgetUpsert, user_id: str = Depends(get_current_user_id)):
    category = fetch_one(
        "SELECT id, name FROM categories WHERE id = %s AND type = 'EXPENSE' AND (user_id = %s OR is_system = TRUE)",
        (payload.category_id, user_id),
    )
    if not category:
        raise HTTPException(status_code=404, detail="Expense category not found.")

    existing = fetch_one(
        "SELECT id FROM budgets WHERE user_id = %s AND category_id = %s AND month = %s AND year = %s",
        (user_id, payload.category_id, payload.month, payload.year),
    )
    if existing:
        execute_returning(
            "UPDATE budgets SET monthly_limit = %s WHERE id = %s RETURNING *",
            (payload.monthly_limit, existing["id"]),
        )
    else:
        execute_returning(
            """
            INSERT INTO budgets (user_id, category_id, monthly_limit, month, year)
            VALUES (%s, %s, %s, %s, %s) RETURNING *
            """,
            (user_id, payload.category_id, payload.monthly_limit, payload.month, payload.year),
        )

    spent_row = fetch_one(
        """
        SELECT COALESCE(SUM(amount), 0) AS spent FROM transactions
        WHERE user_id = %s AND category_id = %s AND type = 'EXPENSE'
          AND date >= %s AND date < %s
        """,
        (
            user_id,
            payload.category_id,
            datetime.date(payload.year, payload.month, 1),
            datetime.date(payload.year + (payload.month == 12), payload.month % 12 + 1, 1),
        ),
    )
    spent = float(spent_row["spent"] or 0)
    return {
        "category_id": str(category["id"]),
        "category_name": category["name"],
        "monthly_limit": payload.monthly_limit,
        "spent": spent,
        "remaining": payload.monthly_limit - spent,
        "over_budget": spent > payload.monthly_limit,
    }
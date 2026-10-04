import datetime
import json
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.core.database import execute_returning, fetch_all, fetch_one, get_db_connection
from app.core.security import get_current_user_id
from app.services.importer import parse_statement_file, parse_stock_file, parse_zerodha_holdings_file

router = APIRouter(prefix="/import", tags=["Statement Importer"])

class BulkImportItem(BaseModel):
    date: str
    time: Optional[str] = None
    description: Optional[str] = None
    amount: float
    type: str # INCOME or EXPENSE
    category: Optional[str] = None
    subcategory: Optional[str] = None
    category_id: Optional[str] = None
    account_id: Optional[str] = None
    notes: Optional[str] = None

class BulkImportPayload(BaseModel):
    account_id: Optional[str] = None
    transactions: List[BulkImportItem]

class BulkAssetImportItem(BaseModel):
    name: str
    asset_class: str = "EQUITY"
    sub_type: Optional[str] = "Stock"
    invested_amount: float = 0
    current_value: float = 0
    quantity: float = 1
    buy_price: float = 0
    current_price: float = 0
    purchase_date: Optional[str] = None
    notes: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None

class BulkAssetImportPayload(BaseModel):
    assets: List[BulkAssetImportItem]

@router.post("/parse-file")
async def parse_uploaded_file(
    file: UploadFile = File(...),
    import_type: str = Form("transactions"),
    broker: str = Form("OTHER"),
    user_id: str = Depends(get_current_user_id)
):
    if not file.filename.lower().endswith(('.csv', '.xlsx', '.xls', '.txt')):
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload CSV or Excel (.xlsx) files.")
        
    contents = await file.read()
    if import_type == "stocks" and broker.upper() == "ZERODHA":
        result = parse_zerodha_holdings_file(contents, file.filename)
    elif import_type == "stocks":
        result = parse_stock_file(contents, file.filename, broker.upper())
    else:
        result = parse_statement_file(contents, file.filename)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to parse file."))
        
    return result

@router.post("/commit-assets")
def commit_imported_assets(
    payload: BulkAssetImportPayload,
    user_id: str = Depends(get_current_user_id)
):
    if not payload.assets:
        raise HTTPException(status_code=400, detail="No stock holdings provided for import.")

    inserted_count = 0
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for item in payload.assets:
                meta_json = json.dumps(item.meta_data or {})
                cur.execute("""
                    INSERT INTO assets (
                        user_id, name, asset_class, sub_type, invested_amount, current_value,
                        quantity, buy_price, current_price, purchase_date, notes, meta_data
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                """, (
                    user_id, item.name, item.asset_class.upper(), item.sub_type,
                    item.invested_amount, item.current_value, item.quantity,
                    item.buy_price, item.current_price, item.purchase_date,
                    item.notes, meta_json
                ))
                inserted_count += 1

    return {
        "success": True,
        "imported_count": inserted_count,
        "message": f"Successfully imported {inserted_count} stock holdings."
    }

@router.post("/commit")
def commit_imported_transactions(
    payload: BulkImportPayload,
    user_id: str = Depends(get_current_user_id)
):
    if not payload.transactions:
        raise HTTPException(status_code=400, detail="No transactions provided for import.")

    user_cats = fetch_all("SELECT id, name, type FROM categories WHERE user_id = %s OR is_system = TRUE ORDER BY is_system DESC, name ASC", (user_id,))
    cat_lookup = {str(c["name"]).strip().lower(): c for c in user_cats}

    inserted_count = 0
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for item in payload.transactions:
                normalized_type = (item.type or 'EXPENSE').upper()
                if normalized_type not in {'INCOME', 'EXPENSE'}:
                    normalized_type = 'EXPENSE'

                try:
                    if item.time:
                        dt = datetime.datetime.fromisoformat(f"{item.date}T{item.time}")
                    else:
                        dt = datetime.datetime.fromisoformat(item.date)
                except Exception:
                    try:
                        dt = datetime.datetime.strptime(item.date, '%d-%m-%Y %H:%M:%S')
                    except Exception:
                        try:
                            dt = datetime.datetime.strptime(item.date, '%d/%m/%Y %H:%M:%S')
                        except Exception:
                            dt = datetime.datetime.fromisoformat(item.date[:10]) if len(item.date) >= 10 else datetime.datetime.now()

                category_name = (item.category or '').strip()
                category_row = None
                if item.category_id:
                    category_row = fetch_one("SELECT * FROM categories WHERE id = %s AND (user_id = %s OR is_system = TRUE)", (item.category_id, user_id))
                elif category_name:
                    normalized_category_key = category_name.strip().lower()
                    if normalized_category_key in cat_lookup:
                        category_row = cat_lookup[normalized_category_key]
                    else:
                        category_row = fetch_one(
                            "SELECT * FROM categories WHERE lower(name) = lower(%s) AND type = %s AND (user_id = %s OR is_system = TRUE) ORDER BY is_system DESC LIMIT 1",
                            (category_name, normalized_type, user_id)
                        )
                        if category_row is None:
                            category_row = execute_returning(
                                "INSERT INTO categories (user_id, name, type, icon, color, is_system) VALUES (%s, %s, %s, %s, %s, FALSE) RETURNING *",
                                (user_id, category_name, normalized_type, 'Tag', '#10B981')
                            )
                            if category_row:
                                cat_lookup[normalized_category_key] = category_row
                elif (item.notes or '').strip():
                    category_name = (item.notes or '').strip()
                    normalized_category_key = category_name.lower()
                    if normalized_category_key in cat_lookup:
                        category_row = cat_lookup[normalized_category_key]
                    else:
                        category_row = fetch_one(
                            "SELECT * FROM categories WHERE lower(name) = lower(%s) AND type = %s AND (user_id = %s OR is_system = TRUE) ORDER BY is_system DESC LIMIT 1",
                            (category_name, normalized_type, user_id)
                        )
                        if category_row is None:
                            category_row = execute_returning(
                                "INSERT INTO categories (user_id, name, type, icon, color, is_system) VALUES (%s, %s, %s, %s, %s, FALSE) RETURNING *",
                                (user_id, category_name, normalized_type, 'Tag', '#10B981')
                            )
                            if category_row:
                                cat_lookup[normalized_category_key] = category_row

                if category_row is None:
                    category_row = fetch_one(
                        "SELECT * FROM categories WHERE type = %s AND (user_id = %s OR is_system = TRUE) ORDER BY is_system DESC LIMIT 1",
                        (normalized_type, user_id)
                    )

                cat_id = category_row["id"] if category_row else None
                subcategory_id = None
                sub_name = (item.subcategory or '').strip()

                if sub_name and cat_id:
                    subcat = fetch_one(
                        "SELECT * FROM subcategories WHERE category_id = %s AND lower(name) = lower(%s)",
                        (cat_id, sub_name)
                    )
                    if subcat:
                        subcategory_id = subcat["id"]
                    else:
                        subcat_new = execute_returning(
                            "INSERT INTO subcategories (category_id, name) VALUES (%s, %s) RETURNING *",
                            (cat_id, sub_name)
                        )
                        if subcat_new:
                            subcategory_id = subcat_new["id"]

                target_account = item.account_id or payload.account_id
                description_value = (item.description or '').strip()
                if not description_value:
                    if sub_name and category_name and category_name.lower() not in sub_name.lower():
                        description_value = f"{category_name} | {sub_name}"
                    elif sub_name:
                        description_value = sub_name
                    elif category_name:
                        description_value = category_name
                    else:
                        description_value = 'Imported transaction'

                notes_value = (item.notes or '').strip()
                if not notes_value and category_name and sub_name:
                    notes_value = f"{category_name} / {sub_name}"

                cur.execute("""
                    INSERT INTO transactions (user_id, account_id, category_id, subcategory_id, type, amount, date, description, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    user_id,
                    target_account,
                    cat_id,
                    subcategory_id,
                    normalized_type,
                    item.amount,
                    dt.date(),
                    description_value,
                    notes_value
                ))
                inserted_count += 1

                if target_account:
                    if normalized_type == 'INCOME':
                        cur.execute("UPDATE accounts SET balance = balance + %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s AND user_id = %s", (item.amount, target_account, user_id))
                    elif normalized_type == 'EXPENSE':
                        cur.execute("UPDATE accounts SET balance = balance - %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s AND user_id = %s", (item.amount, target_account, user_id))

    return {
        "success": True,
        "imported_count": inserted_count,
        "message": f"Successfully imported {inserted_count} transactions."
    }

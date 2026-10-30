import datetime
import json
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.core.database import execute_returning, fetch_all, fetch_one, get_db_connection
from app.core.security import get_current_user_id
from app.services.importer import (
    parse_pdf_statement_file,
    parse_statement_file,
    parse_stock_file,
    parse_zerodha_holdings_file,
)

router = APIRouter(prefix="/import", tags=["Statement Importer"])
MAX_UPLOAD_BYTES = 15 * 1024 * 1024

class BulkImportItem(BaseModel):
    date: str
    time: Optional[str] = None
    description: Optional[str] = None
    amount: float = Field(..., gt=0)
    type: str # INCOME or EXPENSE
    category: Optional[str] = None
    subcategory: Optional[str] = None
    category_id: Optional[str] = None
    account_id: Optional[str] = None
    notes: Optional[str] = None

class BulkImportPayload(BaseModel):
    account_id: str
    transactions: List[BulkImportItem]


def normalize_import_type(value: Optional[str]) -> str:
    normalized_type = (value or '').upper()
    if normalized_type not in {'INCOME', 'EXPENSE'}:
        raise HTTPException(
            status_code=422,
            detail="Each imported transaction must be classified as income or expense.",
        )
    return normalized_type


class BulkAssetImportItem(BaseModel):
    name: str
    asset_class: str = "EQUITY"
    sub_type: Optional[str] = "Stock"
    invested_amount: float = Field(0, ge=0)
    current_value: float = Field(0, ge=0)
    quantity: float = Field(1, ge=0)
    buy_price: float = Field(0, ge=0)
    current_price: float = Field(0, ge=0)
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
    password: Optional[str] = Form(None),
    use_gemini: bool = Form(False),
    user_id: str = Depends(get_current_user_id)
):
    filename = file.filename or ""
    extension = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    supported_extensions = {".csv", ".xlsx", ".xls", ".txt", ".pdf"}
    if f".{extension}" not in supported_extensions:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload CSV, Excel, or PDF files.",
        )
    if import_type == "stocks" and extension == "pdf":
        raise HTTPException(
            status_code=400,
            detail="PDF statements are currently supported for income and expense imports only.",
        )

    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="The uploaded file exceeds the 15 MB limit.")
    if extension == "pdf":
        result = parse_pdf_statement_file(
            contents, filename, password, use_gemini=use_gemini
        )
    elif import_type == "stocks" and broker.upper() == "ZERODHA":
        result = parse_zerodha_holdings_file(contents, filename)
    elif import_type == "stocks":
        result = parse_stock_file(contents, filename, broker.upper())
    else:
        result = parse_statement_file(contents, filename)
    if not result.get("success"):
        if extension == "pdf" and use_gemini:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Gemini extraction did not produce usable rows, and the local PDF parser "
                    "could not recover transactions. Try a clearer PDF or CSV/Excel export. "
                    + result.get("error", "")
                ),
            )
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

    account = fetch_one(
        "SELECT id FROM accounts WHERE id = %s AND user_id = %s",
        (payload.account_id, user_id),
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found.")

    user_cats = fetch_all("SELECT id, name, type FROM categories WHERE user_id = %s OR is_system = TRUE ORDER BY is_system DESC, name ASC", (user_id,))
    cat_lookup = {
        (str(c["name"]).strip().lower(), c["type"]): c
        for c in user_cats
    }

    inserted_count = 0
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for item in payload.transactions:
                normalized_type = normalize_import_type(item.type)

                try:
                    if item.time:
                        dt = datetime.datetime.fromisoformat(f"{item.date}T{item.time}")
                    else:
                        dt = datetime.datetime.fromisoformat(item.date)
                except ValueError:
                    dt = None
                    try:
                        dt = datetime.datetime.strptime(item.date, '%d-%m-%Y %H:%M:%S')
                    except ValueError:
                        try:
                            dt = datetime.datetime.strptime(item.date, '%d/%m/%Y %H:%M:%S')
                        except ValueError as exc:
                            try:
                                dt = datetime.datetime.strptime(item.date, '%d-%m-%Y')
                            except ValueError:
                                try:
                                    dt = datetime.datetime.strptime(item.date, '%d/%m/%Y')
                                except ValueError:
                                    raise HTTPException(
                                        status_code=422,
                                        detail="Each imported transaction must have a valid date.",
                                    ) from exc

                category_name = (item.category or '').strip()
                category_row = None
                if item.category_id:
                    category_row = fetch_one("SELECT * FROM categories WHERE id = %s AND (user_id = %s OR is_system = TRUE)", (item.category_id, user_id))
                elif category_name:
                    normalized_category_key = (category_name.strip().lower(), normalized_type)
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
                    normalized_category_key = (category_name.lower(), normalized_type)
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
                    fallback_category = (
                        "Other Income" if normalized_type == "INCOME" else "Other Expenses"
                    )
                    category_row = fetch_one(
                        "SELECT * FROM categories WHERE type = %s AND (user_id = %s OR is_system = TRUE) ORDER BY CASE WHEN lower(name) = lower(%s) THEN 0 ELSE 1 END, is_system DESC LIMIT 1",
                        (normalized_type, user_id, fallback_category)
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
                cur.execute(
                    "SELECT id FROM accounts WHERE id = %s AND user_id = %s",
                    (target_account, user_id),
                )
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Account not found.")
                description_value = (item.description or '').strip()
                if not description_value:
                    raise HTTPException(
                        status_code=422,
                        detail="Each imported transaction must have a description.",
                    )

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

import json
import datetime
import logging
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from app.core.database import fetch_all, fetch_one, execute_returning, execute_query
from app.core.security import get_current_user_id
from app.schemas.asset import (
    AssetCreate,
    AssetOut,
    AssetUpdate,
    WealthSummary,
    AssetClassSummary
)

router = APIRouter(prefix="/assets", tags=["Assets & Wealth"])
logger = logging.getLogger(__name__)

def hydrate_asset(asset: dict) -> dict:
    inv = float(asset.get("invested_amount") or 0.0)
    cur = float(asset.get("current_value") or 0.0)
    pnl = cur - inv
    pnl_pct = round((pnl / inv * 100.0), 2) if inv > 0 else 0.0
    
    # Ensure meta_data is parsed dictionary
    meta = asset.get("meta_data")
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except Exception:
            meta = {}
    elif meta is None:
        meta = {}
        
    return {
        **asset,
        "invested_amount": inv,
        "current_value": cur,
        "quantity": float(asset.get("quantity") or 1.0),
        "buy_price": float(asset.get("buy_price") or 0.0),
        "current_price": float(asset.get("current_price") or 0.0),
        "pnl": round(pnl, 2),
        "pnl_percentage": pnl_pct,
        "meta_data": meta
    }

@router.get("", response_model=List[AssetOut])
def get_assets(asset_class: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    query = "SELECT * FROM assets WHERE user_id = %s"
    params = [user_id]
    if asset_class:
        query += " AND asset_class = %s"
        params.append(asset_class.upper())
        
    query += " ORDER BY current_value DESC, created_at DESC"
    raw_assets = fetch_all(query, tuple(params))
    return [hydrate_asset(a) for a in raw_assets]

@router.get("/summary", response_model=WealthSummary)
def get_wealth_summary(user_id: str = Depends(get_current_user_id)):
    raw_assets = fetch_all("SELECT * FROM assets WHERE user_id = %s ORDER BY current_value DESC", (user_id,))
    assets = [hydrate_asset(a) for a in raw_assets]
    
    total_invested = sum(a["invested_amount"] for a in assets)
    total_current = sum(a["current_value"] for a in assets)
    total_pnl = total_current - total_invested
    total_pnl_pct = round((total_pnl / total_invested * 100.0), 2) if total_invested > 0 else 0.0
    
    # Liabilities summary
    liabs = fetch_all("SELECT * FROM liabilities WHERE user_id = %s", (user_id,))
    total_liab_outstanding = sum(float(l.get("current_outstanding") or 0.0) for l in liabs)
    total_emi = sum(float(l.get("emi_amount") or 0.0) for l in liabs)
    
    net_worth = total_current - total_liab_outstanding
    
    # Group by Asset Class
    class_groups = {}
    for a in assets:
        ac = a["asset_class"]
        if ac not in class_groups:
            class_groups[ac] = []
        class_groups[ac].append(a)
        
    asset_class_summaries = []
    for ac, items in class_groups.items():
        c_inv = sum(item["invested_amount"] for item in items)
        c_cur = sum(item["current_value"] for item in items)
        c_pnl = c_cur - c_inv
        c_pnl_pct = round((c_pnl / c_inv * 100.0), 2) if c_inv > 0 else 0.0
        alloc_pct = round((c_cur / total_current * 100.0), 1) if total_current > 0 else 0.0
        
        asset_class_summaries.append(AssetClassSummary(
            asset_class=ac,
            total_invested=round(c_inv, 2),
            total_current_value=round(c_cur, 2),
            total_pnl=round(c_pnl, 2),
            pnl_percentage=c_pnl_pct,
            allocation_percentage=alloc_pct,
            count=len(items),
            items=[AssetOut(**item) for item in items]
        ))
        
    return WealthSummary(
        total_assets_invested=round(total_invested, 2),
        total_assets_current=round(total_current, 2),
        total_assets_pnl=round(total_pnl, 2),
        total_assets_pnl_pct=total_pnl_pct,
        total_liabilities_outstanding=round(total_liab_outstanding, 2),
        total_monthly_emi=round(total_emi, 2),
        net_worth=round(net_worth, 2),
        asset_classes=asset_class_summaries
    )

@router.post("", response_model=AssetOut)
def create_asset(payload: AssetCreate, user_id: str = Depends(get_current_user_id)):
    # Auto-calculate current_value from quantity & current_price if provided
    current_val = payload.current_value
    if payload.current_price and payload.quantity and payload.current_price > 0:
        current_val = round(payload.quantity * payload.current_price, 2)
        
    invested_amt = payload.invested_amount
    if payload.buy_price and payload.quantity and payload.buy_price > 0 and invested_amt == 0:
        invested_amt = round(payload.quantity * payload.buy_price, 2)
        
    meta_json = json.dumps(payload.meta_data or {})
    
    new_asset = execute_returning("""
        INSERT INTO assets (
            user_id, name, asset_class, sub_type, invested_amount, current_value, 
            quantity, buy_price, current_price, purchase_date, notes, meta_data
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
        RETURNING *
    """, (
        user_id,
        payload.name,
        payload.asset_class.upper(),
        payload.sub_type,
        invested_amt,
        current_val,
        payload.quantity or 1.0,
        payload.buy_price or 0.0,
        payload.current_price or 0.0,
        payload.purchase_date,
        payload.notes,
        meta_json
    ))
    return hydrate_asset(new_asset)

@router.put("/{asset_id}", response_model=AssetOut)
def update_asset(asset_id: str, payload: AssetUpdate, user_id: str = Depends(get_current_user_id)):
    asset = fetch_one("SELECT * FROM assets WHERE id = %s AND user_id = %s", (asset_id, user_id))
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")
        
    updates = []
    params = []
    
    for field, val in payload.model_dump(exclude_unset=True).items():
        if field == "asset_class" and val:
            val = val.upper()
        if field == "meta_data" and val is not None:
            updates.append("meta_data = %s::jsonb")
            params.append(json.dumps(val))
        else:
            updates.append(f"{field} = %s")
            params.append(val)
            
    if not updates:
        return hydrate_asset(asset)
        
    params.extend([asset_id, user_id])
    updated = execute_returning(f"""
        UPDATE assets 
        SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s AND user_id = %s
        RETURNING *
    """, tuple(params))
    return hydrate_asset(updated)

def refresh_asset_quote(asset: dict, user_id: str) -> dict:
    meta_data = asset.get("meta_data") or {}
    if isinstance(meta_data, str):
        try:
            meta_data = json.loads(meta_data)
        except Exception:
            meta_data = {}
    symbol = meta_data.get("symbol") or meta_data.get("ticker") or asset["name"]
    symbol = str(symbol).strip().upper()
    candidates = [symbol] if "." in symbol else [f"{symbol}.NS", f"{symbol}.BO", symbol]
    quote = None
    last_error = "No quote data returned."
    for candidate in candidates:
        try:
            response = requests.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{candidate}",
                params={"range": "1d", "interval": "1m"},
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=8,
            )
            response.raise_for_status()
            chart = response.json().get("chart", {})
            result = chart.get("result") or []
            if result and result[0].get("meta", {}).get("regularMarketPrice") is not None:
                quote = result[0]
                break
            last_error = f"No price found for {candidate}."
        except (requests.RequestException, ValueError) as error:
            last_error = f"Yahoo Finance request failed for {candidate}: {error}"
            continue

    if not quote:
        raise ValueError(last_error)

    meta = quote["meta"]
    current_price = round(float(meta["regularMarketPrice"]), 2)
    quantity = float(asset.get("quantity") or 1.0)
    current_value = round(current_price * quantity, 2)
    market_timestamp = meta.get("regularMarketTime") or datetime.datetime.now(datetime.timezone.utc).timestamp()
    price_updated_at = datetime.datetime.fromtimestamp(
        market_timestamp,
        tz=datetime.timezone.utc,
    )
    updated = execute_returning("""
        UPDATE assets
        SET current_price = %s, current_value = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s AND user_id = %s
        RETURNING *
    """, (current_price, current_value, asset["id"], user_id))
    hydrated = hydrate_asset(updated)
    hydrated["price_updated_at"] = price_updated_at
    return hydrated


@router.post("/refresh-prices")
def refresh_all_equity_prices(user_id: str = Depends(get_current_user_id)):
    assets = fetch_all(
        "SELECT * FROM assets WHERE user_id = %s AND asset_class = 'EQUITY'",
        (user_id,)
    )
    if not assets:
        return {
            "updated_count": 0,
            "failed_count": 0,
            "message": "No equity holdings to refresh.",
            "failures": [],
        }

    failures = []
    updated_count = 0
    with ThreadPoolExecutor(max_workers=min(5, len(assets))) as executor:
        futures = {
            executor.submit(refresh_asset_quote, asset, user_id): asset
            for asset in assets
        }
        for future in as_completed(futures):
            asset = futures[future]
            try:
                future.result()
                updated_count += 1
            except ValueError as error:
                failures.append({"asset": asset["name"], "reason": str(error)})
            except Exception as error:
                logger.exception("Unexpected price refresh failure for asset %s.", asset["id"])
                failures.append({"asset": asset["name"], "reason": f"Unexpected refresh error: {error}"})

    return {
        "updated_count": updated_count,
        "failed_count": len(failures),
        "message": f"Updated prices for {updated_count} of {len(assets)} equity holdings.",
        "failures": failures,
    }


@router.post("/{asset_id}/refresh-price", response_model=AssetOut)
def refresh_asset_price(asset_id: str, user_id: str = Depends(get_current_user_id)):
    asset = fetch_one("SELECT * FROM assets WHERE id = %s AND user_id = %s", (asset_id, user_id))
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")
    if asset.get("asset_class") not in {"EQUITY", "MUTUAL_FUND", "CRYPTO"}:
        raise HTTPException(status_code=400, detail="Live prices are not available for this asset type.")

    try:
        return refresh_asset_quote(asset, user_id)
    except ValueError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@router.delete("/all")
def delete_all_assets(user_id: str = Depends(get_current_user_id)):
    execute_query("DELETE FROM assets WHERE user_id = %s", (user_id,))
    return {"message": "All assets deleted successfully."}

@router.delete("/{asset_id}")
def delete_asset(asset_id: str, user_id: str = Depends(get_current_user_id)):
    asset = fetch_one("SELECT * FROM assets WHERE id = %s AND user_id = %s", (asset_id, user_id))
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")
        
    execute_query("DELETE FROM assets WHERE id = %s AND user_id = %s", (asset_id, user_id))
    return {"message": "Asset deleted successfully."}

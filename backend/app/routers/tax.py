from typing import Any
from datetime import date
import json

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.database import fetch_all, fetch_one
from app.core.security import get_current_user_id
from app.schemas.tax_setting import IndiaTaxEstimateInput
from app.services.tax_estimator import (
    available_india_tax_years, estimate_india_tax, get_india_tax_rules,
)

router = APIRouter(prefix="/tax", tags=["Tax estimator"])


@router.get("/rules")
def read_tax_rules(
    tax_year: str | None = Query(None, min_length=7, max_length=10),
    _user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    years = available_india_tax_years()
    try:
        rules = get_india_tax_rules(tax_year)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return {
        "country": rules["country"],
        "currency": rules["currency"],
        "tax_year": rules["tax_year"],
        "legislation": rules["legislation"],
        "version": rules["version"],
        "available_tax_years": years,
        "sources": rules["sources"],
        "regimes": rules["individual"]["regimes"],
        "common": rules["individual"]["common"],
    }


@router.get("/profile")
def read_tax_profile_sources(
    tax_year: str = Query(..., min_length=7, max_length=10),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Return editable, traceable tax-input suggestions from the user's own records."""
    try:
        rules = get_india_tax_rules(tax_year)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    start_year = int(rules["tax_year"].split("-")[0])
    period_start = date(start_year, 4, 1)
    period_end = date(start_year + 1, 3, 31)
    as_of = min(date.today(), period_end)
    user = fetch_one("SELECT monthly_income, currency FROM users WHERE id = %s", (user_id,)) or {}
    profile_currency = str(user.get("currency") or "INR").upper()
    amounts_are_inr = profile_currency == "INR"
    transactions = fetch_all("""SELECT t.amount, t.type, t.description, t.date,
            COALESCE(c.name, '') AS category_name, COALESCE(sc.name, '') AS subcategory_name,
            COALESCE(t.notes, '') AS notes
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        LEFT JOIN subcategories sc ON sc.id = t.subcategory_id
        WHERE t.user_id = %s AND t.date >= %s AND t.date <= %s
          AND t.type IN ('INCOME', 'EXPENSE')
        ORDER BY t.date DESC""", (user_id, period_start, as_of)) or []

    totals = {key: 0.0 for key in (
        "salary", "interest", "dividends", "rental_gross", "business_gross",
        "other_income", "capital_gains_records", "deduction_80c", "deduction_80d",
    )}
    transaction_groups: dict[str, dict[tuple[str, str], dict[str, Any]]] = {
        "salary": {}, "interest": {}, "dividends": {}, "other_income": {},
        "deduction_80c": {}, "deduction_80d": {},
    }
    for row in transactions:
        if not amounts_are_inr:
            continue
        category = str(row.get("category_name") or "").lower()
        subcategory = str(row.get("subcategory_name") or "").lower()
        description = str(row.get("description") or "").lower()
        notes = str(row.get("notes") or "").lower()
        label = " ".join((category, subcategory, description, notes))
        transaction_type = row.get("type")
        transaction_amount = float(row.get("amount") or 0)

        if transaction_type == "INCOME":
            if "dividend" in label:
                key = "dividends"
            elif any(term in label for term in ("interest", "fixed deposit", "fd/savings", "fd ")):
                key = "interest"
            elif any(term in label for term in ("salary", "payroll", "monthly salary")):
                key = "salary"
            elif any(term in label for term in ("rental", "rent income")):
                key = "rental_gross"
            elif any(term in label for term in ("business", "freelance")):
                key = "business_gross"
            elif any(term in label for term in ("capital gain", "stock gain", "mutual fund gain")):
                key = "capital_gains_records"
            else:
                key = "other_income"
        else:
            if "health insurance" in label or ("insurance" in category and "health" in label):
                key = "deduction_80d"
            elif any(term in label for term in ("ppf", "elss", "provident fund", "life insurance", "tuition fee", "section 80c")):
                key = "deduction_80c"
            else:
                continue
        totals[key] += transaction_amount
        if key in transaction_groups:
            group_key = (str(row.get("category_name") or "Uncategorised"), str(row.get("subcategory_name") or ""))
            group = transaction_groups[key].setdefault(group_key, {"category": group_key[0], "subcategory": group_key[1], "amount": 0.0, "count": 0})
            group["amount"] += transaction_amount
            group["count"] += 1

    health_policies = []
    if amounts_are_inr:
        health_policies = fetch_all("""SELECT policy_name, annual_premium, payment_status, start_date, renewal_date
            FROM insurance_policies WHERE user_id = %s AND policy_type = 'HEALTH' AND status = 'ACTIVE'
            AND (start_date IS NULL OR start_date <= %s)
            AND (renewal_date IS NULL OR renewal_date >= %s)
            ORDER BY policy_name""", (user_id, period_end, period_start)) or []
    health_policy_premium = sum(float(item.get("annual_premium") or 0) for item in health_policies)

    equity_holdings = fetch_all("""SELECT name, quantity, purchase_date, meta_data
        FROM assets WHERE user_id = %s AND asset_class IN ('EQUITY', 'MUTUAL_FUND')
        ORDER BY name""", (user_id,)) or []
    holdings = []
    for holding in equity_holdings:
        meta = holding.get("meta_data") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except json.JSONDecodeError:
                meta = {}
        holdings.append({
            "name": holding.get("name"),
            "symbol": meta.get("symbol") or meta.get("ticker"),
            "quantity": float(holding.get("quantity") or 0),
            "purchase_date": holding.get("purchase_date"),
        })

    debts = fetch_all("""SELECT debt_name AS name, debt_type AS type, monthly_emi AS emi,
            interest_rate_pct AS interest_rate FROM debts
        WHERE user_id = %s AND debt_type = 'HOME_LOAN'
        UNION ALL
        SELECT name, liability_type AS type, emi_amount AS emi, interest_rate_pct AS interest_rate
        FROM liabilities WHERE user_id = %s AND liability_type = 'HOME_LOAN'
        ORDER BY name""", (user_id, user_id)) or []

    profile_monthly_income = float(user.get("monthly_income") or 0)
    profile_salary_annual = profile_monthly_income * 12 if profile_currency == "INR" else 0.0
    salary_candidate = profile_salary_annual or totals["salary"]
    health_candidate = totals["deduction_80d"] or health_policy_premium

    def suggestion(value: float, source: str, note: str, period: str = "tax-year-to-date") -> dict[str, Any]:
        return {"value": round(value, 2), "source": source, "note": note, "period": period}

    return {
        "tax_year": rules["tax_year"],
        "stored_profile_currency": profile_currency,
        "currency_warning": None if amounts_are_inr else f"Your profile currency is {profile_currency}; Finverse skipped monetary auto-suggestions to avoid treating those amounts as INR. Enter verified INR tax-year amounts manually.",
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "as_of": as_of.isoformat(),
        "suggestions": {
            "salary_income": suggestion(
                salary_candidate,
                "Monthly profile income × 12" if profile_salary_annual else "Recorded salary transactions",
                "Profile amount is an annualized estimate. Compare it with gross salary in your payslips / Form 16. Recorded salary transactions are only year-to-date.",
                "annualized-profile" if profile_salary_annual else "tax-year-to-date",
            ),
            "interest_income": suggestion(totals["interest"], "Money: interest-category income transactions", "Only recorded income transactions from this tax year; add any missing bank / FD interest and confirm the annual total."),
            "dividend_income": suggestion(totals["dividends"], "Money: dividend-category income transactions", "Only dividends entered in Money. Stock holdings do not contain dividend events or historical share quantities."),
            "other_regular_income": suggestion(totals["other_income"], "Money: other income transactions", "Recorded other income only; check whether each item is taxable at ordinary slab rates."),
            "section_80c": suggestion(totals["deduction_80c"], "Money: tagged 80C / PPF / ELSS / EPF / life-insurance / tuition expenses", "Category and description matches are suggestions only; verify each amount is eligible and paid in this tax year."),
            "section_80d": suggestion(health_candidate, "Money: health premium transactions" if totals["deduction_80d"] else "Insurance: active health-policy annual premiums", "Confirm the premium was paid in this tax year and check age / covered-person limits. Policy premiums are not proof of payment."),
        },
        "unclassified_tax_sources": {
            "rental_gross_received": round(totals["rental_gross"], 2),
            "business_gross_receipts": round(totals["business_gross"], 2),
            "capital_gain_related_transactions": round(totals["capital_gains_records"], 2),
            "note": "Rental receipts, business receipts, and capital-gain-tagged transactions are shown for review but are not inserted into taxable-income fields because expenses, holding periods, cost basis, and special tax rates are not derived here.",
        },
        "health_policies": [{
            "name": item.get("policy_name"),
            "annual_premium": float(item.get("annual_premium") or 0),
            "payment_status": item.get("payment_status"),
        } for item in health_policies],
        "transaction_breakdown": {
            field: sorted(
                [{**group, "amount": round(group["amount"], 2)} for group in groups.values()],
                key=lambda group: group["amount"], reverse=True,
            )
            for field, groups in transaction_groups.items()
        },
        "salary_recorded_ytd": round(totals["salary"], 2),
        "home_loans": [{
            "name": item.get("name"), "emi": float(item.get("emi") or 0),
            "interest_rate": float(item.get("interest_rate") or 0),
        } for item in debts],
        "investment_holdings": holdings,
        "data_gaps": [
            "Bank and FD interest is suggested only when it has been recorded as an income transaction.",
            "Dividend totals include recorded dividend transactions only; no dividend history is stored for holdings.",
            "Home-loan EMI and rate do not reveal interest paid during the year; use the lender's annual interest certificate.",
            "Income from rentals and business is not inserted automatically because taxable income needs expense / allowance calculations.",
        ],
    }


@router.post("/estimate")
def calculate_tax_estimate(
    payload: IndiaTaxEstimateInput,
    _user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    try:
        return estimate_india_tax(payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

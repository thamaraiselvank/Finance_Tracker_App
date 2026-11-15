import calendar
import datetime
from zoneinfo import ZoneInfo
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import settings
from app.core.database import fetch_all, fetch_one, get_db_connection
from app.core.security import get_current_user_id
from app.schemas.scheduled_cashflow import CompleteOccurrence, ScheduleCreate, ScheduleFields, ScheduleUpdate

router = APIRouter(prefix="/schedules", tags=["Scheduled Cash Flow"])


def _today() -> datetime.date:
    return datetime.datetime.now(ZoneInfo(settings.AI_QUOTA_TIMEZONE)).date()


def _month_occurrence(anchor: datetime.date, month_index: int) -> datetime.date:
    month0 = anchor.month - 1 + month_index
    year = anchor.year + month0 // 12
    month = month0 % 12 + 1
    day = min(anchor.day, calendar.monthrange(year, month)[1])
    return datetime.date(year, month, day)


def _recurrence_step_months(schedule: dict) -> Optional[int]:
    multipliers = {"MONTHLY": 1, "QUARTERLY": 3, "YEARLY": 12}
    multiplier = multipliers.get(schedule["frequency"])
    return multiplier * int(schedule["interval_count"]) if multiplier else None


def _occurrence_at(schedule: dict, index: int) -> datetime.date:
    if schedule["frequency"] == "WEEKLY":
        return schedule["start_date"] + datetime.timedelta(
            weeks=index * int(schedule["interval_count"])
        )
    return _month_occurrence(
        schedule["start_date"], index * _recurrence_step_months(schedule)
    )


def _occurrence_index_on_or_before(schedule: dict, target: datetime.date) -> int:
    start = schedule["start_date"]
    if target <= start:
        return 0
    if schedule["frequency"] == "WEEKLY":
        days_per_interval = 7 * int(schedule["interval_count"])
        return max((target - start).days // days_per_interval - 1, 0)
    step_months = _recurrence_step_months(schedule)
    months_apart = (target.year - start.year) * 12 + target.month - start.month
    return max(months_apart // step_months - 1, 0)


def _is_occurrence(schedule: dict, occurrence_date: datetime.date) -> bool:
    if occurrence_date < schedule["start_date"]:
        return False
    if schedule.get("end_date") and occurrence_date > schedule["end_date"]:
        return False
    index = _occurrence_index_on_or_before(schedule, occurrence_date)
    for candidate_index in range(index, index + 3):
        candidate = _occurrence_at(schedule, candidate_index)
        if candidate == occurrence_date:
            return True
        if candidate > occurrence_date:
            return False
    return False


def _validate_related_records(values: dict, user_id: str, *, require_active_account: bool = True) -> None:
    active_filter = " AND is_active = TRUE" if require_active_account else ""
    account = fetch_one(
        f"SELECT id FROM accounts WHERE id = %s AND user_id = %s{active_filter}",
        (values["account_id"], user_id),
    )
    if not account:
        raise HTTPException(status_code=422, detail="Choose an active account that belongs to your profile.")

    if values.get("category_id"):
        category = fetch_one(
            "SELECT id FROM categories WHERE id = %s AND type = %s AND (user_id = %s OR is_system = TRUE)",
            (values["category_id"], values["flow_type"], user_id),
        )
        if not category:
            raise HTTPException(status_code=422, detail="Choose a category that matches the cash-flow type.")

    if values.get("asset_id"):
        asset = fetch_one(
            "SELECT id FROM assets WHERE id = %s AND user_id = %s",
            (values["asset_id"], user_id),
        )
        if not asset:
            raise HTTPException(status_code=422, detail="The linked asset was not found in your profile.")

    for field, table, label in (
        ("liability_id", "liabilities", "liability"),
        ("debt_id", "debts", "debt"),
        ("insurance_policy_id", "insurance_policies", "insurance policy"),
    ):
        if values.get(field) and not fetch_one(
            f"SELECT id FROM {table} WHERE id = %s AND user_id = %s",
            (values[field], user_id),
        ):
            raise HTTPException(status_code=422, detail=f"The linked {label} was not found in your profile.")


def _default_category_id(user_id: str, category_name: str):
    row = fetch_one("""
        SELECT id FROM categories
        WHERE type = 'EXPENSE' AND LOWER(name) = LOWER(%s)
          AND (user_id = %s OR is_system = TRUE)
        ORDER BY is_system DESC
        LIMIT 1
    """, (category_name, user_id))
    return row["id"] if row else None


def _load_schedule(schedule_id: str, user_id: str, *, lock: bool = False):
    query = "SELECT * FROM scheduled_cashflows WHERE id = %s AND user_id = %s"
    if lock:
        query += " FOR UPDATE"
    return fetch_one(query, (schedule_id, user_id))


@router.get("")
def list_schedules(user_id: str = Depends(get_current_user_id)):
    return fetch_all("""
        SELECT s.*, c.name AS category_name, a.name AS account_name, asset.name AS asset_name,
               COALESCE(l.name, d.debt_name, p.policy_name) AS linked_record_name
        FROM scheduled_cashflows s
        LEFT JOIN categories c ON c.id = s.category_id
        LEFT JOIN accounts a ON a.id = s.account_id
        LEFT JOIN assets asset ON asset.id = s.asset_id
        LEFT JOIN liabilities l ON l.id = s.liability_id AND l.user_id = s.user_id
        LEFT JOIN debts d ON d.id = s.debt_id AND d.user_id = s.user_id
        LEFT JOIN insurance_policies p ON p.id = s.insurance_policy_id AND p.user_id = s.user_id
        WHERE s.user_id = %s
        ORDER BY s.is_active DESC, s.start_date, s.description
    """, (user_id,))


@router.get("/occurrences")
def list_occurrences(
    start_date: Optional[datetime.date] = Query(None),
    end_date: Optional[datetime.date] = Query(None),
    user_id: str = Depends(get_current_user_id),
):
    today = _today()
    range_start = start_date or today.replace(day=1)
    range_end = end_date or _month_occurrence(today.replace(day=1), 2) - datetime.timedelta(days=1)
    if range_end < range_start:
        raise HTTPException(status_code=422, detail="End date must be on or after the start date.")
    if (range_end - range_start).days > 366:
        raise HTTPException(status_code=422, detail="Calendar range cannot exceed 367 days.")

    schedules = fetch_all("""
        SELECT s.*, c.name AS category_name, a.name AS account_name, asset.name AS asset_name,
               COALESCE(l.name, d.debt_name, p.policy_name) AS linked_record_name
        FROM scheduled_cashflows s
        LEFT JOIN categories c ON c.id = s.category_id
        LEFT JOIN accounts a ON a.id = s.account_id
        LEFT JOIN assets asset ON asset.id = s.asset_id
        LEFT JOIN liabilities l ON l.id = s.liability_id AND l.user_id = s.user_id
        LEFT JOIN debts d ON d.id = s.debt_id AND d.user_id = s.user_id
        LEFT JOIN insurance_policies p ON p.id = s.insurance_policy_id AND p.user_id = s.user_id
        WHERE s.user_id = %s AND s.is_active = TRUE
        ORDER BY s.description
    """, (user_id,))
    actuals = fetch_all("""
        SELECT scheduled_cashflow_id, scheduled_occurrence_date, id AS transaction_id,
               date AS actual_date, amount AS actual_amount
        FROM transactions
        WHERE user_id = %s AND scheduled_occurrence_date BETWEEN %s AND %s
          AND scheduled_cashflow_id IS NOT NULL
    """, (user_id, range_start, range_end))
    actual_by_key = {
        (str(row["scheduled_cashflow_id"]), row["scheduled_occurrence_date"]): row
        for row in actuals
    }

    occurrences = []
    for schedule in schedules:
        index = _occurrence_index_on_or_before(schedule, range_start)
        occurrence = _occurrence_at(schedule, index)
        while occurrence < range_start:
            index += 1
            occurrence = _occurrence_at(schedule, index)
        while occurrence <= range_end:
            if schedule.get("end_date") and occurrence > schedule["end_date"]:
                break
            key = (str(schedule["id"]), occurrence)
            actual = actual_by_key.get(key)
            if actual:
                state = "received" if schedule["flow_type"] == "INCOME" else "paid"
            elif occurrence < today:
                state = "overdue"
            else:
                state = "upcoming"
            occurrences.append({
                "schedule_id": schedule["id"],
                "description": schedule["description"],
                "flow_type": schedule["flow_type"],
                "source_type": schedule["source_type"],
                "frequency": schedule["frequency"],
                "interval_count": schedule["interval_count"],
                "amount": schedule["amount"],
                "amount_is_estimate": schedule["amount_is_estimate"],
                "occurrence_date": occurrence,
                "status": state,
                "category_name": schedule.get("category_name"),
                "account_name": schedule.get("account_name"),
                "asset_name": schedule.get("asset_name"),
                "linked_record_name": schedule.get("linked_record_name"),
                "liability_id": schedule.get("liability_id"),
                "debt_id": schedule.get("debt_id"),
                "insurance_policy_id": schedule.get("insurance_policy_id"),
                "transaction_id": actual.get("transaction_id") if actual else None,
                "actual_date": actual.get("actual_date") if actual else None,
                "actual_amount": actual.get("actual_amount") if actual else None,
            })
            index += 1
            occurrence = _occurrence_at(schedule, index)

    return sorted(occurrences, key=lambda item: (item["occurrence_date"], item["description"].lower()))


@router.post("", status_code=status.HTTP_201_CREATED)
def create_schedule(payload: ScheduleCreate, user_id: str = Depends(get_current_user_id)):
    values = payload.model_dump()
    values["description"] = values["description"].strip()
    if not values["description"]:
        raise HTTPException(status_code=422, detail="Enter a name for this scheduled cash flow.")
    values["flow_type"] = values["flow_type"].upper()
    values["source_type"] = values["source_type"].upper()
    values["frequency"] = values["frequency"].upper()
    _validate_related_records(values, user_id)
    return _insert_schedule(values, user_id)


def _insert_schedule(values: dict, user_id: str):
    if values.get("liability_id") or values.get("debt_id"):
        values["category_id"] = values.get("category_id") or _default_category_id(user_id, "Loan EMI & Debt Payoff")
    elif values.get("insurance_policy_id"):
        values["category_id"] = values.get("category_id") or _default_category_id(user_id, "Insurance Premiums")
    return fetch_one("""
        INSERT INTO scheduled_cashflows (
            user_id, account_id, category_id, asset_id, description, flow_type,
            source_type, amount, amount_is_estimate, frequency, interval_count,
            start_date, end_date, liability_id, debt_id, insurance_policy_id
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
    """, (
        user_id, values["account_id"], values.get("category_id"), values.get("asset_id"),
        values["description"], values["flow_type"], values["source_type"], values["amount"],
        values["amount_is_estimate"], values["frequency"], values["interval_count"],
        values["start_date"], values.get("end_date"), values.get("liability_id"),
        values.get("debt_id"), values.get("insurance_policy_id"),
    ))


@router.put("/{schedule_id}")
def update_schedule(schedule_id: str, payload: ScheduleUpdate, user_id: str = Depends(get_current_user_id)):
    current = _load_schedule(schedule_id, user_id)
    if not current:
        raise HTTPException(status_code=404, detail="Scheduled cash flow not found.")
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return current
    merged = {**current, **updates}
    try:
        validated = ScheduleFields(**{key: merged[key] for key in ScheduleFields.model_fields})
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    values = validated.model_dump()
    values["description"] = values["description"].strip()
    if not values["description"]:
        raise HTTPException(status_code=422, detail="Enter a name for this scheduled cash flow.")
    values["flow_type"] = values["flow_type"].upper()
    values["source_type"] = values["source_type"].upper()
    values["frequency"] = values["frequency"].upper()
    _validate_related_records(values, user_id, require_active_account=False)

    updates = {**updates, "description": values["description"], "flow_type": values["flow_type"],
               "source_type": values["source_type"], "frequency": values["frequency"]}
    fields = [key for key in updates if key in ScheduleUpdate.model_fields]
    assignments = ", ".join(f"{key} = %s" for key in fields)
    return fetch_one(f"""
        UPDATE scheduled_cashflows SET {assignments}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s AND user_id = %s RETURNING *
    """, (*[updates[key] for key in fields], schedule_id, user_id))


@router.delete("/{schedule_id}")
def delete_schedule(schedule_id: str, user_id: str = Depends(get_current_user_id)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM scheduled_cashflows WHERE id = %s AND user_id = %s RETURNING id",
                (schedule_id, user_id),
            )
            deleted = cur.fetchone()
    if not deleted:
        raise HTTPException(status_code=404, detail="Scheduled cash flow not found.")
    return {"success": True}


@router.post("/{schedule_id}/occurrences/{occurrence_date}/complete")
def complete_occurrence(
    schedule_id: str,
    occurrence_date: datetime.date,
    payload: CompleteOccurrence,
    user_id: str = Depends(get_current_user_id),
):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM scheduled_cashflows WHERE id = %s AND user_id = %s FOR UPDATE",
                (schedule_id, user_id),
            )
            schedule = cur.fetchone()
            if not schedule:
                raise HTTPException(status_code=404, detail="Scheduled cash flow not found.")
            if not _is_occurrence(schedule, occurrence_date):
                raise HTTPException(status_code=422, detail="That date is not part of this recurrence schedule.")
            cur.execute("""
                SELECT id FROM transactions
                WHERE user_id = %s AND scheduled_cashflow_id = %s AND scheduled_occurrence_date = %s
            """, (user_id, schedule_id, occurrence_date))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="This occurrence has already been recorded.")

            if payload.transaction_id:
                cur.execute(
                    "SELECT * FROM transactions WHERE id = %s AND user_id = %s FOR UPDATE",
                    (payload.transaction_id, user_id),
                )
                transaction = cur.fetchone()
                if not transaction:
                    raise HTTPException(status_code=404, detail="The selected transaction was not found.")
                if transaction["type"] != schedule["flow_type"]:
                    raise HTTPException(status_code=422, detail="The transaction type does not match this scheduled item.")
                if transaction.get("scheduled_cashflow_id"):
                    raise HTTPException(status_code=409, detail="This transaction is already linked to a scheduled item.")
                paid_date = transaction["date"]
                cur.execute("""
                    UPDATE transactions
                    SET scheduled_cashflow_id = %s, scheduled_occurrence_date = %s
                    WHERE id = %s AND user_id = %s
                """, (schedule_id, occurrence_date, payload.transaction_id, user_id))
                transaction_id = transaction["id"]
            else:
                paid_date = payload.actual_date or occurrence_date
                if paid_date > _today():
                    raise HTTPException(status_code=422, detail="A future date cannot be recorded as already paid or received.")
                actual_amount = payload.actual_amount or schedule["amount"]
                cur.execute("""
                    INSERT INTO transactions (
                        user_id, account_id, category_id, type, amount, date,
                        description, scheduled_cashflow_id, scheduled_occurrence_date
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    user_id, schedule["account_id"], schedule["category_id"], schedule["flow_type"],
                    actual_amount, paid_date, schedule["description"], schedule_id, occurrence_date,
                ))
                transaction_id = cur.fetchone()["id"]
                balance_delta = actual_amount if schedule["flow_type"] == "INCOME" else -actual_amount
                cur.execute("""
                    UPDATE accounts SET balance = balance + %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s AND user_id = %s
                """, (balance_delta, schedule["account_id"], user_id))

            if schedule.get("insurance_policy_id"):
                recurrence_index = _occurrence_index_on_or_before(schedule, occurrence_date)
                while _occurrence_at(schedule, recurrence_index) < occurrence_date:
                    recurrence_index += 1
                next_payment_date = _occurrence_at(schedule, recurrence_index + 1)
                if schedule.get("end_date") and next_payment_date > schedule["end_date"]:
                    next_payment_date = None
                cur.execute("""
                    UPDATE insurance_policies
                    SET last_payment_date = %s, next_payment_date = %s,
                        payment_status = 'PAID', updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s AND user_id = %s
                """, (paid_date, next_payment_date, schedule["insurance_policy_id"], user_id))

    return {
        "success": True,
        "schedule_id": schedule_id,
        "occurrence_date": occurrence_date,
        "transaction_id": transaction_id,
        "message": "Existing transaction linked." if payload.transaction_id else "Transaction recorded.",
    }

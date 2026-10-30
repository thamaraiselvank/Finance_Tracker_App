import io
import logging
import re
import datetime
from numbers import Real
from typing import Dict, Any, Optional
import pandas as pd

MAX_STATEMENT_ROWS = 5000
MAX_OCR_PAGES = 20
OCR_PAGE_TIMEOUT_SECONDS = 15
logger = logging.getLogger(__name__)


def clean_amount(val: Any) -> float:
    """Sanitizes monetary string or number into a clean float."""
    if val is None or pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip()
    cleaned = re.sub(r'(?i)\b(?:INR|RS\.?|CR|DR)\b', '', val_str)
    cleaned = re.sub(r'[₹$\s,]', '', cleaned)
    if cleaned.startswith('(') and cleaned.endswith(')'):
        cleaned = '-' + cleaned[1:-1]
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def parse_date_string(val: Any) -> datetime.date:
    """Parses various date formats gracefully."""
    if isinstance(val, (datetime.datetime, datetime.date)):
        return val.date() if isinstance(val, datetime.datetime) else val
    if val is None or pd.isna(val):
        return datetime.date.today()
    val_str = str(val).strip()
    try:
        dt = pd.to_datetime(val_str, dayfirst=True, errors='raise')
        return dt.date()
    except Exception:
        return datetime.date.today()


def parse_time_string(val: Any) -> Optional[str]:
    if val is None or pd.isna(val):
        return None
    val_str = str(val).strip()
    try:
        dt = pd.to_datetime(val_str, format='mixed', errors='raise')
        return dt.strftime('%H:%M:%S')
    except Exception:
        return None


def normalize_header(value: Any) -> str:
    return re.sub(r'[^a-z0-9]+', ' ', str(value).lower()).strip()


def match_column(columns: list, aliases: list[str]) -> Optional[Any]:
    normalized_map = {
        normalized: col
        for col in columns
        if (normalized := normalize_header(col))
    }
    for alias in aliases:
        target = normalize_header(alias)
        if target in normalized_map:
            return normalized_map[target]

    for alias in aliases:
        target = normalize_header(alias)
        for key, original in normalized_map.items():
            if key == target or key.startswith(target) or target.startswith(key):
                return original
    return None


def detect_column_mappings(df: pd.DataFrame) -> Dict[str, Optional[str]]:
    """Detects the important columns for imported bank or statement files."""
    columns = list(df.columns)
    mapping = {
        "date": match_column(columns, ["Date", "date", "transaction date", "txn date", "tran date", "value date", "value dt", "posting date", "date time", "transaction datetime"]),
        "time": match_column(columns, ["Time", "time", "transaction time", "txn time", "posted time"]),
        "description": match_column(columns, ["Note", "Notes", "note", "notes", "Description", "description", "narration", "transaction remarks", "transaction details", "txn details", "particulars", "remarks", "details", "memo", "payee", "merchant"]),
        "amount": match_column(columns, ["Amount", "amount", "INR", "transaction amount", "txn amount", "net amount", "total", "debit credit amount", "amount inr"]),
        "debit": match_column(columns, ["Debit", "debit", "withdrawal", "withdrawals", "dr", "expense amount", "debit amount"]),
        "credit": match_column(columns, ["Credit", "credit", "deposit", "deposits", "cr", "income amount", "credit amount"]),
        "balance": match_column(columns, ["Closing Balance", "Available Balance", "Running Balance", "Balance"]),
        "category": match_column(columns, ["Category", "category", "category name", "tag", "classification", "type of transaction"]),
        "subcategory": match_column(columns, ["Subcategory", "Sub Category", "subcategory", "sub category", "sub category name", "sub category name", "bucket", "label"]),
        "type": match_column(columns, ["Income/Expense", "Income Expense", "income expense", "income/expense", "Type", "type", "txn type", "entry type", "transaction type", "dr cr", "debit credit"]),
        "account": match_column(columns, ["Account", "account", "account name", "bank account", "cash", "wallet"]),
    }
    return mapping


def coerce_transaction_type(value: Any) -> Optional[str]:
    if value is None or pd.isna(value):
        return None
    normalized = str(value).strip().upper()
    if not normalized:
        return None
    if normalized in {"INCOME", "CREDIT", "CR", "CREDITED", "DEPOSIT", "RECEIVED"}:
        return "INCOME"
    if normalized in {"EXPENSE", "DEBIT", "DR", "DEBITED", "WITHDRAWAL", "PAID", "SPENT", "PAYMENT", "OUTFLOW"}:
        return "EXPENSE"
    if "INCOME" in normalized or "CREDIT" in normalized or "DEPOSIT" in normalized or "CR" == normalized:
        return "INCOME"
    if "EXPENSE" in normalized or "DEBIT" in normalized or "WITHDRAWAL" in normalized or "DR" == normalized:
        return "EXPENSE"
    return None


def _parse_import_date(value: Any, *, excel_serial: bool = False) -> Optional[datetime.date]:
    if value is None or pd.isna(value) or not str(value).strip():
        return None
    if excel_serial and isinstance(value, Real) and not isinstance(value, bool):
        if 0 <= value <= 2958465:
            parsed = pd.to_datetime(
                value, unit="D", origin="1899-12-30", errors="coerce"
            )
            return None if pd.isna(parsed) else parsed.date()
    parsed = pd.to_datetime(value, dayfirst=True, errors="coerce")
    return None if pd.isna(parsed) else parsed.date()


def _reconcile_balance_directions(records: list[Dict[str, Any]]) -> None:
    previous_balance = None
    for record in records:
        raw_data = record.get("raw_data") or {}
        balance_value = raw_data.get("balance")
        current_balance = clean_amount(balance_value) if balance_value not in (None, "") else None
        amount = record.get("amount", 0)
        transaction_type = record.get("type")
        if current_balance is not None and previous_balance is not None and amount > 0:
            balance_delta = round(current_balance - previous_balance, 2)
            matches_amount = abs(abs(balance_delta) - amount) <= max(0.02, amount * 0.001)
            if matches_amount:
                balance_type = "INCOME" if balance_delta > 0 else "EXPENSE"
                if transaction_type is None:
                    record["type"] = balance_type
                elif transaction_type != balance_type:
                    record["needs_review"] = True
            else:
                record["needs_review"] = True
        if current_balance is not None:
            previous_balance = current_balance


def _is_duplicate_statement_record(
    record: Dict[str, Any],
    candidate: Dict[str, Any],
) -> bool:
    if any(
        record.get(key) != candidate.get(key)
        for key in ("date", "type", "amount")
    ):
        return False

    record_balance = (record.get("raw_data") or {}).get("balance")
    candidate_balance = (candidate.get("raw_data") or {}).get("balance")
    if record_balance not in (None, "") and candidate_balance not in (None, ""):
        return clean_amount(record_balance) == clean_amount(candidate_balance)

    return normalize_header(record.get("description", "")) == normalize_header(
        candidate.get("description", "")
    )


def _excel_header_values(row: pd.Series) -> list[str]:
    headers = []
    seen = {}
    for index, value in enumerate(row):
        header = str(value).strip() if not pd.isna(value) else ""
        if not header:
            header = f"Unnamed: {index}"
        occurrence = seen.get(header, 0)
        seen[header] = occurrence + 1
        headers.append(f"{header}.{occurrence}" if occurrence else header)
    return headers


def _read_excel_statement(file_bytes: bytes) -> pd.DataFrame:
    rows = pd.read_excel(io.BytesIO(file_bytes), header=None)
    if rows.empty:
        return rows

    header_index = None
    header_values = None
    for index, row in rows.head(100).iterrows():
        candidate_headers = _excel_header_values(row)
        mapping = detect_column_mappings(pd.DataFrame(columns=candidate_headers))
        if (
            mapping["date"]
            and mapping["description"]
            and (mapping["amount"] or mapping["debit"] or mapping["credit"])
        ):
            header_index = index
            header_values = candidate_headers
            break

    if header_index is None or header_values is None:
        raise ValueError(
            "Could not find a transaction table header. Include date, description, "
            "and amount or debit/credit columns."
        )

    statement = rows.loc[rows.index > header_index].copy()
    statement.columns = header_values
    return statement


def parse_statement_file(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Reads uploaded CSV or XLSX bytes, detects columns, and returns parsed transaction rows."""
    try:
        is_excel = filename.lower().endswith(('.xlsx', '.xls'))
        if is_excel:
            df = _read_excel_statement(file_bytes)
        else:
            try:
                df = pd.read_csv(io.BytesIO(file_bytes))
            except Exception:
                df = pd.read_csv(io.BytesIO(file_bytes), sep=';')

        df = df.dropna(how='all')
        column_mapping = detect_column_mappings(df)
        raw_headers = list(df.columns)

        parsed_records = []
        for idx, row in df.iterrows():
            date_col = column_mapping.get('date')
            time_col = column_mapping.get('time')
            amount_col = column_mapping.get('amount')
            debit_col = column_mapping.get('debit')
            credit_col = column_mapping.get('credit')
            category_col = column_mapping.get('category')
            subcategory_col = column_mapping.get('subcategory')
            type_col = column_mapping.get('type')
            description_col = column_mapping.get('description')
            balance_col = column_mapping.get('balance')

            explicit_type = None
            if type_col and type_col in row and not pd.isna(row[type_col]):
                explicit_type = coerce_transaction_type(row[type_col])
            explicit_type_unrecognized = bool(
                type_col
                and type_col in row
                and not pd.isna(row[type_col])
                and str(row[type_col]).strip()
                and explicit_type is None
            )

            date_raw = row[date_col] if date_col and date_col in row else None
            time_raw = row[time_col] if time_col and time_col in row else None

            if isinstance(date_raw, str) and ' ' in date_raw and not time_raw:
                date_part, time_part = date_raw.split(' ', 1)
                date_raw = date_part
                time_raw = time_part
            
            row_date = _parse_import_date(date_raw, excel_serial=is_excel)
            row_time = parse_time_string(time_raw) if time_raw else None
            if row_time is None and isinstance(date_raw, str) and re.search(r'\d{1,2}:\d{2}(:\d{2})?', date_raw):
                candidate = re.findall(r'(\d{1,2}:\d{2}(?::\d{2})?)', date_raw)
                if candidate:
                    row_time = candidate[0]

            raw_amount = 0.0
            tx_type = explicit_type
            needs_review = row_date is None or explicit_type_unrecognized
            debit_amount = clean_amount(row[debit_col]) if debit_col and debit_col in row else 0
            credit_amount = clean_amount(row[credit_col]) if credit_col and credit_col in row else 0

            if debit_amount > 0 and credit_amount <= 0:
                raw_amount = debit_amount
                tx_type = explicit_type or 'EXPENSE'
                if explicit_type and explicit_type != 'EXPENSE':
                    needs_review = True
            elif credit_amount > 0 and debit_amount <= 0:
                raw_amount = credit_amount
                tx_type = explicit_type or 'INCOME'
                if explicit_type and explicit_type != 'INCOME':
                    needs_review = True
            elif debit_amount > 0 and credit_amount > 0:
                needs_review = True
            elif amount_col and amount_col in row and not pd.isna(row[amount_col]):
                amount_marker = str(row[amount_col]).strip().upper()
                raw_amount = clean_amount(row[amount_col])
                if raw_amount < 0:
                    raw_amount = abs(raw_amount)
                    if not explicit_type:
                        tx_type = 'EXPENSE'
                    elif explicit_type != 'EXPENSE':
                        needs_review = True
                elif not explicit_type and re.search(r'\bCR(?:EDIT)?\b', amount_marker):
                    tx_type = 'INCOME'
                elif not explicit_type and re.search(r'\bDR(?:EBIT)?\b', amount_marker):
                    tx_type = 'EXPENSE'
                elif explicit_type:
                    tx_type = explicit_type
                else:
                    tx_type = None
                    needs_review = True

            if raw_amount <= 0:
                if not (debit_amount > 0 and credit_amount > 0):
                    continue

            category_guess = None
            if category_col and category_col in row and not pd.isna(row[category_col]):
                category_guess = str(row[category_col]).strip()

            subcategory_guess = None
            if subcategory_col and subcategory_col in row and not pd.isna(row[subcategory_col]):
                subcategory_guess = str(row[subcategory_col]).strip()

            description_value = None
            if description_col and description_col in row and not pd.isna(row[description_col]):
                description_raw = str(row[description_col]).strip()
                if description_raw:
                    description_value = description_raw

            if description_value is None:
                if category_guess and subcategory_guess and category_guess.lower() != subcategory_guess.lower():
                    description_value = f"{category_guess} | {subcategory_guess}"
                elif category_guess:
                    description_value = category_guess
                elif subcategory_guess:
                    description_value = subcategory_guess
                else:
                    description_value = ""
                    needs_review = True

            if not description_value.strip():
                needs_review = True

            record = {
                'row_index': idx,
                'date': row_date.isoformat() if row_date else None,
                'time': row_time,
                'description': description_value,
                'amount': round(raw_amount, 2),
                'type': tx_type,
                'category': category_guess,
                'subcategory': subcategory_guess,
                'needs_review': needs_review,
                'raw_data': {str(k): (None if pd.isna(v) else str(v)) for k, v in row.items()}
            }
            if balance_col and balance_col in row and not pd.isna(row[balance_col]):
                record['raw_data']['balance'] = row[balance_col]

            parsed_records.append(record)

        _reconcile_balance_directions(parsed_records)
        if len(parsed_records) > MAX_STATEMENT_ROWS:
            return {
                "success": False,
                "error": f"This statement contains more than {MAX_STATEMENT_ROWS} transactions. Please split it into smaller files.",
                "filename": filename,
            }

        return {
            'success': True,
            'filename': filename,
            'total_rows_found': len(df),
            'parsed_rows_count': len(parsed_records),
            'detected_mappings': column_mapping,
            'available_columns': raw_headers,
            'preview': parsed_records
        }

    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to parse file: {str(e)}',
            'filename': filename
        }


def _suggest_statement_category(description: str, transaction_type: str) -> str:
    normalized = description.casefold()
    if transaction_type == "INCOME":
        if any(word in normalized for word in ("salary", "payroll", "wages")):
            return "Salary"
        if any(word in normalized for word in ("interest", "dividend", "investment")):
            return "Investments & Returns"
        if "rent" in normalized:
            return "Rental Income"
        return "Other Income"

    keyword_categories = [
        (("rent", "housing", "maintenance"), "Housing & Rent"),
        (("grocery", "groceries", "supermarket", "bigbasket", "zepto", "swiggy", "zomato"), "Food & Groceries"),
        (("electricity", "water bill", "gas bill", "broadband", "mobile recharge", "telephone"), "Utilities & Bills"),
        (("petrol", "fuel", "uber", "ola cab", "rapido", "metro"), "Transportation & Fuel"),
        (("pharmacy", "medical", "hospital", "clinic", "doctor"), "Healthcare & Medical"),
        (("amazon", "flipkart", "shopping"), "Shopping & Lifestyle"),
        (("netflix", "spotify", "movie", "cinema"), "Entertainment & Leisure"),
        (("insurance", "premium"), "Insurance Premiums"),
        (("emi", "loan repayment", "loan payment"), "Loan EMI & Debt Payoff"),
        (("tuition", "course fee", "education"), "Education & Courses"),
    ]
    for keywords, category in keyword_categories:
        if any(keyword in normalized for keyword in keywords):
            return category
    return "Other Expenses"


def _group_ocr_words(data: Dict[str, Any]) -> list[list[Dict[str, Any]]]:
    words = []
    for index, text in enumerate(data.get("text", [])):
        text = str(text).strip()
        if not text:
            continue
        try:
            confidence = float(data["conf"][index])
        except (ValueError, TypeError):
            confidence = -1
        left = int(data["left"][index])
        words.append({
            "text": text,
            "left": left,
            "center": left + int(data["width"][index]) / 2,
            "top": int(data["top"][index]),
            "confidence": confidence,
        })

    lines = []
    for word in sorted(words, key=lambda item: (item["top"], item["left"])):
        if not lines or word["top"] - lines[-1]["top"] > 10:
            lines.append({"top": word["top"], "words": [word]})
        else:
            lines[-1]["words"].append(word)

    grouped_lines = [line["words"] for line in lines]
    for line_words in grouped_lines:
        line_words.sort(key=lambda word: word["left"])
    return grouped_lines


def _ocr_header_columns(words: list[Dict[str, Any]]) -> Dict[str, float]:
    roles = {
        "date": {"date", "txn", "transaction", "transactiondate"},
        "value_date": {"valuedt", "valuedate"},
        "description": {
            "particular", "particulars", "narration", "description", "details",
            "remarks", "merchant", "payee", "transactionparticulars",
            "transactionnarration", "transactiondetails",
        },
        "reference": {
            "ref", "reference", "cheque", "chequeno", "chq", "chqno",
            "refno", "chequeref", "chequerefno", "chqrefno",
        },
        "debit": {"debit", "withdrawal", "withdrawals", "dr", "debitamount"},
        "credit": {"credit", "deposit", "deposits", "cr", "creditamount"},
        "amount": {"amount", "transactionamount", "txnamount"},
        "balance": {"balance", "closingbalance", "runningbalance", "availablebalance"},
    }
    positions = {}
    for word in words:
        normalized = normalize_header(word["text"]).replace(" ", "")
        for role, labels in roles.items():
            if normalized in labels or (
                role == "debit" and normalized.startswith("withdrawal")
            ) or (
                role == "credit" and normalized.startswith("deposit")
            ) or (
                role == "balance" and normalized.endswith("balance")
            ):
                positions.setdefault(role, []).append(word["center"])
                break

    return {
        role: sum(values) / len(values)
        for role, values in positions.items()
    }


def _find_ocr_statement_header(
    lines: list[list[Dict[str, Any]]],
) -> tuple[Optional[int], Dict[str, float]]:
    for index in range(min(12, len(lines))):
        for window_size in range(1, 5):
            window_end = min(index + window_size, len(lines))
            window_words = [
                word for line_words in lines[index:window_end]
                for word in line_words
            ]
            columns = _ocr_header_columns(window_words)
            if (
                "date" in columns
                and "description" in columns
                and any(key in columns for key in ("debit", "credit", "amount"))
            ):
                return window_end - 1, columns
    return None, {}


def _ocr_cell_text(
    words: list[Dict[str, Any]],
    role: str,
    columns: Dict[str, float],
) -> str:
    ordered_columns = sorted(columns.items(), key=lambda item: item[1])
    role_index = next(
        (index for index, (column_role, _) in enumerate(ordered_columns) if column_role == role),
        None,
    )
    if role_index is None:
        return ""
    center = ordered_columns[role_index][1]
    left_boundary = (
        (ordered_columns[role_index - 1][1] + center) / 2
        if role_index > 0 else float("-inf")
    )
    right_boundary = (
        (center + ordered_columns[role_index + 1][1]) / 2
        if role_index + 1 < len(ordered_columns) else float("inf")
    )
    return " ".join(
        word["text"] for word in words
        if left_boundary <= word["center"] < right_boundary
    ).strip()


def _ocr_cell_amount(value: str) -> Optional[float]:
    cleaned = re.sub(r"(?i)\b(?:INR|RS\.?)\b", "", value)
    cleaned = cleaned.replace("₹", "").replace(",", "").replace(" ", "")
    if not cleaned or cleaned in {"-", "—"}:
        return 0.0
    if not re.fullmatch(r"\(?-?\d+(?:\.\d{1,2})?\)?", cleaned):
        return None
    amount = clean_amount(cleaned)
    return amount


def _parse_ocr_statement_data(
    data: Dict[str, Any],
    inherited_columns: Optional[Dict[str, float]] = None,
) -> list[Dict[str, Any]]:
    lines = _group_ocr_words(data)
    header_end_index, detected_columns = _find_ocr_statement_header(lines)
    columns = detected_columns or inherited_columns or {}
    if not columns:
        return []
    if header_end_index is None:
        header_end_index = -1

    parsed_records = []
    date_pattern = re.compile(
        r"(?<!\d)(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|"
        r"\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})(?!\d)"
    )
    body_lines = list(enumerate(
        lines[header_end_index + 1:], start=header_end_index + 1
    ))
    date_anchors = []
    for line_number, line_words in body_lines:
        date_text = _ocr_cell_text(line_words, "date", columns)
        date_match = date_pattern.search(date_text)
        if date_match:
            date_anchors.append({
                "row_index": line_number,
                "date": date_match.group(0),
                "top": line_words[0]["top"],
                "lines": [],
            })

    transaction_groups = []
    if date_anchors:
        transaction_groups = [
            {key: value for key, value in anchor.items() if key != "top"}
            for anchor in date_anchors
        ]
        nearest_anchor = 0
        for _, line_words in body_lines:
            description = _ocr_cell_text(line_words, "description", columns)
            has_date = bool(date_pattern.search(_ocr_cell_text(line_words, "date", columns)))
            line_top = line_words[0]["top"]
            has_transaction_amount = any(
                _ocr_cell_text(line_words, role, columns).strip()
                for role in ("debit", "credit", "amount")
                if role in columns
            )
            if (
                re.search(r"\bopening\s+balance\b", description, re.IGNORECASE)
                and not has_date
                and not has_transaction_amount
            ):
                if line_top < date_anchors[0]["top"]:
                    transaction_groups[0]["lines"] = []
                continue
            while (
                nearest_anchor + 1 < len(date_anchors)
                and abs(line_top - date_anchors[nearest_anchor + 1]["top"])
                < abs(line_top - date_anchors[nearest_anchor]["top"])
            ):
                nearest_anchor += 1
            transaction_groups[nearest_anchor]["lines"].append(line_words)
    else:
        prefix_lines = []
        active_group = None
        for line_number, line_words in body_lines:
            description = _ocr_cell_text(line_words, "description", columns)
            has_transaction_amount = any(
                _ocr_cell_text(line_words, role, columns).strip()
                for role in ("debit", "credit", "amount")
                if role in columns
            )
            if (
                re.search(r"\bopening\s+balance\b", description, re.IGNORECASE)
                and not has_transaction_amount
            ):
                prefix_lines = []
                continue
            if has_transaction_amount and (description or prefix_lines):
                active_group = {
                    "row_index": line_number,
                    "date": None,
                    "lines": prefix_lines + [line_words],
                }
                transaction_groups.append(active_group)
                prefix_lines = []
            elif active_group is not None:
                active_group["lines"].append(line_words)
            elif active_group is None:
                prefix_lines.append(line_words)

    parsed_records = []
    for transaction in transaction_groups:
        row_words = [
            word for line_words in transaction["lines"] for word in line_words
        ]
        row_date = _parse_import_date(transaction.get("date"))

        description = _ocr_cell_text(row_words, "description", columns)
        description = re.sub(r"\s+", " ", description).strip(" :-|")
        if not description:
            continue

        debit_text = _ocr_cell_text(row_words, "debit", columns)
        credit_text = _ocr_cell_text(row_words, "credit", columns)
        amount_text = _ocr_cell_text(row_words, "amount", columns)
        balance_text = _ocr_cell_text(row_words, "balance", columns)
        debit_amount = _ocr_cell_amount(debit_text) if "debit" in columns else 0
        credit_amount = _ocr_cell_amount(credit_text) if "credit" in columns else 0
        generic_amount = _ocr_cell_amount(amount_text) if amount_text else 0
        balance = _ocr_cell_amount(balance_text) if balance_text else None

        transaction_type = None
        amount = 0.0
        if isinstance(debit_amount, float) and debit_amount > 0 and credit_amount == 0:
            transaction_type, amount = "EXPENSE", debit_amount
        elif isinstance(credit_amount, float) and credit_amount > 0 and debit_amount == 0:
            transaction_type, amount = "INCOME", credit_amount
        elif isinstance(generic_amount, float) and generic_amount != 0:
            amount = abs(generic_amount)
            if generic_amount < 0:
                transaction_type = "EXPENSE"
        elif isinstance(debit_amount, float) and isinstance(credit_amount, float):
            amount = debit_amount + credit_amount
            if amount > 0:
                transaction_type = None

        confidences = [
            word["confidence"] for word in row_words
            if word["confidence"] >= 0
        ]
        low_confidence = not confidences or sum(confidences) / len(confidences) < 65
        reference_like_description = bool(
            re.fullmatch(r"[A-Za-z0-9/-]{10,}", description)
        )
        needs_review = (
            row_date is None
            or transaction_type is None
            or amount <= 0
            or low_confidence
            or reference_like_description
        )
        record = {
            "row_index": transaction["row_index"],
            "date": row_date.isoformat() if row_date else None,
            "time": None,
            "description": description[:255],
            "amount": round(amount, 2),
            "type": transaction_type,
            "category": (
                _suggest_statement_category(description, transaction_type)
                if transaction_type else None
            ),
            "subcategory": None,
            "needs_review": needs_review,
            "raw_data": {
                "ocr_line": " ".join(word["text"] for word in row_words),
                "balance": balance,
            },
        }
        parsed_records.append(record)

    _reconcile_balance_directions(parsed_records)
    return parsed_records


def parse_pdf_statement_file(
    file_bytes: bytes,
    filename: str,
    password: Optional[str] = None,
    *,
    use_gemini: bool = False,
) -> Dict[str, Any]:
    """Extracts transaction tables from text-based PDF statements."""
    gemini_fallback_reason = None
    if use_gemini:
        try:
            from app.services.pdf_statement_ai import parse_pdf_with_gemini

            return parse_pdf_with_gemini(file_bytes, filename, password)
        except Exception as exc:
            # Preserve the existing local parser as fallback for all AI errors.
            logger.warning("Gemini PDF extraction failed (%s): %s", type(exc).__name__, exc)
            gemini_fallback_reason = str(exc)

    import pdfplumber
    from pdfminer.pdfdocument import PDFPasswordIncorrect
    import pytesseract

    parsed_records = []
    total_rows_found = 0
    ocr_page_count = 0
    ocr_text_samples = []
    detected_bank = None
    bank_names = (
        "State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank",
        "Kotak Mahindra Bank", "Punjab National Bank", "Bank of Baroda",
        "Canara Bank", "Union Bank of India", "IDFC FIRST Bank",
    )

    try:
        with pdfplumber.open(io.BytesIO(file_bytes), password=password or "") as pdf:
            if len(pdf.pages) > 200:
                return {
                    "success": False,
                    "error": "This PDF has more than 200 pages. Please split it into smaller statements.",
                    "filename": filename,
                }

            first_page_text = "\n".join(
                (page.extract_text() or "") for page in pdf.pages[:2]
            ).casefold()
            detected_bank = next(
                (bank for bank in bank_names if bank.casefold() in first_page_text),
                None,
            )

            ocr_columns = {}
            for page_index, page in enumerate(pdf.pages):
                page_records = []
                needs_ocr = page_index == 0
                page_had_table_rows = False
                for table in page.extract_tables() or []:
                    rows = [
                        ["" if cell is None else str(cell).strip() for cell in row]
                        for row in table
                    ]
                    header_index = None
                    for index, row in enumerate(rows[:12]):
                        mapping = detect_column_mappings(pd.DataFrame(columns=row))
                        if (
                            mapping["date"]
                            and mapping["description"]
                            and (mapping["amount"] or mapping["debit"] or mapping["credit"])
                        ):
                            header_index = index
                            break
                    if header_index is None:
                        continue

                    headers = rows[header_index]
                    data_rows = [
                        row[:len(headers)] + [""] * max(0, len(headers) - len(row))
                        for row in rows[header_index + 1:]
                        if any(cell.strip() for cell in row)
                    ]
                    if not data_rows:
                        continue

                    page_had_table_rows = True
                    total_rows_found += len(data_rows)
                    frame = pd.DataFrame(data_rows, columns=headers)
                    csv_bytes = frame.to_csv(index=False).encode("utf-8")
                    result = parse_statement_file(csv_bytes, "statement.csv")
                    if result.get("success"):
                        table_records = result["preview"]
                        page_records.extend(table_records)
                        needs_ocr = needs_ocr or len(table_records) < len(data_rows)
                    else:
                        needs_ocr = True

                if needs_ocr or not page_records:
                    if ocr_page_count >= MAX_OCR_PAGES:
                        return {
                            "success": False,
                            "error": (
                                f"This statement needs OCR on more than {MAX_OCR_PAGES} pages. "
                                "Please split it into smaller files."
                            ),
                            "filename": filename,
                        }
                    ocr_page_count += 1
                    image = page.to_image(resolution=200).original
                    ocr_data = pytesseract.image_to_data(
                        image,
                        output_type=pytesseract.Output.DICT,
                        config="--psm 6",
                        timeout=OCR_PAGE_TIMEOUT_SECONDS,
                    )
                    if len(ocr_text_samples) < 2:
                        ocr_text_samples.append(" ".join(ocr_data.get("text", [])))
                    ocr_lines = _group_ocr_words(ocr_data)
                    _, detected_columns = _find_ocr_statement_header(ocr_lines)
                    if detected_columns:
                        ocr_columns = detected_columns
                    ocr_records = _parse_ocr_statement_data(ocr_data, ocr_columns)
                    if page_records:
                        for candidate in ocr_records:
                            if not any(
                                _is_duplicate_statement_record(candidate, existing)
                                for existing in page_records
                            ):
                                page_records.append(candidate)
                    else:
                        page_records = ocr_records
                    if not page_had_table_rows:
                        total_rows_found += len(ocr_records)

                parsed_records.extend(page_records)

            if detected_bank is None:
                ocr_header_text = "\n".join(ocr_text_samples).casefold()
                detected_bank = next(
                    (bank for bank in bank_names if bank.casefold() in ocr_header_text),
                    None,
                )

        if len(parsed_records) > MAX_STATEMENT_ROWS:
            return {
                "success": False,
                "error": f"This statement contains more than {MAX_STATEMENT_ROWS} transactions. Please split it into smaller files.",
                "filename": filename,
            }
        if not parsed_records:
            return {
                "success": False,
                "error": (
                    "No transactions could be extracted from the statement table. Check that "
                        "the scanned table has recognizable date, description, and debit/credit "
                        "or amount headers. Bank layouts and scan quality vary; try a clearer "
                        "scan or export the statement as CSV/Excel."
                ),
                "filename": filename,
            }

        for record in parsed_records:
            if not record.get("category") and record.get("type") in {"INCOME", "EXPENSE"}:
                record["category"] = _suggest_statement_category(
                    record["description"], record["type"]
                )

        result = {
            "success": True,
            "filename": filename,
            "detected_bank": detected_bank,
            "total_rows_found": total_rows_found,
            "parsed_rows_count": len(parsed_records),
            "preview": parsed_records,
        }
        if use_gemini:
            for record in parsed_records:
                record["needs_review"] = True
            result["parser"] = "local_pdf_fallback"
            result["gemini_fallback_reason"] = gemini_fallback_reason or "Gemini returned no usable result."
            result["review_notice"] = "Local PDF extraction was used. Review each row before importing."
        return result
    except PDFPasswordIncorrect:
        return {
            "success": False,
            "error": "The PDF is password-protected or the password is incorrect. Enter the statement password and try again.",
            "filename": filename,
        }
    except pytesseract.pytesseract.TesseractNotFoundError:
        return {
            "success": False,
            "error": (
                "Local OCR is not installed on this server. Install Tesseract OCR "
                "with English language data, then try the PDF again."
            ),
            "filename": filename,
        }
    except Exception:
        return {
            "success": False,
            "error": "Could not read this PDF statement. It may be damaged or use an unsupported layout.",
            "filename": filename,
        }


def detect_stock_column_mappings(df: pd.DataFrame) -> Dict[str, Optional[str]]:
    columns = list(df.columns)
    return {
        "name": match_column(columns, [
            "Stock Name", "Company Name", "Scrip Name", "Instrument", "Trading Symbol",
            "Tradingsymbol", "Symbol", "Security Name", "Name"
        ]),
        "isin": match_column(columns, ["ISIN", "ISIN Code"]),
        "quantity": match_column(columns, [
            "Quantity", "Quantity Available", "Qty", "Holdings Quantity", "Units"
        ]),
        "buy_price": match_column(columns, [
            "Buy Average", "Average Buy Price", "Average Price", "Avg Price", "Buy Price", "Average Cost"
        ]),
        "invested_amount": match_column(columns, [
            "Buy Value", "Invested Amount", "Invested Value", "Total Buy Value", "Cost Value", "Average Cost Value"
        ]),
        "current_price": match_column(columns, [
            "Current Price", "LTP", "Last Price", "Market Price", "Closing Price", "Previous Closing Price", "CMP"
        ]),
        "current_value": match_column(columns, [
            "Current Value", "Market Value", "Present Value", "Valuation", "Total Value"
        ]),
        "purchase_date": match_column(columns, ["Purchase Date", "Buy Date", "Trade Date"]),
        "exchange": match_column(columns, ["Exchange", "Exchange Segment"]),
    }


def parse_stock_file(file_bytes: bytes, filename: str, broker: str = "OTHER") -> Dict[str, Any]:
    """Reads common broker holdings exports and returns asset holding rows."""
    try:
        if filename.lower().endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            try:
                df = pd.read_csv(io.BytesIO(file_bytes))
            except Exception:
                df = pd.read_csv(io.BytesIO(file_bytes), sep=';')

        df = df.dropna(how='all')
        mapping = detect_stock_column_mappings(df)
        raw_headers = list(df.columns)
        parsed_records = []

        for idx, row in df.iterrows():
            name_col = mapping.get("name")
            isin_col = mapping.get("isin")
            name = str(row[name_col]).strip() if name_col and name_col in row and not pd.isna(row[name_col]) else ""
            isin = str(row[isin_col]).strip() if isin_col and isin_col in row and not pd.isna(row[isin_col]) else ""
            if not name:
                name = isin or f"Imported holding #{idx + 1}"

            quantity = clean_amount(row[mapping["quantity"]]) if mapping.get("quantity") and not pd.isna(row[mapping["quantity"]]) else 1.0
            buy_price = clean_amount(row[mapping["buy_price"]]) if mapping.get("buy_price") and not pd.isna(row[mapping["buy_price"]]) else 0.0
            current_price = clean_amount(row[mapping["current_price"]]) if mapping.get("current_price") and not pd.isna(row[mapping["current_price"]]) else 0.0
            invested_amount = clean_amount(row[mapping["invested_amount"]]) if mapping.get("invested_amount") and not pd.isna(row[mapping["invested_amount"]]) else buy_price * quantity
            current_value = clean_amount(row[mapping["current_value"]]) if mapping.get("current_value") and not pd.isna(row[mapping["current_value"]]) else current_price * quantity

            if quantity <= 0 and invested_amount <= 0 and current_value <= 0:
                continue
            if not invested_amount and buy_price:
                invested_amount = buy_price * quantity
            if not current_value and current_price:
                current_value = current_price * quantity

            exchange_col = mapping.get("exchange")
            exchange = str(row[exchange_col]).strip() if exchange_col and exchange_col in row and not pd.isna(row[exchange_col]) else None
            purchase_date_col = mapping.get("purchase_date")
            purchase_date = parse_date_string(row[purchase_date_col]).isoformat() if purchase_date_col and purchase_date_col in row and not pd.isna(row[purchase_date_col]) else None

            parsed_records.append({
                "row_index": idx,
                "name": name,
                "asset_class": "EQUITY",
                "sub_type": "Stock",
                "quantity": round(quantity, 6),
                "buy_price": round(buy_price, 2),
                "invested_amount": round(invested_amount, 2),
                "current_price": round(current_price, 2),
                "current_value": round(current_value, 2),
                "purchase_date": purchase_date,
                "notes": f"Imported from {broker.title()}" + (f" ({exchange})" if exchange else ""),
                "meta_data": {"broker": broker, "isin": isin, "exchange": exchange, "raw_data": {str(k): (None if pd.isna(v) else str(v)) for k, v in row.items()}},
            })

        return {
            "success": True,
            "filename": filename,
            "broker": broker,
            "total_rows_found": len(df),
            "parsed_rows_count": len(parsed_records),
            "detected_mappings": mapping,
            "available_columns": raw_headers,
            "preview": parsed_records[:100],
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to parse stock file: {str(e)}", "filename": filename}


def _read_zerodha_sheet(raw_sheet: pd.DataFrame) -> Optional[pd.DataFrame]:
    """Find the table header in a Zerodha Console sheet and return its data."""
    header_aliases = {
        "isin", "quantity", "qty", "average price", "avg price", "current value",
        "invested value", "scheme name", "scheme", "symbol", "tradingsymbol", "instrument"
    }
    for row_index in range(min(len(raw_sheet), 100)):
        values = {normalize_header(value) for value in raw_sheet.iloc[row_index].tolist() if not pd.isna(value)}
        has_quantity = any(value == "quantity" or value.startswith("quantity ") or value == "qty" for value in values)
        has_price_or_value = any(
            value in {"average price", "avg price", "current value", "invested value", "previous closing price", "closing price"}
            for value in values
        )
        if len(values & header_aliases) >= 2 and has_quantity and has_price_or_value:
            headers = [str(value).strip() if not pd.isna(value) else f"column_{idx}" for idx, value in enumerate(raw_sheet.iloc[row_index])]
            sheet = raw_sheet.iloc[row_index + 1:].copy()
            sheet.columns = headers
            return sheet.dropna(how="all")
    return None


def parse_zerodha_holdings_file(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Extract Equity and Mutual Fund holdings from a Zerodha Console workbook."""
    try:
        sheets = pd.read_excel(io.BytesIO(file_bytes), sheet_name=None, header=None)
        parsed_records = []
        sheets_used = []
        seen_keys = set()

        recognized_sheet_count = 0
        for sheet_name, raw_sheet in sheets.items():
            normalized_sheet = normalize_header(sheet_name)
            sheet = _read_zerodha_sheet(raw_sheet)
            if sheet is None:
                continue

            has_mutual_label = normalized_sheet in {"mf", "mutual fund", "mutual funds", "mutualfunds"} or "mutual" in normalized_sheet or any(
                "mutual" in normalize_header(value)
                for value in raw_sheet.iloc[:5].fillna("").astype(str).values.flatten()
            )
            has_equity_label = "equity" in normalized_sheet or any(
                "equity" in normalize_header(value)
                for value in raw_sheet.iloc[:5].fillna("").astype(str).values.flatten()
            )
            asset_class = "MUTUAL_FUND" if has_mutual_label else "EQUITY"
            recognized_sheet_count += 1
            mapping = detect_stock_column_mappings(sheet)
            name_col = mapping.get("name") or match_column(list(sheet.columns), [
                "Scheme Name", "Scheme", "Fund Name", "Company", "Company Name", "Scrip", "Instrument Name"
            ])
            isin_col = mapping.get("isin")
            quantity_col = mapping.get("quantity")
            buy_price_col = mapping.get("buy_price") or match_column(list(sheet.columns), ["Average Price", "Avg Buy Price", "Average Cost"])
            invested_col = mapping.get("invested_amount") or match_column(list(sheet.columns), ["Invested Value", "Investment Value", "Cost Value"])
            current_price_col = mapping.get("current_price") or match_column(list(sheet.columns), ["Closing Price", "Current NAV", "NAV", "LTP"])
            current_value_col = mapping.get("current_value") or match_column(list(sheet.columns), ["Current Value", "Market Value", "Present Value"])

            for row_index, row in sheet.iterrows():
                name = str(row[name_col]).strip() if name_col and not pd.isna(row[name_col]) else ""
                isin = str(row[isin_col]).strip() if isin_col and not pd.isna(row[isin_col]) else ""
                if not name or name.lower() in {"total", "grand total", "nan"}:
                    continue

                quantity = clean_amount(row[quantity_col]) if quantity_col and not pd.isna(row[quantity_col]) else 1.0
                buy_price = clean_amount(row[buy_price_col]) if buy_price_col and not pd.isna(row[buy_price_col]) else 0.0
                invested_amount = clean_amount(row[invested_col]) if invested_col and not pd.isna(row[invested_col]) else buy_price * quantity
                current_price = clean_amount(row[current_price_col]) if current_price_col and not pd.isna(row[current_price_col]) else 0.0
                current_value = clean_amount(row[current_value_col]) if current_value_col and not pd.isna(row[current_value_col]) else current_price * quantity
                if not current_value and current_price and quantity:
                    current_value = current_price * quantity
                if not invested_amount and buy_price and quantity:
                    invested_amount = buy_price * quantity
                if quantity <= 0 and invested_amount <= 0 and current_value <= 0:
                    continue

                key = isin or name.lower()
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                parsed_records.append({
                    "row_index": int(row_index),
                    "name": name,
                    "asset_class": asset_class,
                    "sub_type": "Mutual Fund" if asset_class == "MUTUAL_FUND" else "Stock",
                    "quantity": round(quantity, 6),
                    "buy_price": round(buy_price, 2),
                    "invested_amount": round(invested_amount, 2),
                    "current_price": round(current_price, 2),
                    "current_value": round(current_value, 2),
                    "purchase_date": None,
                    "notes": "Imported from Zerodha Console",
                    "meta_data": {
                        "broker": "ZERODHA",
                        "isin": isin,
                        "source_sheet": sheet_name,
                        "raw_data": {str(k): (None if pd.isna(v) else str(v)) for k, v in row.items()},
                    },
                })
            sheets_used.append(sheet_name)

        if not parsed_records and recognized_sheet_count == 0:
            return {"success": False, "error": "No Equity or Mutual Fund holdings were found in the Zerodha workbook.", "filename": filename}
        if not parsed_records:
            return {"success": False, "error": "Zerodha sheets were found, but no holding rows contained quantity and value data.", "filename": filename}
        return {
            "success": True,
            "filename": filename,
            "broker": "ZERODHA",
            "sheets_used": sheets_used,
            "total_rows_found": len(parsed_records),
            "parsed_rows_count": len(parsed_records),
            "preview": parsed_records[:100],
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to parse Zerodha workbook: {str(e)}", "filename": filename}

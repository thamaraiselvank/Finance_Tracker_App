import io
import re
import datetime
from typing import Dict, Any, Optional
import pandas as pd


def clean_amount(val: Any) -> float:
    """Sanitizes monetary string or number into a clean float."""
    if val is None or pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip()
    cleaned = re.sub(r'[₹$\s,]', '', val_str)
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
    normalized_map = {normalize_header(col): col for col in columns}
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
        "date": match_column(columns, ["Date", "date", "transaction date", "txn date", "value date", "posting date", "date time", "transaction datetime"]),
        "time": match_column(columns, ["Time", "time", "transaction time", "txn time", "posted time"]),
        "description": match_column(columns, ["Note", "Notes", "note", "notes", "Description", "description", "narration", "particulars", "remarks", "details", "memo", "payee", "merchant"]),
        "amount": match_column(columns, ["Amount", "amount", "INR", "transaction amount", "txn amount", "value", "net amount", "total", "debit credit amount", "amount inr"]),
        "debit": match_column(columns, ["Debit", "debit", "withdrawal", "dr", "expense amount", "debit amount"]),
        "credit": match_column(columns, ["Credit", "credit", "deposit", "cr", "income amount", "credit amount"]),
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
    if normalized in {"INCOME", "CREDIT", "CR", "CREDITED", "DEPOSIT", "DEBITED", "RECEIVED"}:
        return "INCOME"
    if normalized in {"EXPENSE", "DEBIT", "DR", "WITHDRAWAL", "PAID", "SPENT", "PAYMENT", "OUTFLOW"}:
        return "EXPENSE"
    if "INCOME" in normalized or "CREDIT" in normalized or "DEPOSIT" in normalized or "CR" == normalized:
        return "INCOME"
    if "EXPENSE" in normalized or "DEBIT" in normalized or "WITHDRAWAL" in normalized or "DR" == normalized:
        return "EXPENSE"
    return None


def parse_statement_file(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Reads uploaded CSV or XLSX bytes, detects columns, and returns parsed transaction rows."""
    try:
        if filename.lower().endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(file_bytes))
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

            explicit_type = None
            if type_col and type_col in row and not pd.isna(row[type_col]):
                explicit_type = coerce_transaction_type(row[type_col])

            date_raw = row[date_col] if date_col and date_col in row else None
            time_raw = row[time_col] if time_col and time_col in row else None

            if isinstance(date_raw, str) and ' ' in date_raw and not time_raw:
                date_part, time_part = date_raw.split(' ', 1)
                date_raw = date_part
                time_raw = time_part
            
            row_date = parse_date_string(date_raw)
            row_time = parse_time_string(time_raw) if time_raw else None
            if row_time is None and isinstance(date_raw, str) and re.search(r'\d{1,2}:\d{2}(:\d{2})?', date_raw):
                candidate = re.findall(r'(\d{1,2}:\d{2}(?::\d{2})?)', date_raw)
                if candidate:
                    row_time = candidate[0]

            raw_amount = 0.0
            tx_type = explicit_type or 'EXPENSE'

            if debit_col and debit_col in row and not pd.isna(row[debit_col]) and clean_amount(row[debit_col]) > 0:
                raw_amount = clean_amount(row[debit_col])
                if not explicit_type:
                    tx_type = 'EXPENSE'
            elif credit_col and credit_col in row and not pd.isna(row[credit_col]) and clean_amount(row[credit_col]) > 0:
                raw_amount = clean_amount(row[credit_col])
                if not explicit_type:
                    tx_type = 'INCOME'
            elif amount_col and amount_col in row and not pd.isna(row[amount_col]):
                raw_amount = clean_amount(row[amount_col])
                if raw_amount < 0:
                    raw_amount = abs(raw_amount)
                    if not explicit_type:
                        tx_type = 'EXPENSE'
                elif explicit_type:
                    tx_type = explicit_type
                elif tx_type == 'EXPENSE':
                    tx_type = 'EXPENSE'
                else:
                    tx_type = tx_type or 'EXPENSE'

            if raw_amount <= 0:
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
                    description_value = f'Transaction #{idx + 1}'

            record = {
                'row_index': idx,
                'date': row_date.isoformat(),
                'time': row_time,
                'description': description_value,
                'amount': round(raw_amount, 2),
                'type': tx_type,
                'category': category_guess,
                'subcategory': subcategory_guess,
                'raw_data': {str(k): (None if pd.isna(v) else str(v)) for k, v in row.items()}
            }

            parsed_records.append(record)

        return {
            'success': True,
            'filename': filename,
            'total_rows_found': len(df),
            'parsed_rows_count': len(parsed_records),
            'detected_mappings': column_mapping,
            'available_columns': raw_headers,
            'preview': parsed_records[:100]
        }

    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to parse file: {str(e)}',
            'filename': filename
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

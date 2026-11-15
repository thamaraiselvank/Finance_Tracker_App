"""Ruleset-driven Indian individual income-tax estimate for Tax Year 2026-27."""
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.schemas.tax_setting import IndiaTaxEstimateInput

RULES_PATH = Path(__file__).resolve().parent.parent / "data" / "india_tax_rules.json"


@lru_cache(maxsize=1)
def _load_rulesets() -> dict[str, dict[str, Any]]:
    rulesets: dict[str, dict[str, Any]] = {}
    for path in RULES_PATH.parent.glob("india_tax_rules*.json"):
        with path.open("r", encoding="utf-8") as file:
            rules = json.load(file)
        year = str(rules.get("tax_year", ""))
        if not year or year in rulesets:
            raise ValueError(f"Tax rules file has a missing or duplicate tax year: {path.name}")
        individual = rules.get("individual")
        if not isinstance(individual, dict) or not isinstance(individual.get("regimes"), dict):
            raise ValueError(f"Tax rules file is missing individual regime data: {path.name}")
        # Accept both the current nested rules format and earlier files that
        # placed shared rates at the document root.
        if not isinstance(individual.get("common"), dict) and isinstance(rules.get("common"), dict):
            individual["common"] = rules["common"]
        if not isinstance(individual.get("common"), dict):
            raise ValueError(f"Tax rules file is missing individual common rules: {path.name}")
        if not {"new", "old"}.issubset(individual["regimes"]):
            raise ValueError(f"Tax rules file must define both old and new regimes: {path.name}")
        rulesets[year] = rules
    if not rulesets:
        raise ValueError("No India tax rulesets are configured.")
    return rulesets


def available_india_tax_years() -> list[str]:
    return sorted(_load_rulesets(), reverse=True)


def get_india_tax_rules(tax_year: str | None = None) -> dict[str, Any]:
    rulesets = _load_rulesets()
    selected_year = tax_year or available_india_tax_years()[0]
    if selected_year not in rulesets:
        raise ValueError(f"No India tax rules are available for Tax Year {selected_year}.")
    return rulesets[selected_year]


def _slab_tax(income: float, slabs: list[dict[str, Any]]) -> float:
    tax = 0.0
    for slab in slabs:
        lower = float(slab["from"])
        upper = slab["to"]
        taxable_in_band = max(0.0, income - lower)
        if upper is not None:
            taxable_in_band = min(taxable_in_band, float(upper) - lower)
        tax += taxable_in_band * float(slab["rate"])
        if upper is None or income <= float(upper):
            break
    return tax


def _old_regime_slabs(rules: dict[str, Any], age: int, resident: bool) -> list[dict[str, Any]]:
    bands = rules["individual"]["regimes"]["old"]["slabs_by_age"]
    if resident and age >= 80:
        return bands["age_80_plus"]
    if resident and age >= 60:
        return bands["age_60_to_79"]
    return bands["under_60"]


def _common_rules(rules: dict[str, Any]) -> dict[str, Any]:
    """Return shared tax rates across supported ruleset layouts."""
    individual = rules.get("individual") or {}
    common = individual.get("common") or rules.get("common")
    if not isinstance(common, dict):
        raise ValueError(f"Tax year {rules.get('tax_year', 'unknown')} is missing shared tax rules.")
    return common


def _tax_after_surcharge(
    taxable_income: float,
    slab_tax: float,
    rules: dict[str, Any],
    regime: str,
    slabs: list[dict[str, Any]],
) -> tuple[float, float, float]:
    common = _common_rules(rules)
    thresholds = [float(value) for value in common["surcharge_thresholds"]]
    rates = common[f"surcharge_rates_{regime}"]
    rate_index = sum(taxable_income > threshold for threshold in thresholds)
    surcharge_rate = float(rates[min(rate_index, len(rates) - 1)])
    tax_with_surcharge = slab_tax * (1 + surcharge_rate)

    # Marginal relief at each surcharge threshold prevents tax plus surcharge
    # from rising by more than the income above that threshold.
    for index, threshold in enumerate(thresholds):
        if taxable_income <= threshold:
            break
        prior_rate = float(rates[min(index, len(rates) - 1)])
        threshold_tax = _slab_tax(threshold, slabs)
        relief_cap = threshold_tax * (1 + prior_rate) + taxable_income - threshold
        tax_with_surcharge = min(tax_with_surcharge, relief_cap)

    return tax_with_surcharge, surcharge_rate, max(0.0, tax_with_surcharge - slab_tax)


def _estimate_regime(
    values: IndiaTaxEstimateInput,
    rules: dict[str, Any],
    regime: str,
    gross_income: float,
) -> dict[str, Any]:
    regime_rules = rules["individual"]["regimes"][regime]
    resident = values.residential_status == "resident"
    if regime == "new":
        slabs = regime_rules["income_tax_slabs"]
        standard_deduction = min(values.salary_income, float(regime_rules["standard_deduction"]["amount"]))
        eligible_deductions = min(
            values.employer_nps_deduction_new,
            values.salary_income * float(regime_rules["employer_nps_deduction_max_pct_of_salary"]),
        )
        deduction_details = {"standard_deduction": standard_deduction, "employer_nps": eligible_deductions}
    else:
        slabs = _old_regime_slabs(rules, values.age, resident)
        deductions = regime_rules["deductions"]
        standard_deduction = min(values.salary_income, float(deductions["standard_deduction"]["amount"]))
        deduction_details = {
            "standard_deduction": standard_deduction,
            "section_80c_other": min(
                values.section_80c,
                max(float(deductions["section_80c_limit"]) - values.employee_pf_contribution, 0.0),
            ),
            "employee_pf_contribution": min(values.employee_pf_contribution, float(deductions["section_80c_limit"])),
            "section_80d": min(values.section_80d, float(deductions["section_80d_limit"])),
            "home_loan_interest_self_occupied": min(
                values.home_loan_interest_self_occupied,
                float(deductions["home_loan_interest_self_occupied_limit"]),
            ),
            "other_old_regime_deductions": values.other_old_regime_deductions,
        }
        eligible_deductions = sum(deduction_details.values()) - standard_deduction

    total_deductions = standard_deduction + eligible_deductions
    taxable_income = max(0.0, gross_income - total_deductions)
    slab_tax = _slab_tax(taxable_income, slabs)
    rebate = 0.0
    relief_note = None
    rebate_rules = regime_rules["rebate_87a"]
    if resident and taxable_income <= float(rebate_rules["taxable_income_limit"]):
        rebate = min(slab_tax, float(rebate_rules["maximum_amount"]))
    slab_tax_after_rebate = max(0.0, slab_tax - rebate)

    if regime == "new" and resident and taxable_income > float(rebate_rules["taxable_income_limit"]):
        threshold = float(rebate_rules["taxable_income_limit"])
        if slab_tax_after_rebate > taxable_income - threshold:
            slab_tax_after_rebate = max(0.0, taxable_income - threshold)
            relief_note = "Marginal relief applied at the section 87A threshold."

    # Use the slab amount after rebate/relief for surcharge calculation.
    tax_with_surcharge, surcharge_rate, surcharge_amount = _tax_after_surcharge(
        taxable_income, slab_tax_after_rebate, rules, regime, slabs
    )
    cess = tax_with_surcharge * float(_common_rules(rules)["health_education_cess_rate"])
    total_before_rounding = tax_with_surcharge + cess
    total_tax = int((total_before_rounding + 5) // 10) * 10
    balance = round(total_tax - values.tax_already_paid, 2)

    return {
        "regime": regime,
        "taxable_income": round(taxable_income, 2),
        "deductions": {key: round(value, 2) for key, value in deduction_details.items()},
        "total_deductions": round(total_deductions, 2),
        "slab_tax_before_rebate": round(slab_tax, 2),
        "rebate_87a": round(rebate, 2),
        "surcharge_rate": surcharge_rate,
        "surcharge": round(surcharge_amount, 2),
        "cess": round(cess, 2),
        "estimated_tax": total_tax,
        "tax_already_paid": round(values.tax_already_paid, 2),
        "estimated_balance": balance,
        "estimated_refund": max(0.0, -balance),
        "effective_rate_pct": round(total_tax / gross_income * 100, 2) if gross_income else 0.0,
        "notes": [relief_note] if relief_note else [],
    }


def estimate_india_tax(values: IndiaTaxEstimateInput) -> dict[str, Any]:
    rules = get_india_tax_rules(values.tax_year)
    gross_income = sum((
        values.salary_income, values.interest_income, values.dividend_income,
        values.rental_taxable_income, values.business_taxable_income,
        values.other_regular_income,
    ))
    results = {
        regime: _estimate_regime(values, rules, regime, gross_income)
        for regime in ("new", "old")
    }
    preferred = min(results.values(), key=lambda result: result["estimated_tax"])
    return {
        "country": "IN",
        "tax_year": values.tax_year,
        "legislation": rules["legislation"],
        "ruleset_version": rules["version"],
        "gross_regular_income": round(gross_income, 2),
        "residential_status": values.residential_status,
        "age": values.age,
        "results": results,
        "lower_estimate_regime": preferred["regime"],
        "estimated_difference": round(abs(results["new"]["estimated_tax"] - results["old"]["estimated_tax"]), 2),
        "sources": rules["sources"],
    }

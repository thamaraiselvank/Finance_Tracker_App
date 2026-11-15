# Indian tax estimator: sourced rules and implementation plan

## Rules reviewed on 11 November 2026

For income earned from 1 April 2026 through 31 March 2027, use **Tax Year 2026–27** and the Income-tax Act, 2025. The Income Tax Department says the 2025 Act took effect on 1 April 2026, calls the period a Tax Year, and carries forward the new regime as the default under section 202. Earlier income (including FY 2025–26, filed as AY 2026–27) remains under the 1961 Act. A tax page must make the year and law explicit so estimates for those periods do not get mixed.

The Finance Bill 2026 specifies the Tax Year 2026–27 section 202 default-regime slabs: ₹0–4 lakh (0%), ₹4–8 lakh (5%), ₹8–12 lakh (10%), ₹12–16 lakh (15%), ₹16–20 lakh (20%), ₹20–24 lakh (25%), then 30%. It also specifies the rates for people who opt out. The Income-tax Act, 2025 section 19 lists a salary standard deduction of up to ₹75,000 in the section 202(1) regime and ₹50,000 otherwise. The current Income Tax Department AY 2026–27 guide lists the new-regime resident-individual rebate up to ₹60,000 when taxable income is at most ₹12 lakh, and 4% health and education cess; verify the corresponding Tax Year provision and special-income limits before production calculations. Its old-regime age-based slabs and rebate of up to ₹12,500 for resident individuals up to ₹5 lakh taxable income are the comparison for AY 2026–27, not a reason to use the old Act for TY 2026–27.

Official sources:

- [Income and Tax Estimator User Manual](https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/income-and-tax-estimator-um) — explicitly covers the Act selection, TY 2026–27, salary, house property, capital gains, business/professional income, other sources, deductions, TDS/TCS, advance tax, and comparison of regimes.
- [Objective and scope of the New Act](https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/objective-and-scope-new-act) — effective date, Tax Year naming, old-year transition, and default new regime.
- [Finance Bill 2026 memorandum](https://www.indiabudget.gov.in/doc/memo.pdf) — the actual Tax Year 2026–27 section 202 and opt-out slab rates.
- [Income-tax Act, 2025, section 19](https://wmstatic-prd.incometaxindia.gov.in/web/guest/w/section-19-199) — regime-specific standard deduction from salary.
- [Salaried Individuals for AY 2026–27](https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1) — published slab, rebate, cess, surcharge and age-band information. It is an AY 2026–27 page under the prior Act, so treat it as a cross-check rather than silently applying it to TY 2026–27.

The versioned active snapshot is in `backend/app/data/india_tax_rules.json`. Slabs and policy values are loaded by the backend from this data file, not embedded in page components. The current estimator is deliberately limited to ordinary slab-rate income and the deductions it names in the UI; it does not implement capital-gains schedules or all eligibility rules.

## Recommended product flow

1. Show the tax year, governing Act, selected regime, and last ruleset update date. Ask the user to confirm India/residency, age band, salary or pension, and whether they have business/professional income. Do not infer tax residency from currency.
2. Ask for annual salary (with salary components needed for exemptions), rental/house-property details, business or professional income, capital gains by type, dividends, bank/FD interest, other income, and agricultural income where applicable. Imported transactions and account balances are clues only; ask the user to confirm taxable annual amounts.
3. Ask separately for deductions and exemptions that may differ by regime: eligible savings/investments, health insurance, home-loan interest, rent/HRA, NPS, donations, education-loan interest, and employer contributions. Include TDS/TCS, advance tax, and self-assessment tax to estimate balance due/refund.
4. Compute each regime with deterministic backend code and a ruleset selected by tax year. Compare estimated tax, effective rate, and amount payable/refundable, showing each income head and deduction contribution. Give a source link and an assumptions/missing-information list.
5. Treat capital gains and other special-rate income as separate calculators, then combine according to statute. Add rebate eligibility, surcharge caps/marginal relief, cess, rounding, age, residence, and regime-specific eligibility only after rule cases are sourced and reviewed.

Debts, insurance, and health records should prefill candidate questions, not automatically create tax deductions. For example, a home loan can prompt for eligible interest/principal and whether it is a self-occupied or let-out property; a health policy can prompt for taxpayer/dependent ages and premium amounts. A debt balance or premium alone is not a deduction. The app should never describe a calculated estimate as a tax filing or guaranteed liability.

## Current implementation and next scope

The app now exposes an India Tax page in desktop and mobile navigation. It accepts user-entered annual salary/pension, interest, dividends, net taxable rental/business amounts, other regular income, selected deductions, residence, age, and tax already paid. The authenticated `/tax/rules` endpoint returns the active snapshot and all configured tax years; `/tax/profile` summarizes candidate amounts from the user's profile, Money transactions, Insurance policies, home-loan records and Wealth holdings; `/tax/estimate` calculates old/new comparisons for the selected year. Suggestions remain editable and explain their source; click-through buttons open the relevant app module. Draft inputs persist only in the current browser.

The estimate includes slab tax, applicable 87A rebate, basic surcharge and threshold marginal relief, 4% cess, and round-off to ₹10. The app does not verify deduction eligibility. Section 80D limits depend on age and covered people; home-property, business, capital gains, agricultural income, special-rate income, AMT, non-resident source rules, and filing-form eligibility require more input and calculations. The result is for planning and should not be used as a filed return.

Auto-suggestions are deliberately conservative: profile monthly income is annualized and labeled; Money income is tax-year-to-date, and only relevant category/subcategory records are suggested; a recorded health premium or active policy is a candidate deduction, not proof of eligibility. Rental receipts and business receipts are shown for review rather than added as taxable income. Home-loan EMI does not reveal interest paid. Existing stock/fund assets hold a current quantity and quote but no dividend-event ledger or historical units, so dividend income comes only from recorded Money transactions. Automatic market-dividend tracking requires a corporate-action data source plus transaction-level holding history; without those, using current holdings to reconstruct past dividends would be unreliable.

## Flexible rule loading

Keep immutable JSON snapshots per country and tax year with `tax_year`, `effective_from`, `legislation`, `version`, source URLs, verified-at date, applicability conditions, and rule values. The current endpoint supports the active snapshot only. Before adding a new year, verify its rule file, add year selection, and save calculation snapshots if the product needs reproducible history. Updating JSON alone should never be treated as legal review.

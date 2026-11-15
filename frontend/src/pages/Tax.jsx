import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, BookOpenText, Calculator, CircleAlert, ExternalLink, Info, IndianRupee, Scale } from 'lucide-react';
import api from '../services/api';

const STORAGE_KEY = 'finverse_india_tax_draft';
const emptyDraft = {
  tax_year: '2026-27',
  age: 30,
  residential_status: 'resident',
  salary_income: '',
  interest_income: '',
  dividend_income: '',
  rental_taxable_income: '',
  business_taxable_income: '',
  other_regular_income: '',
  section_80c: '',
  employee_pf_contribution: '',
  section_80d: '',
  home_loan_interest_self_occupied: '',
  other_old_regime_deductions: '',
  employer_nps_deduction_new: '',
  tax_already_paid: '',
};

const incomeFields = [
  ['salary_income', 'Annual salary / pension income', 'Gross taxable salary for the year. The salary standard deduction is applied automatically.'],
  ['interest_income', 'Bank / FD interest', 'Enter annual taxable interest, not account balance.'],
  ['dividend_income', 'Dividend income', 'Enter the annual taxable amount.'],
  ['rental_taxable_income', 'Taxable house-property income', 'Enter the amount after applying house-property rules.'],
  ['business_taxable_income', 'Taxable business / professional income', 'Enter taxable profit after business expenses; this estimate uses ordinary slabs.'],
  ['other_regular_income', 'Other regular taxable income', 'For example, family pension or other income taxed at slab rates.'],
];

const deductionFields = [
  ['section_80c', 'Other eligible Section 80C amount (excluding PF below)', 'Capped together with employee PF at ₹1.5 lakh in the old-regime estimate.'],
  ['employee_pf_contribution', 'Employee PF contribution for this year', 'In this estimate, employee EPF counts within the old-regime Section 80C limit. It is not added again to salary, and does not reduce taxable income in the new regime. Use your payslip / PF statement amount.'],
  ['section_80d', 'Eligible health-insurance amount', 'Enter the claimable amount; this estimate caps it at ₹1 lakh. Age and covered-person limits can reduce eligibility.'],
  ['home_loan_interest_self_occupied', 'Self-occupied home-loan interest', 'Old-regime estimate caps this at ₹2 lakh.'],
  ['other_old_regime_deductions', 'Other eligible old-regime deductions', 'Enter only deductions you have checked as eligible.'],
  ['employer_nps_deduction_new', 'Employer NPS contribution (new regime)', 'Enter eligible employer contribution; capped at 14% of salary in this estimate.'],
];

const breakdownSource = {
  salary_income: 'salary', interest_income: 'interest', dividend_income: 'dividends',
  other_regular_income: 'other_income', section_80c: 'deduction_80c', section_80d: 'deduction_80d',
};

const amount = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(value || 0));

function MoneyField({ name, label, help, value, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      <span className="relative mt-1 block">
        <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input name={name} type="number" min="0" step="1000" inputMode="decimal" value={value} onChange={onChange} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      </span>
      {help && <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">{help}</span>}
    </label>
  );
}

export default function Tax({ user, hideAmounts, setActiveTab }) {
  const [draft, setDraft] = useState(() => {
    try {
      return { ...emptyDraft, ...JSON.parse(localStorage.getItem(`${STORAGE_KEY}:${user?.id || 'user'}`) || '{}') };
    } catch {
      return emptyDraft;
    }
  });
  const [rules, setRules] = useState(null);
  const [sources, setSources] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rulesError, setRulesError] = useState('');
  const [estimateError, setEstimateError] = useState('');
  const [prefilled, setPrefilled] = useState(false);
  const resultPanelRef = useRef(null);

  const fetchProfileSources = async (taxYear, autofill = true) => {
    try {
      const { data } = await api.get('/tax/profile', { params: { tax_year: taxYear } });
      setSources(data);
      if (autofill) {
        setDraft((current) => {
          const next = { ...current };
          Object.entries(data.suggestions || {}).forEach(([field, suggestion]) => {
            if ((next[field] === '' || next[field] === null || next[field] === undefined) && Number(suggestion.value) > 0) {
              next[field] = String(suggestion.value);
            }
          });
          return next;
        });
      }
    } catch (error) {
      console.error('Could not load tax suggestions from your saved records:', error);
    }
  };

  useEffect(() => {
    api.get('/tax/rules')
      .then(({ data }) => {
        setRules(data);
        fetchProfileSources(draft.tax_year, true);
      })
      .catch(() => setRulesError('Could not load the active India tax rules. Please try again later.'));
  }, []);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}:${user?.id || 'user'}`, JSON.stringify(draft));
  }, [draft, user?.id]);

  const totalAnnualIncome = useMemo(() => incomeFields.reduce(
    (sum, [name]) => sum + Number(draft[name] || 0), 0,
  ), [draft]);

  const setField = (event) => setDraft((current) => ({ ...current, [event.target.name]: event.target.value }));

  const selectTaxYear = async (taxYear) => {
    setDraft((current) => ({ ...current, tax_year: taxYear }));
    setEstimate(null);
    setRulesError('');
    try {
      const { data } = await api.get('/tax/rules', { params: { tax_year: taxYear } });
      setRules(data);
      await fetchProfileSources(taxYear, true);
    } catch (error) {
      setRulesError(error.response?.data?.detail || `Rules for Tax Year ${taxYear} are not available.`);
    }
  };

  const prefillProfileIncome = () => {
    if (user?.currency !== 'INR') return;
    const monthly = Number(user?.monthly_income || 0);
    if (!monthly) return;
    setDraft((current) => ({ ...current, salary_income: String(Math.round(monthly * 12)) }));
    setPrefilled(true);
    setEstimate(null);
  };

  const applyAllSuggestions = () => {
    if (!sources?.suggestions) return;
    setDraft((current) => {
      const next = { ...current };
      Object.entries(sources.suggestions).forEach(([field, suggestion]) => {
        if (Number(suggestion.value) > 0) next[field] = String(suggestion.value);
      });
      return next;
    });
    setPrefilled(false);
  };

  const calculate = async (event) => {
    event.preventDefault();
    setEstimateError('');
    setLoading(true);
    try {
      const payload = Object.fromEntries(Object.entries(draft).map(([key, value]) => [
        key, key === 'tax_year' || key === 'residential_status' ? value : Number(value || 0),
      ]));
      const { data } = await api.post('/tax/estimate', payload);
      setEstimate(data);
      window.setTimeout(() => {
        resultPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        resultPanelRef.current?.focus({ preventScroll: true });
      }, 0);
    } catch (error) {
      setEstimateError(error.response?.data?.detail?.[0]?.msg || error.response?.data?.detail || 'Could not calculate an estimate. Check the amounts and try again.');
    } finally {
      setLoading(false);
    }
  };

  const displayAmount = (value) => hideAmounts ? '••••••' : amount(value);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><span className="rounded-xl bg-emerald-100 p-2 dark:bg-emerald-400/10"><Calculator className="h-5 w-5" /></span><span className="text-xs font-bold uppercase tracking-wider">India tax planner</span></div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Compare your tax regimes</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Estimate annual income tax under the old and new regimes using the current India ruleset. Enter annual taxable amounts and eligible deductions.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-right dark:border-slate-700 dark:bg-slate-900">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active rules</p>
          <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">{rules?.tax_year || 'Tax Year 2026–27'}</p>
          <p className="text-[10px] text-slate-500">{rules?.legislation || 'Income-tax Act, 2025'} · v{rules?.version || '2026.1'}</p>
        </div>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/[0.07] dark:text-amber-100">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-xs leading-relaxed"><b>Planning estimate only.</b> This compares ordinary slab-rate income and selected deductions. It does not calculate capital gains, special-rate income, agricultural-income aggregation, all house-property cases, AMT, or return eligibility. Confirm the details with the Income Tax Department or a tax professional before filing.</p>
      </div>

      {rulesError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{rulesError}</p>}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(390px,0.9fr)]">
        <form onSubmit={calculate} className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h2 className="font-bold text-slate-900 dark:text-white">Your tax profile</h2><p className="text-xs text-slate-500">The rules apply to India; account currency does not determine tax residency.</p></div>
              <button type="button" onClick={prefillProfileIncome} disabled={!user?.monthly_income || user?.currency !== 'INR'} className="text-right text-[10px] font-bold text-emerald-700 hover:underline disabled:opacity-40 dark:text-emerald-300">Prefill profile income</button>
            </div>
            {prefilled && <p className="mb-3 text-[10px] text-emerald-700 dark:text-emerald-300">Prefilled from monthly profile income × 12. Review and adjust the annual amount.</p>}
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block"><span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Tax year</span><select value={draft.tax_year} onChange={(event) => selectTaxYear(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">{(rules?.available_tax_years || [draft.tax_year]).map((year) => <option key={year} value={year}>Tax Year {year}</option>)}</select><span className="mt-1 block text-[10px] text-slate-500">Only years with a reviewed rules file are listed.</span></label>
              <label className="block"><span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Age in this tax year</span><input name="age" type="number" min="18" max="120" value={draft.age} onChange={setField} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>
              <label className="block"><span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Residential status</span><select name="residential_status" value={draft.residential_status} onChange={setField} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="resident">Resident individual</option><option value="non_resident">Non-resident individual</option></select><span className="mt-1 block text-[10px] text-slate-500">Choose based on tax rules, not where your account is held.</span></label>
            </div>
          </section>

          <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5 dark:border-sky-400/20 dark:bg-sky-400/[0.04]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-bold text-slate-900 dark:text-white">Suggestions from your records</h2><p className="mt-1 text-[10px] text-slate-500">{sources ? `From ${sources.period_start} through ${sources.as_of}. Values are editable.` : 'Looking for income, insurance and investment records…'}</p></div>
              <button type="button" onClick={applyAllSuggestions} disabled={!sources} className="rounded-lg border border-sky-300 px-3 py-1.5 text-[10px] font-bold text-sky-900 hover:bg-sky-100 disabled:opacity-40 dark:border-sky-400/30 dark:text-sky-200">Apply all suggestions</button>
            </div>
            {sources?.currency_warning && <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-[10px] text-amber-900 dark:bg-amber-300/10 dark:text-amber-200">{sources.currency_warning}</p>}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {sources && Object.entries(sources.suggestions || {}).map(([field, suggestion]) => (
                <div key={field} className="rounded-xl border border-sky-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold capitalize text-slate-700 dark:text-slate-200">{field.replaceAll('_', ' ')}</span><button type="button" onClick={() => setDraft((current) => ({ ...current, [field]: String(suggestion.value) }))} className="shrink-0 font-bold text-emerald-700 hover:underline dark:text-emerald-300">Use {displayAmount(suggestion.value)}</button></div>
                  <p className="mt-1 text-[9px] font-semibold text-slate-500">{suggestion.source} · {suggestion.period === 'tax-year-to-date' ? 'recorded year to date' : 'annualized estimate'}</p>
                  <p className="mt-1 text-[9px] leading-relaxed text-slate-500">{suggestion.note}</p>
                  {field === 'salary_income' && sources.salary_recorded_ytd > 0 && <p className="mt-1 text-[9px] text-slate-500">Salary transactions recorded so far: {displayAmount(sources.salary_recorded_ytd)}</p>}
                  {(sources.transaction_breakdown?.[breakdownSource[field]] || []).map((record) => <p key={`${record.category}-${record.subcategory}`} className="mt-1 text-[9px] text-slate-500">{record.category}{record.subcategory ? ` · ${record.subcategory}` : ''}: {displayAmount(record.amount)} ({record.count} entries)</p>)}
                  <button type="button" onClick={() => setActiveTab?.(field === 'section_80d' ? 'insurance' : 'money')} className="mt-1 text-[9px] font-bold text-sky-700 hover:underline dark:text-sky-300">Open {field === 'section_80d' ? 'Insurance' : 'Money'} ↗</button>
                </div>
              ))}
            </div>
            {sources?.unclassified_tax_sources && <div className="mt-3 rounded-xl bg-white p-3 text-[10px] dark:bg-slate-950"><p className="font-bold text-slate-700 dark:text-slate-200">Needs review before entering as taxable income</p><div className="mt-2 grid grid-cols-1 gap-1 text-slate-500 sm:grid-cols-3"><span>Rental receipts: {displayAmount(sources.unclassified_tax_sources.rental_gross_received)}</span><span>Business receipts: {displayAmount(sources.unclassified_tax_sources.business_gross_receipts)}</span><span>Capital-gain records: {displayAmount(sources.unclassified_tax_sources.capital_gain_related_transactions)}</span></div><p className="mt-2 text-[9px] leading-relaxed">{sources.unclassified_tax_sources.note}</p></div>}
            {sources?.data_gaps?.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-[10px] font-bold text-sky-900 dark:text-sky-200">Why some values need confirmation</summary><ul className="mt-2 list-inside list-disc space-y-1 text-[9px] text-slate-500">{sources.data_gaps.map((note) => <li key={note}>{note}</li>)}</ul></details>}
            {sources?.home_loans?.length > 0 && <div className="mt-3 rounded-xl bg-white p-3 text-[10px] dark:bg-slate-950"><div className="flex items-center justify-between gap-2"><p className="font-bold text-slate-700 dark:text-slate-200">Home loans found</p><button type="button" onClick={() => setActiveTab?.('debts')} className="font-bold text-sky-700 hover:underline dark:text-sky-300">Open Debts ↗</button></div>{sources.home_loans.map((loan, index) => <p key={`${loan.name}-${index}`} className="mt-1 text-slate-500">{loan.name}: EMI {displayAmount(loan.emi)} · {loan.interest_rate}% interest. EMI data does not show annual interest paid.</p>)}</div>}
            {sources?.health_policies?.length > 0 && <div className="mt-3 rounded-xl bg-white p-3 text-[10px] dark:bg-slate-950"><div className="flex items-center justify-between gap-2"><p className="font-bold text-slate-700 dark:text-slate-200">Health insurance records</p><button type="button" onClick={() => setActiveTab?.('insurance')} className="font-bold text-sky-700 hover:underline dark:text-sky-300">Open Insurance ↗</button></div>{sources.health_policies.map((policy, index) => <p key={`${policy.name}-${index}`} className="mt-1 text-slate-500">{policy.name}: recorded annual premium {displayAmount(policy.annual_premium)} · payment status {policy.payment_status || 'not recorded'}.</p>)}</div>}
            {sources?.investment_holdings?.length > 0 && <div className="mt-3 rounded-xl bg-white p-3 text-[10px] dark:bg-slate-950"><div className="flex items-center justify-between gap-2"><p className="font-bold text-slate-700 dark:text-slate-200">Equity / fund holdings found</p><button type="button" onClick={() => setActiveTab?.('wealth')} className="font-bold text-sky-700 hover:underline dark:text-sky-300">Open Wealth ↗</button></div>{sources.investment_holdings.slice(0, 6).map((holding, index) => <p key={`${holding.name}-${index}`} className="mt-1 text-slate-500">{holding.name}{holding.symbol ? ` (${holding.symbol})` : ' · ticker not recorded'} · quantity {holding.quantity}</p>)}<p className="mt-2 text-[9px] text-slate-500">The portfolio stores holdings and quotes, but has no dividend-event history or historical share balances. Only dividends recorded in Money are suggested above.</p></div>}
            <div className="mt-3 flex flex-wrap gap-2">
              {[['money', 'Open Money'], ['wealth', 'Open Wealth'], ['insurance', 'Open Insurance'], ['debts', 'Open Debts']].map(([tab, label]) => <button type="button" key={tab} onClick={() => setActiveTab?.(tab)} className="rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-[9px] font-bold text-slate-600 hover:border-sky-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{label} ↗</button>)}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="font-bold text-slate-900 dark:text-white">Annual taxable income</h2>
            <p className="mb-4 text-xs text-slate-500">Use annual figures for {sources?.period_start || '1 April 2026'} – {sources?.period_end || '31 March 2027'}. Enter net taxable rental and business income.</p>
            <div className="grid gap-4 sm:grid-cols-2">{incomeFields.map(([name, label, help]) => <MoneyField key={name} name={name} label={label} help={help} value={draft[name]} onChange={setField} />)}</div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-xs dark:bg-slate-900"><span className="font-semibold text-slate-600 dark:text-slate-300">Total entered income</span><span className="font-bold text-slate-900 dark:text-white">{displayAmount(totalAnnualIncome)}</span></div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="font-bold text-slate-900 dark:text-white">Deductions and tax paid</h2>
            <p className="mb-4 text-xs text-slate-500">Section 80C / 80D and home-loan interest apply to the old-regime estimate here. Enter claimable amounts, not policy values, loan balances, or account totals.</p>
            <div className="grid gap-4 sm:grid-cols-2">{deductionFields.map(([name, label, help]) => <MoneyField key={name} name={name} label={label} help={help} value={draft[name]} onChange={setField} />)}<MoneyField name="tax_already_paid" label="TDS, TCS and advance tax already paid" help="Used to estimate the remaining amount due or possible refund." value={draft.tax_already_paid} onChange={setField} /></div>
          </section>

          {estimateError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{Array.isArray(estimateError) ? estimateError.map((item) => item.msg).join(', ') : estimateError}</p>}
          <button type="submit" disabled={loading || !rules} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/10 transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-50"><Scale className="h-4 w-4" />{loading ? 'Calculating both regimes…' : 'Estimate both regimes'}</button>
          <p className="text-center text-[10px] text-slate-400">Your draft is saved in this browser. It is sent to Finverse only when you calculate.</p>
        </form>

        <section ref={resultPanelRef} tabIndex={-1} aria-label="Tax estimate results" className="space-y-4 scroll-mt-5 focus:outline-none xl:sticky xl:top-5">
          {!estimate ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-950">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"><IndianRupee className="h-6 w-6" /></div>
              <h2 className="mt-4 font-bold text-slate-900 dark:text-white">Your comparison will show here</h2>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">Add your annual income and any deductions you can claim, then calculate to see old and new regime estimates side by side.</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 p-5 text-white shadow-xl">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Comparison result</p><h2 className="mt-1 text-lg font-bold">{estimate.lower_estimate_regime === 'new' ? 'New' : 'Old'} regime is lower for these inputs</h2></div><BadgeCheck className="h-5 w-5 text-emerald-300" /></div>
                <p className="mt-3 text-sm text-emerald-100">Estimated difference: <b>{displayAmount(estimate.estimated_difference)}</b></p>
                <p className="mt-1 text-[10px] text-emerald-200/70">Tax Year {estimate.tax_year} · {estimate.legislation} · rules v{estimate.ruleset_version}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {['new', 'old'].map((key) => {
                  const result = estimate.results[key];
                  const isLower = key === estimate.lower_estimate_regime;
                  return (
                    <article key={key} className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950 ${isLower ? 'border-emerald-400 ring-1 ring-emerald-400/40' : 'border-slate-200 dark:border-slate-800'}`}>
                      <div className="flex items-center justify-between"><h3 className="font-bold capitalize text-slate-900 dark:text-white">{key} regime</h3>{isLower && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold uppercase text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">Lower estimate</span>}</div>
                      <p className="mt-3 text-[10px] uppercase tracking-wide text-slate-500">Estimated annual tax</p><p className="text-2xl font-black text-slate-900 dark:text-white">{displayAmount(result.estimated_tax)}</p>
                      <p className={`mt-1 text-xs font-semibold ${result.estimated_balance > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{result.estimated_balance > 0 ? `${displayAmount(result.estimated_balance)} estimated remaining` : `${displayAmount(result.estimated_refund)} estimated excess paid`}</p>
                      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-[11px] dark:border-slate-800">
                        <Row label="Taxable income" value={displayAmount(result.taxable_income)} />
                        <Row label="Total deductions" value={displayAmount(result.total_deductions)} />
                        <Row label="Slab tax before rebate" value={displayAmount(result.slab_tax_before_rebate)} />
                        <Row label="Section 87A rebate" value={`− ${displayAmount(result.rebate_87a)}`} />
                        <Row label={`Surcharge (${Math.round(result.surcharge_rate * 100)}%)`} value={displayAmount(result.surcharge)} />
                        <Row label="Health & education cess" value={displayAmount(result.cess)} />
                        <Row label="Effective rate" value={`${result.effective_rate_pct}%`} />
                      </div>
                      {!!Object.keys(result.deductions).length && <details className="mt-3"><summary className="cursor-pointer text-[10px] font-bold text-emerald-800 dark:text-emerald-300">Show deduction breakdown</summary><div className="mt-2 space-y-1.5">{Object.entries(result.deductions).map(([label, value]) => <Row key={label} label={label.replaceAll('_', ' ')} value={displayAmount(value)} />)}</div></details>}
                    </article>
                  );
                })}
              </div>
            </>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-2"><Info className="h-4 w-4 text-sky-600" /><h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">What this estimate includes</h3></div>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[10px] leading-relaxed text-slate-500"><li>Tax Year 2026–27 slab-rate income comparison, age/residency inputs, standard deduction, listed deductions, rebate, surcharge relief and cess.</li><li>Interest, dividends and entered taxable income are treated as ordinary slab-rate income.</li><li>Amounts are estimates from the figures entered; the app does not verify proof or eligibility.</li></ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-2 flex items-center gap-2"><BookOpenText className="h-4 w-4 text-violet-600" /><h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Official references</h3></div>
            {(rules?.sources || []).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 border-t border-slate-100 py-2 text-[10px] font-semibold text-emerald-800 hover:underline dark:border-slate-800 dark:text-emerald-300"><span>{source.title}</span><ExternalLink className="h-3 w-3 shrink-0" /></a>)}
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex items-start justify-between gap-3"><span className="capitalize text-slate-500">{label}</span><span className="shrink-0 font-semibold text-slate-800 dark:text-slate-200">{value}</span></div>;
}

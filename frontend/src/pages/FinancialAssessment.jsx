import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleAlert, ClipboardCheck, LoaderCircle, Sparkles } from 'lucide-react';
import api from '../services/api';
import useCurrency from '../utils/useCurrency';
import PageGuide from '../components/PageGuide';

const SECTIONS = [
  { title: 'Income & work', subtitle: 'Understand where money comes from and how predictable it is.' },
  { title: 'Spending & savings', subtitle: 'Estimate everyday costs and your accessible safety buffer.' },
  { title: 'Debt & commitments', subtitle: 'Ask about debt only when it applies.' },
  { title: 'Protection & planning', subtitle: 'Check health cover, people who depend on you, and planning confidence.' },
  { title: 'Investments & goals', subtitle: 'Understand your asset mix, market comfort, and next priority.' },
];

const INITIAL_ANSWERS = {
  income_sources: [], monthly_net_income: '', income_stability: '',
  essential_monthly_spending: '', month_end_pattern: '', liquid_savings: '',
  debt_status: '', debt_outstanding: '', monthly_debt_payment: '', debt_payment_pattern: '',
  upcoming_large_expense: '', unexpected_expense_plan: '', health_cover: '',
  has_dependents: null, term_cover: '', planning_confidence: '', investment_types: [],
  gold_share: 'not_applicable', market_reaction: '', goal_priority: '', goal_horizon: '',
};

const INCOME_SOURCES = [
  ['salary', 'Salary'], ['self_employed', 'Self-employed'], ['business', 'Business'],
  ['freelance', 'Freelance / gig'], ['investment', 'Interest / dividends'],
  ['rental', 'Rent'], ['pension', 'Pension'], ['other', 'Other'],
];
const INVESTMENT_TYPES = [
  ['cash_deposit', 'Cash / deposits'], ['stocks', 'Stocks'], ['mutual_funds', 'Mutual funds'],
  ['bonds', 'Bonds'], ['gold', 'Gold'], ['property', 'Property'],
  ['retirement', 'Retirement savings'], ['crypto', 'Crypto'], ['other', 'Other'],
];

function ChoiceGrid({ value, options, onChange, columns = 2 }) {
  return <div className={`grid gap-2 ${columns === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
    {options.map(([optionValue, label]) => (
      <button key={optionValue} type="button" onClick={() => onChange(optionValue)} className={`rounded-xl border px-3 py-2.5 text-left text-xs transition ${value === optionValue ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-900 ring-1 ring-emerald-500/30 dark:border-emerald-500 dark:bg-emerald-900/50 dark:text-emerald-100 dark:ring-emerald-500/40' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
        <span className="flex items-center gap-2">{value === optionValue ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <span className="h-3.5 w-3.5 rounded-full border border-slate-300" />}{label}</span>
      </button>
    ))}
  </div>;
}

function MultiChoice({ values = [], options, onChange }) {
  const toggle = (value) => onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    {options.map(([value, label]) => <button key={value} type="button" onClick={() => toggle(value)} className={`rounded-xl border px-3 py-2.5 text-left text-xs transition ${values.includes(value) ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-900 dark:border-emerald-500 dark:bg-emerald-900/50 dark:text-emerald-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
      <span className="flex items-center gap-2"><span className={`flex h-4 w-4 items-center justify-center rounded border ${values.includes(value) ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300'}`}>{values.includes(value) && <Check className="h-3 w-3" />}</span>{label}</span>
    </button>)}
  </div>;
}

function NumberAnswer({ value, onChange, currencySymbol, label }) {
  return <label className="block max-w-sm text-xs font-semibold text-slate-700">{label}
    <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:ring-2 focus-within:ring-emerald-500/30">
      <span className="text-slate-400">{currencySymbol}</span>
      <input type="number" min="0" max="1000000000" step="100" value={value} onChange={(event) => onChange(event.target.value)} className="w-full border-0 bg-transparent px-2 py-2.5 text-sm text-slate-900 outline-none" placeholder="Enter an estimate" />
    </div>
  </label>;
}

function scoreAnswers(answers) {
  const income = Number(answers.monthly_net_income || 0);
  const expense = Number(answers.essential_monthly_spending || 0);
  const savings = Number(answers.liquid_savings || 0);
  const surplusRatio = income > 0 ? (income - expense) / income : -1;
  let cashflow = surplusRatio < 0 ? 25 : surplusRatio === 0 ? 45 : surplusRatio < 0.1 ? 65 : surplusRatio < 0.2 ? 82 : 95;
  cashflow += ({ regular: 5, mostly_regular: 0, variable: -8, seasonal: -12 }[answers.income_stability] || 0);
  cashflow += ({ save_regularly: 8, save_sometimes: 0, break_even: -10, withdraw_or_borrow: -20 }[answers.month_end_pattern] || 0);
  const runway = expense > 0 ? savings / expense : 0;
  const liquidity = runway < 1 ? 25 : runway < 3 ? 45 : runway < 6 ? 70 : runway < 9 ? 90 : 100;
  let debt = 45;
  if (answers.debt_status === 'no') debt = answers.unexpected_expense_plan === 'savings' ? 95 : answers.unexpected_expense_plan === 'monthly_cashflow' ? 85 : 65;
  if (answers.debt_status === 'yes') {
    const ratio = income > 0 ? Number(answers.monthly_debt_payment || 0) / income : 1;
    const burden = ratio <= 0.2 ? 90 : ratio <= 0.35 ? 70 : ratio <= 0.5 ? 45 : 25;
    debt = (burden + ({ on_time: 100, sometimes_late: 60, missed_recently: 20 }[answers.debt_payment_pattern] || 45)) / 2;
  }
  const health = ({ both: 100, personal: 90, employer: 68, none: 25, not_sure: 45 }[answers.health_cover] || 45);
  const term = ({ adequate: 100, some: 65, none: 20, not_sure: 45, not_applicable: 45 }[answers.term_cover] || 45);
  const protection = answers.has_dependents ? (health + term) / 2 : health;
  let investments = answers.investment_types.length === 0 ? 55 : answers.investment_types.length === 1 ? 65 : answers.investment_types.length <= 3 ? 78 : 88;
  if (answers.gold_share === 'over_50') investments -= 20;
  else if (answers.gold_share === '26_to_50') investments -= 10;
  const goals = (answers.goal_horizon === 'not_sure' ? 55 : 75) + ({ confident: 10, somewhat: 0, need_help: -5, not_sure: -5 }[answers.planning_confidence] || 0);
  const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));
  const pillarScores = {
    'Cash flow': clamp(cashflow), 'Emergency savings': clamp(liquidity),
    'Debt & commitments': clamp(debt), Protection: clamp(protection),
    Investments: clamp(investments), 'Goals & planning': clamp(goals),
  };
  const weights = [0.2, 0.2, 0.15, 0.15, 0.15, 0.15];
  const score = clamp(Object.values(pillarScores).reduce((sum, value, index) => sum + value * weights[index], 0));
  const uncertain = [answers.income_stability === 'variable', answers.debt_status === 'not_sure', answers.health_cover === 'not_sure', answers.term_cover === 'not_sure', answers.gold_share === 'not_sure', answers.market_reaction === 'not_sure', answers.goal_horizon === 'not_sure'].filter(Boolean).length;
  return {
    score,
    rating: score >= 75 ? 'Strong foundation' : score >= 55 ? 'Building' : 'Needs attention',
    data_confidence: uncertain >= 4 ? 'low' : uncertain >= 2 ? 'medium' : 'high',
    pillar_scores: pillarScores,
  };
}

export default function FinancialAssessment({ setActiveTab, hideAmounts }) {
  const { currencySymbol, formatCurrency } = useCurrency();
  const [section, setSection] = useState(0);
  const [answers, setAnswers] = useState(INITIAL_ANSWERS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const patchAnswers = (changes) => {
    setAnswers((current) => ({ ...current, ...changes }));
    setResult(null);
    setError('');
  };

  const missing = useMemo(() => {
    const required = ['income_stability', 'month_end_pattern', 'debt_status', 'health_cover', 'planning_confidence', 'market_reaction', 'goal_priority', 'goal_horizon'];
    const gaps = required.filter((key) => !answers[key]);
    if (!answers.income_sources.length) gaps.push('income_sources');
    if (!answers.monthly_net_income && answers.monthly_net_income !== '0') gaps.push('monthly_net_income');
    if (!answers.essential_monthly_spending || Number(answers.essential_monthly_spending) <= 0) gaps.push('essential_monthly_spending');
    if (answers.liquid_savings === '') gaps.push('liquid_savings');
    if (!answers.debt_status) gaps.push('debt_status');
    if (answers.debt_status === 'yes' && (!answers.debt_outstanding || answers.monthly_debt_payment === '' || !answers.debt_payment_pattern)) gaps.push('debt_details');
    if (answers.debt_status === 'no' && (!answers.upcoming_large_expense || !answers.unexpected_expense_plan)) gaps.push('no_debt_details');
    if (answers.has_dependents === null) gaps.push('has_dependents');
    if (answers.has_dependents && !answers.term_cover) gaps.push('term_cover');
    if (answers.investment_types.includes('gold') && answers.gold_share === 'not_applicable') gaps.push('gold_share');
    return gaps;
  }, [answers]);

  const getRecommendations = async () => {
    if (missing.length) {
      setError('Please answer the remaining questions in each section. Choose “Not sure” where you don’t know.');
      return;
    }
    const normalized = {
      ...answers,
      monthly_net_income: Number(answers.monthly_net_income),
      essential_monthly_spending: Number(answers.essential_monthly_spending),
      liquid_savings: Number(answers.liquid_savings),
      debt_outstanding: answers.debt_status === 'yes' ? Number(answers.debt_outstanding) : null,
      monthly_debt_payment: answers.debt_status === 'yes' ? Number(answers.monthly_debt_payment) : null,
      debt_payment_pattern: answers.debt_status === 'yes' ? answers.debt_payment_pattern : null,
      upcoming_large_expense: answers.debt_status === 'no' ? answers.upcoming_large_expense : null,
      unexpected_expense_plan: answers.debt_status === 'no' ? answers.unexpected_expense_plan : null,
      has_dependents: Boolean(answers.has_dependents),
      term_cover: answers.has_dependents ? answers.term_cover : 'not_applicable',
      gold_share: answers.investment_types.includes('gold') ? answers.gold_share : 'not_applicable',
    };
    setResult(scoreAnswers(normalized));
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/ai/financial-assessment', { answers: normalized });
      setResult(data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'AI recommendations are temporarily unavailable. Your assessment score is shown below; please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  const toggleField = (field, value) => patchAnswers({
    [field]: answers[field].includes(value) ? answers[field].filter((item) => item !== value) : [...answers[field], value],
    ...(field === 'investment_types' && value === 'gold' && !answers[field].includes(value) ? { gold_share: 'not_sure' } : {}),
    ...(field === 'investment_types' && value === 'gold' && answers[field].includes(value) ? { gold_share: 'not_applicable' } : {}),
  });

  const goToTool = (tool) => {
    const tabs = { Money: 'money', Goals: 'goals', Debts: 'debts', Insurance: 'insurance', Wealth: 'wealth', Tax: 'tax', Learn: 'learn', Profile: 'profile' };
    if (tabs[tool]) setActiveTab?.(tabs[tool]);
  };

  const sectionFields = [
    <div className="space-y-5" key="income">
      <div><p className="mb-2 text-xs font-semibold text-slate-800">1. What are your income sources? <span className="font-normal text-slate-500">Choose all that apply.</span></p><MultiChoice values={answers.income_sources} options={INCOME_SOURCES} onChange={(value) => patchAnswers({ income_sources: value })} /></div>
      <div><p className="mb-2 text-xs font-semibold text-slate-800">2. About how much do you receive in a typical month, after deductions?</p><NumberAnswer value={answers.monthly_net_income} onChange={(value) => patchAnswers({ monthly_net_income: value })} currencySymbol={currencySymbol} label="Monthly take-home income" /><p className="mt-1 text-[10px] text-slate-500">Use a rough estimate if your income varies. Enter 0 if you currently have no regular income.</p></div>
      <div><p className="mb-2 text-xs font-semibold text-slate-800">3. How predictable is your income?</p><ChoiceGrid value={answers.income_stability} onChange={(value) => patchAnswers({ income_stability: value })} options={[["regular", "Mostly regular"], ["mostly_regular", "Some variation"], ["variable", "Varies significantly"], ["seasonal", "Seasonal or irregular"]]} /></div>
    </div>,
    <div className="space-y-5" key="cashflow">
      <div><p className="mb-2 text-xs font-semibold text-slate-800">4. About how much do you spend on essentials in a typical month?</p><NumberAnswer value={answers.essential_monthly_spending} onChange={(value) => patchAnswers({ essential_monthly_spending: value })} currencySymbol={currencySymbol} label="Essential monthly spending" /><p className="mt-1 text-[10px] text-slate-500">Include housing, food, utilities, transport and necessary healthcare. New users can estimate.</p></div>
      <div><p className="mb-2 text-xs font-semibold text-slate-800">5. What usually happens to your money by month end?</p><ChoiceGrid value={answers.month_end_pattern} onChange={(value) => patchAnswers({ month_end_pattern: value })} options={[["save_regularly", "I usually save some"], ["save_sometimes", "I save in some months"], ["break_even", "I mostly break even"], ["withdraw_or_borrow", "I use savings or credit"]]} /></div>
      <div><p className="mb-2 text-xs font-semibold text-slate-800">6. How much do you have in savings you can access quickly, without selling investments?</p><NumberAnswer value={answers.liquid_savings} onChange={(value) => patchAnswers({ liquid_savings: value })} currencySymbol={currencySymbol} label="Accessible savings" /></div>
    </div>,
    <div className="space-y-5" key="debt">
      <div><p className="mb-2 text-xs font-semibold text-slate-800">7. Do you currently have outstanding debt?</p><ChoiceGrid value={answers.debt_status} onChange={(value) => patchAnswers({ debt_status: value })} options={[["yes", "Yes"], ["no", "No"], ["not_sure", "I’m not sure"]]} columns={1} /></div>
      {answers.debt_status === 'yes' && <>
        <div><p className="mb-2 text-xs font-semibold text-slate-800">8. About how much do you still owe across those debts?</p><NumberAnswer value={answers.debt_outstanding} onChange={(value) => patchAnswers({ debt_outstanding: value })} currencySymbol={currencySymbol} label="Total outstanding debt" /><p className="mt-1 text-[10px] text-slate-500">Include credit cards, personal, vehicle, education and home loans.</p></div>
        <div><p className="mb-2 text-xs font-semibold text-slate-800">9. How much do you repay monthly, and how are payments going?</p><NumberAnswer value={answers.monthly_debt_payment} onChange={(value) => patchAnswers({ monthly_debt_payment: value })} currencySymbol={currencySymbol} label="Monthly debt payments" /><div className="mt-3"><ChoiceGrid value={answers.debt_payment_pattern} onChange={(value) => patchAnswers({ debt_payment_pattern: value })} options={[["on_time", "I pay on time"], ["sometimes_late", "Sometimes late"], ["missed_recently", "I missed a recent payment"]]} /></div></div>
      </>}
      {answers.debt_status === 'no' && <>
        <div><p className="mb-2 text-xs font-semibold text-slate-800">8. Do you expect any large expenses in the next 12 months?</p><ChoiceGrid value={answers.upcoming_large_expense} onChange={(value) => patchAnswers({ upcoming_large_expense: value })} options={[["yes", "Yes"], ["no", "No"], ["not_sure", "Not sure"]]} columns={1} /></div>
        <div><p className="mb-2 text-xs font-semibold text-slate-800">9. If an unexpected expense came up, how would you most likely cover it?</p><ChoiceGrid value={answers.unexpected_expense_plan} onChange={(value) => patchAnswers({ unexpected_expense_plan: value })} options={[["savings", "Accessible savings"], ["monthly_cashflow", "Current income"], ["borrow", "I may need to borrow"], ["not_sure", "Not sure"]]} /></div>
      </>}
      {answers.debt_status === 'not_sure' && <p className="rounded-xl bg-sky-50 p-3 text-xs text-sky-900">That’s okay. The assessment will mark debt information as uncertain. You can review the Debts section later.</p>}
    </div>,
    <div className="space-y-5" key="protection">
      <div><p className="mb-2 text-xs font-semibold text-slate-800">10. Do you have health insurance?</p><ChoiceGrid value={answers.health_cover} onChange={(value) => patchAnswers({ health_cover: value })} options={[["personal", "A personal policy"], ["employer", "Employer cover only"], ["both", "Personal and employer cover"], ["none", "No cover"], ["not_sure", "I’m not sure"]]} /></div>
      <div><p className="mb-2 text-xs font-semibold text-slate-800">11. Does anyone depend on your income?</p><ChoiceGrid value={answers.has_dependents === null ? '' : String(answers.has_dependents)} onChange={(value) => patchAnswers({ has_dependents: value === 'yes', term_cover: value === 'no' ? 'not_applicable' : '' })} options={[["yes", "Yes"], ["no", "No"]]} columns={1} />
        {answers.has_dependents === true && <div className="mt-3"><p className="mb-2 text-[11px] font-semibold text-slate-700">Do you have term or life cover for them?</p><ChoiceGrid value={answers.term_cover} onChange={(value) => patchAnswers({ term_cover: value })} options={[["adequate", "Yes, I believe it is adequate"], ["some", "I have some cover"], ["none", "No cover"], ["not_sure", "I’m not sure"]]} /></div>}
      </div>
      <div><p className="mb-2 text-xs font-semibold text-slate-800">12. How confident are you about tracking important bill, insurance and tax dates?</p><ChoiceGrid value={answers.planning_confidence} onChange={(value) => patchAnswers({ planning_confidence: value })} options={[["confident", "I keep track of them"], ["somewhat", "I track some of them"], ["need_help", "I could use reminders"], ["not_sure", "Not sure"]]} /></div>
    </div>,
    <div className="space-y-5" key="investing">
      <div><p className="mb-2 text-xs font-semibold text-slate-800">13. Which assets or investments do you currently have?</p><MultiChoice values={answers.investment_types} options={INVESTMENT_TYPES} onChange={(value) => patchAnswers({ investment_types: value, gold_share: value.includes('gold') ? (answers.gold_share === 'not_applicable' ? 'not_sure' : answers.gold_share) : 'not_applicable' })} /><p className="mt-2 text-[10px] text-slate-500">If you selected gold, about what share of your investable assets is in gold?</p>{answers.investment_types.includes('gold') && <div className="mt-2"><ChoiceGrid value={answers.gold_share === 'not_applicable' ? '' : answers.gold_share} onChange={(value) => patchAnswers({ gold_share: value })} options={[["none", "Very little"], ["under_10", "Under 10%"], ["10_to_25", "10–25%"], ["26_to_50", "26–50%"], ["over_50", "Over 50%"], ["not_sure", "Not sure"]]} /></div>}</div>
      <div><p className="mb-2 text-xs font-semibold text-slate-800">14. If your investments temporarily fell by 20%, what would you most likely do?</p><ChoiceGrid value={answers.market_reaction} onChange={(value) => patchAnswers({ market_reaction: value })} options={[["sell", "Sell to avoid further loss"], ["wait", "Wait and review my plan"], ["invest_more", "Invest more if my plan allowed"], ["not_sure", "I’m not sure"]]} /></div>
      <div><p className="mb-2 text-xs font-semibold text-slate-800">15. What is the main financial goal you want to work toward next?</p><div className="grid gap-3 sm:grid-cols-2"><select value={answers.goal_priority} onChange={(event) => patchAnswers({ goal_priority: event.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700"><option value="">Choose a goal</option><option value="emergency_fund">Build emergency savings</option><option value="debt_repayment">Repay debt</option><option value="home">Buy a home</option><option value="education">Education</option><option value="retirement">Retirement</option><option value="wealth_building">Build long-term wealth</option><option value="family">Family needs</option><option value="other">Other</option></select><select value={answers.goal_horizon} onChange={(event) => patchAnswers({ goal_horizon: event.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700"><option value="">When do you hope to reach it?</option><option value="under_1_year">Within a year</option><option value="1_to_3_years">1–3 years</option><option value="3_to_10_years">3–10 years</option><option value="over_10_years">Over 10 years</option><option value="not_sure">Not sure yet</option></select></div></div>
    </div>,
  ];

  return <div className="mx-auto flex max-w-5xl flex-col gap-6 p-5 md:p-8">
    <header><div className="flex items-center gap-2"><span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-800"><ClipboardCheck className="h-5 w-5" /></span><h1 className="text-2xl font-bold tracking-tight text-slate-900">Financial Assessment</h1></div><p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-500">A 15-question check-up across income, spending, savings, debt, protection, investments and goals. It adapts when you have no debt. Estimates are welcome.</p></header>
    <PageGuide title="Your assessment answers stay focused" summary="When you request recommendations, Finverse sends your answers and the calculated score to the AI. It does not send transaction rows, account numbers, policy numbers, or your name." steps={['Answer the five short sections. New users can estimate monthly amounts.', 'Choose “Not sure” when you do not know; it affects confidence, not your worth.', 'Review the score and suggested next steps. Use links to open the relevant app tools.']} terms={[]} />

    <div className="grid gap-2 sm:grid-cols-5" aria-label="Assessment progress">{SECTIONS.map((item, index) => <div key={item.title} className={`rounded-xl border p-3 ${index === section ? 'border-emerald-500 bg-emerald-50' : index < section ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-white'}`}><p className={`text-[10px] font-bold ${index <= section ? 'text-emerald-800' : 'text-slate-400'}`}>SECTION {index + 1}</p><p className="mt-1 text-xs font-semibold text-slate-800">{item.title}</p></div>)}</div>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-100 pb-4"><div><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Section {section + 1} of 5</p><h2 className="mt-1 text-lg font-bold text-slate-900">{SECTIONS[section].title}</h2><p className="mt-1 text-xs text-slate-500">{SECTIONS[section].subtitle}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600">15 questions max</span></div>
      {sectionFields[section]}
      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4"><button type="button" disabled={section === 0} onClick={() => { setSection((value) => value - 1); setError(''); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40"><ArrowLeft className="h-3.5 w-3.5" />Previous</button>
        {section < SECTIONS.length - 1 ? <button type="button" onClick={() => { setSection((value) => value + 1); setError(''); }} className="inline-flex items-center gap-1 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900">Next section<ArrowRight className="h-3.5 w-3.5" /></button> : <button type="button" onClick={getRecommendations} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{loading ? <><LoaderCircle className="h-4 w-4 animate-spin" />Getting your recommendations…</> : <><Sparkles className="h-4 w-4" />Calculate score & get AI suggestions</>}</button>}
      </div>
      {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {section === 4 && missing.length > 0 && <p className="mt-3 text-[10px] text-slate-500">Please complete the applicable fields. If you are unsure, select the “Not sure” option.</p>}
    </section>

    {result && <section className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-emerald-950 to-teal-900 p-5 text-white"><div><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Your financial health snapshot</p><h2 className="mt-1 text-2xl font-extrabold">{result.score} / 100</h2><p className="mt-1 text-sm font-semibold text-emerald-100">{result.rating}</p></div><div className="rounded-lg bg-white/10 px-3 py-2 text-[10px] text-emerald-100">Data confidence: <span className="font-bold uppercase">{result.data_confidence}</span></div></div>
      <p className="text-sm leading-relaxed text-slate-700">{result.summary || 'Your score is calculated from your answers. AI suggestions will appear here when available.'}</p>
      <details className="group rounded-xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer list-none text-sm font-bold text-slate-800">
          How this score is calculated <span className="text-xs font-medium text-slate-500">(show details)</span>
        </summary>
        <div className="mt-4 space-y-4 text-xs leading-relaxed text-slate-700">
          <p>The score is a weighted snapshot of your answers. Each area gets a 0–100 score, then the app combines them using the weights below. It is a planning aid, not a credit, investment, or professional rating.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <p><strong>Cash flow · 20%</strong><br />Compares take-home income with essential spending, then adjusts for income regularity and whether you usually save, break even, or draw on savings/credit.</p>
            <p><strong>Emergency savings · 20%</strong><br />Accessible savings divided by essential monthly spending: under 1 month = 25; 1–&lt;3 = 45; 3–&lt;6 = 70; 6–&lt;9 = 90; 9+ = 100.</p>
            <p><strong>Debt & commitments · 15%</strong><br />For debt, combines repayment share of income (≤20% = 90; ≤35% = 70; ≤50% = 45; higher = 25) with payment history. With no debt, it uses your unexpected-expense plan. “Not sure” scores 45.</p>
            <p><strong>Protection · 15%</strong><br />Health cover is scored from 25 (none) to 100 (personal and employer cover). If someone depends on your income, the score averages health cover with your term-cover answer.</p>
            <p><strong>Investments · 15%</strong><br />Based on the number of asset types selected: none = 55; one = 65; two or three = 78; four or more = 88. A high gold share reduces this area score by 10–20 points.</p>
            <p><strong>Goals & planning · 15%</strong><br />A stated goal horizon starts at 75 (an unsure horizon starts at 55), adjusted by your confidence in keeping up with important dates and planning.</p>
          </div>
          <p><strong>Overall bands:</strong> 75–100 Strong foundation; 55–74 Building; 0–54 Needs attention. <strong>Data confidence</strong> reflects how many answers were marked uncertain; it does not change the score.</p>
          <p><strong>What does not directly change the number:</strong> your profession/income-source selection and total debt balance. Debt is scored using monthly repayment burden and payment history; income source and balances may give the AI context for its suggestions. The investment score is a simple count of asset types, so it is not a measure of portfolio performance or suitability.</p>
        </div>
      </details>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(result.pillar_scores || {}).map(([name, value]) => <div key={name} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-700">{name}</span><span className="font-bold text-emerald-800">{value}/100</span></div><div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${value}%` }} /></div></div>)}</div>
      {!!result.strengths?.length && <div className="rounded-xl bg-emerald-50 p-4"><h3 className="text-xs font-bold text-emerald-900">Strengths to build on</h3><ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-emerald-900">{result.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {!!result.recommendations?.length && <div className="space-y-3"><h3 className="text-base font-bold text-slate-900">Recommended next steps</h3>{result.recommendations.map((item, index) => <article key={`${item.title}-${index}`} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-bold uppercase text-amber-800">{item.priority}</span><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{item.area}</span></div><button type="button" disabled={item.app_tool === 'None'} onClick={() => goToTool(item.app_tool)} className="text-[10px] font-bold text-sky-700 hover:underline disabled:hidden">Open {item.app_tool} ↗</button></div><h4 className="mt-2 text-sm font-bold text-slate-900">{item.title}</h4><p className="mt-1 text-xs leading-relaxed text-slate-600">{item.why}</p><ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-700">{item.actions.map((action, actionIndex) => <li key={actionIndex}>{action}</li>)}</ul><p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-600"><span className="font-bold">Progress check:</span> {item.progress_check}</p></article>)}</div>}
      {result.disclaimer && <p className="border-t border-slate-100 pt-3 text-[10px] leading-relaxed text-slate-500">{result.disclaimer}</p>}
      <button type="button" onClick={() => { setResult(null); setSection(0); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Retake assessment</button>
    </section>}
  </div>;
}

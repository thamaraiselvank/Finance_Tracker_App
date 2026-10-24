import React, { useState } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  Coins, 
  Building, 
  Wallet, 
  Palmtree, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles,
  X,
  Plus,
  Trash2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import api from '../services/api';
import useCurrency from '../utils/useCurrency';

const PIE_COLORS = ['#10B981', '#EF4444'];

export default function Calculators({ setActiveTab, hideAmounts }) {
  const { formatCurrency: formatAmount, currencySymbol } = useCurrency();
  const [selectedCalc, setSelectedCalc] = useState(null); // 'fire', 'sip', 'lumpsum', 'cagr', 'xirr', 'emi', 'swp'
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Forms
  const [sipForm, setSipForm] = useState({ monthly_investment: 10000, expected_return_rate_pct: 12, time_period_years: 15, annual_step_up_pct: 10 });
  const [lumpForm, setLumpForm] = useState({ total_investment: 100000, expected_return_rate_pct: 12, time_period_years: 10 });
  const [cagrForm, setCagrForm] = useState({ initial_value: 50000, final_value: 150000, duration_years: 5 });
  const [emiForm, setEmiForm] = useState({ loan_amount: 3000000, interest_rate_pct: 8.5, tenure_months: 240 });
  const [swpForm, setSwpForm] = useState({ total_investment: 5000000, monthly_withdrawal: 30000, expected_return_rate_pct: 8, annual_inflation_pct: 6, time_period_years: 20 });
  const [fireForm, setFireForm] = useState({
    current_age: 28,
    target_retirement_age: 50,
    life_expectancy: 85,
    monthly_expense: 35000,
    current_portfolio_value: 200000,
    existing_monthly_investment: 15000,
    expected_pre_retire_return_pct: 12,
    expected_post_retire_return_pct: 8,
    expected_inflation_pct: 6,
  });
  const [xirrCashflows, setXirrCashflows] = useState([
    { date: '2023-01-01', amount: -50000 },
    { date: '2023-06-01', amount: -25000 },
    { date: '2024-01-01', amount: -50000 },
    { date: '2026-08-01', amount: 165000 },
  ]);

  const formatCurrency = (val) => {
    if (hideAmounts) return '••••••';
    return formatAmount(val);
  };

  const handleRunCalc = async (type) => {
    setLoading(true);
    setResult(null);
    try {
      let res;
      if (type === 'sip') res = await api.post('/calculators/sip', sipForm);
      else if (type === 'lumpsum') res = await api.post('/calculators/lumpsum', lumpForm);
      else if (type === 'cagr') res = await api.post('/calculators/cagr', cagrForm);
      else if (type === 'emi') res = await api.post('/calculators/emi', emiForm);
      else if (type === 'swp') res = await api.post('/calculators/swp', swpForm);
      else if (type === 'fire') res = await api.post('/calculators/fire', fireForm);
      else if (type === 'xirr') res = await api.post('/calculators/xirr', { cash_flows: xirrCashflows });
      setResult(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Calculation error');
    } finally {
      setLoading(false);
    }
  };

  const calcCards = [
    {
      group: 'RETURNS',
      items: [
        { id: 'xirr', title: 'XIRR Calculator', desc: 'Annualized return on SIPs and irregular investments.', icon: TrendingUp, bg: 'bg-emerald-50 text-emerald-800' },
        { id: 'sip', title: 'SIP Calculator', desc: 'Project the future value of a monthly SIP, with optional step-up.', icon: Calendar, bg: 'bg-emerald-50 text-emerald-800' },
        { id: 'lumpsum', title: 'Lumpsum Calculator', desc: 'Growth of a one-time investment over time.', icon: Coins, bg: 'bg-emerald-50 text-emerald-800' },
        { id: 'cagr', title: 'CAGR Calculator', desc: 'Compound annual growth rate between two values.', icon: TrendingUp, bg: 'bg-emerald-50 text-emerald-800' },
      ]
    },
    {
      group: 'LOANS',
      items: [
        { id: 'emi', title: 'EMI Calculator', desc: 'Monthly instalment, total interest, and principal breakup.', icon: Building, bg: 'bg-amber-50 text-amber-800' },
      ]
    },
    {
      group: 'PLANNING',
      items: [
        { id: 'fire', title: 'FIRE / Retirement Calculator', desc: 'The corpus you need and the SIP to reach it.', icon: Palmtree, bg: 'bg-blue-50 text-blue-800' },
        { id: 'swp', title: 'SWP with Inflation', desc: 'How long your corpus lasts with inflation-linked withdrawals.', icon: Wallet, bg: 'bg-blue-50 text-blue-800' },
      ]
    }
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header Matching Finverse Screenshot */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xl tracking-tight text-slate-900 font-sans">
            Finverse<span className="text-emerald-700">.</span>
          </span>
          <span className="text-sm font-semibold text-slate-500">Calculators</span>
        </div>
        <button
          onClick={() => setActiveTab('overview')}
          className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>

      {/* CALCULATOR HUB VIEW */}
      {!selectedCalc && (
        <div className="space-y-8">
          {calcCards.map((sec) => (
            <div key={sec.group} className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {sec.group}
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sec.items.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.id}
                      onClick={() => { setSelectedCalc(card.id); setResult(null); }}
                      className="bg-white border border-slate-200/90 hover:border-emerald-300 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${card.bg}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-800 transition-colors">
                            {card.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {card.desc}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-800 group-hover:translate-x-1 transition-all" />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* INTERACTIVE CALCULATOR RUNNER */}
      {selectedCalc && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setSelectedCalc(null); setResult(null); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Calculators
            </button>
            <span className="text-xs font-bold text-slate-400 uppercase">
              {selectedCalc.toUpperCase()} RUNNER
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input Form Column */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <h2 className="font-bold text-slate-900 text-base capitalize">
                {selectedCalc === 'fire' ? 'FIRE / Retirement Planner' : `${selectedCalc} Calculator`}
              </h2>

              {/* 1. FIRE Calculator Form */}
              {selectedCalc === 'fire' && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Current Age</label>
                      <input
                        type="number"
                        value={fireForm.current_age}
                        onChange={(e) => setFireForm({ ...fireForm, current_age: parseInt(e.target.value) || 28 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Target Retirement Age</label>
                      <input
                        type="number"
                        value={fireForm.target_retirement_age}
                        onChange={(e) => setFireForm({ ...fireForm, target_retirement_age: parseInt(e.target.value) || 50 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Current Monthly Living Expense ({currencySymbol})</label>
                    <input
                      type="number"
                      value={fireForm.monthly_expense}
                      onChange={(e) => setFireForm({ ...fireForm, monthly_expense: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Current Portfolio Value ({currencySymbol})</label>
                    <input
                      type="number"
                      value={fireForm.current_portfolio_value}
                      onChange={(e) => setFireForm({ ...fireForm, current_portfolio_value: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Existing Monthly Investment ({currencySymbol})</label>
                    <input
                      type="number"
                      value={fireForm.existing_monthly_investment}
                      onChange={(e) => setFireForm({ ...fireForm, existing_monthly_investment: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 text-[10px]">Pre-Ret Return %</label>
                      <input
                        type="number"
                        value={fireForm.expected_pre_retire_return_pct}
                        onChange={(e) => setFireForm({ ...fireForm, expected_pre_retire_return_pct: parseFloat(e.target.value) || 12 })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 text-[10px]">Post-Ret Return %</label>
                      <input
                        type="number"
                        value={fireForm.expected_post_retire_return_pct}
                        onChange={(e) => setFireForm({ ...fireForm, expected_post_retire_return_pct: parseFloat(e.target.value) || 8 })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 text-[10px]">Inflation %</label>
                      <input
                        type="number"
                        value={fireForm.expected_inflation_pct}
                        onChange={(e) => setFireForm({ ...fireForm, expected_inflation_pct: parseFloat(e.target.value) || 6 })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. SIP Calculator Form */}
              {selectedCalc === 'sip' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Monthly Investment ({currencySymbol})</label>
                    <input
                      type="number"
                      value={sipForm.monthly_investment}
                      onChange={(e) => setSipForm({ ...sipForm, monthly_investment: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Expected Return (% p.a.)</label>
                      <input
                        type="number"
                        value={sipForm.expected_return_rate_pct}
                        onChange={(e) => setSipForm({ ...sipForm, expected_return_rate_pct: parseFloat(e.target.value) || 12 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Time Period (Years)</label>
                      <input
                        type="number"
                        value={sipForm.time_period_years}
                        onChange={(e) => setSipForm({ ...sipForm, time_period_years: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Annual Step-Up (% optional)</label>
                    <input
                      type="number"
                      value={sipForm.annual_step_up_pct}
                      onChange={(e) => setSipForm({ ...sipForm, annual_step_up_pct: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* 3. EMI Calculator Form */}
              {selectedCalc === 'emi' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Loan Amount ({currencySymbol})</label>
                    <input
                      type="number"
                      value={emiForm.loan_amount}
                      onChange={(e) => setEmiForm({ ...emiForm, loan_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Interest Rate (% p.a.)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={emiForm.interest_rate_pct}
                        onChange={(e) => setEmiForm({ ...emiForm, interest_rate_pct: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Tenure (Months)</label>
                      <input
                        type="number"
                        value={emiForm.tenure_months}
                        onChange={(e) => setEmiForm({ ...emiForm, tenure_months: parseInt(e.target.value) || 12 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Lumpsum Calculator Form */}
              {selectedCalc === 'lumpsum' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Total Investment ({currencySymbol})</label>
                    <input
                      type="number"
                      value={lumpForm.total_investment}
                      onChange={(e) => setLumpForm({ ...lumpForm, total_investment: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Return Rate (% p.a.)</label>
                      <input
                        type="number"
                        value={lumpForm.expected_return_rate_pct}
                        onChange={(e) => setLumpForm({ ...lumpForm, expected_return_rate_pct: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Time Period (Years)</label>
                      <input
                        type="number"
                        value={lumpForm.time_period_years}
                        onChange={(e) => setLumpForm({ ...lumpForm, time_period_years: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 5. CAGR Calculator Form */}
              {selectedCalc === 'cagr' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Initial Value ({currencySymbol})</label>
                    <input
                      type="number"
                      value={cagrForm.initial_value}
                      onChange={(e) => setCagrForm({ ...cagrForm, initial_value: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Final Value ({currencySymbol})</label>
                    <input
                      type="number"
                      value={cagrForm.final_value}
                      onChange={(e) => setCagrForm({ ...cagrForm, final_value: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Duration (Years)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={cagrForm.duration_years}
                      onChange={(e) => setCagrForm({ ...cagrForm, duration_years: parseFloat(e.target.value) || 1 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* 6. XIRR Cashflows Form */}
              {selectedCalc === 'xirr' && (
                <div className="space-y-3 text-xs">
                  <p className="text-slate-500 text-[11px]">Enter negative amount for investments and positive amount for final value / returns.</p>
                  {xirrCashflows.map((cf, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="date"
                        value={cf.date}
                        onChange={(e) => {
                          const updated = [...xirrCashflows];
                          updated[idx].date = e.target.value;
                          setXirrCashflows(updated);
                        }}
                        className="px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                      <input
                        type="number"
                        data-allow-negative="true"
                        value={cf.amount}
                        onChange={(e) => {
                          const updated = [...xirrCashflows];
                          updated[idx].amount = parseFloat(e.target.value) || 0;
                          setXirrCashflows(updated);
                        }}
                        className="px-2 py-1 border border-slate-300 rounded text-xs w-28"
                      />
                      <button
                        onClick={() => setXirrCashflows(xirrCashflows.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setXirrCashflows([...xirrCashflows, { date: new Date().toISOString().split('T')[0], amount: -10000 }])}
                    className="text-emerald-800 hover:underline font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Cash Flow
                  </button>
                </div>
              )}

              <button
                onClick={() => handleRunCalc(selectedCalc)}
                disabled={loading}
                className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 mt-4"
              >
                {loading ? 'Calculating...' : 'Calculate Results'}
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Results Column (2 Cols) */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
              {result ? (
                <div className="space-y-6">
                  <h3 className="font-bold text-slate-900 text-sm">Calculation Results</h3>

                  {/* FIRE Results */}
                  {selectedCalc === 'fire' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <span className="text-[10px] font-bold text-emerald-900 uppercase">Standard FIRE Corpus</span>
                          <p className="text-xl font-extrabold text-emerald-900 mt-1">{formatCurrency(result.standard_fire_corpus)}</p>
                          <span className="text-[10px] text-emerald-700">25x inflation-adjusted</span>
                        </div>
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                          <span className="text-[10px] font-bold text-blue-900 uppercase">Projected Portfolio</span>
                          <p className="text-xl font-extrabold text-blue-900 mt-1">{formatCurrency(result.projected_corpus_at_retire_age)}</p>
                          <span className="text-[10px] text-blue-700">At age {fireForm.target_retirement_age}</span>
                        </div>
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                          <span className="text-[10px] font-bold text-purple-900 uppercase">Required Monthly SIP</span>
                          <p className="text-xl font-extrabold text-purple-900 mt-1">{formatCurrency(result.required_monthly_sip)}</p>
                          <span className="text-[10px] text-purple-700">To bridge shortfall</span>
                        </div>
                      </div>

                      {/* Milestones */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-700 uppercase">FIRE Milestones</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          {(result.milestones || []).map((m, i) => (
                            <div key={i} className="p-3 border border-slate-200 rounded-xl bg-slate-50">
                              <p className="font-bold text-slate-900">{m.type}</p>
                              <p className="text-base font-extrabold text-emerald-800 mt-1">{formatCurrency(m.required_corpus)}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">Est. Age: {m.projected_age} yrs</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SIP Results */}
                  {selectedCalc === 'sip' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Total Invested</span>
                          <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(result.total_invested)}</p>
                        </div>
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase">Est. Returns</span>
                          <p className="text-xl font-bold text-emerald-800 mt-1">{formatCurrency(result.estimated_returns)}</p>
                        </div>
                        <div className="p-4 bg-emerald-900 text-white rounded-xl">
                          <span className="text-[10px] font-bold text-emerald-200 uppercase">Total Future Value</span>
                          <p className="text-xl font-extrabold text-white mt-1">{formatCurrency(result.total_value)}</p>
                        </div>
                      </div>

                      {/* Growth Area Chart */}
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={result.yearly_schedule || []}>
                            <XAxis dataKey="year" tickFormatter={(y) => `Y${y}`} />
                            <YAxis tickFormatter={(v) => formatCurrency(v)} />
                            <Tooltip formatter={(v) => formatCurrency(v)} />
                            <Area type="monotone" dataKey="total_invested" stackId="1" stroke="#94a3b8" fill="#cbd5e1" />
                            <Area type="monotone" dataKey="returns_earned" stackId="1" stroke="#10b981" fill="#86efac" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* EMI Results */}
                  {selectedCalc === 'emi' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 bg-emerald-900 text-white rounded-xl">
                          <span className="text-[10px] font-bold text-emerald-200 uppercase">Monthly EMI</span>
                          <p className="text-2xl font-black text-white mt-1">{formatCurrency(result.monthly_emi)}</p>
                        </div>
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                          <span className="text-[10px] font-bold text-red-800 uppercase">Total Interest</span>
                          <p className="text-xl font-bold text-red-700 mt-1">{formatCurrency(result.total_interest)}</p>
                        </div>
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Total Payment</span>
                          <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(result.total_payment)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* XIRR Results */}
                  {selectedCalc === 'xirr' && (
                    <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                      <span className="text-xs font-bold text-emerald-900 uppercase">Annualized Return (XIRR)</span>
                      <p className="text-4xl font-black text-emerald-900">{result.xirr_percentage}%</p>
                      <p className="text-xs text-emerald-700">Net Profit: {formatCurrency(result.net_profit)}</p>
                    </div>
                  )}

                  {/* CAGR Results */}
                  {selectedCalc === 'cagr' && (
                    <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                      <span className="text-xs font-bold text-emerald-900 uppercase">Compound Annual Growth Rate</span>
                      <p className="text-4xl font-black text-emerald-900">{result.cagr_percentage}%</p>
                      <p className="text-xs text-emerald-700">Absolute Growth: {result.absolute_growth_percentage}%</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-24 text-center text-slate-400 text-xs">
                  Select parameters and click "Calculate Results" to generate financial forecasts.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

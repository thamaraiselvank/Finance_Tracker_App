import React, { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  ChevronRight,
  HeartPulse,
  LayoutDashboard,
  PiggyBank,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../services/api';
import useCurrency from '../utils/useCurrency';

const COLORS = ['#0f766e', '#f59e0b', '#2563eb', '#e11d48', '#7c3aed', '#0891b2'];
const TABS = [
  { id: 'snapshot', label: 'Snapshot', icon: LayoutDashboard },
  { id: 'wealth', label: 'Wealth', icon: TrendingUp },
  { id: 'cashflow', label: 'Cash flow', icon: Wallet },
  { id: 'essentials', label: 'Essentials', icon: HeartPulse },
];

export default function Overview({ hideAmounts, setActiveTab }) {
  const { formatCurrency: formatAmount } = useCurrency();
  const [wealth, setWealth] = useState(null);
  const [txSummary, setTxSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [aiAudit, setAiAudit] = useState(null);
  const [goalsSummary, setGoalsSummary] = useState(null);
  const [debtsSummary, setDebtsSummary] = useState(null);
  const [insuranceSummary, setInsuranceSummary] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [activeView, setActiveView] = useState('snapshot');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [wealthRes, txRes, healthRes, auditRes, goalsRes, debtsRes, insuranceRes, recsRes] = await Promise.all([
        api.get('/assets/summary').catch(() => ({ data: null })),
        api.get('/transactions/summary').catch(() => ({ data: null })),
        api.get('/essentials/health-check').catch(() => ({ data: null })),
        api.get('/ai/audit').catch(() => ({ data: null })),
        api.get('/goals/summary/progress').catch(() => ({ data: null })),
        api.get('/debts/summary/overview').catch(() => ({ data: null })),
        api.get('/insurance/summary/overview').catch(() => ({ data: null })),
        api.get('/recommendations/').catch(() => ({ data: [] })),
      ]);

      setWealth(wealthRes.data);
      setTxSummary(txRes.data);
      setHealth(healthRes.data);
      setAiAudit(auditRes.data);
      setGoalsSummary(goalsRes.data);
      setDebtsSummary(debtsRes.data);
      setInsuranceSummary(insuranceRes.data);
      setRecommendations(Array.isArray(recsRes.data) ? recsRes.data.slice(0, 3) : []);
    } catch (error) {
      console.error('Failed to load overview data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (value) => {
    if (hideAmounts) return '••••••';
    return formatAmount(value);
  };

  const allocationData = (wealth?.asset_classes || [])
    .map((asset) => ({ name: asset.asset_class.replaceAll('_', ' '), value: asset.total_current_value }))
    .filter((asset) => asset.value > 0);
  const cashflowData = [
    { name: 'Income', value: txSummary?.total_income || 0, fill: '#0f766e' },
    { name: 'Spending', value: txSummary?.total_expense || 0, fill: '#e11d48' },
    { name: 'Saved', value: txSummary?.net_savings || 0, fill: '#2563eb' },
  ];
  const goalProgress = Number(goalsSummary?.total_target_amount || 0) > 0
    ? Math.min(100, (Number(goalsSummary?.total_current_amount || 0) / Number(goalsSummary.total_target_amount)) * 100)
    : 0;
  const healthScore = Number(health?.overall_health_score || 0);
  const healthTone = healthScore >= 8 ? 'text-emerald-700' : healthScore >= 6 ? 'text-blue-700' : healthScore >= 4 ? 'text-amber-700' : 'text-rose-700';
  const tooltipStyle = { background: 'var(--panel-strong)', border: '1px solid var(--panel-border)', borderRadius: '6px', color: 'var(--text-primary)' };

  const Metric = ({ label, value, note, icon: Icon, tone = 'text-slate-700' }) => (
    <div className="min-w-0 border-l-2 border-slate-200 pl-3 first:border-0 first:pl-0">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        <span className="truncate">{label}</span>
      </div>
      <p className={`mt-1 truncate text-lg font-bold leading-tight ${tone}`} title={String(value)}>{value}</p>
      <p className="mt-1 truncate text-[10px] text-slate-500">{note}</p>
    </div>
  );

  const Signal = ({ label, value, detail, percent, tone }) => (
    <div className="rounded-md border border-slate-200 bg-white/75 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-slate-500">{label}</p>
          <p className={`mt-1 text-base font-bold ${tone}`}>{value}</p>
        </div>
        <span className="text-right text-[10px] text-slate-500">{detail}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone.includes('rose') ? 'bg-rose-500' : tone.includes('amber') ? 'bg-amber-500' : 'bg-teal-600'}`} style={{ width: `${Math.max(3, Math.min(100, percent))}%` }} />
      </div>
    </div>
  );

  const SectionHeading = ({ title, detail, action }) => (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {detail && <p className="mt-0.5 text-[11px] text-slate-500">{detail}</p>}
      </div>
      {action}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1480px] px-4 py-4 md:px-7 md:py-5 page-enter">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">Finverse · Personal finance</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Your money, at a glance</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50" title="Refresh overview" aria-label="Refresh overview">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setActiveTab('money')} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-teal-800 px-3 text-xs font-semibold text-white transition hover:bg-teal-700">
            <Plus className="h-4 w-4" /> Add transaction
          </button>
        </div>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm sm:grid-cols-4 md:gap-5 md:px-5" aria-label="Financial summary">
        <Metric label="Net worth" value={formatCurrency(wealth?.net_worth)} note={`${formatCurrency(wealth?.total_assets_current)} assets`} icon={TrendingUp} tone="text-teal-800" />
        <Metric label="Monthly cash flow" value={formatCurrency(txSummary?.net_savings)} note={`${formatCurrency(txSummary?.total_income)} income · ${formatCurrency(txSummary?.total_expense)} spend`} icon={ArrowDownRight} tone="text-blue-700" />
        <Metric label="Financial health" value={`${healthScore.toFixed(1)} / 10`} note={health?.health_score_status || 'Health score'} icon={BadgeCheck} tone={healthTone} />
        <Metric label="Active goals" value={goalsSummary?.active_goals || 0} note={`${goalsSummary?.completed_goals || 0} completed · ${formatCurrency(goalsSummary?.total_monthly_allocation)} / month`} icon={Target} tone="text-amber-700" />
      </section>

      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Dashboard views" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={activeView === id} onClick={() => setActiveView(id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-t-md border-b-2 px-3 py-2.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${activeView === id ? 'border-teal-800 bg-teal-800 text-white shadow-sm' : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </nav>

      {loading && !wealth && !txSummary ? (
        <div className="flex min-h-64 items-center justify-center rounded-md border border-slate-200 bg-white text-sm text-slate-500">Loading your financial overview…</div>
      ) : (
        <div role="tabpanel" className="min-h-[420px]">
          {activeView === 'snapshot' && (
            <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
              <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <SectionHeading title="This month" detail="Income, spending, and what remains" action={<PiggyBank className="h-4 w-4 text-teal-700" />} />
                  <button onClick={() => setActiveView('cashflow')} className="ml-3 inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-teal-800">Details <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
                <div className="grid grid-cols-3 gap-2 border-y border-slate-100 py-3">
                  <div><p className="text-[10px] text-slate-500">Income</p><p className="mt-1 truncate text-sm font-bold text-teal-800">{formatCurrency(txSummary?.total_income)}</p></div>
                  <div><p className="text-[10px] text-slate-500">Spending</p><p className="mt-1 truncate text-sm font-bold text-rose-700">{formatCurrency(txSummary?.total_expense)}</p></div>
                  <div><p className="text-[10px] text-slate-500">Saved</p><p className="mt-1 truncate text-sm font-bold text-blue-700">{formatCurrency(txSummary?.net_savings)}</p></div>
                </div>
                <div className="h-[190px] pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashflowData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#e8edf2" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={tooltipStyle} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>{cashflowData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <SectionHeading title="Four financial essentials" detail="Signals that keep your plan steady" />
                  <button onClick={() => setActiveView('essentials')} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-teal-800">Open <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Signal label="Emergency runway" value={`${Number(health?.emergency_runway_months || 0).toFixed(1)} months`} detail="6 months target" percent={(Number(health?.emergency_runway_months || 0) / 6) * 100} tone="text-teal-800" />
                  <Signal label="Savings rate" value={`${Number(health?.savings_rate_pct || 0).toFixed(1)}%`} detail="20% target" percent={(Number(health?.savings_rate_pct || 0) / 20) * 100} tone="text-blue-700" />
                  <Signal label="Debt-to-income" value={`${Number(debtsSummary?.debt_to_income_ratio || 0).toFixed(1)}%`} detail="Below 20% preferred" percent={100 - Number(debtsSummary?.debt_to_income_ratio || 0)} tone={debtsSummary?.debt_to_income_ratio > 40 ? 'text-rose-700' : 'text-amber-700'} />
                  <Signal label="Insurance cover" value={`${insuranceSummary?.active_policies || 0} active`} detail={formatCurrency(insuranceSummary?.total_sum_insured)} percent={insuranceSummary?.active_policies ? 100 : 8} tone={insuranceSummary?.critical_gaps?.length ? 'text-amber-700' : 'text-teal-800'} />
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-xs">
                  <span className="text-slate-500">Overall essentials score</span>
                  <span className={`font-bold ${healthTone}`}>{healthScore.toFixed(1)} / 10 · {health?.health_score_status || 'No data'}</span>
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm md:p-5 xl:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <SectionHeading title="Latest activity" detail="Most recent transactions" />
                  <button onClick={() => setActiveTab('money')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800">All activity <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
                {(txSummary?.recent_transactions || []).length ? (
                  <div className="grid gap-x-5 sm:grid-cols-2">
                    {txSummary.recent_transactions.slice(0, 4).map((transaction) => (
                      <div key={transaction.id} className="flex min-w-0 items-center justify-between gap-3 border-t border-slate-100 py-2.5 first:border-0">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${transaction.type === 'INCOME' ? 'bg-teal-50 text-teal-800' : 'bg-rose-50 text-rose-700'}`}>{transaction.type === 'INCOME' ? '+' : '−'}</span>
                          <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{transaction.description}</p><p className="truncate text-[10px] text-slate-500">{transaction.date} · {transaction.category_name || 'General'}</p></div>
                        </div>
                        <span className="shrink-0 text-xs font-bold text-slate-700">{formatCurrency(transaction.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="border-t border-slate-100 py-6 text-center text-xs text-slate-500">No transactions recorded yet.</p>}
              </section>
            </div>
          )}

          {activeView === 'wealth' && (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <SectionHeading title="Asset allocation" detail="How your current assets are distributed" action={<TrendingUp className="h-4 w-4 text-teal-700" />} />
                {allocationData.length ? <div className="mt-3 grid items-center gap-3 sm:grid-cols-[minmax(180px,0.9fr)_1.1fr]">
                  <div className="h-[270px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={allocationData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={94} paddingAngle={3}>{allocationData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(value)} contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer></div>
                  <div className="space-y-2">{(wealth?.asset_classes || []).map((asset, index) => <div key={asset.asset_class} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0"><span className="flex min-w-0 items-center gap-2 text-xs capitalize text-slate-600"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{asset.asset_class.replaceAll('_', ' ')}</span><span className="shrink-0 text-right text-xs font-semibold text-slate-800">{formatCurrency(asset.total_current_value)}<small className="ml-2 text-slate-500">{asset.allocation_percentage}%</small></span></div>)}</div>
                </div> : <div className="grid min-h-64 place-items-center text-xs text-slate-500">Add an asset to see your allocation.</div>}
              </section>
              <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <SectionHeading title="Balance sheet" detail="Assets, liabilities, and investment performance" />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-white p-3"><p className="text-[10px] text-slate-500">Net worth</p><p className="mt-1 text-lg font-bold text-teal-800">{formatCurrency(wealth?.net_worth)}</p></div>
                  <div className="rounded-md bg-white p-3"><p className="text-[10px] text-slate-500">Total assets</p><p className="mt-1 text-lg font-bold text-slate-800">{formatCurrency(wealth?.total_assets_current)}</p></div>
                  <div className="rounded-md bg-white p-3"><p className="text-[10px] text-slate-500">Invested</p><p className="mt-1 text-lg font-bold text-blue-700">{formatCurrency(wealth?.total_assets_invested)}</p></div>
                  <div className="rounded-md bg-white p-3"><p className="text-[10px] text-slate-500">Liabilities</p><p className="mt-1 text-lg font-bold text-rose-700">{formatCurrency(wealth?.total_liabilities_outstanding)}</p></div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-xs"><span className="text-slate-500">Total asset P&L</span><span className={`font-bold ${Number(wealth?.total_assets_pnl || 0) >= 0 ? 'text-teal-800' : 'text-rose-700'}`}>{formatCurrency(wealth?.total_assets_pnl)} ({Number(wealth?.total_assets_pnl_pct || 0).toFixed(1)}%)</span></div>
                <button onClick={() => setActiveTab('wealth')} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-teal-800">Manage assets <ChevronRight className="h-3.5 w-3.5" /></button>
              </section>
            </div>
          )}

          {activeView === 'cashflow' && (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <SectionHeading title="Monthly cash flow" detail="Your income, expenses, and net savings for this month" action={<Wallet className="h-4 w-4 text-blue-700" />} />
                <div className="mt-4 grid grid-cols-3 gap-3">{cashflowData.map((item) => <div key={item.name} className="border-l-2 pl-3" style={{ borderColor: item.fill }}><p className="text-[10px] text-slate-500">{item.name}</p><p className="mt-1 truncate text-base font-bold text-slate-800">{formatCurrency(item.value)}</p></div>)}</div>
                <div className="mt-4 h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={cashflowData} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}><CartesianGrid vertical={false} stroke="#e8edf2" /><XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => formatCurrency(value)} contentStyle={tooltipStyle} /><Bar dataKey="value" radius={[5, 5, 0, 0]}>{cashflowData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div>
              </section>
              <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <SectionHeading title="Savings momentum" detail="A clear view of the amount you keep" action={<ArrowUpRight className="h-4 w-4 text-teal-700" />} />
                <div className="mt-5 rounded-md bg-white p-4"><p className="text-[11px] text-slate-500">Net saved this month</p><p className="mt-1 text-2xl font-bold text-teal-800">{formatCurrency(txSummary?.net_savings)}</p><div className="mt-4 h-[130px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={cashflowData}><defs><linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity={0.25} /><stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} /></linearGradient></defs><Area dataKey="value" type="monotone" stroke="#0f766e" strokeWidth={2} fill="url(#savingsFill)" /></AreaChart></ResponsiveContainer></div></div>
                <div className="mt-3 flex items-start gap-2 rounded-md border border-teal-100 bg-teal-50 p-3 text-xs text-teal-900"><PiggyBank className="mt-0.5 h-4 w-4 shrink-0" /><span>Savings rate: <strong>{Number(health?.savings_rate_pct || 0).toFixed(1)}%</strong>. A steady habit matters more than a single month.</span></div>
                <button onClick={() => setActiveTab('money')} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-teal-800">Review transactions <ChevronRight className="h-3.5 w-3.5" /></button>
              </section>
            </div>
          )}

          {activeView === 'essentials' && (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <SectionHeading title="Your financial essentials" detail="Four signals behind your day-to-day resilience" />
                  <div className="shrink-0 text-right"><p className={`text-2xl font-bold ${healthTone}`}>{healthScore.toFixed(1)}<span className="text-xs text-slate-500"> / 10</span></p><p className="text-[10px] font-semibold text-slate-500">{health?.health_score_status || 'No data'}</p></div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Signal label="Emergency fund" value={`${Number(health?.emergency_runway_months || 0).toFixed(1)} months`} detail="6 months target" percent={(Number(health?.emergency_runway_months || 0) / 6) * 100} tone="text-teal-800" />
                  <Signal label="Savings rate" value={`${Number(health?.savings_rate_pct || 0).toFixed(1)}%`} detail="20% target" percent={(Number(health?.savings_rate_pct || 0) / 20) * 100} tone="text-blue-700" />
                  <Signal label="Debt-to-income" value={`${Number(debtsSummary?.debt_to_income_ratio || 0).toFixed(1)}%`} detail="Below 20% preferred" percent={100 - Number(debtsSummary?.debt_to_income_ratio || 0)} tone={debtsSummary?.debt_to_income_ratio > 40 ? 'text-rose-700' : 'text-amber-700'} />
                  <Signal label="Insurance cover" value={`${insuranceSummary?.active_policies || 0} active policies`} detail={formatCurrency(insuranceSummary?.total_sum_insured)} percent={insuranceSummary?.active_policies ? 100 : 8} tone={insuranceSummary?.critical_gaps?.length ? 'text-amber-700' : 'text-teal-800'} />
                </div>
                {insuranceSummary?.critical_gaps?.length > 0 && <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Coverage review: {insuranceSummary.critical_gaps.join('; ')}</p>}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <button onClick={() => setActiveTab('essentials')} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Review essentials</button>
                  <button onClick={() => setActiveTab('debts')} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Manage debt</button>
                  <button onClick={() => setActiveTab('insurance')} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Review insurance</button>
                </div>
              </section>
              <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <SectionHeading title="Plan & next steps" detail="Goals and useful actions" action={<Target className="h-4 w-4 text-amber-700" />} />
                <div className="mt-3 rounded-md bg-white p-3">
                  <div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-700">Goal progress</span><span className="font-bold text-teal-800">{goalProgress.toFixed(0)}%</span></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-700" style={{ width: `${goalProgress}%` }} /></div>
                  <div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>{goalsSummary?.active_goals || 0} active goals</span><span>{formatCurrency(goalsSummary?.total_current_amount)} of {formatCurrency(goalsSummary?.total_target_amount)}</span></div>
                </div>
                {(recommendations.length > 0 || aiAudit?.insights?.length > 0) ? <div className="mt-2 space-y-2">{(recommendations.length ? recommendations : aiAudit.insights).slice(0, 2).map((item, index) => <div key={item.id || item.title || index} className="rounded-md border border-slate-200 bg-white p-3"><div className="flex items-start gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /><div className="min-w-0"><p className="text-xs font-bold text-slate-800">{item.title || 'Financial insight'}</p><p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{item.description || item.summary}</p></div></div></div>)}</div> : <p className="mt-2 rounded-md border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">No recommendations yet. Keep your goals and transactions up to date.</p>}
                <button onClick={() => setActiveTab('goals')} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-800">Open goals <ChevronRight className="h-3.5 w-3.5" /></button>
              </section>
            </div>
          )}
        </div>
      )}
      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
        <span>Personal financial overview</span>
        <span className="inline-flex items-center gap-1"><Shield className="h-3 w-3" /> Amounts {hideAmounts ? 'hidden' : 'visible'} · private to your account</span>
      </footer>
    </div>
  );
}
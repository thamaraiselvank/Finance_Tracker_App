import React, { useState, useEffect, useRef } from 'react';
import { Plus, CreditCard, TrendingDown, AlertCircle, Zap, Trash2 } from 'lucide-react';
import api from '../services/api';
import { inrInWords } from '../utils/numberWords';
import useCurrency from '../utils/useCurrency';
import ConfirmDialog from '../components/ConfirmDialog';
import PageGuide from '../components/PageGuide';

const emptyDebt = {
    debt_name: '',
    debt_type: 'PERSONAL_LOAN',
    principal_amount: '',
    current_outstanding: '',
    interest_rate_pct: '',
    tenure_months: '',
    monthly_emi: '',
    start_date: '',
    end_date: '',
    total_interest_paid: '',
    creditor_name: ''
  };

const addMonthsToDate = (dateValue, months) => {
  if (!dateValue || !months) return '';
  const [year, month, day] = dateValue.split('-').map(Number);
  const targetMonth = month - 1 + Number(months);
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const targetDay = Math.min(day, lastDay);
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
};

const getMonthsBetweenDates = (startDate, endDate) => {
  if (!startDate || !endDate || endDate < startDate) return '';
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  let months = (endYear - startYear) * 12 + endMonth - startMonth;
  if (endDay > startDay) months += 1;
  return Math.max(1, months);
};

const calculateEstimatedInterest = (principal, annualRate, monthlyEmi, tenureMonths) => {
  let balance = Number(principal) || 0;
  const rate = (Number(annualRate) || 0) / 1200;
  let payment = Number(monthlyEmi) || 0;
  const months = Number(tenureMonths) || 0;
  if (!balance || !months) return null;
  if (payment <= 0) {
    payment = rate > 0
      ? balance * rate / (1 - Math.pow(1 + rate, -months))
      : balance / months;
  }

  let totalInterest = 0;
  for (let month = 0; month < Math.min(months, 600) && balance > 0; month += 1) {
    const interest = balance * rate;
    if (payment <= interest) return null;
    totalInterest += interest;
    balance = Math.max(0, balance + interest - payment);
  }
  return balance <= 0.01 ? totalInterest : null;
};

const formatDate = (dateValue) => {
  if (!dateValue) return 'N/A';
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
};

export default function DebtsPage() {
  const { currency, formatCurrency, currencySymbol } = useCurrency();
  const [debts, setDebts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyError, setStrategyError] = useState('');
  const strategyRequestVersion = useRef(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [strategyType, setStrategyType] = useState('avalanche');
  const [editingDebt, setEditingDebt] = useState(null);
  const [debtToDelete, setDebtToDelete] = useState(null);
  const [newDebt, setNewDebt] = useState(emptyDebt);

  useEffect(() => {
    fetchDebts();
    fetchSummary();
  }, []);

  const fetchDebts = async () => {
    try {
      const response = await api.get('/debts/');
      setDebts(Array.isArray(response.data) ? response.data : []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching debts:', error);
      setDebts([]);
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await api.get('/debts/summary/overview');
      setSummary(response.data || null);
    } catch (error) {
      console.error('Error fetching summary:', error);
      setSummary(null);
    }
  };

  const fetchStrategy = async () => {
    const requestVersion = ++strategyRequestVersion.current;
    setStrategy(null);
    setStrategyError('');
    setStrategyLoading(true);
    try {
      const endpoint = strategyType === 'avalanche' ? '/debts/strategy/avalanche' : '/debts/strategy/snowball';
      const response = await api.get(endpoint);
      if (requestVersion === strategyRequestVersion.current) {
        setStrategy(response.data);
      }
    } catch (error) {
      console.error('Error fetching strategy:', error);
      if (requestVersion === strategyRequestVersion.current) {
        setStrategyError('Unable to load the payoff strategy. Please try again.');
      }
    } finally {
      if (requestVersion === strategyRequestVersion.current) {
        setStrategyLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchStrategy();
  }, [strategyType]);

  const openAddDebt = () => {
    setEditingDebt(null);
    setNewDebt(emptyDebt);
    setShowModal(true);
  };

  const openEditDebt = (debt) => {
    setEditingDebt(debt);
    setNewDebt({
      debt_name: debt.debt_name || '',
      debt_type: debt.debt_type || 'PERSONAL_LOAN',
      principal_amount: debt.principal_amount ?? '',
      current_outstanding: debt.current_outstanding ?? '',
      interest_rate_pct: debt.interest_rate_pct ?? '',
      tenure_months: debt.tenure_months ?? '',
      monthly_emi: debt.monthly_emi ?? '',
      start_date: debt.start_date || '',
      end_date: debt.end_date || '',
      total_interest_paid: debt.total_interest_paid ?? '',
      creditor_name: debt.creditor_name || ''
    });
    setShowModal(true);
  };

  const updateLoanDate = (field, value) => {
    setNewDebt((current) => {
      const updated = { ...current, [field]: value };
      if (field === 'start_date') {
        if (updated.tenure_months) {
          updated.end_date = addMonthsToDate(value, updated.tenure_months);
        } else if (value && updated.end_date) {
          updated.tenure_months = getMonthsBetweenDates(value, updated.end_date);
        }
      } else if (field === 'end_date' && updated.start_date) {
        updated.tenure_months = getMonthsBetweenDates(updated.start_date, value);
      }
      return updated;
    });
  };

  const updateTenure = (value) => {
    setNewDebt((current) => ({
      ...current,
      tenure_months: value,
      end_date: value && current.start_date ? addMonthsToDate(current.start_date, value) : current.end_date,
    }));
  };

  const updateNonNegativeNumber = (field, value) => {
    setNewDebt((current) => ({
      ...current,
      [field]: value === '' ? '' : Math.max(0, Number(value) || 0),
    }));
  };

  const handleSaveDebt = async () => {
    const payload = {
      debt_name: newDebt.debt_name.trim(),
      debt_type: newDebt.debt_type,
      principal_amount: Number(newDebt.principal_amount || newDebt.current_outstanding || 0),
      current_outstanding: Number(newDebt.current_outstanding || 0),
      interest_rate_pct: Number(newDebt.interest_rate_pct || 0),
      tenure_months: newDebt.tenure_months ? Number(newDebt.tenure_months) : null,
      monthly_emi: Number(newDebt.monthly_emi || 0),
      start_date: newDebt.start_date || null,
      end_date: newDebt.end_date || null,
      total_interest_paid: Number(newDebt.total_interest_paid || 0),
      creditor_name: newDebt.creditor_name?.trim() || null
    };

    if (
      !payload.debt_name ||
      payload.principal_amount <= 0 ||
      payload.current_outstanding < 0 ||
      (payload.tenure_months !== null && payload.tenure_months <= 0) ||
      (payload.start_date && payload.end_date && payload.end_date <= payload.start_date)
    ) {
      alert('Please enter valid debt details, including a positive tenure and an end date after the start date.');
      return;
    }

    try {
      if (editingDebt) {
        await api.put(`/debts/${editingDebt.id}`, payload);
      } else {
        await api.post('/debts/', payload);
      }

      setShowModal(false);
      setEditingDebt(null);
      setNewDebt(emptyDebt);
      await Promise.all([fetchDebts(), fetchSummary(), fetchStrategy()]);
    } catch (error) {
      console.error('Error saving debt:', error);
      alert(error.response?.data?.detail || 'Unable to save this debt. Please try again.');
    }
  };

  const handleDeleteDebt = async () => {
    await api.delete(`/debts/${debtToDelete.id}`);
    await Promise.all([fetchDebts(), fetchSummary(), fetchStrategy()]);
  };

  const getDebtIcon = (debtType) => {
    const icons = {
      'CREDIT_CARD': '💳',
      'PERSONAL_LOAN': '💰',
      'HOME_LOAN': '🏠',
      'CAR_LOAN': '🚗',
      'EDUCATION_LOAN': '🎓',
      'GOLD_LOAN': '💍',
      'BUSINESS_LOAN': '💼',
      'OTHER': '📋'
    };
    return icons[debtType] || '📋';
  };

  const getRiskBadge = (debtToIncome) => {
    if (debtToIncome < 20) return { color: 'bg-emerald-500/20 text-emerald-400', label: 'Healthy' };
    if (debtToIncome < 40) return { color: 'bg-yellow-500/20 text-yellow-400', label: 'Caution' };
    return { color: 'bg-red-500/20 text-red-400', label: 'Critical' };
  };

  if (loading) {
    return <div className="text-center text-slate-400">Loading debts...</div>;
  }

  const riskBadge = getRiskBadge(summary?.debt_to_income_ratio || 0);
  const estimatedInterest = calculateEstimatedInterest(
    newDebt.principal_amount,
    newDebt.interest_rate_pct,
    newDebt.monthly_emi,
    newDebt.tenure_months
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight font-display">Debt Management</h1>
          <p className="text-xs text-slate-400 mt-0.5">Track and strategize your debt payoff</p>
        </div>
        <button
          onClick={openAddDebt}
          className="btn-aurora flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Debt
        </button>
      </div>

      <PageGuide
        title="Debts: understand balances and payoff options"
        summary="Track what you owe, the interest rate, and payment schedule. Strategies compare possible payoff orders using your entries."
        steps={['Use the current outstanding balance from your lender statement.', 'Add the interest rate and monthly payment if known.', 'Compare avalanche and snowball estimates; choose based on your circumstances.']}
        terms={[{ term: 'Principal', definition: 'The amount originally borrowed.' }, { term: 'Outstanding', definition: 'The amount still owed now.' }, { term: 'EMI', definition: 'A regular loan payment that usually includes principal and interest.' }]}
      />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Total Debt</p>
            <p className="finance-summary-value font-bold text-red-400">{formatCurrency(summary.total_outstanding)}</p>
          </div>
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Monthly EMI</p>
            <p className="finance-summary-value font-bold text-orange-400">{formatCurrency(summary.total_monthly_emi)}</p>
          </div>
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Avg Interest Rate</p>
            <p className="finance-summary-value font-bold text-yellow-400">{summary.total_interest_rate_avg?.toFixed(2)}%</p>
          </div>
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Debt-to-Income Ratio</p>
            <p className={`finance-summary-value font-bold ${riskBadge.color.split(' ')[0].replace('bg-', 'text-').split('/')[0]}-400`}>{summary.debt_to_income_ratio?.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Debt Free Timeline Alert */}
      {summary?.estimated_debt_free_date && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex items-start gap-3">
          <Zap className="text-blue-400 mt-1" size={20} />
          <div>
            <p className="text-blue-400 font-semibold">Projected Debt-Free Date</p>
            <p className="text-slate-300">
              At current payment rate: {new Date(summary.estimated_debt_free_date).toLocaleDateString()} ({summary.debt_free_months} months)
            </p>
          </div>
        </div>
      )}

      {/* Payoff Strategy Section */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-2xl font-bold text-white mb-4">Payoff Strategies</h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setStrategyType('avalanche')}
            className={`p-4 rounded-lg border transition-all ${
              strategyType === 'avalanche'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            <p className="font-semibold mb-1">Avalanche Strategy</p>
            <p className="text-sm">Pay highest interest first</p>
          </button>
          <button
            onClick={() => setStrategyType('snowball')}
            className={`p-4 rounded-lg border transition-all ${
              strategyType === 'snowball'
                ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            <p className="font-semibold mb-1">Snowball Strategy</p>
            <p className="text-sm">Pay smallest amount first</p>
          </button>
        </div>

        {/* Strategy Details */}
        {strategyLoading ? (
          <p className="text-sm text-slate-300">Calculating payoff plan...</p>
        ) : strategyError ? (
          <p className="text-sm text-red-300">{strategyError}</p>
        ) : strategy && (
          <div className="bg-slate-700 p-4 rounded-lg">
            {strategy.recommended_order?.length ? (
              <>
                <p className="text-slate-300 mb-4">
                  <span className="font-semibold">Months to Payoff:</span> {strategy.months_to_complete >= 600 ? '600+ months' : `${strategy.months_to_complete} months`}
                </p>
                {strategyType === 'avalanche' && strategy.total_interest_saved > 0 && (
                  <p className="text-emerald-400">
                    <span className="font-semibold">Interest Saved:</span> {formatCurrency(strategy.total_interest_saved)}
                  </p>
                )}
                <div className="mt-4 space-y-2">
                  <p className="font-semibold text-white">Payoff Order:</p>
                  {strategy.recommended_order.map((item, idx) => (
                    <div key={idx} className="text-sm text-slate-300 bg-slate-800 p-2 rounded">
                      {idx + 1}. {item.debt_name} ({Number(item.interest_rate_pct || 0).toFixed(2)}%) - {item.months_to_payoff >= 600 ? '600+ months' : `${item.months_to_payoff} months`}
                      {item.payoff_date && <span className="block mt-1 text-xs text-slate-400">Estimated payoff: {new Date(`${item.payoff_date}T00:00:00`).toLocaleDateString()}</span>}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-300">
                No outstanding debts to include in a payoff strategy. Add a debt or update an existing balance to see your plan.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Debts List */}
      <div className="space-y-4">
        {debts && debts.length > 0 ? (
          debts.map(debt => (
            <div key={debt.id} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{getDebtIcon(debt.debt_type)}</div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{debt.debt_name}</h3>
                    <p className="text-slate-400 text-sm">
                      {debt.debt_type.replace(/_/g, ' ')} • {debt.creditor_name}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    onClick={() => openEditDebt(debt)}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDebtToDelete(debt)}
                    title="Delete debt"
                    aria-label={`Delete ${debt.debt_name}`}
                    className="grid h-8 w-8 place-items-center rounded-md border border-rose-400/15 bg-rose-500/[0.06] text-rose-300 transition hover:bg-rose-500/15"
                  >
                    <Trash2 size={14} />
                  </button>
                  {debt.interest_rate_pct > 12 && (
                  <div className="flex items-center gap-1 text-red-400 text-sm bg-red-500/10 px-2 py-1 rounded">
                    <AlertCircle size={16} /> High Interest
                  </div>
                )}
                </div>
              </div>

              {/* Debt Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 py-4 border-t border-b border-slate-700">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Original Principal</p>
                  <p className="finance-detail-value font-bold text-slate-200">{formatCurrency(debt.principal_amount)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Outstanding</p>
                  <p className="finance-detail-value font-bold text-white">{formatCurrency(debt.current_outstanding)}</p>
                  <p className="break-words text-xs text-slate-400">{inrInWords(debt.current_outstanding, currency)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Monthly EMI</p>
                  <p className="finance-detail-value font-bold text-orange-400">{formatCurrency(debt.monthly_emi)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Interest Rate</p>
                  <p className="finance-detail-value font-bold text-yellow-400">{debt.interest_rate_pct}%</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Tenure</p>
                  <p className="finance-detail-value font-bold text-slate-300">{debt.tenure_months ? `${debt.tenure_months} months` : 'Not set'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Interest Paid to Date</p>
                  <p className="finance-detail-value font-bold text-emerald-400">{formatCurrency(debt.total_interest_paid || 0)}</p>
                </div>
              </div>

              {/* Payoff Info */}
              <div className="mt-4 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <TrendingDown size={16} className="text-slate-400" />
                  <span className="text-slate-300">
                    Started: <span className="font-semibold text-white">{formatDate(debt.start_date)}</span>
                    <span className="mx-2 text-slate-500">•</span>
                    Loan end date: <span className="font-semibold text-white">
                      {formatDate(debt.end_date)}
                    </span>
                  </span>
                </div>
                {debt.priority_payoff && (
                  <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-semibold">
                    Priority
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-slate-800 rounded-lg border border-slate-700">
            <CreditCard size={48} className="mx-auto text-slate-500 mb-4" />
            <p className="text-slate-300 text-lg font-semibold mb-2">No debts recorded</p>
            <p className="text-slate-400 mb-6">Great! You're debt-free or haven't recorded your debts yet</p>
            <button
              onClick={openAddDebt}
              className="bg-emerald-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-emerald-600 transition-all inline-flex items-center gap-2"
            >
              <Plus size={18} /> Add Debt
            </button>
          </div>
        )}
      </div>

      {/* Create Debt Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 md:p-8 max-w-3xl w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">{editingDebt ? 'Edit Debt' : 'Add New Debt'}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Debt Name</label>
                <input
                  type="text"
                  value={newDebt.debt_name}
                  onChange={(e) => setNewDebt({...newDebt, debt_name: e.target.value})}
                  placeholder="e.g., Home Loan"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Debt Type</label>
                <select
                  value={newDebt.debt_type}
                  onChange={(e) => setNewDebt({...newDebt, debt_type: e.target.value})}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="PERSONAL_LOAN">Personal Loan</option>
                  <option value="HOME_LOAN">Home Loan</option>
                  <option value="CAR_LOAN">Car Loan</option>
                  <option value="EDUCATION_LOAN">Education Loan</option>
                  <option value="GOLD_LOAN">Gold Loan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Original Principal ({currencySymbol})</label>
                <input
                  type="number"
                  min="0"
                  value={newDebt.principal_amount}
                  onChange={(e) => updateNonNegativeNumber('principal_amount', e.target.value)}
                  placeholder="Enter principal amount"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                {newDebt.principal_amount !== '' && <p className="text-xs text-slate-400 mt-1">{inrInWords(newDebt.principal_amount, currency)}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Outstanding Amount ({currencySymbol})</label>
                <input
                  type="number"
                  min="0"
                  value={newDebt.current_outstanding}
                  onChange={(e) => updateNonNegativeNumber('current_outstanding', e.target.value)}
                  placeholder="Enter outstanding amount"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                {newDebt.current_outstanding !== '' && <p className="text-xs text-slate-400 mt-1">{inrInWords(newDebt.current_outstanding, currency)}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={newDebt.interest_rate_pct}
                  onChange={(e) => updateNonNegativeNumber('interest_rate_pct', e.target.value)}
                  placeholder="Enter interest rate"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Monthly EMI ({currencySymbol})</label>
                <input
                  type="number"
                  min="0"
                  value={newDebt.monthly_emi}
                  onChange={(e) => updateNonNegativeNumber('monthly_emi', e.target.value)}
                  placeholder="Enter monthly EMI"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                {newDebt.monthly_emi !== '' && <p className="text-xs text-slate-400 mt-1">{inrInWords(newDebt.monthly_emi, currency)}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Loan Tenure (months)</label>
                <input
                  type="number"
                  min="1"
                  list="loan-tenure-options"
                  value={newDebt.tenure_months}
                  onChange={(e) => updateTenure(e.target.value)}
                  placeholder="e.g., 60"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                <datalist id="loan-tenure-options">
                  {[6, 12, 24, 36, 60, 84, 120, 180, 240, 300, 360].map((months) => (
                    <option key={months} value={months}>{months} months</option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Loan Start Date</label>
                <input
                  type="date"
                  value={newDebt.start_date}
                  onChange={(e) => updateLoanDate('start_date', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Loan End Date</label>
                <input
                  type="date"
                  value={newDebt.end_date}
                  onChange={(e) => updateLoanDate('end_date', e.target.value)}
                  min={newDebt.start_date || undefined}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                <p className="text-xs text-slate-400 mt-1">Calculated from the start date and tenure, or set a date to calculate the tenure.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Interest Paid to Date ({currencySymbol})</label>
                <input
                  type="number"
                  min="0"
                  value={newDebt.total_interest_paid}
                  onChange={(e) => updateNonNegativeNumber('total_interest_paid', e.target.value)}
                  placeholder="Enter interest already paid"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                <p className="text-xs text-slate-400 mt-1">Enter the actual interest paid so far from your loan statement.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Creditor Name</label>
                <input
                  type="text"
                  value={newDebt.creditor_name}
                  onChange={(e) => setNewDebt({...newDebt, creditor_name: e.target.value})}
                  placeholder="e.g., HDFC Bank"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
            </div>

            {newDebt.principal_amount && newDebt.tenure_months && (
              <div className="mt-4 rounded-lg border border-slate-600 bg-slate-700/60 p-4">
                <p className="text-sm font-medium text-slate-300">Estimated total interest over the loan</p>
                <p className="mt-1 text-xl font-bold text-emerald-400">
                  {estimatedInterest === null ? 'Unable to estimate with this EMI' : formatCurrency(estimatedInterest)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Estimate based on original principal, annual interest rate, tenure, and monthly EMI. Track actual interest paid separately below.
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDebt}
                className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all font-semibold"
              >
                {editingDebt ? 'Save Changes' : 'Add Debt'}
              </button>
            </div>
          </div>
        </div>
      )}
      {debtToDelete && (
        <ConfirmDialog
          title={`Delete "${debtToDelete.debt_name}"?`}
          description="This debt record will be permanently deleted. This cannot be undone."
          onCancel={() => setDebtToDelete(null)}
          onConfirm={handleDeleteDebt}
        />
      )}
    </div>
  );
}

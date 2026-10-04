import React, { useState, useEffect } from 'react';
import { Plus, CreditCard, TrendingDown, AlertCircle, Zap } from 'lucide-react';
import api from '../services/api';
import { inrInWords } from '../utils/numberWords';

const emptyDebt = {
    debt_name: '',
    debt_type: 'PERSONAL_LOAN',
    principal_amount: 0,
    current_outstanding: 0,
    interest_rate_pct: 0,
    tenure_months: 0,
    monthly_emi: 0,
    creditor_name: ''
  };

export default function DebtsPage() {
  const [debts, setDebts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [strategyType, setStrategyType] = useState('avalanche');
  const [editingDebt, setEditingDebt] = useState(null);
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
    try {
      const endpoint = strategyType === 'avalanche' ? '/debts/strategy/avalanche' : '/debts/strategy/snowball';
      const response = await api.get(endpoint);
      setStrategy(response.data);
    } catch (error) {
      console.error('Error fetching strategy:', error);
    }
  };

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
      principal_amount: debt.principal_amount || 0,
      current_outstanding: debt.current_outstanding || 0,
      interest_rate_pct: debt.interest_rate_pct || 0,
      tenure_months: debt.tenure_months || 0,
      monthly_emi: debt.monthly_emi || 0,
      creditor_name: debt.creditor_name || ''
    });
    setShowModal(true);
  };

  const handleSaveDebt = async () => {
    const payload = {
      debt_name: newDebt.debt_name.trim(),
      debt_type: newDebt.debt_type,
      principal_amount: Number(newDebt.principal_amount || newDebt.current_outstanding || 0),
      current_outstanding: Number(newDebt.current_outstanding || 0),
      interest_rate_pct: Number(newDebt.interest_rate_pct || 0),
      tenure_months: Number(newDebt.tenure_months || 0),
      monthly_emi: Number(newDebt.monthly_emi || 0),
      creditor_name: newDebt.creditor_name?.trim() || null
    };

    if (!payload.debt_name || payload.principal_amount <= 0 || payload.current_outstanding < 0) {
      alert('Please enter a debt name, principal amount, and outstanding amount.');
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
      fetchDebts();
      fetchSummary();
    } catch (error) {
      console.error('Error saving debt:', error);
    }
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

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Total Debt</p>
            <p className="text-3xl font-bold text-red-400">₹{(summary.total_outstanding || 0).toLocaleString()}</p>
          </div>
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Monthly EMI</p>
            <p className="text-3xl font-bold text-orange-400">₹{(summary.total_monthly_emi || 0).toLocaleString()}</p>
          </div>
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Avg Interest Rate</p>
            <p className="text-3xl font-bold text-yellow-400">{summary.total_interest_rate_avg?.toFixed(2)}%</p>
          </div>
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Debt-to-Income Ratio</p>
            <p className={`text-3xl font-bold ${riskBadge.color.split(' ')[0].replace('bg-', 'text-').split('/')[0]}-400`}>{summary.debt_to_income_ratio?.toFixed(1)}%</p>
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
            onClick={() => { setStrategyType('avalanche'); fetchStrategy(); }}
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
            onClick={() => { setStrategyType('snowball'); fetchStrategy(); }}
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
        {strategy && (
          <div className="bg-slate-700 p-4 rounded-lg">
            <p className="text-slate-300 mb-4">
              <span className="font-semibold">Months to Payoff:</span> {strategy.months_to_complete} months
            </p>
            {strategyType === 'avalanche' && strategy.total_interest_saved && (
              <p className="text-emerald-400">
                <span className="font-semibold">Interest Saved:</span> ₹{strategy.total_interest_saved.toLocaleString()}
              </p>
            )}
            {strategy.recommended_order && strategy.recommended_order.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="font-semibold text-white">Payoff Order:</p>
                {strategy.recommended_order.map((item, idx) => (
                  <div key={idx} className="text-sm text-slate-300 bg-slate-800 p-2 rounded">
                    {idx + 1}. {item.debt_name} - {item.months_to_payoff} months
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Debts List */}
      <div className="space-y-4">
        {debts && debts.length > 0 ? (
          debts.map(debt => (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-all">
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditDebt(debt)}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-all"
                  >
                    Edit
                  </button>
                  {debt.interest_rate_pct > 12 && (
                  <div className="flex items-center gap-1 text-red-400 text-sm bg-red-500/10 px-2 py-1 rounded">
                    <AlertCircle size={16} /> High Interest
                  </div>
                )}
                </div>
              </div>

              {/* Debt Details Grid */}
              <div className="grid grid-cols-4 gap-4 py-4 border-t border-b border-slate-700">
                <div>
                  <p className="text-xs text-slate-400">Outstanding</p>
                  <p className="text-lg font-bold text-white">₹{(debt.current_outstanding || 0).toLocaleString()}</p>
                  <p className="text-xs text-slate-400">{inrInWords(debt.current_outstanding)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Monthly EMI</p>
                  <p className="text-lg font-bold text-orange-400">₹{(debt.monthly_emi || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Interest Rate</p>
                  <p className="text-lg font-bold text-yellow-400">{debt.interest_rate_pct}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Tenure</p>
                  <p className="text-lg font-bold text-slate-300">{debt.tenure_months} months</p>
                </div>
              </div>

              {/* Payoff Info */}
              <div className="mt-4 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <TrendingDown size={16} className="text-slate-400" />
                  <span className="text-slate-300">
                    Debt-free by: <span className="font-semibold text-white">
                      {debt.end_date ? new Date(debt.end_date).toLocaleDateString() : 'N/A'}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full border border-slate-700 max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">{editingDebt ? 'Edit Debt' : 'Add New Debt'}</h2>

            <div className="space-y-4">
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
                <label className="block text-sm font-medium text-slate-300 mb-1">Original Principal (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={newDebt.principal_amount}
                  onChange={(e) => setNewDebt({...newDebt, principal_amount: e.target.value === '' ? 0 : Number(e.target.value)})}
                  placeholder="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                <p className="text-xs text-slate-400 mt-1">{inrInWords(newDebt.principal_amount)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Outstanding Amount (₹)</label>
                <input
                  type="number"
                  value={newDebt.current_outstanding}
                  onChange={(e) => setNewDebt({...newDebt, current_outstanding: e.target.value === '' ? 0 : Number(e.target.value)})}
                  placeholder="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                <p className="text-xs text-slate-400 mt-1">{inrInWords(newDebt.current_outstanding)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newDebt.interest_rate_pct}
                  onChange={(e) => setNewDebt({...newDebt, interest_rate_pct: e.target.value === '' ? 0 : Number(e.target.value)})}
                  placeholder="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Monthly EMI (₹)</label>
                <input
                  type="number"
                  value={newDebt.monthly_emi}
                  onChange={(e) => setNewDebt({...newDebt, monthly_emi: e.target.value === '' ? 0 : Number(e.target.value)})}
                  placeholder="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                <p className="text-xs text-slate-400 mt-1">{inrInWords(newDebt.monthly_emi)}</p>
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
    </div>
  );
}

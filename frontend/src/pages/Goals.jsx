import React, { useState, useEffect } from 'react';
import { Plus, Target, TrendingUp, Calendar, AlertCircle, CheckCircle2, Trash2, Pencil } from 'lucide-react';
import api from '../services/api';
import { inrInWords } from '../utils/numberWords';

const emptyGoal = {
    goal_name: '',
    goal_type: 'WEALTH_BUILD',
    target_amount: 0,
    current_amount: 0,
    target_date: '',
    priority: 3,
    description: '',
    allocated_monthly_savings: 0
  };

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [summary, setSummary] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [newGoal, setNewGoal] = useState(emptyGoal);

  useEffect(() => {
    fetchGoals();
    fetchSummary();
  }, []);

  const fetchGoals = async () => {
    try {
      const response = await api.get('/goals/');
      setGoals(Array.isArray(response.data) ? response.data : []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching goals:', error);
      setGoals([]);
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await api.get('/goals/summary/progress');
      setSummary(response.data || null);
    } catch (error) {
      console.error('Error fetching summary:', error);
      setSummary(null);
    }
  };

  const openAddGoal = () => {
    setEditingGoal(null);
    setNewGoal(emptyGoal);
    setShowModal(true);
  };

  const openEditGoal = (goal) => {
    setEditingGoal(goal);
    setNewGoal({
      goal_name: goal.goal_name || '',
      goal_type: goal.goal_type || 'WEALTH_BUILD',
      target_amount: goal.target_amount || 0,
      current_amount: goal.current_amount || 0,
      target_date: goal.target_date ? goal.target_date.split('T')[0] : '',
      priority: goal.priority || 3,
      description: goal.description || '',
      allocated_monthly_savings: goal.allocated_monthly_savings || 0
    });
    setShowModal(true);
  };

  const handleSaveGoal = async () => {
    const payload = {
      ...newGoal,
      goal_name: newGoal.goal_name.trim(),
      target_amount: Number(newGoal.target_amount || 0),
      current_amount: Number(newGoal.current_amount || 0),
      priority: Number(newGoal.priority || 3),
      allocated_monthly_savings: Number(newGoal.allocated_monthly_savings || 0),
      target_date: newGoal.target_date || null,
      description: newGoal.description?.trim() || null
    };

    if (!payload.goal_name || payload.target_amount <= 0 || !payload.target_date) {
      alert('Please enter a goal name, target amount, and target date.');
      return;
    }

    try {
      if (editingGoal) {
        await api.put(`/goals/${editingGoal.id}`, payload);
      } else {
        await api.post('/goals/', payload);
      }

      setShowModal(false);
      setEditingGoal(null);
      setNewGoal(emptyGoal);
      fetchGoals();
      fetchSummary();
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  };

  const handleDeleteGoal = async (goal) => {
    if (!window.confirm(`Delete "${goal.goal_name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/goals/${goal.id}`);
      setGoals((currentGoals) => currentGoals.filter((item) => item.id !== goal.id));
      await Promise.all([fetchGoals(), fetchSummary()]);
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('Unable to delete this goal. Please try again.');
    }
  };

  const getGoalIcon = (goalType) => {
    const icons = {
      'RETIREMENT': '🏖️',
      'DOWN_PAYMENT': '🏠',
      'DEBT_PAYOFF': '💳',
      'WEALTH_BUILD': '💰',
      'EDUCATION': '🎓',
      'BUSINESS': '💼',
      'EMERGENCY_FUND': '🆘',
      'VACATION': '✈️',
      'OTHER': '⭐'
    };
    return icons[goalType] || '⭐';
  };

  const calculateProgress = (goal) => {
    if (!goal.target_amount) return 0;
    return Math.min((goal.current_amount / goal.target_amount) * 100, 100);
  };

  const getGoalMetrics = (goal) => {
    const targetAmount = Number(goal.target_amount || 0);
    const currentAmount = Number(goal.current_amount || 0);
    const remainingAmount = Math.max(targetAmount - currentAmount, 0);
    const daysRemaining = Math.max(
      Math.ceil((new Date(goal.target_date) - new Date()) / (1000 * 60 * 60 * 24)),
      1
    );
    const monthsRemaining = Math.max(Math.ceil(daysRemaining / 30), 1);
    const requiredMonthly = remainingAmount / monthsRemaining;
    const allocatedMonthly = Number(goal.allocated_monthly_savings || 0);
    const monthlyShortfall = Math.max(requiredMonthly - allocatedMonthly, 0);

    return {
      savedPercentage: targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0,
      remainingAmount,
      remainingPercentage: targetAmount > 0 ? (remainingAmount / targetAmount) * 100 : 0,
      requiredMonthly,
      allocatedMonthly,
      monthlyShortfall,
      monthsRemaining
    };
  };

  const getGoalInsight = (goal, metrics) => {
    if (metrics.remainingAmount <= 0) return 'Goal achieved. Keep this amount protected for its intended purpose.';
    if (metrics.allocatedMonthly >= metrics.requiredMonthly) {
      return `On track: your planned ${formatCurrency(metrics.allocatedMonthly)}/month can reach this goal by the target date.`;
    }
    if (metrics.allocatedMonthly > 0) {
      return `Increase monthly savings by ${formatCurrency(metrics.monthlyShortfall)} to reach this goal on time.`;
    }
    return `Set aside ${formatCurrency(metrics.requiredMonthly)} per month to reach this goal by the target date.`;
  };

  const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const getRequiredMonthlySavings = (goal) => {
    const remainingAmount = Math.max((goal.target_amount || 0) - (goal.current_amount || 0), 0);
    const daysRemaining = Math.max(
      Math.ceil((new Date(goal.target_date) - new Date()) / (1000 * 60 * 60 * 24)),
      1
    );
    const monthsRemaining = Math.max(Math.ceil(daysRemaining / 30), 1);
    return remainingAmount / monthsRemaining;
  };

  if (loading) {
    return <div className="text-center text-slate-400">Loading goals...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight font-display">Financial Goals</h1>
          <p className="text-xs text-slate-400 mt-0.5">Track and achieve your financial milestones</p>
        </div>
        <button
          onClick={openAddGoal}
          className="btn-aurora flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Goal
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Total Goals</p>
            <p className="text-3xl font-bold text-white">{summary.total_goals}</p>
          </div>
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Active</p>
            <p className="text-3xl font-bold text-emerald-400">{summary.active_goals}</p>
          </div>
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Completed</p>
            <p className="text-3xl font-bold text-emerald-400">{summary.completed_goals}</p>
          </div>
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Overall Saved</p>
            <p className="text-3xl font-bold text-cyan-400">
              {summary.total_target_amount > 0
                ? Math.min((summary.total_current_amount / summary.total_target_amount) * 100, 100).toFixed(1)
                : '0.0'}%
            </p>
          </div>
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Overall Remaining</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(Math.max((summary.total_target_amount || 0) - (summary.total_current_amount || 0), 0))}
            </p>
          </div>
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Monthly Allocation</p>
            <p className="text-3xl font-bold text-purple-400">{formatCurrency(summary.total_monthly_allocation)}</p>
          </div>
        </div>
      )}

      {/* Goals List */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {goals && goals.length > 0 ? (
          goals.map(goal => (
            <article key={goal.id} className="finance-detail-card group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5">
              {(() => {
                const metrics = getGoalMetrics(goal);
                return (
                  <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="finance-card-icon grid h-12 w-12 shrink-0 place-items-center text-2xl">{getGoalIcon(goal.goal_type)}</div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-white" title={goal.goal_name}>{goal.goal_name}</h3>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">{goal.description || goal.goal_type.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={`px-2.5 py-1 text-[10px] uppercase tracking-wide ${
                  goal.status === 'COMPLETED' ? 'finance-status-complete' :
                  goal.status === 'PAUSED' ? 'finance-status-paused' :
                  'finance-status-active'
                }`}>
                  {goal.status}
                </span>
                  <button
                    onClick={() => openEditGoal(goal)}
                    title="Edit goal"
                    aria-label={`Edit ${goal.goal_name}`}
                    className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 hover:text-white"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteGoal(goal)}
                    title="Delete goal"
                    aria-label={`Delete ${goal.goal_name}`}
                    className="grid h-8 w-8 place-items-center rounded-md border border-rose-400/15 bg-rose-500/[0.06] text-rose-300 transition hover:bg-rose-500/15"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="finance-card-feature mt-5 p-4">
                <div className="mb-2.5 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Saved so far</p>
                    <p className="mt-1 truncate text-xl font-bold text-white">{formatCurrency(goal.current_amount)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Target</p>
                    <p className="mt-1 text-sm font-semibold text-slate-300">{formatCurrency(goal.target_amount)}</p>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-700/80">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-700"
                    style={{ width: `${metrics.savedPercentage}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="finance-accent-success font-bold">{metrics.savedPercentage.toFixed(1)}% complete</span>
                  <span className="text-slate-400">{formatCurrency(metrics.remainingAmount)} to go</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="finance-card-meta flex min-w-0 items-center gap-2 px-3 py-2.5">
                  <Calendar size={15} className="finance-accent-info shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-500">Target date</p>
                    <p className="text-xs font-semibold text-slate-200">
                      {goal.target_date ? new Date(goal.target_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'Not set'}
                    </p>
                  </div>
                </div>
                <div className="finance-card-meta flex min-w-0 items-center gap-2 px-3 py-2.5">
                  <TrendingUp size={15} className="finance-accent-success shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-500">Needed monthly</p>
                    <p className="truncate text-xs font-semibold text-slate-200">
                      {formatCurrency(getRequiredMonthlySavings(goal))}/mo
                    </p>
                  </div>
                </div>
              </div>

              <div className="finance-card-insight mt-3 px-3 py-2.5">
                <p className="text-xs leading-relaxed text-slate-200">{getGoalInsight(goal, metrics)}</p>
                {metrics.allocatedMonthly > 0 && metrics.remainingAmount > 0 && (
                  <p className="mt-1 text-[10px] text-slate-400">
                    Planned: {formatCurrency(metrics.allocatedMonthly)}/mo · Required: {formatCurrency(metrics.requiredMonthly)}/mo
                  </p>
                )}
              </div>

              {metrics.savedPercentage < 25 && goal.status === 'ACTIVE' && (
                <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
                  <AlertCircle size={14} /> Increase your monthly savings to stay on track
                </div>
              )}
              {metrics.savedPercentage >= 100 && (
                <div className="mt-3 flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
                  <CheckCircle2 size={14} /> Goal achieved. Well done!
                </div>
              )}
                  </>
                );
              })()}
            </article>
          ))
        ) : (
          <div className="text-center py-12 bg-slate-800 rounded-lg border border-slate-700">
            <Target size={48} className="mx-auto text-slate-500 mb-4" />
            <p className="text-slate-300 text-lg font-semibold mb-2">No goals yet</p>
            <p className="text-slate-400 mb-6">Create your first financial goal to get started!</p>
            <button
              onClick={openAddGoal}
              className="bg-emerald-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-emerald-600 transition-all inline-flex items-center gap-2"
            >
              <Plus size={18} /> Create Goal
            </button>
          </div>
        )}
      </div>

      {/* Create Goal Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full border border-slate-700">
            <h2 className="text-3xl font-bold text-white mb-6">{editingGoal ? 'Edit Goal' : 'Create New Goal'}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Goal Name</label>
                <input
                  type="text"
                  value={newGoal.goal_name}
                  onChange={(e) => setNewGoal({...newGoal, goal_name: e.target.value})}
                  placeholder="e.g., Down Payment for House"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Goal Type</label>
                <select
                  value={newGoal.goal_type}
                  onChange={(e) => setNewGoal({...newGoal, goal_type: e.target.value})}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="RETIREMENT">Retirement</option>
                  <option value="DOWN_PAYMENT">Down Payment</option>
                  <option value="DEBT_PAYOFF">Debt Payoff</option>
                  <option value="WEALTH_BUILD">Wealth Building</option>
                  <option value="EDUCATION">Education</option>
                  <option value="BUSINESS">Business</option>
                  <option value="EMERGENCY_FUND">Emergency Fund</option>
                  <option value="VACATION">Vacation</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Target Amount (₹)</label>
                <input
                  type="number"
                  value={newGoal.target_amount}
                  onChange={(e) => setNewGoal({...newGoal, target_amount: e.target.value === '' ? 0 : Number(e.target.value)})}
                  placeholder="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                <p className="text-xs text-slate-400 mt-1">{inrInWords(newGoal.target_amount)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Already Saved (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={newGoal.current_amount}
                  onChange={(e) => setNewGoal({...newGoal, current_amount: e.target.value === '' ? 0 : Number(e.target.value)})}
                  placeholder="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                <p className="text-xs text-slate-400 mt-1">{inrInWords(newGoal.current_amount)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Target Date</label>
                <input
                  type="date"
                  value={newGoal.target_date}
                  onChange={(e) => setNewGoal({...newGoal, target_date: e.target.value})}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Priority (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={newGoal.priority}
                  onChange={(e) => setNewGoal({...newGoal, priority: e.target.value === '' ? 3 : Number(e.target.value)})}
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
                onClick={handleSaveGoal}
                className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all font-semibold"
              >
                {editingGoal ? 'Save Changes' : 'Create Goal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

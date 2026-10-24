import React, { useState, useEffect } from 'react';
import { TrendingUp, Target, CreditCard, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import FinancialHealthCard from '../components/dashboard/FinancialHealthCard';
import useCurrency from '../utils/useCurrency';

export default function Dashboard() {
  const { formatCurrency } = useCurrency();
  const [health, setHealth] = useState(null);
  const [goalsSummary, setGoalsSummary] = useState(null);
  const [debtsSummary, setDebtsSummary] = useState(null);
  const [insuranceSummary, setInsuranceSummary] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [healthRes, goalsRes, debtsRes, insuranceRes, recsRes] = await Promise.all([
        api.post('/financial-profile/health-score').catch(() => null),
        api.get('/goals/summary/progress').catch(() => null),
        api.get('/debts/summary/overview').catch(() => null),
        api.get('/insurance/summary/overview').catch(() => null),
        api.get('/recommendations/').catch(() => null)
      ]);

      if (healthRes) setHealth(healthRes.data || null);
      if (goalsRes) setGoalsSummary(goalsRes.data || null);
      if (debtsRes) setDebtsSummary(debtsRes.data || null);
      if (insuranceRes) setInsuranceSummary(insuranceRes.data || null);
      if (recsRes) setRecommendations(Array.isArray(recsRes.data) ? recsRes.data.slice(0, 5) : []);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <div className="text-center text-slate-400">Loading your financial overview...</div>
      </div>
    );
  }

  const criticalAlerts = [];
  if (debtsSummary?.debt_to_income_ratio > 40) {
    criticalAlerts.push('High debt-to-income ratio - focus on debt payoff');
  }
  if (health && health.score < 50) {
    criticalAlerts.push('Financial health score is low - review recommendations');
  }
  if (insuranceSummary?.critical_gaps?.length > 0) {
    criticalAlerts.push(`Insurance review needed: ${insuranceSummary.critical_gaps.join('; ')}`);
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight font-display mb-1">Financial Dashboard</h1>
        <p className="text-xs text-slate-400">Action center: risks, goals, debt payoff, and the next decisions to make.</p>
      </div>

      {/* Critical Alerts */}
      {criticalAlerts.length > 0 && (
        <div className="space-y-3">
          {criticalAlerts.map((alert, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
              <p className="text-red-300">{alert}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Health Score and Key Metrics */}
        <div className="col-span-1">
          <FinancialHealthCard />
        </div>

        {/* Middle Column - Goals & Debts */}
        <div className="space-y-6">
          {/* Goals Summary */}
          {goalsSummary && (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-all">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Target size={24} className="text-emerald-400" />
                  Financial Goals
                </h3>
                <span className="text-2xl font-bold text-emerald-400">{goalsSummary.total_goals}</span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Active</span>
                    <span className="text-emerald-400 font-semibold">{goalsSummary.active_goals}</span>
                  </div>
                  <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{ width: `${goalsSummary.total_goals > 0 ? (goalsSummary.active_goals / goalsSummary.total_goals) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-700">
                  <div className="bg-slate-700 rounded p-2">
                    <p className="text-xs text-slate-400">Monthly Allocation</p>
                    <p className="text-sm font-bold text-white">{formatCurrency(goalsSummary.total_monthly_allocation)}</p>
                  </div>
                  <div className="bg-slate-700 rounded p-2">
                    <p className="text-xs text-slate-400">Completed</p>
                    <p className="text-sm font-bold text-emerald-400">{goalsSummary.completed_goals}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Debts Summary */}
          {debtsSummary && (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-all">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <CreditCard size={24} className="text-red-400" />
                  Debt Management
                </h3>
                <span className="text-2xl font-bold text-red-400">{formatCurrency(debtsSummary.total_outstanding)}</span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Total Outstanding</span>
                    <span className="text-red-400 font-semibold">{formatCurrency(debtsSummary.total_outstanding)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-700">
                  <div className="bg-slate-700 rounded p-2">
                    <p className="text-xs text-slate-400">Monthly EMI</p>
                    <p className="text-sm font-bold text-orange-400">{formatCurrency(debtsSummary.total_monthly_emi)}</p>
                  </div>
                  <div className="bg-slate-700 rounded p-2">
                    <p className="text-xs text-slate-400">Debt-to-Income</p>
                    <p className={`text-sm font-bold ${debtsSummary.debt_to_income_ratio > 40 ? 'text-red-400' : debtsSummary.debt_to_income_ratio > 20 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {debtsSummary.debt_to_income_ratio?.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {debtsSummary.estimated_debt_free_date && (
                  <div className="bg-slate-700/50 rounded p-2 mt-2">
                    <p className="text-xs text-slate-400">Debt-free by</p>
                    <p className="text-sm font-bold text-white">
                      {new Date(debtsSummary.estimated_debt_free_date).toLocaleDateString()} ({debtsSummary.debt_free_months} months)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Insurance & Quick Stats */}
        <div className="space-y-6">
          {/* Insurance Summary */}
          {insuranceSummary && (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-all">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield size={24} className="text-blue-400" />
                  Insurance
                </h3>
                <span className="text-2xl font-bold text-blue-400">{insuranceSummary.total_policies}</span>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Active Policies</p>
                  <p className="text-lg font-bold text-emerald-400">{insuranceSummary.active_policies}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-700">
                  <div className="bg-slate-700 rounded p-2">
                    <p className="text-xs text-slate-400">Sum Insured</p>
                    <p className="text-sm font-bold text-blue-400">{formatCurrency(insuranceSummary.total_sum_insured)}</p>
                  </div>
                  <div className="bg-slate-700 rounded p-2">
                    <p className="text-xs text-slate-400">Annual Premium</p>
                    <p className="text-sm font-bold text-purple-400">{formatCurrency(insuranceSummary.total_annual_premium)}</p>
                  </div>
                </div>

                {insuranceSummary.critical_gaps?.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded p-2 mt-2">
                    <p className="text-xs text-red-400 font-semibold">Coverage review needed</p>
                    <p className="text-xs text-red-300 mt-1">{insuranceSummary.critical_gaps.join('; ')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-lg p-6 border border-emerald-500/30">
            <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <a
                href="#goals"
                className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-all text-sm font-semibold"
              >
                <Target size={16} /> Create New Goal
              </a>
              <a
                href="#debts"
                className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-all text-sm font-semibold"
              >
                <CreditCard size={16} /> Track Debt Payoff
              </a>
              <a
                href="#insurance"
                className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-all text-sm font-semibold"
              >
                <Shield size={16} /> Review Coverage
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Top Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
              <TrendingUp size={24} className="text-cyan-400" />
              Top Recommendations
            </h3>
            <a href="#recommendations" className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold">
              View All →
            </a>
          </div>

          <div className="space-y-3">
            {recommendations.map(rec => (
              <div key={rec.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600/50 hover:border-slate-600 transition-all">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-white">{rec.title}</h4>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    rec.urgency === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                    rec.urgency === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                    rec.urgency === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {rec.urgency}
                  </span>
                </div>
                <p className="text-sm text-slate-300">{rec.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Insight */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-lg p-6 border border-cyan-500/30">
        <div className="flex items-start gap-4">
          <CheckCircle2 className="text-cyan-400 mt-1 flex-shrink-0" size={24} />
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Financial Wellness Tip</h3>
            {health?.score >= 80 && (
              <p className="text-slate-300">
                Excellent work! Your financial health is strong. Consider optimizing your investment portfolio and planning for wealth growth through tax-efficient investments.
              </p>
            )}
            {health?.score >= 60 && health?.score < 80 && (
              <p className="text-slate-300">
                You're on the right track. Focus on building your emergency fund to 6 months and ensuring adequate insurance coverage.
              </p>
            )}
            {health?.score < 60 && (
              <p className="text-slate-300">
                There's room for improvement. Start by creating an emergency fund and reviewing your high-interest debt repayment strategy.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

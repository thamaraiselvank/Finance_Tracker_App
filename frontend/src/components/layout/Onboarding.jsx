import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, Sparkles, Coins, TrendingUp, Users, Target } from 'lucide-react';
import { inrInWords } from '../../utils/numberWords';

export default function Onboarding() {
  const { updateProfile, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    currency: user?.currency || 'INR',
    current_age: user?.current_age || 28,
    target_retirement_age: user?.target_retirement_age || 50,
    monthly_income: user?.monthly_income || 100000,
    monthly_expense: user?.monthly_expense || 0,
    target_savings_rate: user?.target_savings_rate || 30,
    emergency_fund_amount: user?.emergency_fund_amount || 0,
    dependents_count: user?.dependents_count || 0
  });

  const currencies = [
    { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
    { code: 'USD', symbol: '$', label: 'US Dollar' },
    { code: 'EUR', symbol: '€', label: 'Euro' },
    { code: 'GBP', symbol: '£', label: 'British Pound' }
  ];

  const handleNext = () => setStep(step + 1);
  const handlePrev = () => setStep(step - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile({
        ...formData,
        is_onboarded: true
      });
      // The parent component (App.jsx) will re-render automatically when user state updates
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen aurora-mesh-bg flex items-center justify-center p-4">
      <div className="w-full max-w-2xl glass-card overflow-hidden border border-white/[0.06] flex flex-col">
        {/* Header */}
        <div className="p-8 border-b border-white/[0.06] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-aurora-500/10 rounded-full blur-[80px]" />
          <h2 className="text-2xl font-bold text-white font-display relative z-10 flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-aurora-400" />
            Let's personalize your Finverse
          </h2>
          <p className="text-slate-400 text-sm mt-2 relative z-10">
            Step {step} of 3: We need a few details to tailor your FIRE (Financial Independence, Retire Early) projections.
          </p>
        </div>

        {/* Content */}
        <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }} className="p-8 flex-1">
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                  <Coins className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Currency & Income</h3>
                  <p className="text-xs text-slate-400">Set your base currency and current earnings.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Base Currency</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {currencies.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setFormData({ ...formData, currency: c.code })}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                        formData.currency === c.code 
                          ? 'bg-aurora-500/20 border-aurora-500/50 text-white' 
                          : 'bg-white/[0.02] border-white/[0.05] text-slate-400 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="text-xl font-bold">{c.symbol}</span>
                      <span className="text-xs">{c.code}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Monthly Income (Post-tax)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-500 font-medium">
                    {currencies.find(c => c.code === formData.currency)?.symbol}
                  </span>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.monthly_income}
                    onChange={e => setFormData({ ...formData, monthly_income: Number(e.target.value) })}
                    className="w-full pl-8 pr-4 py-3 text-sm glass-input font-medium"
                    placeholder="e.g. 100000"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">{inrInWords(formData.monthly_income)}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Monthly Essential Expenses</label>
                <input type="number" required min="0" value={formData.monthly_expense} onChange={e => setFormData({ ...formData, monthly_expense: Number(e.target.value) })} className="w-full px-4 py-3 text-sm glass-input font-medium" placeholder="e.g. 50000" />
                <p className="mt-1 text-xs text-slate-400">{inrInWords(formData.monthly_expense)}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Current Emergency Fund</label>
                <input type="number" required min="0" value={formData.emergency_fund_amount} onChange={e => setFormData({ ...formData, emergency_fund_amount: Number(e.target.value) })} className="w-full px-4 py-3 text-sm glass-input font-medium" placeholder="e.g. 300000" />
                <p className="mt-1 text-xs text-slate-400">{inrInWords(formData.emergency_fund_amount)}</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
               <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <Target className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Age & FIRE Goals</h3>
                  <p className="text-xs text-slate-400">When do you plan to achieve financial independence?</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Current Age</label>
                  <input
                    type="number"
                    required
                    min="18"
                    max="100"
                    value={formData.current_age}
                    onChange={e => setFormData({ ...formData, current_age: Number(e.target.value) })}
                    className="w-full px-4 py-3 text-sm glass-input font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Target Retirement Age</label>
                  <input
                    type="number"
                    required
                    min={formData.current_age + 1}
                    max="100"
                    value={formData.target_retirement_age}
                    onChange={e => setFormData({ ...formData, target_retirement_age: Number(e.target.value) })}
                    className="w-full px-4 py-3 text-sm glass-input font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Target Savings Rate (%)</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.target_savings_rate}
                    onChange={e => setFormData({ ...formData, target_savings_rate: Number(e.target.value) })}
                    className="flex-1 accent-aurora-500"
                  />
                  <div className="text-right min-w-[80px]">
                    <div className="text-lg font-bold text-white">{formData.target_savings_rate}%</div>
                    <div className="text-xs text-aurora-400 font-medium">
                      {currencies.find(c => c.code === formData.currency)?.symbol}
                      {((formData.monthly_income * formData.target_savings_rate) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Experts recommend saving at least 20%, but the FIRE movement suggests 50%+ for early retirement.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
               <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20">
                  <Users className="w-6 h-6 text-pink-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Family & Dependents</h3>
                  <p className="text-xs text-slate-400">Used for calculating life & health insurance adequacy.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-4">Number of Dependents</label>
                <div className="flex flex-wrap gap-3">
                  {[0, 1, 2, 3, 4, '5+'].map((num, i) => {
                    const val = typeof num === 'string' ? 5 : num;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setFormData({ ...formData, dependents_count: val })}
                        className={`w-14 h-14 rounded-xl border flex items-center justify-center text-lg font-bold transition-all ${
                          formData.dependents_count === val 
                            ? 'bg-aurora-500/20 border-aurora-500/50 text-white' 
                            : 'bg-white/[0.02] border-white/[0.05] text-slate-400 hover:bg-white/[0.04]'
                        }`}
                      >
                        {num}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-slate-500 mt-4">
                  Include spouse, children, or dependent parents who rely on your income.
                </p>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="mt-10 pt-6 border-t border-white/[0.06] flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Back
              </button>
            ) : (
              <div />
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2.5 btn-aurora rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Saving...' : step === 3 ? 'Complete Setup' : 'Continue'}
              {!loading && step < 3 && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

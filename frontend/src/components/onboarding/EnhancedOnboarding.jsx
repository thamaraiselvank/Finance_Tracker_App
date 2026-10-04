import React, { useState } from 'react';
import { ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../services/api';

export default function EnhancedOnboarding({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Basic Information
    current_age: 25,
    target_retirement_age: 60,
    monthly_income: 0,
    dependents_count: 0,

    // Financial Goals
    primary_goal: 'WEALTH_BUILD',
    secondary_goals: [],
    goal_timeframes: {},

    // Financial Health
    current_debt: 0,
    monthly_debt_payments: 0,
    current_savings: 0,
    emergency_fund_months: 0,

    // Insurance
    life_insurance_coverage: 0,
    health_insurance_coverage: 0,

    // Investment
    current_investments: 0,
    investment_experience: 'BEGINNER',
    risk_tolerance: 'MODERATE',

    // Additional
    major_purchases_planned: '',
    additional_notes: ''
  });

  const totalSteps = 5;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await api.post('/financial-profile/onboarding-complete', formData);
      console.log('Onboarding completed:', response.data);
      onComplete && onComplete(response.data);
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome to Finverse</h1>
          <p className="text-slate-400">Let's understand your financial goals and create your roadmap</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-3">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i + 1}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  i + 1 <= currentStep
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {i + 1 < currentStep ? <CheckCircle2 size={20} /> : i + 1}
              </div>
            ))}
          </div>
          <div className="w-full bg-slate-700 h-2 rounded-full">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-slate-800 rounded-xl p-8 shadow-2xl border border-slate-700">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Basic Information</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Current Age</label>
                  <input
                    type="number"
                    value={formData.current_age}
                    onChange={(e) => handleInputChange('current_age', parseInt(e.target.value))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Retirement Age</label>
                  <input
                    type="number"
                    value={formData.target_retirement_age}
                    onChange={(e) => handleInputChange('target_retirement_age', parseInt(e.target.value))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Monthly Income (₹)</label>
                <input
                  type="number"
                  value={formData.monthly_income}
                  onChange={(e) => handleInputChange('monthly_income', parseFloat(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Number of Dependents</label>
                <select
                  value={formData.dependents_count}
                  onChange={(e) => handleInputChange('dependents_count', parseInt(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="0">None</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4+</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Financial Health */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Your Financial Health</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Current Savings (₹)</label>
                <input
                  type="number"
                  value={formData.current_savings}
                  onChange={(e) => handleInputChange('current_savings', parseFloat(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Current Debt (₹)</label>
                <input
                  type="number"
                  value={formData.current_debt}
                  onChange={(e) => handleInputChange('current_debt', parseFloat(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Monthly Debt Payments (₹)</label>
                <input
                  type="number"
                  value={formData.monthly_debt_payments}
                  onChange={(e) => handleInputChange('monthly_debt_payments', parseFloat(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div className="bg-slate-700 p-4 rounded-lg border border-slate-600">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-blue-400 mt-1 flex-shrink-0" size={20} />
                  <div>
                    <p className="text-sm text-slate-300">
                      <span className="font-semibold">Emergency Fund:</span> You should have 3-6 months of expenses saved
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Insurance */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Insurance Coverage</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Life Insurance Coverage (₹)</label>
                <input
                  type="number"
                  value={formData.life_insurance_coverage}
                  onChange={(e) => handleInputChange('life_insurance_coverage', parseFloat(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  placeholder="0"
                />
                <p className="text-xs text-slate-400 mt-1">Recommended: 10x annual income</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Health Insurance Coverage (₹)</label>
                <input
                  type="number"
                  value={formData.health_insurance_coverage}
                  onChange={(e) => handleInputChange('health_insurance_coverage', parseFloat(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  placeholder="0"
                />
                <p className="text-xs text-slate-400 mt-1">Recommended: 5x annual income for family</p>
              </div>
            </div>
          )}

          {/* Step 4: Investment Profile */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Investment Profile</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Investment Experience</label>
                <select
                  value={formData.investment_experience}
                  onChange={(e) => handleInputChange('investment_experience', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Risk Tolerance</label>
                <div className="space-y-2">
                  {['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'].map(risk => (
                    <label key={risk} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="risk_tolerance"
                        value={risk}
                        checked={formData.risk_tolerance === risk}
                        onChange={(e) => handleInputChange('risk_tolerance', e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-slate-300 capitalize">{risk.toLowerCase()}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Current Investments (₹)</label>
                <input
                  type="number"
                  value={formData.current_investments}
                  onChange={(e) => handleInputChange('current_investments', parseFloat(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {/* Step 5: Goals */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Financial Goals</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Primary Goal</label>
                <select
                  value={formData.primary_goal}
                  onChange={(e) => handleInputChange('primary_goal', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="RETIREMENT">Retirement</option>
                  <option value="DOWN_PAYMENT">Down Payment (Home/Car)</option>
                  <option value="DEBT_PAYOFF">Debt Payoff</option>
                  <option value="WEALTH_BUILD">Wealth Building</option>
                  <option value="EDUCATION">Education Fund</option>
                  <option value="BUSINESS">Business Investment</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Any major purchases planned?</label>
                <textarea
                  value={formData.major_purchases_planned}
                  onChange={(e) => handleInputChange('major_purchases_planned', e.target.value)}
                  placeholder="e.g., House, Car, Wedding"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Additional Notes</label>
                <textarea
                  value={formData.additional_notes}
                  onChange={(e) => handleInputChange('additional_notes', e.target.value)}
                  placeholder="Anything else we should know about your financial situation?"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  rows="3"
                />
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="flex-1 px-6 py-3 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Back
            </button>

            {currentStep < totalSteps ? (
              <button
                onClick={handleNext}
                className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
              >
                Next <ChevronRight size={20} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-all"
              >
                {loading ? 'Completing...' : 'Complete Onboarding'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

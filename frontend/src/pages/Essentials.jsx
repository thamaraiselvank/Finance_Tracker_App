import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  PiggyBank, 
  Hospital, 
  Pill, 
  Scale, 
  Check, 
  Edit2, 
  Sparkles, 
  AlertTriangle,
  Info,
  ChevronDown,
  User,
  Plus
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import useCurrency from '../utils/useCurrency';

export default function Essentials({ hideAmounts }) {
  const { user, updateProfile } = useAuth();
  const { formatCurrency: formatAmount } = useCurrency();
  const [healthData, setHealthData] = useState(null);
  const [insurances, setInsurances] = useState([]);
  const [editingTerm, setEditingTerm] = useState(false);
  const [editingHealth, setEditingHealth] = useState(false);
  const [editingDependents, setEditingDependents] = useState(false);
  const [termInput, setTermInput] = useState('');
  const [healthInput, setHealthInput] = useState('');
  const [dependentsInput, setDependentsInput] = useState(0);
  const [dependentDetails, setDependentDetails] = useState([]);
  const [showAddPolicyModal, setShowAddPolicyModal] = useState(false);

  // New Policy Form
  const [policyForm, setPolicyForm] = useState({
    policy_name: '',
    insurance_type: 'TERM',
    sum_insured: '',
    annual_premium: '',
    insurer_name: '',
  });

  const fetchData = async () => {
    try {
      const [hRes, insRes] = await Promise.all([
        api.get('/essentials/health-check'),
        api.get('/essentials/insurances')
      ]);
      setHealthData(hRes.data);
      setInsurances(insRes.data);
      setTermInput(hRes.data?.term_cover || '');
      setHealthInput(hRes.data?.health_cover || '');
      setDependentsInput(hRes.data?.dependents_count || 0);
      setDependentDetails(user?.health_dependents || []);
    } catch (err) {
      console.error('Failed to fetch health check data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (val) => {
    if (hideAmounts) return '••••••';
    return formatAmount(val);
  };

  const handleUpdateInsuranceCover = async (type, amount) => {
    try {
      // Find existing policy of type or create new
      const existing = insurances.find(i => i.insurance_type === type);
      if (existing) {
        await api.put(`/essentials/insurances/${existing.id}`, {
          sum_insured: parseFloat(amount) || 0
        });
      } else {
        await api.post('/essentials/insurances', {
          policy_name: `${type === 'TERM' ? 'Term Life' : 'Health'} Insurance Cover`,
          insurance_type: type,
          sum_insured: parseFloat(amount) || 0,
          annual_premium: 0
        });
      }
      if (type === 'TERM') setEditingTerm(false);
      if (type === 'HEALTH') setEditingHealth(false);
      fetchData();
    } catch (err) {
      alert('Failed to update insurance cover');
    }
  };

  const handleUpdateDependents = async () => {
    try {
      await updateProfile({ dependents_count: dependentDetails.length, health_dependents: dependentDetails });
      setEditingDependents(false);
      fetchData();
    } catch (err) {
      alert('Failed to update dependents count');
    }
  };

  const addDependent = () => setDependentDetails([...dependentDetails, { name: '', relationship: '', age: '', cover: '' }]);
  const updateDependent = (index, field, value) => {
    setDependentDetails(dependentDetails.map((dependent, itemIndex) => itemIndex === index ? { ...dependent, [field]: value } : dependent));
  };
  const removeDependent = (index) => setDependentDetails(dependentDetails.filter((_, itemIndex) => itemIndex !== index));

  const handleCreatePolicy = async (e) => {
    e.preventDefault();
    try {
      await api.post('/essentials/insurances', {
        ...policyForm,
        sum_insured: parseFloat(policyForm.sum_insured) || 0,
        annual_premium: parseFloat(policyForm.annual_premium) || 0,
      });
      setShowAddPolicyModal(false);
      setPolicyForm({
        policy_name: '',
        insurance_type: 'TERM',
        sum_insured: '',
        annual_premium: '',
        insurer_name: '',
      });
      fetchData();
    } catch (err) {
      alert('Failed to save insurance policy');
    }
  };

  const score = healthData?.overall_health_score || 0;
  const scorePct = (score / 10) * 100;
  const getBadgeClass = (status) => {
    if (status === 'Excellent' || status === 'Good') return 'badge-good';
    if (status === 'Moderate' || status === 'Getting There') return 'badge-getting-there';
    if (status === 'No Data') return 'badge-neutral';
    return 'badge-risky';
  };
  const savingsColorClass =
    healthData?.savings_rate_status === 'Excellent' || healthData?.savings_rate_status === 'Good'
      ? 'text-emerald-700'
      : healthData?.savings_rate_status === 'No Data'
        ? 'text-slate-500'
        : 'text-red-600';
  const emergencyRunwayMonths = Number(healthData?.emergency_runway_months || 0);
  const savingsRatePct = Number(healthData?.savings_rate_pct || 0);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Essentials</h1>
        <p className="text-xs text-slate-500 mt-0.5">Your scorecard: Essentials measures readiness; Insurance stores the policies behind it.</p>
      </div>

      {/* Financial Profile Accordion Header */}
      <div className="bg-white border border-slate-200/90 rounded-xl px-5 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <User className="w-4 h-4 text-slate-500" />
          <span>Financial Profile</span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-bold text-slate-900 theme-transition">How the score is calculated</h2>
          </div>
          <div className="space-y-3 text-xs text-slate-600">
            <p>Overall health score is weighted across five pillars and capped at 10:</p>
            <ul className="space-y-2 pl-4 list-disc">
              <li><span className="font-semibold text-slate-800">Emergency Fund:</span> 25% — checks if liquid reserves cover at least 6 months of expenses.</li>
              <li><span className="font-semibold text-slate-800">Savings Rate:</span> 25% — measures how much income is being saved each month.</li>
              <li><span className="font-semibold text-slate-800">Term Insurance:</span> 15% — compares your cover against 25× annual expenses.</li>
              <li><span className="font-semibold text-slate-800">Health Insurance:</span> 15% — checks cover adequacy for your dependents and family.</li>
              <li><span className="font-semibold text-slate-800">Debt Ratio:</span> 20% — keeps liabilities under control relative to overall assets.</li>
            </ul>
          </div>
        </div>

        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900 theme-transition">How to improve it</h2>
          </div>
          <div className="space-y-3 text-xs text-slate-600">
            <p>To raise the score, focus on the weakest pillar first:</p>
            <ul className="space-y-2 pl-4 list-disc">
              <li>Build a liquid emergency fund worth at least 6 months of expenses.</li>
              <li>Increase savings rate toward 20–40% of monthly income.</li>
              <li>Review term cover against your annual cost of living and dependents.</li>
              <li>Increase health insurance cover for family members and medical inflation.</li>
              <li>Reduce debt and keep liabilities below 20–30% of total assets.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* OVERALL HEALTH SCORE CARD (Finverse Screenshot Style) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{score}</span>
            <span className="text-sm font-semibold text-slate-400">/10</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-2">
              OVERALL HEALTH SCORE
            </span>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getBadgeClass(healthData?.health_score_status)}`}>
            {healthData?.health_score_status || 'No Data'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div 
            className={`h-2.5 rounded-full transition-all duration-500 ${
              score >= 8 ? 'bg-emerald-600' :
              score >= 5 ? 'bg-amber-600' :
              'bg-red-600'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, scorePct))}%` }}
          />
        </div>
      </div>

      {/* 2x2 ESSENTIALS PILLARS GRID (Finverse Screenshot Style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PILLAR 1: Emergency Fund */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Emergency Fund</h3>
              </div>
              <span className={getBadgeClass(healthData?.emergency_fund_status)}>
                • {healthData?.emergency_fund_status || 'No Data'}
              </span>
            </div>

            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-semibold">LIQUID ASSETS</span>
                <p className="text-xs text-slate-500 mt-0.5">Cash & Savings • FD & RD • Liquid / Debt Funds</p>
              </div>
              <span className="text-lg font-extrabold text-slate-900">
                {formatCurrency(healthData?.liquid_assets || 0)}
              </span>
            </div>

            {/* Runway Scale */}
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-500 uppercase text-[10px]">RUNWAY</span>
                <span className="text-slate-900 font-bold">{healthData?.emergency_runway_months || 0} months</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-emerald-700 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (emergencyRunwayMonths / 12) * 100)}%` }}
                />
              </div>
              <div className="relative h-3 text-[10px] text-slate-400 pt-0.5">
                <span className="absolute left-0">0</span>
                <span className="absolute left-1/4 -translate-x-1/2">3m</span>
                <span className="absolute left-1/2 -translate-x-1/2">6m</span>
                <span className="absolute right-0">12m+</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div><span className="text-slate-400 text-[10px] font-semibold uppercase">6-MONTH TARGET</span><p className="font-bold text-slate-900">{formatCurrency((healthData?.monthly_expense || 0) * 6)}</p></div>
                <div><span className="text-slate-400 text-[10px] font-semibold uppercase">MONTHLY EXPENSE</span><p className="font-bold text-slate-900">{formatCurrency(healthData?.monthly_expense || 0)}</p></div>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 font-medium pt-2 border-t border-slate-100">
            {healthData?.emergency_runway_months >= 6
              ? "You have at least six months of expenses covered. Keep this buffer in liquid funds."
              : "Do you have the six-month target above? Add to your emergency fund until this buffer reaches six months."}
          </p>
        </div>

        {/* PILLAR 2: Savings Rate */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <PiggyBank className="w-4 h-4 text-amber-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Savings Rate</h3>
                  <span className="text-[10px] text-slate-400">intended • from financial profile</span>
                </div>
              </div>
              <span className={getBadgeClass(healthData?.savings_rate_status)}>
                • {healthData?.savings_rate_status || 'No Data'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black ${savingsColorClass}`}>{healthData?.savings_rate_pct || 0}%</span>
              <span className="text-xs text-slate-500">of income saved</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Based on your Financial Profile • actual savings may differ
            </p>

            <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] font-semibold uppercase">INCOME</span>
                <p className="font-bold text-slate-900">{formatCurrency(healthData?.monthly_income || 0)}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-semibold uppercase">EXPENSE</span>
                <p className="font-bold text-slate-900">{formatCurrency(healthData?.actual_monthly_expense || 0)}</p>
              </div>
            </div>

            {/* Savings Rate Bar */}
            <div className="mt-3 space-y-1">
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className={`${healthData?.savings_rate_status === 'Excellent' || healthData?.savings_rate_status === 'Good' ? 'bg-emerald-600' : 'bg-red-600'} h-2 rounded-full transition-all duration-500`}
                  style={{ width: `${Math.min(100, (savingsRatePct / 80) * 100)}%` }}
                />
              </div>
              <div className="relative h-3 text-[10px] text-slate-400">
                <span className="absolute left-0">0%</span>
                <span className="absolute left-1/4 -translate-x-1/2">20%</span>
                <span className="absolute left-[62.5%] -translate-x-1/2">50%</span>
                <span className="absolute right-0">80%+</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-600 font-semibold uppercase text-[10px]">TIME TO FINANCIAL INDEPENDENCE</span>
              <span className="font-bold text-slate-900">
                {healthData?.time_to_fi_years ? `around ${healthData.time_to_fi_years} yrs` : 'Add income and expenses'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Try to save at least 20% of your income. Cut discretionary spending first.
            </p>
          </div>
        </div>

        {/* PILLAR 3: Term Insurance */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Hospital className="w-4 h-4 text-purple-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Term Insurance</h3>
                  <p className="text-[10px] text-slate-400">Life protection cover, scored here</p>
                </div>
              </div>
              <span className={getBadgeClass(healthData?.term_cover_status)}>
                • {healthData?.term_cover_status || 'No Data'}
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">YOUR COVER</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Enter cover amount"
                  value={termInput}
                  onChange={(e) => setTermInput(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs w-44 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <button
                  onClick={() => handleUpdateInsuranceCover('TERM', termInput)}
                  className="p-1.5 bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 cursor-pointer"
                  title="Save Term Cover"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold uppercase text-[10px]">IDEAL COVER</span>
              <span className="font-extrabold text-slate-900">{formatCurrency(healthData?.ideal_term_cover || 0)}</span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
              <div 
                className="bg-emerald-600 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, ((healthData?.term_cover || 0) / (healthData?.ideal_term_cover || 1)) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Formula: Annual Expense × 25 = {formatCurrency(healthData?.ideal_term_cover || 0)}
            </p>
          </div>

          <p className="text-xs text-slate-600 font-medium pt-2 border-t border-slate-100">
            {healthData?.term_cover >= healthData?.ideal_term_cover
              ? "Your term cover meets the recommended 25x expense rule."
              : "Your term cover is significantly below the recommended amount."}
          </p>
        </div>

        {/* PILLAR 4: Health Insurance */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Pill className="w-4 h-4 text-pink-600" />
                <h3 className="font-bold text-slate-900 text-sm">Health Insurance</h3>
              </div>
              <span className={getBadgeClass(healthData?.health_cover_status)}>
                • {healthData?.health_cover_status || 'No Data'}
              </span>
            </div>

            {/* Dependents row */}
            <div className="flex items-center justify-between text-xs mb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">DEPENDENTS</span>
                {editingDependents ? (
                  <div className="mt-2 space-y-2">
                    {dependentDetails.map((dependent, index) => (
                      <div key={index} className="grid grid-cols-2 gap-2">
                        <input placeholder="Name" value={dependent.name || ''} onChange={e => updateDependent(index, 'name', e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-xs" />
                        <input placeholder="Relationship" value={dependent.relationship || ''} onChange={e => updateDependent(index, 'relationship', e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-xs" />
                        <input type="number" min="0" placeholder="Age" value={dependent.age || ''} onChange={e => updateDependent(index, 'age', e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-xs" />
                        <input type="number" min="0" placeholder="Cover amount" value={dependent.cover || ''} onChange={e => updateDependent(index, 'cover', e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-xs" />
                        <button type="button" onClick={() => removeDependent(index)} className="text-left text-[10px] text-red-600">Remove</button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={addDependent} className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><Plus className="w-3 h-3" /> Add dependent</button>
                      <button type="button" onClick={handleUpdateDependents} className="p-1 bg-emerald-800 text-white rounded" title="Save dependents"><Check className="w-3 h-3" /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-bold text-slate-900">{dependentDetails.length || healthData?.dependents_count || 0} people</span>
                    <button onClick={() => setEditingDependents(true)} className="text-slate-400 hover:text-slate-700">
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">SELF / POLICY COVER</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Enter cover amount"
                  value={healthInput}
                  onChange={(e) => setHealthInput(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs w-44 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <button
                  onClick={() => handleUpdateInsuranceCover('HEALTH', healthInput)}
                  className="p-1.5 bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 cursor-pointer"
                  title="Save Health Cover"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold uppercase text-[10px]">RECOMMENDED</span>
              <span className="font-bold text-slate-900">{formatCurrency(healthData?.recommended_health_cover || 0)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
              <div 
                className="bg-emerald-600 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, ((healthData?.health_cover || 0) / 1000000) * 100)}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-slate-600 font-medium pt-2 border-t border-slate-100">
            A minimum private health cover of {formatCurrency(500000)} is recommended.
          </p>
        </div>
      </div>

      {/* PILLAR 5: Debt Ratio Card (Finverse Screenshot Style) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Scale className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Debt Ratio</h3>
          </div>
          <span className={getBadgeClass(healthData?.debt_ratio_status)}>
            • {healthData?.debt_ratio_status || 'No Data'}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-emerald-800">{healthData?.debt_ratio_pct || 0}%</span>
          <span className="text-xs text-slate-500 font-medium">of assets are debt-funded</span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
          <div>
            <span className="text-slate-400 text-[10px] font-semibold uppercase">TOTAL ASSETS</span>
            <p className="font-extrabold text-slate-900 text-base">{formatCurrency(healthData?.total_assets || 0)}</p>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] font-semibold uppercase">TOTAL LIABILITIES</span>
            <p className="font-extrabold text-emerald-800 text-base">{formatCurrency(healthData?.total_liabilities || 0)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

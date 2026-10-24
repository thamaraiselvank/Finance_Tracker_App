import React, { useMemo, useState, useEffect } from 'react';
import { User, Mail, Briefcase, Landmark, PiggyBank, Shield, Heart, Save, PencilLine, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { inrInWords } from '../utils/numberWords';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    currency: 'INR',
    current_age: 28,
    target_retirement_age: 60,
    monthly_income: 0,
    monthly_expense: 0,
    target_savings_rate: 20,
    emergency_fund_amount: 0,
    dependents_count: 0,
    is_onboarded: true,
  });
  const currencySymbol = getCurrencySymbol(form.currency);

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        username: user.username || '',
        email: user.email || '',
        currency: user.currency || 'INR',
        current_age: user.current_age || 28,
        target_retirement_age: user.target_retirement_age || 60,
        monthly_income: user.monthly_income || 0,
        monthly_expense: user.monthly_expense || 0,
        target_savings_rate: user.target_savings_rate || 20,
        emergency_fund_amount: user.emergency_fund_amount || 0,
        dependents_count: user.dependents_count || 0,
        is_onboarded: Boolean(user.is_onboarded),
      });
    }
  }, [user]);

  const storedInfo = useMemo(() => [
    { label: 'Full name', value: user?.full_name || 'Not available', icon: User },
    { label: 'Email', value: user?.email || 'Not available', icon: Mail },
    { label: 'Username', value: user?.username || 'Not available', icon: Briefcase },
    { label: 'Currency', value: user?.currency || 'INR', icon: Landmark },
    { label: 'Monthly income', value: formatCurrency(user?.monthly_income, user?.currency), icon: PiggyBank },
    { label: 'Monthly expense', value: formatCurrency(user?.monthly_expense, user?.currency), icon: Briefcase },
    { label: 'Emergency fund', value: formatCurrency(user?.emergency_fund_amount, user?.currency), icon: Shield },
    { label: 'Dependents', value: `${user?.dependents_count || 0} people`, icon: Heart },
  ], [user]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateProfile({
        ...form,
        current_age: Number(form.current_age),
        target_retirement_age: Number(form.target_retirement_age),
        monthly_income: Number(form.monthly_income),
        monthly_expense: Number(form.monthly_expense),
        target_savings_rate: Number(form.target_savings_rate),
        emergency_fund_amount: Number(form.emergency_fund_amount),
        dependents_count: Number(form.dependents_count),
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile', error);
      alert('Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-sky-500 font-semibold">Account</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 theme-transition">My Profile</h1>
        </div>
        <button
          onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          className="btn-aurora inline-flex items-center gap-2"
          disabled={saving}
        >
          {saving ? 'Saving...' : isEditing ? <Save className="w-4 h-4" /> : <PencilLine className="w-4 h-4" />}
          {saving ? 'Saving...' : isEditing ? 'Save changes' : 'Edit profile'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.5fr] gap-6">
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-16 h-16 rounded-2xl aurora-gradient text-white text-xl font-black flex items-center justify-center shadow-lg">
              {user?.full_name ? user.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() : 'U'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 theme-transition">{user?.full_name || user?.username || 'User'}</h2>
              <p className="text-sm text-slate-500">{user?.email || 'No email added'}</p>
            </div>
          </div>

          <div className="space-y-3">
            {storedInfo.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-slate-600" />
                  </span>
                  <span className="text-sm text-slate-500">{label}</span>
                </div>
                <span className="text-sm font-semibold text-slate-800">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-900 theme-transition">Profile details</h2>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1 text-[11px] font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {user?.is_onboarded ? 'Profile active' : 'Needs setup'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Full name</span>
              <input
                disabled={!isEditing}
                value={form.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                className="theme-input w-full"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Username</span>
              <input
                disabled={!isEditing}
                value={form.username}
                onChange={(e) => handleChange('username', e.target.value)}
                className="theme-input w-full"
              />
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Email</span>
              <input
                disabled={!isEditing}
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="theme-input w-full"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Current age</span>
              <input
                disabled={!isEditing}
                type="number"
                value={form.current_age}
                onChange={(e) => handleChange('current_age', e.target.value)}
                className="theme-input w-full"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Retirement age</span>
              <input
                disabled={!isEditing}
                type="number"
                value={form.target_retirement_age}
                onChange={(e) => handleChange('target_retirement_age', e.target.value)}
                className="theme-input w-full"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Monthly income ({currencySymbol})</span>
              <input
                disabled={!isEditing}
                type="number"
                value={form.monthly_income}
                onChange={(e) => handleChange('monthly_income', e.target.value)}
                className="theme-input w-full"
              />
              <span className="block text-xs text-slate-400">{inrInWords(form.monthly_income, form.currency)}</span>
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Monthly expense ({currencySymbol})</span>
              <input
                disabled={!isEditing}
                type="number"
                value={form.monthly_expense}
                onChange={(e) => handleChange('monthly_expense', e.target.value)}
                className="theme-input w-full"
              />
              <span className="block text-xs text-slate-400">{inrInWords(form.monthly_expense, form.currency)}</span>
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Target savings rate %</span>
              <input
                disabled={!isEditing}
                type="number"
                value={form.target_savings_rate}
                onChange={(e) => handleChange('target_savings_rate', e.target.value)}
                className="theme-input w-full"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Emergency fund ({currencySymbol})</span>
              <input
                disabled={!isEditing}
                type="number"
                value={form.emergency_fund_amount}
                onChange={(e) => handleChange('emergency_fund_amount', e.target.value)}
                className="theme-input w-full"
              />
              <span className="block text-xs text-slate-400">{inrInWords(form.emergency_fund_amount, form.currency)}</span>
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Dependents</span>
              <input
                disabled={!isEditing}
                type="number"
                value={form.dependents_count}
                onChange={(e) => handleChange('dependents_count', e.target.value)}
                className="theme-input w-full"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Currency</span>
              <select
                disabled={!isEditing}
                value={form.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="theme-input w-full"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

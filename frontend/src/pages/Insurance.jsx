import React, { useState, useEffect } from 'react';
import { Plus, Shield, Calendar, Clock3, CreditCard, Pencil, Trash2 } from 'lucide-react';
import api from '../services/api';
import { inrInWords } from '../utils/numberWords';
import useCurrency from '../utils/useCurrency';

const emptyPolicy = {
    policy_name: '',
    policy_type: 'HEALTH',
    sum_insured: 0,
    annual_premium: 0,
    policy_number: '',
    coverage_type: 'Individual',
    dependents_covered: 0,
    insurer_name: '',
    start_date: '',
    renewal_date: '',
    payment_frequency: 'YEARLY',
    payment_status: 'PENDING',
    next_payment_date: '',
    last_payment_date: ''
  };

export default function InsurancePage() {
  const { currency, currencySymbol, formatCurrency } = useCurrency();
  const [policies, setPolicies] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [newPolicy, setNewPolicy] = useState(emptyPolicy);

  useEffect(() => {
    fetchPolicies();
    fetchSummary();
  }, []);

  const fetchPolicies = async () => {
    try {
      const response = await api.get('/insurance/');
      setPolicies(Array.isArray(response.data) ? response.data : []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching policies:', error);
      setPolicies([]);
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await api.get('/insurance/summary/overview');
      setSummary(response.data || null);
    } catch (error) {
      console.error('Error fetching summary:', error);
      setSummary(null);
    }
  };

  const openAddPolicy = () => {
    setEditingPolicy(null);
    setNewPolicy(emptyPolicy);
    setShowModal(true);
  };

  const openEditPolicy = (policy) => {
    setEditingPolicy(policy);
    setNewPolicy({
      policy_name: policy.policy_name || '',
      policy_type: policy.policy_type || 'HEALTH',
      sum_insured: policy.sum_insured || 0,
      annual_premium: policy.annual_premium || 0,
      policy_number: policy.policy_number || '',
      coverage_type: policy.coverage_type || 'Individual',
      dependents_covered: policy.dependents_covered || 0,
      insurer_name: policy.insurer_name || '',
      start_date: policy.start_date ? policy.start_date.split('T')[0] : '',
      renewal_date: policy.renewal_date ? policy.renewal_date.split('T')[0] : '',
      payment_frequency: policy.payment_frequency || 'YEARLY',
      payment_status: policy.payment_status || 'PENDING',
      next_payment_date: policy.next_payment_date ? policy.next_payment_date.split('T')[0] : '',
      last_payment_date: policy.last_payment_date ? policy.last_payment_date.split('T')[0] : ''
    });
    setShowModal(true);
  };

  const handleSavePolicy = async () => {
    const payload = {
      policy_name: newPolicy.policy_name.trim(),
      policy_type: newPolicy.policy_type,
      sum_insured: Number(newPolicy.sum_insured || 0),
      annual_premium: Number(newPolicy.annual_premium || 0),
      policy_number: newPolicy.policy_number?.trim() || null,
      coverage_type: newPolicy.coverage_type || null,
      dependents_covered: Number(newPolicy.dependents_covered || 0),
      insurer_name: newPolicy.insurer_name?.trim() || null,
      start_date: newPolicy.start_date || null,
      renewal_date: newPolicy.renewal_date || null,
      payment_frequency: newPolicy.payment_frequency,
      payment_status: newPolicy.payment_status,
      next_payment_date: newPolicy.next_payment_date || null,
      last_payment_date: newPolicy.last_payment_date || null
    };

    if (!payload.policy_name || payload.sum_insured <= 0 || payload.annual_premium < 0) {
      alert('Please enter a valid policy name and sum insured.');
      return;
    }

    try {
      if (editingPolicy) {
        await api.put(`/insurance/${editingPolicy.id}`, payload);
      } else {
        await api.post('/insurance/', payload);
      }

      setShowModal(false);
      setEditingPolicy(null);
      setNewPolicy(emptyPolicy);
      fetchPolicies();
      fetchSummary();
    } catch (error) {
      console.error('Error saving policy:', error);
    }
  };

  const handleDeletePolicy = async (policy) => {
    if (!window.confirm(`Delete "${policy.policy_name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/insurance/${policy.id}`);
      setPolicies((currentPolicies) => currentPolicies.filter((item) => item.id !== policy.id));
      await Promise.all([fetchPolicies(), fetchSummary()]);
    } catch (error) {
      console.error('Error deleting policy:', error);
      alert('Unable to delete this policy. Please try again.');
    }
  };

  const getPolicyIcon = (policyType) => {
    const icons = {
      'HEALTH': '🏥',
      'TERM_LIFE': '💳',
      'MOTOR': '🚗',
      'HOME': '🏠',
      'TRAVEL': '✈️',
      'CRITICAL_ILLNESS': '🩺',
      'OTHER': '📋'
    };
    return icons[policyType] || '📋';
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'ACTIVE': return 'finance-status-complete';
      case 'EXPIRED': return 'finance-status-expired';
      case 'RENEWED': return 'finance-status-active';
      default: return 'finance-status-paused';
    }
  };

  const frequencyLabels = {
    MONTHLY: 'Monthly',
    QUARTERLY: 'Quarterly',
    HALF_YEARLY: 'Half-yearly',
    YEARLY: 'Yearly'
  };

  const installmentDivisors = {
    MONTHLY: 12,
    QUARTERLY: 4,
    HALF_YEARLY: 2,
    YEARLY: 1
  };

  const getPaymentDays = (dateValue) => {
    if (!dateValue) return null;
    return Math.ceil((new Date(`${dateValue}T00:00:00`) - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24));
  };

  const getPaymentReminder = (policy) => {
    const days = getPaymentDays(policy.next_payment_date);
    if (days === null) return { label: 'Payment date not set', color: 'text-slate-500' };
    if (days < 0) return { label: `Payment overdue by ${Math.abs(days)} days`, color: 'finance-accent-danger' };
    if (days === 0) return { label: 'Payment due today', color: 'finance-accent-warning' };
    if (days <= 30) return { label: `Payment due in ${days} days`, color: 'finance-accent-warning' };
    return { label: `Next payment in ${days} days`, color: 'finance-accent-success' };
  };

  if (loading) {
    return <div className="text-center text-slate-400">Loading insurance policies...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight font-display">Insurance Management</h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage and track your insurance policies</p>
        </div>
        <button
          onClick={openAddPolicy}
          className="btn-aurora flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Policy
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Total Policies</p>
            <p className="text-3xl font-bold text-white">{summary.total_policies}</p>
          </div>
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Active Policies</p>
            <p className="text-3xl font-bold text-emerald-400">{summary.active_policies}</p>
          </div>
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Total Sum Insured</p>
            <p className="text-3xl font-bold text-blue-400">{formatCurrency(summary.total_sum_insured)}</p>
          </div>
          <div className="glass-panel-hover p-5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Annual Premium</p>
            <p className="text-3xl font-bold text-purple-400">{formatCurrency(summary.total_annual_premium)}</p>
          </div>
        </div>
      )}

      {/* Policies List */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {policies && policies.length > 0 ? (
          policies.map(policy => (
            <article key={policy.id} className="finance-detail-card group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5">
              {(() => {
                const reminder = getPaymentReminder(policy);
                const frequency = policy.payment_frequency || 'YEARLY';
                const installment = (Number(policy.annual_premium) || 0) / (installmentDivisors[frequency] || 1);
                return (
                  <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="finance-card-icon grid h-12 w-12 shrink-0 place-items-center text-2xl">{getPolicyIcon(policy.policy_type)}</div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-white" title={policy.policy_name}>{policy.policy_name}</h3>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">
                      {policy.policy_type.replace(/_/g, ' ')}{policy.insurer_name ? ` · ${policy.insurer_name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${getStatusColor(policy.status)}`}>
                    {policy.status || 'UNKNOWN'}
                  </span>
                  <button
                    onClick={() => openEditPolicy(policy)}
                    title="Edit policy"
                    aria-label={`Edit ${policy.policy_name}`}
                    className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 hover:text-white"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDeletePolicy(policy)}
                    title="Delete policy"
                    aria-label={`Delete ${policy.policy_name}`}
                    className="grid h-8 w-8 place-items-center rounded-md border border-rose-400/15 bg-rose-500/[0.06] text-rose-300 transition hover:bg-rose-500/15"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-[1.2fr_0.8fr] gap-2">
                <div className="finance-card-feature p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sum insured</p>
                  <p className="mt-1 text-xl font-bold text-white">{formatCurrency(policy.sum_insured)}</p>
                  <p className="mt-1 truncate text-[10px] text-slate-500">{policy.coverage_type || 'Coverage details not set'}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-black/10 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Annual premium</p>
                  <p className="finance-accent-info mt-1 text-lg font-bold">{formatCurrency(policy.annual_premium)}</p>
                  <p className="mt-1 truncate text-[10px] text-slate-500">{formatCurrency(installment)} · {frequencyLabels[frequency] || frequency}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="finance-card-meta flex min-w-0 items-center gap-2 px-3 py-2.5">
                  <CreditCard className={`shrink-0 ${policy.payment_status === 'PAID' ? 'finance-accent-success' : 'finance-accent-warning'}`} size={15} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500">Premium status</p>
                    <p className={`truncate text-xs font-semibold ${policy.payment_status === 'PAID' ? 'finance-accent-success' : 'finance-accent-warning'}`}>{policy.payment_status === 'PAID' ? 'Paid' : 'Payment pending'}</p>
                  </div>
                </div>
                <div className="finance-card-meta flex min-w-0 items-center gap-2 px-3 py-2.5">
                  <Clock3 className={`shrink-0 ${reminder.color}`} size={15} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500">Next payment</p>
                    <p className={`truncate text-xs font-semibold ${reminder.color}`}>{reminder.label}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/[0.07] pt-3 text-[10px] text-slate-400">
                <span className="truncate">Policy no. {policy.policy_number || 'Not provided'}</span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {policy.dependents_covered > 0 && <span>{policy.dependents_covered} dependents covered</span>}
                  {policy.renewal_date && <span className="inline-flex items-center gap-1"><Calendar size={12} /> Renews {new Date(policy.renewal_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  {policy.next_payment_date && <span>Due {new Date(policy.next_payment_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>}
                </div>
              </div>
                  </>
                );
              })()}
            </article>
          ))
        ) : (
          <div className="text-center py-12 bg-slate-800 rounded-lg border border-slate-700">
            <Shield size={48} className="mx-auto text-slate-500 mb-4" />
            <p className="text-slate-300 text-lg font-semibold mb-2">No insurance policies</p>
            <p className="text-slate-400 mb-6">Add your insurance policies to track and manage them</p>
            <button
              onClick={openAddPolicy}
              className="bg-emerald-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-emerald-600 transition-all inline-flex items-center gap-2"
            >
              <Plus size={18} /> Add Policy
            </button>
          </div>
        )}
      </div>

      {/* Create Policy Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 md:p-8 max-w-4xl w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">{editingPolicy ? 'Edit Policy' : 'Add New Policy'}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Policy Name</label>
                <input
                  type="text"
                  value={newPolicy.policy_name}
                  onChange={(e) => setNewPolicy({...newPolicy, policy_name: e.target.value})}
                  placeholder="e.g., HDFC Health Insurance"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Policy Type</label>
                <select
                  value={newPolicy.policy_type}
                  onChange={(e) => setNewPolicy({...newPolicy, policy_type: e.target.value})}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="HEALTH">Health Insurance</option>
                  <option value="TERM_LIFE">Term Life</option>
                  <option value="MOTOR">Motor Insurance</option>
                  <option value="HOME">Home Insurance</option>
                  <option value="TRAVEL">Travel Insurance</option>
                  <option value="CRITICAL_ILLNESS">Critical Illness</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Sum Insured ({currencySymbol})</label>
                <input
                  type="number"
                  value={newPolicy.sum_insured}
                  onChange={(e) => setNewPolicy({...newPolicy, sum_insured: e.target.value === '' ? 0 : Number(e.target.value)})}
                  placeholder="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                <p className="text-xs text-slate-400 mt-1">{inrInWords(newPolicy.sum_insured, currency)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Annual Premium ({currencySymbol})</label>
                <input
                  type="number"
                  value={newPolicy.annual_premium}
                  onChange={(e) => setNewPolicy({...newPolicy, annual_premium: e.target.value === '' ? 0 : Number(e.target.value)})}
                  placeholder="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                <p className="text-xs text-slate-400 mt-1">{inrInWords(newPolicy.annual_premium, currency)}</p>
              </div>

              <div className="contents">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Payment Frequency</label>
                  <select
                    value={newPolicy.payment_frequency}
                    onChange={(e) => setNewPolicy({...newPolicy, payment_frequency: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="HALF_YEARLY">Half-yearly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Payment Status</label>
                  <select
                    value={newPolicy.payment_status}
                    onChange={(e) => setNewPolicy({...newPolicy, payment_status: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="PENDING">Payment pending</option>
                    <option value="PAID">Premium paid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Policy Number</label>
                <input
                  type="text"
                  value={newPolicy.policy_number}
                  onChange={(e) => setNewPolicy({...newPolicy, policy_number: e.target.value})}
                  placeholder="e.g., POL123456"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Insurer Name</label>
                <input
                  type="text"
                  value={newPolicy.insurer_name}
                  onChange={(e) => setNewPolicy({...newPolicy, insurer_name: e.target.value})}
                  placeholder="e.g., HDFC Insurance"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Coverage Type</label>
                <input
                  type="text"
                  value={newPolicy.coverage_type}
                  onChange={(e) => setNewPolicy({...newPolicy, coverage_type: e.target.value})}
                  placeholder="e.g., Individual or Family"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Dependents Covered</label>
                <input
                  type="number"
                  min="0"
                  value={newPolicy.dependents_covered}
                  onChange={(e) => setNewPolicy({...newPolicy, dependents_covered: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value))})}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div className="contents">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Next Payment Date</label>
                  <input
                    type="date"
                    value={newPolicy.next_payment_date}
                    onChange={(e) => setNewPolicy({...newPolicy, next_payment_date: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Last Payment Date</label>
                  <input
                    type="date"
                    value={newPolicy.last_payment_date}
                    onChange={(e) => setNewPolicy({...newPolicy, last_payment_date: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Start Date</label>
                <input
                  type="date"
                  value={newPolicy.start_date}
                  onChange={(e) => setNewPolicy({...newPolicy, start_date: e.target.value})}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Renewal Date</label>
                <input
                  type="date"
                  value={newPolicy.renewal_date}
                  onChange={(e) => setNewPolicy({...newPolicy, renewal_date: e.target.value})}
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
                onClick={handleSavePolicy}
                className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all font-semibold"
              >
                {editingPolicy ? 'Save Changes' : 'Add Policy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

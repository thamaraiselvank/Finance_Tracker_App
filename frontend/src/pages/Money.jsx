import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Download, 
  Trash2, 
  Edit3, 
  X, 
  Calendar, 
  Briefcase, 
  Home, 
  Utensils, 
  Zap, 
  Car, 
  ShoppingBag, 
  CreditCard, 
  PlusCircle,
  TrendingUp,
  TrendingDown,
  Building,
  Check,
  ChevronDown,
  ChevronRight,
  Tags,
  NotebookText
} from 'lucide-react';
import api from '../services/api';

export default function Money({ hideAmounts }) {
  const [activeSubTab, setActiveSubTab] = useState('transactions'); // 'transactions', 'budget', 'accounts', 'insights'
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [budgetDrafts, setBudgetDrafts] = useState({});
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetRefresh, setBudgetRefresh] = useState(0);
  const [budgetPeriod, setBudgetPeriod] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthBuckets, setMonthBuckets] = useState([]);
  const [monthDataMap, setMonthDataMap] = useState({});
  const [loadingMonths, setLoadingMonths] = useState({});
  const [filterType, setFilterType] = useState('ALL'); // 'EXPENSE', 'INCOME', 'TRANSFER', 'ALL'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);

  // Form State
  const [form, setForm] = useState({
    type: 'INCOME',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    category_id: '',
    subcategory_id: '',
    account_id: '',
    notes: '',
  });

  // Custom Category Form
  const [newCatForm, setNewCatForm] = useState({
    name: '',
    type: 'EXPENSE',
    color: '#10B981',
    subcategories: '',
  });

  // Account Form
  const [newAccountForm, setNewAccountForm] = useState({
    name: '',
    account_type: 'SAVINGS',
    balance: '0',
    institution: '',
  });

  const fetchData = async () => {
    try {
      const [sumRes, catRes, accRes, monthsRes] = await Promise.all([
        api.get('/transactions/summary'),
        api.get('/categories'),
        api.get('/accounts'),
        api.get('/transactions/months')
      ]);
      setSummary(sumRes.data);
      setCategories(catRes.data);
      setAccounts(accRes.data);
      setMonthBuckets(monthsRes.data || []);
      setMonthDataMap({});
      setLoadingMonths({});
      setTransactions([]);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    }
  };

  const fetchMonthTransactions = async (year, monthIndex) => {
    const monthKey = `${year}-${monthIndex}`;
    if (monthDataMap[monthKey]) return;

    setLoadingMonths((prev) => ({ ...prev, [monthKey]: true }));

    try {
      const startDate = new Date(year, monthIndex, 1).toISOString().slice(0, 10);
      const endDate = new Date(year, monthIndex + 1, 0).toISOString().slice(0, 10);

      const res = await api.get('/transactions', {
        params: {
          start_date: startDate,
          end_date: endDate,
          type: filterType === 'ALL' ? undefined : filterType,
          account_id: selectedAccountId || undefined,
          search: searchQuery || undefined,
          limit: 500,
        }
      });

      setMonthDataMap((prev) => ({ ...prev, [monthKey]: res.data }));
      setTransactions(res.data);
    } catch (err) {
      console.error('Failed to fetch month transactions:', err);
    } finally {
      setLoadingMonths((prev) => ({ ...prev, [monthKey]: false }));
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterType, selectedAccountId, searchQuery]);

  useEffect(() => {
    if (activeSubTab !== 'budget') return;
    const [year, month] = budgetPeriod.split('-').map(Number);
    setBudgetsLoading(true);
    api.get('/budgets', { params: { month, year } })
      .then((res) => {
        setBudgets(res.data || []);
        setBudgetDrafts((prev) => ({
          ...prev,
          ...Object.fromEntries((res.data || [])
            .filter((budget) => budget.monthly_limit !== null)
            .map((budget) => [budget.category_id, String(budget.monthly_limit)])),
        }));
      })
      .catch((err) => {
        console.error('Failed to fetch budgets:', err);
        alert(err.response?.data?.detail || 'Failed to load monthly budgets');
      })
      .finally(() => setBudgetsLoading(false));
  }, [activeSubTab, budgetPeriod, budgetRefresh]);

  const formatCurrency = (val) => {
    if (hideAmounts) return '••••••';
    if (val === undefined || val === null) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    try {
      await api.post('/transactions', {
        ...form,
        amount: parseFloat(form.amount) || 0,
        category_id: form.category_id || undefined,
        subcategory_id: form.subcategory_id || undefined,
        account_id: form.account_id || undefined,
      });
      setShowAddModal(false);
      setBudgetRefresh((current) => current + 1);
      setForm({
        type: form.type,
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        category_id: '',
        subcategory_id: '',
        account_id: '',
        notes: '',
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save transaction');
    }
  };

  const openDeleteConfirm = (type, payload) => {
    setDeleteModal({ type, payload });
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;

    try {
      if (deleteModal.type === 'transaction') {
        await api.delete(`/transactions/${deleteModal.payload.id}`);
      } else if (deleteModal.type === 'month') {
        await Promise.all(deleteModal.payload.map((tx) => api.delete(`/transactions/${tx.id}`)));
      }
      setDeleteModal(null);
      setBudgetRefresh((current) => current + 1);
      fetchData();
    } catch (err) {
      alert('Failed to delete transaction');
    }
  };

  const handleDeleteTransaction = async (id) => {
    openDeleteConfirm('transaction', { id });
  };

  const handleDeleteMonth = async (monthTransactions) => {
    if (!monthTransactions?.length) return;
    openDeleteConfirm('month', monthTransactions);
  };

  const groupedTransactions = useMemo(() => {
    const yearMap = new Map();

    monthBuckets.forEach((bucket) => {
      const year = Number(bucket.year);
      const monthIndex = Number(bucket.month) - 1;
      const monthKey = bucket.month_key || `${year}-${monthIndex}`;
      const monthLabel = new Date(year, monthIndex, 1).toLocaleString('en-US', { month: 'long' });

      if (!yearMap.has(year)) {
        yearMap.set(year, { year, months: [] });
      }

      yearMap.get(year).months.push({
        key: monthKey,
        label: monthLabel,
        year,
        monthIndex,
        transactions: monthDataMap[monthKey] || [],
      });
    });

    return Array.from(yearMap.values())
      .map((yearGroup) => ({
        year: yearGroup.year,
        months: yearGroup.months.sort((a, b) => b.monthIndex - a.monthIndex),
      }))
      .sort((a, b) => b.year - a.year);
  }, [monthBuckets, monthDataMap]);

  const [expandedYears, setExpandedYears] = useState({});
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedDates, setExpandedDates] = useState({});

  const toggleYear = (year) => {
    setExpandedYears((prev) => ({
      ...prev,
      [year]: !(prev[year] ?? true),
    }));
  };

  const toggleMonth = async (monthKey, year, monthIndex) => {
    const isOpen = expandedMonths[monthKey] ?? false;
    const nextState = !isOpen;

    setExpandedMonths((prev) => ({
      ...prev,
      [monthKey]: nextState,
    }));

    if (nextState && !monthDataMap[monthKey]) {
      await fetchMonthTransactions(year, monthIndex);
    }
  };

  const toggleDate = (dateKey) => {
    setExpandedDates((prev) => ({
      ...prev,
      [dateKey]: !(prev[dateKey] ?? true),
    }));
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      const subcats = newCatForm.subcategories
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      await api.post('/categories', {
        name: newCatForm.name,
        type: newCatForm.type,
        color: newCatForm.color,
        subcategories: subcats,
      });
      setShowAddCategoryModal(false);
      setNewCatForm({ name: '', type: 'EXPENSE', color: '#10B981', subcategories: '' });
      setBudgetRefresh((current) => current + 1);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create category');
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounts', {
        name: newAccountForm.name,
        account_type: newAccountForm.account_type,
        balance: parseFloat(newAccountForm.balance) || 0,
        institution: newAccountForm.institution,
      });
      setShowAddAccountModal(false);
      setNewAccountForm({ name: '', account_type: 'SAVINGS', balance: '0', institution: '' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create account');
    }
  };

  const handleSaveBudget = async (e, categoryId) => {
    e.preventDefault();
    const [year, month] = budgetPeriod.split('-').map(Number);
    try {
      const res = await api.put('/budgets', {
        category_id: categoryId,
        monthly_limit: Number(budgetDrafts[categoryId]),
        month,
        year,
      });
      setBudgets((current) => current.map((budget) => (
        budget.category_id === categoryId ? res.data : budget
      )));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save monthly limit');
    }
  };

  const selectedCatObj = categories.find(c => String(c.id) === String(form.category_id));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Transactions</h1>
          <p className="text-xs text-slate-500 mt-0.5">{transactions.length} entries</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg w-40 sm:w-56 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={() => {
              // Export as CSV
              const csvContent = "data:text/csv;charset=utf-8," + 
                ["Date,Type,Amount,Description,Category,Account"]
                .concat(transactions.map(t => `"${t.date}","${t.type}",${t.amount},"${t.description}","${t.category_name || ''}","${t.account_name || ''}"`))
                .join("\n");
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", "finverse_transactions.csv");
              document.body.appendChild(link);
              link.click();
            }}
            className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-semibold">
        {['transactions', 'budget', 'accounts', 'insights'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`pb-3 capitalize transition-all relative ${
              activeSubTab === tab
                ? 'text-emerald-800 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab}
            {activeSubTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-800 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: TRANSACTIONS VIEW */}
      {activeSubTab === 'transactions' && (
        <div className="space-y-6">
          {/* Controls Bar: Type Pills + Dropdowns */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Type Filter Buttons (Finverse Screenshot Style) */}
            <div className="flex items-center bg-slate-100/90 p-1 rounded-xl">
              {['EXPENSE', 'INCOME', 'TRANSFER', 'ALL'].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                    filterType === t
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.toLowerCase()}
                </button>
              ))}
            </div>

            {/* Account & Time Filters */}
            <div className="flex items-center gap-3">
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All accounts</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>

              <div className="text-xs text-slate-400 font-medium">
                This Month
              </div>
            </div>
          </div>

          {/* TOTAL & MONTHLY AVG CARDS (Finverse Screenshot Style) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total</span>
              <p className="text-2xl font-extrabold text-emerald-800 mt-1">
                +{formatCurrency(summary?.total_income || 0)}
              </p>
            </div>
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Monthly Avg</span>
              <p className="text-2xl font-extrabold text-emerald-800 mt-1">
                +{formatCurrency(summary?.monthly_avg_income || 0)}
              </p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">This Month</span>
            </div>
          </div>

          <div className="space-y-4">
            {groupedTransactions.length > 0 ? (
              groupedTransactions.map((yearGroup) => {
const yearOpen = expandedYears[yearGroup.year] ?? false;

                return (
                  <div key={yearGroup.year} className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                      <button
                        onClick={() => toggleYear(yearGroup.year)}
                        className="flex items-center gap-2 text-left text-base font-bold text-slate-900 hover:text-slate-700"
                      >
                        {yearOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                        <span>{yearGroup.year}</span>
                        {yearGroup.months.reduce((c, m) => c + m.transactions.length, 0) > 0 && (
                          <span className="text-[11px] font-semibold text-slate-500">({yearGroup.months.reduce((c, m) => c + m.transactions.length, 0)})</span>
                        )}
                      </button>
                    </div>

                    {yearOpen && (
                      <div className="space-y-3 p-3">
                        {yearGroup.months.map((monthGroup) => {
                          const isMonthOpen = expandedMonths[monthGroup.key] ?? false;
                          const monthTotal = monthGroup.transactions.reduce((sum, tx) => {
                            const value = tx.type === 'INCOME' ? Number(tx.amount) : -Number(tx.amount);
                            return sum + value;
                          }, 0);

                          return (
                            <div key={monthGroup.key} className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/30">
                              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white/80">
                                <button
                                  onClick={() => toggleMonth(monthGroup.key, monthGroup.year, monthGroup.monthIndex)}
                                  className="flex items-center gap-2 text-left text-sm font-bold text-slate-900 hover:text-slate-700"
                                >
                                  {isMonthOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                                  <span>{monthGroup.label}</span>
                                  {monthGroup.transactions.length > 0 && (
                                    <span className="text-[11px] font-semibold text-slate-500">({monthGroup.transactions.length})</span>
                                  )}
                                </button>

                                <div className="flex items-center gap-3">
                                  {monthGroup.transactions.length > 0 && (
                                    <span className={`text-xs font-bold ${monthTotal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                      {monthTotal >= 0 ? '+' : '-'}{formatCurrency(Math.abs(monthTotal))}
                                    </span>
                                  )}
                                  {monthGroup.transactions.length > 0 && (
                                    <button
                                      onClick={() => handleDeleteMonth(monthGroup.transactions)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                      title="Delete month"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isMonthOpen && (
                                <div className="divide-y divide-slate-100">
                                  {loadingMonths[monthGroup.key] ? (
                                    <div className="px-4 py-6 text-xs text-slate-500">Loading transactions...</div>
                                  ) : monthGroup.transactions.length === 0 ? (
                                    <div className="px-4 py-6 text-xs text-slate-500">No transactions in this month.</div>
                                  ) : Object.entries(
                                    monthGroup.transactions.reduce((acc, tx) => {
                                      const dateKey = tx.date;
                                      if (!acc[dateKey]) acc[dateKey] = [];
                                      acc[dateKey].push(tx);
                                      return acc;
                                    }, {})
                                  ).map(([dateKey, dateTransactions]) => {
                                    const isDateOpen = expandedDates[dateKey] ?? false;
                                    const dateTotal = dateTransactions.reduce((sum, tx) => sum + (tx.type === 'INCOME' ? Number(tx.amount) : -Number(tx.amount)), 0);

                                    return (
                                      <div key={dateKey} className="bg-white/70">
                                        <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/80">
                                          <button
                                            onClick={() => toggleDate(dateKey)}
                                            className="flex items-center gap-2 text-left text-sm font-semibold text-slate-800"
                                          >
                                            {isDateOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                                            <span>{dateKey}</span>
                                            <span className="text-[11px] font-medium text-slate-500">({dateTransactions.length})</span>
                                          </button>

                                          <div className="flex items-center gap-3">
                                            <span className={`text-xs font-bold ${dateTotal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                              {dateTotal >= 0 ? '+' : '-'}{formatCurrency(Math.abs(dateTotal))}
                                            </span>
                                            <button
                                              onClick={() => dateTransactions.forEach((tx) => handleDeleteTransaction(tx.id))}
                                              className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                              title="Delete date transactions"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>

                                        {isDateOpen && (
                                          <div className="px-4 pb-3">
                                            {dateTransactions.map((tx) => (
                                              <div key={tx.id} className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                    {tx.category_name && (
                                                      <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase inline-flex items-center gap-1.5">
                                                        <Briefcase className="w-3 h-3 text-blue-600" />
                                                        {tx.category_name}
                                                      </span>
                                                    )}
                                                    {tx.subcategory_name && (
                                                      <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1.5">
                                                        <Tags className="w-3 h-3 text-amber-600" />
                                                        {tx.subcategory_name}
                                                      </span>
                                                    )}
                                                  </div>

                                                  <div className={`font-bold ${tx.type === 'INCOME' ? 'text-emerald-800' : 'text-red-600'}`}>
                                                    {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                                                  </div>
                                                </div>

                                                <div className="mt-3 flex flex-col gap-2 text-[11px] text-slate-600">
                                                  {tx.description && (
                                                    <div className="flex items-start gap-2">
                                                      <NotebookText className="w-3.5 h-3.5 mt-0.5 text-slate-400" />
                                                      <span className="font-medium text-slate-800">{tx.description}</span>
                                                    </div>
                                                  )}

                                                  <div className="flex items-center justify-between gap-2 flex-wrap text-[10px]">
                                                    <span className="text-slate-400">
                                                      {tx.account_name ? (
                                                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium inline-flex items-center gap-1">
                                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                          {tx.account_name}
                                                        </span>
                                                      ) : (
                                                        'No account'
                                                      )}
                                                    </span>
                                                    <button
                                                      onClick={() => handleDeleteTransaction(tx.id)}
                                                      className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                                      title="Delete transaction"
                                                    >
                                                      <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center text-slate-400 text-xs">
                No transactions found for this filter.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BUDGET VIEW */}
      {activeSubTab === 'budget' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Monthly Spending Budgets</h2>
              <p className="text-xs text-slate-500">Track and cap expenses per category</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                aria-label="Budget month"
                type="month"
                value={budgetPeriod}
                onChange={(e) => setBudgetPeriod(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
              />
              <button
                onClick={() => setShowAddCategoryModal(true)}
                className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> New Category
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgets.map((budget) => {
              const hasLimit = budget.monthly_limit !== null;
              const progress = hasLimit && budget.monthly_limit > 0
                ? Math.min((budget.spent / budget.monthly_limit) * 100, 100)
                : 0;
              const overBudget = budget.over_budget;
              return (
                <form
                  key={budget.category_id}
                  onSubmit={(e) => handleSaveBudget(e, budget.category_id)}
                  className="p-4 border border-slate-200 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between gap-3 text-xs font-bold">
                    <span className="text-slate-900">{budget.category_name}</span>
                    <label className="flex items-center gap-2 text-slate-500 font-medium">
                      Limit
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        aria-label={`${budget.category_name} monthly limit`}
                        placeholder="Set amount"
                        value={budgetDrafts[budget.category_id] ?? ''}
                        onChange={(e) => setBudgetDrafts((prev) => ({
                          ...prev,
                          [budget.category_id]: e.target.value,
                        }))}
                        className="w-28 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900"
                      />
                    </label>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
                    <div
                      className={`h-2 rounded-full ${overBudget ? 'bg-red-600' : 'bg-emerald-600'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-600">Spent: {formatCurrency(budget.spent)}</span>
                    <span className={`font-semibold ${overBudget ? 'text-red-700' : 'text-emerald-700'}`}>
                      {!hasLimit
                        ? 'No limit set'
                        : overBudget
                          ? `Over by ${formatCurrency(Math.abs(budget.remaining))}`
                          : `Remaining: ${formatCurrency(budget.remaining)}`}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={budgetsLoading}
                      className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                    >
                      {hasLimit ? 'Update limit' : 'Set limit'}
                    </button>
                  </div>
                </form>
              );
            })}
            {!budgetsLoading && budgets.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-slate-500">No expense categories found.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ACCOUNTS VIEW */}
      {activeSubTab === 'accounts' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Connected Accounts & Wallets</h2>
              <p className="text-xs text-slate-500">Bank accounts, credit cards, and cash reserves</p>
            </div>
            <button
              onClick={() => setShowAddAccountModal(true)}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Account
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.length > 0 ? (
              accounts.map(a => (
                <div key={a.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">{a.name}</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                      {a.account_type}
                    </span>
                  </div>
                  <p className="text-xl font-extrabold text-slate-900">{formatCurrency(a.balance)}</p>
                  <p className="text-[11px] text-slate-400">{a.institution || 'Bank Account'}</p>
                </div>
              ))
            ) : (
              <div className="col-span-3 py-8 text-center text-slate-400 text-xs">
                No accounts created yet. Click "+ Add Account" above.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: INSIGHTS VIEW */}
      {activeSubTab === 'insights' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6">
          <h2 className="text-base font-bold text-slate-900">Cashflow Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50 rounded-xl">
              <span className="text-xs text-emerald-800 font-bold">Total Inflow</span>
              <p className="text-2xl font-black text-emerald-900 mt-1">{formatCurrency(summary?.total_income || 0)}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-xl">
              <span className="text-xs text-red-800 font-bold">Total Outflow</span>
              <p className="text-2xl font-black text-red-900 mt-1">{formatCurrency(summary?.total_expense || 0)}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl">
              <span className="text-xs text-blue-800 font-bold">Net Savings</span>
              <p className="text-2xl font-black text-blue-900 mt-1">{formatCurrency(summary?.net_savings || 0)}</p>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 bg-slate-900/20 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-900">Delete {deleteModal.type === 'transaction' ? 'transaction' : 'transactions'}?</h3>
              <p className="mt-3 text-sm text-slate-600">
                {deleteModal.type === 'transaction'
                  ? 'This transaction will be permanently removed.'
                  : `Delete all ${deleteModal.payload.length} transactions in this month?`}
              </p>
            </div>

            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className="px-5 py-2 border border-slate-300 text-slate-700 rounded-full font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold shadow-xs cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD TRANSACTION MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Add Transaction</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-3 text-xs">
              {/* Type Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {['INCOME', 'EXPENSE', 'TRANSFER'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t })}
                    className={`flex-1 py-1.5 rounded-lg font-bold capitalize transition-all ${
                      form.type === t ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.toLowerCase()}
                  </button>
                ))}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 80000"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Salary, Grocery Shopping"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value, subcategory_id: '' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">Select Category</option>
                    {categories.filter(c => c.type === form.type).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subcategory</label>
                  <select
                    value={form.subcategory_id}
                    onChange={(e) => setForm({ ...form, subcategory_id: e.target.value })}
                    disabled={!selectedCatObj || selectedCatObj.subcategories?.length === 0}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white disabled:opacity-50"
                  >
                    <option value="">Select Subcategory</option>
                    {(selectedCatObj?.subcategories || []).map(sc => (
                      <option key={sc.id} value={sc.id}>{sc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account</label>
                  <select
                    value={form.account_id}
                    onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">None / Cash</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CATEGORY MODAL */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Create New Category</h3>
              <button onClick={() => setShowAddCategoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Side Hustle, Fitness & Gym"
                  value={newCatForm.name}
                  onChange={(e) => setNewCatForm({ ...newCatForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Type</label>
                <select
                  value={newCatForm.type}
                  onChange={(e) => setNewCatForm({ ...newCatForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subcategories (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Gym Membership, Supplements, Trainer"
                  value={newCatForm.subcategories}
                  onChange={(e) => setNewCatForm({ ...newCatForm, subcategories: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ACCOUNT MODAL */}
      {showAddAccountModal && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Add Bank / Wallet Account</h3>
              <button onClick={() => setShowAddAccountModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Nickname</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Salary Account, Cash Wallet"
                  value={newAccountForm.name}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Type</label>
                  <select
                    value={newAccountForm.account_type}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, account_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="SAVINGS">Savings Account</option>
                    <option value="CURRENT">Current Account</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="WALLET">Digital Wallet</option>
                    <option value="FIXED_DEPOSIT">Fixed Deposit</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Balance (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={newAccountForm.balance}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, balance: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

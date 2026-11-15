import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  NotebookText,
  Loader2
} from 'lucide-react';
import api from '../services/api';
import useCurrency from '../utils/useCurrency';
import ConfirmDialog from '../components/ConfirmDialog';
import PageGuide from '../components/PageGuide';
import Schedule from '../components/Schedule';
import { showToast } from '../utils/toast';

const formatLocalDate = (date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const getCurrentMonthStart = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
};

const CATEGORY_EMOJIS = {
  Briefcase: '💼', TrendingUp: '📈', Laptop: '💻', Home: '🏠', PlusCircle: '➕',
  Utensils: '🍽️', Zap: '⚡', Car: '🚗', Activity: '🩺', ShoppingBag: '🛍️',
  Film: '🎬', ShieldCheck: '🛡️', CreditCard: '💳', BookOpen: '📚',
  MinusCircle: '➖', Plane: '✈️', Tag: '🏷️',
};

const getCategoryEmoji = (category) => {
  const nameStartsWithEmoji = /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(String(category?.name || '').trim());
  if (nameStartsWithEmoji) return '';
  return CATEGORY_EMOJIS[category?.icon] || category?.icon || '🏷️';
};

export default function Money({ hideAmounts, focusDate, setActiveTab }) {
  const { formatCurrency: formatCurrencyValue, currencySymbol } = useCurrency();
  const [activeSubTab, setActiveSubTab] = useState('transactions'); // 'transactions', 'budget', 'accounts', 'insights'
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState('');
  const categoriesRequestVersion = useRef(0);
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState('');
  const accountRequestVersion = useRef(0);
  const [budgets, setBudgets] = useState([]);
  const [budgetDrafts, setBudgetDrafts] = useState({});
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetRefresh, setBudgetRefresh] = useState(0);
  const [budgetPeriod, setBudgetPeriod] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthBuckets, setMonthBuckets] = useState([]);
  const [monthBucketsLoading, setMonthBucketsLoading] = useState(true);
  const [monthDataMap, setMonthDataMap] = useState({});
  const [loadingMonths, setLoadingMonths] = useState({});
  const monthRequestVersion = useRef(0);
  const monthListRequestVersion = useRef(0);
  const summaryRequestVersion = useRef(0);
  const accountSummaryInitialized = useRef(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [transactionListError, setTransactionListError] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'EXPENSE', 'INCOME', 'TRANSFER', 'ALL'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [dateRange, setDateRange] = useState(() => ({
    start: getCurrentMonthStart(),
    end: formatLocalDate(new Date()),
  }));
  const [datePreset, setDatePreset] = useState('this_month');
  const [dividendTransactions, setDividendTransactions] = useState([]);
  const [dividendTransactionsLoading, setDividendTransactionsLoading] = useState(false);
  const [dividendTransactionsError, setDividendTransactionsError] = useState('');
  const transactionFilters = useRef({
    filterType,
    selectedAccountId,
    searchQuery,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);

  // Form State
  const [form, setForm] = useState({
    type: 'INCOME',
    amount: '',
    date: formatLocalDate(new Date()),
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
    icon: '🏷️',
    color: '#10B981',
    subcategories: '',
  });

  // Account Form
  const [newAccountForm, setNewAccountForm] = useState({
    name: '',
    account_type: 'SAVINGS',
    balance: '',
    institution: '',
  });

  const fetchCategories = async () => {
    const requestVersion = ++categoriesRequestVersion.current;
    setCategoriesLoading(true);
    setCategoriesError('');
    try {
      const response = await api.get('/categories');
      if (requestVersion !== categoriesRequestVersion.current) return;
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      if (requestVersion === categoriesRequestVersion.current) {
        setCategories([]);
        setCategoriesError('Unable to load categories.');
      }
    } finally {
      if (requestVersion === categoriesRequestVersion.current) {
        setCategoriesLoading(false);
      }
    }
  };

  const fetchData = async () => {
    const requestVersion = ++monthListRequestVersion.current;
    monthRequestVersion.current += 1;
    summaryRequestVersion.current += 1;
    setSummary(null);
    setSummaryLoading(true);
    setSummaryError('');
    setTransactionListError('');
    setMonthBuckets([]);
    setMonthBucketsLoading(true);
    setMonthDataMap({});
    setLoadingMonths({});
    setTransactions([]);
    setExpandedMonths({});
    setExpandedDates({});

    const summaryRequest = fetchSummary();
    const categoriesRequest = fetchCategories();
    const results = await Promise.allSettled([
      fetchAccounts(),
      api.get('/transactions/months'),
    ]);
    if (requestVersion !== monthListRequestVersion.current) return;

    const [, monthsResult] = results;
    if (monthsResult.status === 'fulfilled') {
      setMonthBuckets(monthsResult.value.data || []);
    } else {
      console.error('Failed to fetch transaction months:', monthsResult.reason);
      setTransactionListError('Unable to load the transaction list. Please try again.');
    }
    setMonthBucketsLoading(false);
    await Promise.all([categoriesRequest, summaryRequest]);
  };

  const fetchAccounts = async () => {
    const requestVersion = ++accountRequestVersion.current;
    setAccountsLoading(true);
    setAccountsError('');
    try {
      const response = await api.get('/accounts');
      if (requestVersion === accountRequestVersion.current) {
        setAccounts(Array.isArray(response.data) ? response.data : []);
        setAccountsError('');
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
      if (requestVersion === accountRequestVersion.current) {
        setAccountsError('Unable to load accounts. Please try again.');
      }
    } finally {
      if (requestVersion === accountRequestVersion.current) {
        setAccountsLoading(false);
      }
    }
  };

  const retryFetchCategories = async () => {
    await fetchCategories();
  };

  const fetchSummary = async () => {
    const requestVersion = ++summaryRequestVersion.current;
    setSummary(null);
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const res = await api.get('/transactions/summary', {
        params: {
          account_id: selectedAccountId || undefined,
          start_date: dateRange.start,
          end_date: dateRange.end,
        },
      });
      if (requestVersion === summaryRequestVersion.current) {
        setSummary(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch transaction summary:', err);
      if (requestVersion === summaryRequestVersion.current) {
        setSummary(null);
        setSummaryError('Unable to load transaction totals. Please try again.');
      }
    } finally {
      if (requestVersion === summaryRequestVersion.current) {
        setSummaryLoading(false);
      }
    }
  };

  const fetchMonthTransactions = async (year, monthNumber) => {
    const monthKey = `${year}-${String(monthNumber).padStart(2, '0')}`;
    if (monthDataMap[monthKey]) return;
    const requestVersion = monthRequestVersion.current;

    setLoadingMonths((prev) => ({ ...prev, [monthKey]: true }));

    try {
      const monthStart = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
      const lastDay = new Date(year, monthNumber, 0).getDate();
      const monthEnd = `${year}-${String(monthNumber).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const startDate = dateRange.start > monthStart ? dateRange.start : monthStart;
      const endDate = dateRange.end < monthEnd ? dateRange.end : monthEnd;

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

      if (requestVersion === monthRequestVersion.current) {
        setMonthDataMap((prev) => ({ ...prev, [monthKey]: res.data }));
        setTransactions(Array.isArray(res.data) ? res.data : []);
        setTransactionListError('');
      }
    } catch (err) {
      console.error('Failed to fetch month transactions:', err);
      if (requestVersion === monthRequestVersion.current) {
        setTransactionListError('Unable to load transactions for this month. Please try again.');
      }
    } finally {
      if (requestVersion === monthRequestVersion.current) {
        setLoadingMonths((prev) => ({ ...prev, [monthKey]: false }));
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!focusDate) return;
    const value = String(focusDate).slice(0, 10);
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return;
    setActiveSubTab('transactions');
    setFilterType('INCOME');
    setSelectedAccountId('');
    setSearchQuery('');
    setDatePreset('custom');
    setDateRange({ start: `${year}-${String(month).padStart(2, '0')}-01`, end: value });
  }, [focusDate]);

  useEffect(() => {
    if (activeSubTab !== 'dividends') return;
    let cancelled = false;
    setDividendTransactionsLoading(true);
    setDividendTransactionsError('');
    api.get('/transactions', {
      params: {
        type: 'INCOME', start_date: dateRange.start, end_date: dateRange.end,
        account_id: selectedAccountId || undefined, limit: 500,
      },
    }).then(({ data }) => {
      if (cancelled) return;
      const rows = Array.isArray(data) ? data : [];
      setDividendTransactions(rows.filter((row) => (
        String(row.subcategory_name || '').toLowerCase() === 'dividends'
        || (String(row.category_name || '').toLowerCase().includes('investment') && String(row.description || '').toLowerCase().includes('dividend'))
      )));
    }).catch((error) => {
      if (!cancelled) setDividendTransactionsError(error.response?.data?.detail || 'Could not load dividend receipts.');
    }).finally(() => {
      if (!cancelled) setDividendTransactionsLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeSubTab, dateRange, selectedAccountId, budgetRefresh]);

  useEffect(() => {
    if (activeSubTab === 'accounts') fetchAccounts();
  }, [activeSubTab]);

  useEffect(() => {
    if (!accountSummaryInitialized.current) {
      accountSummaryInitialized.current = true;
      return;
    }
    fetchSummary();
  }, [selectedAccountId, dateRange]);

  useEffect(() => {
    const previousFilters = transactionFilters.current;
    const filtersChanged = previousFilters.filterType !== filterType
      || previousFilters.selectedAccountId !== selectedAccountId
      || previousFilters.searchQuery !== searchQuery
      || previousFilters.startDate !== dateRange.start
      || previousFilters.endDate !== dateRange.end;

    transactionFilters.current = {
      filterType,
      selectedAccountId,
      searchQuery,
      startDate: dateRange.start,
      endDate: dateRange.end,
    };

    if (!filtersChanged) return;

    monthRequestVersion.current += 1;
    setMonthDataMap({});
    setLoadingMonths({});
    setTransactions([]);
    setExpandedMonths({});
    setExpandedDates({});
    setTransactionListError('');
  }, [filterType, selectedAccountId, searchQuery, dateRange]);

  useEffect(() => {
    if (!focusDate || activeSubTab !== 'transactions') return;
    const value = String(focusDate).slice(0, 10);
    const [year, month] = value.split('-').map(Number);
    if (!year || !month) return;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const monthStart = `${monthKey}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    setExpandedYears((current) => ({ ...current, [year]: true }));
    setExpandedMonths((current) => ({ ...current, [monthKey]: true }));
    const overlapsSelectedRange = dateRange.start <= monthEnd && dateRange.end >= monthStart;
    if (overlapsSelectedRange && !monthDataMap[monthKey] && !loadingMonths[monthKey]) fetchMonthTransactions(year, month);
  }, [focusDate, activeSubTab, dateRange, monthDataMap, loadingMonths]);

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
        showToast(err.response?.data?.detail || 'Could not load monthly budgets.', 'error');
      })
      .finally(() => setBudgetsLoading(false));
  }, [activeSubTab, budgetPeriod, budgetRefresh]);

  const formatCurrency = (val) => {
    if (hideAmounts) return '••••••';
    return formatCurrencyValue(val);
  };
  const formatSummaryValue = (val) => {
    if (summaryLoading) return 'Loading…';
    if (summaryError) return 'Unavailable';
    return formatCurrency(val);
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        category_id: form.category_id || undefined,
        subcategory_id: form.subcategory_id || undefined,
        account_id: form.account_id || undefined,
      };
      if (editingTransaction) {
        await api.put(`/transactions/${editingTransaction.id}`, payload);
      } else {
        await api.post('/transactions', payload);
      }
      setShowAddModal(false);
      setEditingTransaction(null);
      setBudgetRefresh((current) => current + 1);
      setForm({
        type: form.type,
        amount: '',
        date: formatLocalDate(new Date()),
        description: '',
        category_id: '',
        subcategory_id: '',
        account_id: '',
        notes: '',
      });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.detail || `Could not ${editingTransaction ? 'update' : 'save'} the transaction.`, 'error');
    }
  };

  const openEditTransaction = (transaction) => {
    setEditingTransaction(transaction);
    setForm({
      type: transaction.type || 'EXPENSE',
      amount: String(transaction.amount ?? ''),
      date: String(transaction.date || '').split('T')[0],
      description: transaction.description || '',
      category_id: transaction.category_id || '',
      subcategory_id: transaction.subcategory_id || '',
      account_id: transaction.account_id || '',
      notes: transaction.notes || '',
    });
    setShowAddModal(true);
  };

  const openDeleteConfirm = (type, payload) => {
    setDeleteModal({ type, payload });
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;

    if (deleteModal.type === 'transaction') {
      await api.delete(`/transactions/${deleteModal.payload.id}`);
    } else if (deleteModal.type === 'month' || deleteModal.type === 'date') {
      await Promise.all(deleteModal.payload.map((tx) => api.delete(`/transactions/${tx.id}`)));
    } else if (deleteModal.type === 'all') {
      await api.delete('/transactions/all');
    } else if (deleteModal.type === 'account') {
      await api.delete(`/accounts/${deleteModal.payload.id}`);
    }
    setBudgetRefresh((current) => current + 1);
    await fetchData();
  };

  const handleDeleteTransaction = async (id) => {
    openDeleteConfirm('transaction', { id });
  };

  const handleDeleteMonth = async (monthTransactions) => {
    if (!monthTransactions?.length) return;
    openDeleteConfirm('month', monthTransactions);
  };

  const handleDeleteDate = (dateTransactions) => {
    if (!dateTransactions?.length) return;
    openDeleteConfirm('date', dateTransactions);
  };

  const groupedTransactions = useMemo(() => {
    const yearMap = new Map();

    monthBuckets.forEach((bucket) => {
      const year = Number(bucket.year);
      const monthNumber = Number(bucket.month);
      const monthIndex = monthNumber - 1;
      const monthKey = `${year}-${String(monthNumber).padStart(2, '0')}`;
      const monthStart = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
      const monthEnd = `${year}-${String(monthNumber).padStart(2, '0')}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, '0')}`;
      if (monthEnd < dateRange.start || monthStart > dateRange.end) return;
      const monthLabel = new Date(year, monthIndex, 1).toLocaleString('en-US', { month: 'long' });

      if (!yearMap.has(year)) {
        yearMap.set(year, { year, months: [] });
      }

      yearMap.get(year).months.push({
        key: monthKey,
        label: monthLabel,
        year,
        monthIndex,
        monthNumber,
        transactions: monthDataMap[monthKey] || [],
      });
    });

    return Array.from(yearMap.values())
      .map((yearGroup) => ({
        year: yearGroup.year,
        months: yearGroup.months.sort((a, b) => b.monthIndex - a.monthIndex),
      }))
      .sort((a, b) => b.year - a.year);
  }, [monthBuckets, monthDataMap, dateRange]);

  const [expandedYears, setExpandedYears] = useState({});
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedDates, setExpandedDates] = useState({});
  const toggleYear = (year) => {
    setExpandedYears((prev) => ({
      ...prev,
      [year]: !(prev[year] ?? false),
    }));
  };

  const toggleMonth = async (monthKey, year, monthNumber) => {
    const isOpen = expandedMonths[monthKey] ?? false;
    const nextState = !isOpen;

    setExpandedMonths((prev) => ({
      ...prev,
      [monthKey]: nextState,
    }));

    if (nextState && !monthDataMap[monthKey] && !loadingMonths[monthKey]) {
      await fetchMonthTransactions(year, monthNumber);
    }
  };

  const toggleDate = (dateKey) => {
    setExpandedDates((prev) => ({
      ...prev,
      [dateKey]: !(prev[dateKey] ?? false),
    }));
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      const subcats = newCatForm.subcategories
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const response = await api.post('/categories', {
        name: newCatForm.name,
        type: newCatForm.type,
        icon: newCatForm.icon || '🏷️',
        color: newCatForm.color,
        subcategories: subcats,
      });
      setShowAddCategoryModal(false);
      setNewCatForm({ name: '', type: 'EXPENSE', icon: '🏷️', color: '#10B981', subcategories: '' });
      setBudgetRefresh((current) => current + 1);
      await fetchData();
      setForm((current) => ({
        ...current,
        type: response.data.type,
        category_id: response.data.id,
        subcategory_id: '',
      }));
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not create the category.', 'error');
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: newAccountForm.name,
        account_type: newAccountForm.account_type,
        balance: parseFloat(newAccountForm.balance) || 0,
        institution: newAccountForm.institution,
      };
      if (editingAccount) {
        await api.put(`/accounts/${editingAccount.id}`, payload);
      } else {
        await api.post('/accounts', payload);
      }
      setShowAddAccountModal(false);
      setEditingAccount(null);
      setNewAccountForm({ name: '', account_type: 'SAVINGS', balance: '', institution: '' });
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.detail || `Could not ${editingAccount ? 'update' : 'create'} the account.`, 'error');
    }
  };

  const openAccountModal = (account = null) => {
    setEditingAccount(account);
    setNewAccountForm(account ? {
      name: account.name || '',
      account_type: account.account_type || 'SAVINGS',
      balance: String(account.balance ?? 0),
      institution: account.institution || '',
    } : { name: '', account_type: 'SAVINGS', balance: '', institution: '' });
    setShowAddAccountModal(true);
  };

  const openAddTransaction = () => {
    if (accountsLoading) return;
    if (accountsError) {
      showToast(accountsError, 'error');
      return;
    }
    if (accounts.length === 0) {
      setActiveSubTab('accounts');
      openAccountModal();
      return;
    }
    setEditingTransaction(null);
    setForm({
      type: 'INCOME',
      amount: '',
      date: formatLocalDate(new Date()),
      description: '',
      category_id: '',
      subcategory_id: '',
      account_id: accounts[0].id,
      notes: '',
    });
    setShowAddModal(true);
  };

  const handleDeleteAccount = async (account) => {
    openDeleteConfirm('account', account);
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
      showToast(err.response?.data?.detail || 'Could not save the monthly limit.', 'error');
    }
  };

  const selectedCatObj = categories.find(c => String(c.id) === String(form.category_id));
  const transactionCategories = categories.filter(
    (category) => String(category.type || '').trim().toUpperCase() === form.type
  );
  const systemTransactionCategories = transactionCategories.filter((category) => category.is_system);
  const customTransactionCategories = transactionCategories.filter((category) => !category.is_system);
  const totalTransactionCount = monthBuckets.reduce((count, bucket) => count + Number(bucket.transaction_count || 0), 0);
  const chooseDatePreset = (preset) => {
    setDatePreset(preset);
    if (preset === 'custom') return;
    const today = new Date();
    const todayString = formatLocalDate(today);
    let start;
    let end = todayString;
    if (preset === 'this_month') {
      start = getCurrentMonthStart();
    } else if (preset === 'last_month') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      start = formatLocalDate(first);
      end = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 0));
    } else if (preset === 'last_30_days') {
      const first = new Date(today);
      first.setDate(today.getDate() - 29);
      start = formatLocalDate(first);
    } else if (preset === 'year_to_date') {
      start = `${today.getFullYear()}-01-01`;
    } else {
      start = '2000-01-01';
    }
    setDateRange({ start, end });
  };
  const dateRangeControls = (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <label className="flex items-center gap-1.5 font-medium text-slate-500">
        Period
        <select aria-label="Choose date range" value={datePreset} onChange={(event) => chooseDatePreset(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700">
          <option value="this_month">This month</option>
          <option value="last_month">Last month</option>
          <option value="last_30_days">Last 30 days</option>
          <option value="year_to_date">Year to date</option>
          <option value="all_time">All time</option>
          <option value="custom">Custom range</option>
        </select>
      </label>
      {datePreset === 'custom' && <>
        <label className="flex items-center gap-1.5 font-medium text-slate-500">From
          <input aria-label="Start date" type="date" value={dateRange.start} max={dateRange.end} onChange={(event) => setDateRange((current) => ({ ...current, start: event.target.value, end: event.target.value > current.end ? event.target.value : current.end }))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700" />
        </label>
        <label className="flex items-center gap-1.5 font-medium text-slate-500">To
          <input aria-label="End date" type="date" value={dateRange.end} min={dateRange.start} max={formatLocalDate(new Date())} onChange={(event) => setDateRange((current) => ({ ...current, start: event.target.value < current.start ? event.target.value : current.start, end: event.target.value }))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700" />
        </label>
      </>}
    </div>
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{activeSubTab === 'schedule' ? 'Cash flow schedule' : activeSubTab === 'transactions' ? 'Transactions' : `Money · ${activeSubTab}`}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{activeSubTab === 'transactions' ? `${totalTransactionCount} entries` : activeSubTab === 'schedule' ? 'Expected and recurring income and expenses' : ''}</p>
        </div>
        {activeSubTab === 'transactions' && <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
          {totalTransactionCount > 0 && (
            <button
              onClick={() => openDeleteConfirm('all', totalTransactionCount)}
              className="px-3.5 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete All
            </button>
          )}
          <button
            onClick={openAddTransaction}
            disabled={accountsLoading}
            className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:cursor-wait disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>}
      </div>

      <PageGuide
        title={activeSubTab === 'transactions' ? 'Transactions: money in and money out' : activeSubTab === 'schedule' ? 'Schedule expected cash flows' : `Money: ${activeSubTab}`}
        summary={activeSubTab === 'transactions' ? 'Record income, expenses, and transfers so your cash-flow view reflects what happened.' : activeSubTab === 'schedule' ? 'Plan recurring bills, subscriptions, EMIs, and expected income. An item becomes an actual transaction only when you record or link it.' : activeSubTab === 'budget' ? 'Set monthly spending limits by category, then compare them with your recorded expenses.' : activeSubTab === 'accounts' ? 'Accounts organize balances for cash and financial accounts; they are optional for transaction tracking.' : activeSubTab === 'dividends' ? 'Review dividend cash receipts recorded from your investment holdings.' : 'Cash-flow insights summarize recorded income and expenses over time.'}
        steps={activeSubTab === 'transactions' ? ['Choose Add to enter the date, type, amount, category, and account.', 'To bring in history, use Import and review its preview before saving.'] : activeSubTab === 'schedule' ? ['Add a bill or expected income, choose its cadence, dates, account, and optional category or asset.', 'When it is paid or received, record a new transaction or link an imported transaction.'] : activeSubTab === 'budget' ? ['Choose a month.', 'Set a limit for categories you want to monitor.'] : activeSubTab === 'accounts' ? ['Add an account name and type.', 'Enter its current balance if you want it included in your overview.'] : ['Record transactions regularly.', 'Use the period and category views to spot patterns.']}
        terms={[{ term: 'Income', definition: 'Money received.' }, { term: 'Expense', definition: 'Money paid out.' }, { term: 'Transfer', definition: 'Money moved between your own accounts.' }]}
      />

      {/* Sub Tabs Navigation */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-semibold">
        {['transactions', 'dividends', 'budget', 'accounts', 'insights', 'schedule'].map((tab) => (
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

      {activeSubTab === 'schedule' && <Schedule setActiveSubTab={setActiveSubTab} />}

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

              {dateRangeControls}
            </div>
          </div>

          {summaryError && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {summaryError}
            </p>
          )}
          {transactionListError && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {transactionListError}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total inflow · selected dates</span>
              <p className="text-2xl font-extrabold text-emerald-800 mt-1">{formatSummaryValue(summary?.total_income)}</p>
            </div>
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total outflow · selected dates</span>
              <p className="text-2xl font-extrabold text-red-700 mt-1">{formatSummaryValue(summary?.total_expense)}</p>
            </div>
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Net savings · selected dates</span>
              <p className={`text-2xl font-extrabold mt-1 ${(summary?.net_savings || 0) >= 0 ? 'text-blue-800' : 'text-red-700'}`}>
                {formatSummaryValue(summary?.net_savings)}
              </p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Inflow minus outflow</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Average monthly inflow</span>
              <p className="text-xl font-extrabold text-emerald-800 mt-1">{formatSummaryValue(summary?.monthly_avg_income)}</p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Last 90 days divided by 3</span>
            </div>
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Average monthly outflow</span>
              <p className="text-xl font-extrabold text-red-700 mt-1">{formatSummaryValue(summary?.monthly_avg_expense)}</p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Last 90 days divided by 3</span>
            </div>
          </div>

          <div className="space-y-4">
            {transactionListError ? (
              <div className="rounded-2xl border border-red-200 bg-white p-8 text-center text-sm text-red-600" role="status">
                Transaction list unavailable. Your summary totals are loaded separately.
              </div>
            ) : monthBucketsLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500" role="status">
                Loading transaction periods…
              </div>
            ) : groupedTransactions.length > 0 ? (
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
                            if (tx.type === 'INCOME') return sum + Number(tx.amount);
                            if (tx.type === 'EXPENSE') return sum - Number(tx.amount);
                            return sum;
                          }, 0);

                          return (
                            <div key={monthGroup.key} className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/30">
                              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white/80">
                                <button
                                  onClick={() => toggleMonth(monthGroup.key, monthGroup.year, monthGroup.monthNumber) }
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
                                    const dateTotal = dateTransactions.reduce((sum, tx) => {
                                      if (tx.type === 'INCOME') return sum + Number(tx.amount);
                                      if (tx.type === 'EXPENSE') return sum - Number(tx.amount);
                                      return sum;
                                    }, 0);

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
                                              onClick={() => handleDeleteDate(dateTransactions)}
                                              className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                              title="Delete transactions for this date"
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
                                                    <div className="flex items-center gap-1">
                                                      <button
                                                        onClick={() => openEditTransaction(tx)}
                                                        className="p-1 text-slate-400 hover:text-emerald-700 transition-colors cursor-pointer"
                                                        title="Edit transaction"
                                                        aria-label={`Edit ${tx.description || 'transaction'}`}
                                                      >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                      </button>
                                                      <button
                                                        onClick={() => handleDeleteTransaction(tx.id)}
                                                        className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                                        title="Delete transaction"
                                                        aria-label={`Delete ${tx.description || 'transaction'}`}
                                                      >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                      </button>
                                                    </div>
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

      {activeSubTab === 'dividends' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Dividend income</h2>
              <p className="mt-1 text-xs text-slate-500">Cash dividends you recorded as received. Announcements are tracked in Wealth and are not counted until recorded.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select aria-label="Filter dividends by account" value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                <option value="">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
              {dateRangeControls}
            </div>
          </div>
          {dividendTransactionsError && <p role="alert" className="text-xs text-red-600">{dividendTransactionsError}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Dividends received · selected period</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-900">{dividendTransactionsLoading ? 'Loading…' : formatCurrency(dividendTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0))}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Recorded dividend receipts</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{dividendTransactionsLoading ? 'Loading…' : dividendTransactions.length}</p>
            </div>
          </div>
          {dividendTransactionsLoading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">Loading dividend receipts…</div> : dividendTransactions.length ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="divide-y divide-slate-100">
                {dividendTransactions.map((tx) => (
                  <div key={tx.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{tx.description || 'Dividend income'}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{new Date(`${String(tx.date).slice(0, 10)}T00:00:00`).toLocaleDateString()}{tx.account_name ? ` · ${tx.account_name}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-700">+{formatCurrency(tx.amount)}</span>
                      <button type="button" onClick={() => openEditTransaction(tx)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">No dividend receipts recorded for this period</p>
              <p className="mt-1 text-xs text-slate-500">Check the date range, or record a paid dividend from Wealth → holding details.</p>
              {setActiveTab && <button type="button" onClick={() => setActiveTab('wealth')} className="mt-3 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-900">Open Wealth</button>}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BUDGET VIEW */}
      {activeSubTab === 'budget' && (
        <div className="space-y-5">
          {(() => {
            const limitedBudgets = budgets.filter((budget) => budget.monthly_limit !== null);
            const totalLimit = limitedBudgets.reduce((sum, budget) => sum + Number(budget.monthly_limit || 0), 0);
            const totalSpent = budgets.reduce((sum, budget) => sum + Number(budget.spent || 0), 0);
            const limitedSpent = limitedBudgets.reduce((sum, budget) => sum + Number(budget.spent || 0), 0);
            const remaining = totalLimit - limitedSpent;
            return <>
              <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Monthly budget planner</p>
                  <h2 className="mt-1 text-xl font-bold">Make every limit easy to follow</h2>
                  <p className="mt-1 text-xs text-emerald-100">Choose a month, set category limits, and watch spending update from your transactions.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input aria-label="Budget month" type="month" value={budgetPeriod} onChange={(e) => setBudgetPeriod(e.target.value)} className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white [color-scheme:dark]" />
                  <button onClick={() => { setNewCatForm((current) => ({ ...current, type: 'EXPENSE' })); setShowAddCategoryModal(true); }} className="budget-new-category-button inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50">
                    <Plus className="h-3.5 w-3.5" /> New category
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="budget-summary-card budget-summary-limits rounded-xl border border-emerald-100 bg-emerald-50 p-4"><p className="budget-summary-label text-[11px] font-semibold text-emerald-800">Total limits</p><p className="budget-summary-value mt-1 text-xl font-bold text-emerald-950">{formatCurrency(totalLimit)}</p><p className="budget-summary-detail mt-1 text-[10px] text-emerald-700">{limitedBudgets.length} categories budgeted</p></div>
                <div className="budget-summary-card budget-summary-spent rounded-xl border border-sky-100 bg-sky-50 p-4"><p className="budget-summary-label text-[11px] font-semibold text-sky-800">Total spent</p><p className="budget-summary-value mt-1 text-xl font-bold text-sky-950">{formatCurrency(totalSpent)}</p><p className="budget-summary-detail mt-1 text-[10px] text-sky-700">Across this month’s expense categories</p></div>
                <div className={`budget-summary-card ${remaining < 0 ? 'budget-summary-over' : 'budget-summary-remaining'} rounded-xl border p-4 ${remaining < 0 ? 'border-rose-100 bg-rose-50' : 'border-violet-100 bg-violet-50'}`}><p className="budget-summary-label text-[11px] font-semibold">Budget remaining</p><p className="budget-summary-value mt-1 text-xl font-bold">{formatCurrency(remaining)}</p><p className="budget-summary-detail mt-1 text-[10px]">From categories with a limit</p></div>
              </div>

              <div className="flex items-end justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Category limits</h3><p className="mt-0.5 text-[11px] text-slate-500">Save a limit on any card. Unbudgeted categories remain visible.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{budgets.length} categories</span></div>
              {budgetsLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-44 animate-pulse rounded-xl bg-slate-100" />)}</div> : budgets.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {budgets.map((budget) => {
                    const hasLimit = budget.monthly_limit !== null;
                    const limit = Number(budget.monthly_limit || 0);
                    const spent = Number(budget.spent || 0);
                    const progress = hasLimit && limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
                    const overBudget = Boolean(budget.over_budget);
                    const percentage = hasLimit && limit > 0 ? Math.round((spent / limit) * 100) : 0;
                    return <form key={budget.category_id} onSubmit={(e) => handleSaveBudget(e, budget.category_id)} className={`budget-category-card flex min-h-48 flex-col justify-between rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${overBudget ? 'border-rose-200' : 'border-slate-200'}`}>
                      <div>
                        <div className="flex items-start justify-between gap-2"><h4 className="flex items-center gap-2 text-sm font-bold text-slate-900"><span aria-hidden="true">{getCategoryEmoji(budget)}</span>{budget.category_name}</h4><span className={`budget-status-pill shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${overBudget ? 'budget-status-over bg-rose-100 text-rose-700' : hasLimit ? 'budget-status-on-track bg-emerald-100 text-emerald-800' : 'budget-status-not-set bg-slate-100 text-slate-500'}`}>{overBudget ? 'Over limit' : hasLimit ? `${percentage}% used` : 'Not set'}</span></div>
                        <div className="mt-4 flex items-end justify-between gap-2"><div><p className="budget-field-label text-[10px] text-slate-500">Spent</p><p className="mt-0.5 text-base font-bold text-slate-900">{formatCurrency(spent)}</p></div>{hasLimit && <div className="text-right"><p className="budget-field-label text-[10px] text-slate-500">Limit</p><p className="mt-0.5 text-xs font-semibold text-slate-700">{formatCurrency(limit)}</p></div>}</div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${budget.category_name} budget usage`} aria-valuenow={percentage} aria-valuemin="0" aria-valuemax="100"><div className={`h-full rounded-full transition-all ${overBudget ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }} /></div>
                        <p className={`budget-card-detail mt-2 min-h-4 text-[10px] ${overBudget ? 'budget-card-detail-over font-semibold text-rose-700' : 'text-slate-500'}`}>{!hasLimit ? 'Set a limit to track this category.' : overBudget ? `Over by ${formatCurrency(Math.abs(Number(budget.remaining || 0)))}` : `${formatCurrency(Number(budget.remaining || 0))} remaining`}</p>
                      </div>
                      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3"><label htmlFor={`budget-${budget.category_id}`} className="sr-only">{budget.category_name} monthly limit</label><input id={`budget-${budget.category_id}`} type="number" min="0" step="0.01" required aria-label={`${budget.category_name} monthly limit`} placeholder="Monthly limit" value={budgetDrafts[budget.category_id] ?? ''} onChange={(e) => setBudgetDrafts((prev) => ({ ...prev, [budget.category_id]: e.target.value }))} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" /><button type="submit" disabled={budgetsLoading} className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-900 disabled:opacity-50">Save</button></div>
                    </form>;
                  })}
                </div>
              ) : <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">No expense categories found.</div>}
            </>;
          })()}
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
              onClick={() => openAccountModal()}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Account
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accountsError && (
              <p className="col-span-full text-sm text-red-600" role="alert">{accountsError}</p>
            )}
            {accounts.length > 0 ? (
              accounts.map(a => (
                <div key={a.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">{a.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                      {a.account_type}
                    </span>
                    <button type="button" onClick={() => openAccountModal(a)} className="text-slate-500 hover:text-emerald-800" aria-label={`Edit ${a.name}`}>
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleDeleteAccount(a)} className="text-slate-500 hover:text-red-600" aria-label={`Delete ${a.name}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xl font-extrabold text-slate-900">{formatCurrency(a.balance)}</p>
                <p className="text-[11px] text-slate-400">{a.institution || 'Bank Account'} · {a.currency || 'INR'}</p>
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
              <p className="text-2xl font-black text-emerald-900 mt-1">{formatSummaryValue(summary?.total_income)}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-xl">
              <span className="text-xs text-red-800 font-bold">Total Outflow</span>
              <p className="text-2xl font-black text-red-900 mt-1">{formatSummaryValue(summary?.total_expense)}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl">
              <span className="text-xs text-blue-800 font-bold">Net Savings</span>
              <p className="text-2xl font-black text-blue-900 mt-1">{formatSummaryValue(summary?.net_savings)}</p>
              <span className="text-[11px] text-blue-700">For selected dates; transfers excluded</span>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <ConfirmDialog
          title={deleteModal.type === 'account'
            ? `Delete "${deleteModal.payload.name}"?`
            : deleteModal.type === 'all' ? 'Delete all transactions?' : `Delete ${deleteModal.type === 'transaction' ? 'transaction' : 'transactions'}?`}
          description={deleteModal.type === 'account'
            ? 'This account and all transactions linked to it will be permanently deleted. This cannot be undone.'
            : deleteModal.type === 'transaction'
              ? 'This transaction will be permanently removed.'
              : deleteModal.type === 'month'
                ? `Delete all ${deleteModal.payload.length} transactions in this month?`
                : deleteModal.type === 'date'
                  ? `Delete all ${deleteModal.payload.length} transactions on this date?`
                  : `Permanently delete all ${deleteModal.payload} transactions from Money? Account balances will be adjusted. This cannot be undone.`}
          onCancel={() => setDeleteModal(null)}
          onConfirm={confirmDelete}
        />
      )}

      {/* ADD TRANSACTION MODAL */}
      {showAddModal && (
        <div className="transaction-modal-backdrop fixed inset-0 flex items-center justify-center p-4 z-50" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowAddModal(false); setEditingTransaction(null); } }}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</h3>
              <button onClick={() => { setShowAddModal(false); setEditingTransaction(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-3 text-xs">
              {/* Type Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {['INCOME', 'EXPENSE', 'TRANSFER'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t, category_id: '', subcategory_id: '' })}
                    className={`flex-1 py-1.5 rounded-lg font-bold capitalize transition-all ${
                      form.type === t ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.toLowerCase()}
                  </button>
                ))}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount ({currencySymbol})</label>
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

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows="2"
                  placeholder="Optional details"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block font-semibold text-slate-700">Category</label>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => { setNewCatForm((current) => ({ ...current, type: form.type })); setShowAddCategoryModal(true); }} className="font-semibold text-emerald-800 hover:text-emerald-900">+ Add category</button>
                      {categoriesError && <button type="button" onClick={retryFetchCategories} disabled={categoriesLoading} className="font-semibold text-emerald-800 hover:text-emerald-900 disabled:opacity-50">{categoriesLoading ? 'Loading…' : 'Retry'}</button>}
                    </div>
                  </div>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value, subcategory_id: '' })}
                    disabled={categoriesLoading || Boolean(categoriesError)}
                    aria-busy={categoriesLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white disabled:cursor-wait disabled:opacity-70"
                  >
                    <option value="">
                      {categoriesLoading ? 'Loading categories…' : categoriesError ? 'Could not load categories' : 'Select Category'}
                    </option>
                    {transactionCategories.length === 0 && !categoriesLoading && !categoriesError && (
                      <option value="" disabled>No {form.type.toLowerCase()} categories available</option>
                    )}
                    {!!systemTransactionCategories.length && <optgroup label="Finverse categories">
                      {systemTransactionCategories.map((category) => <option key={category.id} value={category.id}>{getCategoryEmoji(category)}{getCategoryEmoji(category) ? ' ' : ''}{category.name}</option>)}
                    </optgroup>}
                    {!!customTransactionCategories.length && <optgroup label="Your categories">
                      {customTransactionCategories.map((category) => <option key={category.id} value={category.id}>{getCategoryEmoji(category)}{getCategoryEmoji(category) ? ' ' : ''}{category.name}</option>)}
                    </optgroup>}
                  </select>
                  {categoriesLoading && (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500" role="status">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      Loading categories…
                    </div>
                  )}
                  {!categoriesLoading && !categoriesError && transactionCategories.length === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewCatForm((current) => ({ ...current, type: form.type }));
                        setShowAddCategoryModal(true);
                      }}
                      className="mt-1 font-semibold text-emerald-800 hover:text-emerald-900"
                    >
                      + Add {form.type.toLowerCase()} category
                    </button>
                  )}
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
                  <label className="block font-semibold text-slate-700 mb-1">Account <span className="text-red-600">*</span></label>
                  <select
                    required
                    value={form.account_id}
                    onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">Select an account</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditingTransaction(null); }}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  {editingTransaction ? 'Update Transaction' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CATEGORY MODAL */}
      {showAddCategoryModal && (
        <div className="transaction-modal-backdrop fixed inset-0 flex items-center justify-center p-4 z-50" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAddCategoryModal(false); }}>
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
                  <option value="TRANSFER">Transfer</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category emoji</label>
                <div className="flex items-center gap-2">
                  <input type="text" aria-label="Category emoji" maxLength={8} value={newCatForm.icon} onChange={(e) => setNewCatForm({ ...newCatForm, icon: e.target.value })} className="w-16 rounded-lg border border-slate-300 px-3 py-2 text-center text-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500" />
                  <div className="flex flex-wrap gap-1">{['🏷️', '💼', '🏠', '🍽️', '🛍️', '🚗', '🩺', '🛡️', '🎬', '✈️', '📚', '💳'].map((emoji) => <button key={emoji} type="button" aria-label={`Use ${emoji} category icon`} onClick={() => setNewCatForm({ ...newCatForm, icon: emoji })} className={`rounded-md p-1.5 text-base hover:bg-slate-100 ${newCatForm.icon === emoji ? 'bg-emerald-50 ring-1 ring-emerald-500' : ''}`}>{emoji}</button>)}</div>
                </div>
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
        <div className="transaction-modal-backdrop fixed inset-0 flex items-center justify-center p-4 z-50" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowAddAccountModal(false); setEditingAccount(null); } }}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">{editingAccount ? 'Edit Account' : 'Add Bank / Wallet Account'}</h3>
              <button onClick={() => { setShowAddAccountModal(false); setEditingAccount(null); }} className="text-slate-400 hover:text-slate-600">
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
                  <label className="block font-semibold text-slate-700 mb-1">Initial Balance ({currencySymbol})</label>
                  <input
                    type="number"
                    step="any"
                    value={newAccountForm.balance}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, balance: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Institution</label>
                <input
                  type="text"
                  placeholder="Bank or provider name"
                  value={newAccountForm.institution}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, institution: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAddAccountModal(false); setEditingAccount(null); }}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  {editingAccount ? 'Update Account' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

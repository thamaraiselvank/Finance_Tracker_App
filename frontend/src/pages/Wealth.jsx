import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  TrendingUp, 
  TrendingDown, 
  Trash2, 
  Edit2, 
  X,
  RefreshCw,
  PieChart as PieIcon,
  DollarSign,
  Layers,
  FileText,
  Info
} from 'lucide-react';
import api from '../services/api';
import useCurrency from '../utils/useCurrency';
import ConfirmDialog from '../components/ConfirmDialog';
import PageGuide from '../components/PageGuide';
import { addMonthsToIsoDate, syncLinkedSchedule } from '../utils/linkedSchedule';
import { showToast } from '../utils/toast';

const ASSET_CLASSES = [
  { id: 'ALL', label: 'All Classes' },
  { id: 'EQUITY', label: 'Equity' },
  { id: 'MUTUAL_FUND', label: 'Mutual Funds' },
  { id: 'COMMODITY_GOLD', label: 'Commodities' },
  { id: 'REAL_ESTATE', label: 'Real Estate' },
  { id: 'CASH_EQUIVALENT', label: 'Cash & FDs' },
  { id: 'CRYPTO', label: 'Crypto' },
];

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const defaultIncomeSource = (assetClass) => {
  if (assetClass === 'REAL_ESTATE') return 'RENTAL_INCOME';
  if (assetClass === 'FIXED_INCOME') return 'INTEREST';
  if (['EQUITY', 'MUTUAL_FUND'].includes(assetClass)) return 'DIVIDEND';
  return 'OTHER';
};

const monthlyEquivalent = (schedule) => {
  const amount = Number(schedule.amount || 0);
  const interval = Math.max(1, Number(schedule.interval_count || 1));
  if (schedule.frequency === 'WEEKLY') return amount * 52 / (12 * interval);
  if (schedule.frequency === 'QUARTERLY') return amount / (3 * interval);
  if (schedule.frequency === 'YEARLY') return amount / (12 * interval);
  return amount / interval;
};

export default function Wealth({ hideAmounts, onViewMoneyDate }) {
  const { formatCurrency: formatAmount, currencySymbol } = useCurrency();
  const [activeSubTab, setActiveSubTab] = useState('assets'); // 'assets', 'liabilities', 'networth', 'allocation'
  const [wealthSummary, setWealthSummary] = useState(null);
  const [liabilities, setLiabilities] = useState([]);
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClasses, setExpandedClasses] = useState({ EQUITY: true, COMMODITY_GOLD: true, MUTUAL_FUND: true, REAL_ESTATE: true, CASH_EQUIVALENT: true });
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [showAddLiabModal, setShowAddLiabModal] = useState(false);
  const [showAmortizationModal, setShowAmortizationModal] = useState(false);
  const [selectedLiabAmortization, setSelectedLiabAmortization] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [refreshingAssetId, setRefreshingAssetId] = useState(null);
  const [refreshingAllPrices, setRefreshingAllPrices] = useState(false);
  const [assetPriceUpdatedAt, setAssetPriceUpdatedAt] = useState(null);
  const [dividendEvents, setDividendEvents] = useState([]);
  const [loadingDividends, setLoadingDividends] = useState(false);
  const [refreshingDividends, setRefreshingDividends] = useState(false);
  const [recordingDividendId, setRecordingDividendId] = useState(null);
  const [dividendAmounts, setDividendAmounts] = useState({});
  const [dividendPaymentDates, setDividendPaymentDates] = useState({});
  const [dividendYear, setDividendYear] = useState(String(new Date().getFullYear()));
  const [showDividendInfo, setShowDividendInfo] = useState(false);
  const [dividendForm, setDividendForm] = useState({ accountId: '' });
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [assetIncomeSchedules, setAssetIncomeSchedules] = useState([]);
  const [assetIncomeOccurrences, setAssetIncomeOccurrences] = useState([]);
  const [liabilitySchedule, setLiabilitySchedule] = useState({ enabled: true, account_id: '', first_due_date: '' });
  const [assetIncome, setAssetIncome] = useState({
    enabled: false, source_type: 'DIVIDEND', amount: '', account_id: '',
    frequency: 'MONTHLY', interval_count: '1', start_date: localToday(), end_date: '',
  });

  // Asset Form State
  const [assetForm, setAssetForm] = useState({
    name: '',
    symbol: '',
    asset_class: 'EQUITY',
    sub_type: 'Large Cap Stock',
    invested_amount: '',
    current_value: '',
    quantity: '1',
    buy_price: '',
    current_price: '',
    notes: '',
  });

  // Liability Form State
  const [liabForm, setLiabForm] = useState({
    name: '',
    liability_type: 'HOME_LOAN',
    principal_amount: '',
    current_outstanding: '',
    interest_rate_pct: '8.5',
    tenure_months: '120',
    emi_amount: '',
    lender: '',
    notes: '',
  });

  const fetchData = async () => {
    try {
      const today = new Date();
      const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const monthEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
      const [wRes, lRes, accountsRes, schedulesRes, occurrencesRes] = await Promise.all([
        api.get('/assets/summary'),
        api.get('/liabilities'),
        api.get('/accounts').catch(() => ({ data: [] })),
        api.get('/schedules').catch(() => ({ data: [] })),
        api.get('/schedules/occurrences', { params: { start_date: monthStart, end_date: monthEnd } }).catch(() => ({ data: [] })),
      ]);
      setWealthSummary(wRes.data);
      setLiabilities(lRes.data);
      const activeAccounts = (accountsRes.data || []).filter((account) => account.is_active !== false);
      setAccounts(activeAccounts);
      setAssetIncomeSchedules(Array.isArray(schedulesRes.data) ? schedulesRes.data : []);
      setAssetIncomeOccurrences(Array.isArray(occurrencesRes.data) ? occurrencesRes.data : []);
      setAssetIncome((current) => ({ ...current, account_id: current.account_id || activeAccounts[0]?.id || '' }));
      setLiabilitySchedule((current) => ({ ...current, account_id: current.account_id || activeAccounts[0]?.id || '' }));
    } catch (err) {
      console.error('Failed to fetch wealth data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (val) => {
    if (hideAmounts) return '••••••';
    return formatAmount(val);
  };

  const toggleClassExpand = (cls) => {
    setExpandedClasses((prev) => ({ ...prev, [cls]: !prev[cls] }));
  };

  const openAddAsset = () => {
    setEditingAsset(null);
    setAssetForm({ name: '', symbol: '', asset_class: 'EQUITY', sub_type: 'Large Cap Stock', invested_amount: '', current_value: '', quantity: '1', buy_price: '', current_price: '', notes: '' });
    setAssetIncome({ enabled: false, source_type: 'DIVIDEND', amount: '', account_id: accounts[0]?.id || '', frequency: 'MONTHLY', interval_count: '1', start_date: localToday(), end_date: '' });
    setShowAddAssetModal(true);
  };

  const openEditAsset = (asset) => {
    const incomeSchedule = assetIncomeSchedules.find((schedule) => String(schedule.asset_id) === String(asset.id) && schedule.flow_type === 'INCOME');
    setEditingAsset(asset);
    setAssetForm({
      name: asset.name || '', symbol: asset.meta_data?.symbol || asset.meta_data?.ticker || '', asset_class: asset.asset_class || 'OTHER', sub_type: asset.sub_type || '',
      invested_amount: String(asset.invested_amount ?? ''), current_value: String(asset.current_value ?? ''),
      quantity: String(asset.quantity ?? '1'), buy_price: String(asset.buy_price ?? ''),
      current_price: String(asset.current_price ?? ''), notes: asset.notes || '',
    });
    setAssetIncome({
      enabled: Boolean(incomeSchedule?.is_active), source_type: incomeSchedule?.source_type || defaultIncomeSource(asset.asset_class),
      amount: incomeSchedule ? String(incomeSchedule.amount) : '', account_id: incomeSchedule?.account_id || accounts[0]?.id || '',
      frequency: incomeSchedule?.frequency || 'MONTHLY', interval_count: String(incomeSchedule?.interval_count || 1),
      start_date: incomeSchedule ? String(incomeSchedule.start_date).slice(0, 10) : localToday(),
      end_date: incomeSchedule?.end_date ? String(incomeSchedule.end_date).slice(0, 10) : '',
    });
    setSelectedAsset(null);
    setShowAddAssetModal(true);
  };

  const updateAssetUnitField = (field, value) => {
    setAssetForm((current) => {
      const updated = { ...current, [field]: value };
      const price = Number(field === 'current_price' ? value : updated.current_price);
      const quantity = Number(field === 'quantity' ? value : updated.quantity);
      updated.current_value = price > 0 && quantity > 0 ? String(price * quantity) : '';
      return updated;
    });
  };

  const handleSaveAsset = async (e) => {
    e.preventDefault();
    if (assetIncome.enabled && (!assetIncome.account_id || !assetIncome.start_date || Number(assetIncome.amount) <= 0)) {
      showToast('To track recurring asset income, choose an account, start date, and expected amount above zero.', 'error');
      return;
    }
    try {
      const isUnitBased = ['EQUITY', 'MUTUAL_FUND', 'COMMODITY_GOLD', 'CRYPTO'].includes(assetForm.asset_class);
      const isCash = assetForm.asset_class === 'CASH_EQUIVALENT';

      let finalInvested = parseFloat(assetForm.invested_amount) || 0;
      let finalBuyPrice = parseFloat(assetForm.buy_price) || 0;
      let finalCurrentPrice = parseFloat(assetForm.current_price) || 0;
      let finalQuantity = parseFloat(assetForm.quantity) || 1;
      let finalCurrentValue = parseFloat(assetForm.current_value) || 0;

      if (isUnitBased) {
        finalInvested = finalBuyPrice * finalQuantity;
        if (!finalCurrentValue && finalCurrentPrice) {
          finalCurrentValue = finalCurrentPrice * finalQuantity;
        }
      } else if (isCash) {
        finalInvested = finalCurrentValue;
        finalBuyPrice = finalCurrentValue;
        finalCurrentPrice = finalCurrentValue;
        finalQuantity = 1;
      } else {
        // Real estate, fixed income
        finalBuyPrice = finalInvested;
        finalCurrentPrice = finalCurrentValue;
        finalQuantity = 1;
      }

      const assetPayload = {
        ...assetForm,
        meta_data: {
          ...((editingAsset?.meta_data && typeof editingAsset.meta_data === 'object') ? editingAsset.meta_data : {}),
          symbol: assetForm.symbol.trim().toUpperCase(),
        },
        invested_amount: finalInvested,
        current_value: finalCurrentValue,
        quantity: finalQuantity,
        buy_price: finalBuyPrice,
        current_price: finalCurrentPrice,
      };
      const assetResponse = editingAsset
        ? await api.put(`/assets/${editingAsset.id}`, assetPayload)
        : await api.post('/assets', assetPayload);
      let incomeScheduleWarning = '';
      try {
        await syncLinkedSchedule(api, {
          linkField: 'asset_id', linkId: assetResponse.data.id, enabled: assetIncome.enabled,
          accountId: assetIncome.account_id, description: `${assetForm.name.trim()} income`,
          amount: assetIncome.amount, sourceType: assetIncome.source_type, flowType: 'INCOME', amountIsEstimate: true,
          frequency: assetIncome.frequency, intervalCount: assetIncome.interval_count,
          startDate: assetIncome.start_date, endDate: assetIncome.end_date || null,
        });
      } catch (scheduleError) {
        incomeScheduleWarning = `Asset ${editingAsset ? 'updated' : 'saved'}, but its income schedule could not be updated: ${scheduleError.response?.data?.detail || scheduleError.message}`;
      }
      setShowAddAssetModal(false);
      setEditingAsset(null);
      setAssetForm({
        name: '',
        symbol: '',
        asset_class: 'EQUITY',
        sub_type: '',
        invested_amount: '',
        current_value: '',
        quantity: '1',
        buy_price: '',
        current_price: '',
        notes: '',
      });
      setAssetIncome({ enabled: false, source_type: 'DIVIDEND', amount: '', account_id: accounts[0]?.id || '', frequency: 'MONTHLY', interval_count: '1', start_date: localToday(), end_date: '' });
      await fetchData();
      if (incomeScheduleWarning) showToast(incomeScheduleWarning, 'warning');
      else showToast(editingAsset ? 'Asset updated.' : assetIncome.enabled ? 'Asset and recurring income schedule saved.' : 'Asset saved.', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not save the asset.', 'error');
    }
  };

  const handleDeleteAsset = (id) => setDeleteCandidate({ type: 'asset', id });

  const handleDeleteAllAssets = () => setDeleteCandidate({ type: 'allAssets' });

  const handleOpenAsset = (asset) => {
    setSelectedAsset(asset);
    setAssetPriceUpdatedAt(asset.price_updated_at || asset.updated_at || null);
    setDividendEvents([]);
    setDividendPaymentDates({});
    setDividendForm((current) => ({ ...current, accountId: current.accountId || accounts[0]?.id || '' }));
    if (asset.asset_class === 'EQUITY') {
      setLoadingDividends(true);
      const hasTicker = Boolean(asset.meta_data?.symbol || asset.meta_data?.ticker);
      (hasTicker
        ? api.post(`/assets/${asset.id}/refresh-dividends`).then((response) => response.data.events || [])
        : api.get(`/assets/${asset.id}/dividends`).then((response) => response.data || []))
        .then((events) => setDividendEvents(events))
        .catch(() => setDividendEvents([]))
        .finally(() => setLoadingDividends(false));
    }
  };

  const handleRefreshDividends = async () => {
    if (!selectedAsset) return;
    setRefreshingDividends(true);
    try {
      const response = await api.post(`/assets/${selectedAsset.id}/refresh-dividends`);
      setDividendEvents(response.data.events || []);
      showToast(`Updated ${response.data.updated_count} dividend announcement(s) for ${response.data.ticker}.`, 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not load dividend history. Check that this equity has a ticker symbol.', 'error');
    } finally {
      setRefreshingDividends(false);
    }
  };

  const handleRecordDividend = async (event) => {
    const suggestedAmount = Number(event.amount_per_share || 0) * Number(selectedAsset?.quantity || 0);
    const amount = Number(dividendAmounts[event.id] ?? suggestedAmount.toFixed(2));
    const paymentDate = dividendPaymentDates[event.id] || String(event.event_date).slice(0, 10);
    if (!selectedAsset || !dividendForm.accountId || amount <= 0 || !paymentDate) {
      showToast('Enter the actual amount received, payment date, and receiving account.', 'error');
      return;
    }
    setRecordingDividendId(event.id);
    try {
      await api.post(`/assets/${selectedAsset.id}/dividends/${event.id}/record`, {
        actual_amount: amount, payment_date: paymentDate, account_id: dividendForm.accountId,
      });
      setDividendAmounts((current) => {
        const updated = { ...current };
        delete updated[event.id];
        return updated;
      });
      const response = await api.get(`/assets/${selectedAsset.id}/dividends`);
      setDividendEvents(response.data || []);
      await fetchData();
      showToast('Dividend recorded in Money and included in tax income.', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not record this dividend.', 'error');
    } finally {
      setRecordingDividendId(null);
    }
  };

  const handleRefreshAssetPrice = async () => {
    if (!selectedAsset) return;
    setRefreshingAssetId(selectedAsset.id);
    try {
      const response = await api.post(`/assets/${selectedAsset.id}/refresh-price`);
      setSelectedAsset(response.data);
      setAssetPriceUpdatedAt(response.data.price_updated_at || new Date().toISOString());
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not refresh the live price.', 'error');
    } finally {
      setRefreshingAssetId(null);
    }
  };

  const handleRefreshAllEquityPrices = async () => {
    setRefreshingAllPrices(true);
    try {
      const response = await api.post('/assets/refresh-prices');
      await fetchData();
      const failures = response.data.failures || [];
      if (failures.length) {
        const details = failures.map((failure) => `${failure.asset}: ${failure.reason}`).join('\n');
        showToast(`${response.data.message} Could not refresh: ${details}`, 'warning');
      } else {
        showToast(response.data.message, 'success');
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not refresh equity prices.', 'error');
    } finally {
      setRefreshingAllPrices(false);
    }
  };

  const handleCreateLiability = async (e) => {
    e.preventDefault();
    if (liabilitySchedule.enabled && (!liabilitySchedule.account_id || !liabilitySchedule.first_due_date)) {
      showToast('Choose a payment account and first due date for the EMI schedule, or turn off schedule linking.', 'error');
      return;
    }
    try {
      const response = await api.post('/liabilities', {
        ...liabForm,
        principal_amount: parseFloat(liabForm.principal_amount) || 0,
        current_outstanding: parseFloat(liabForm.current_outstanding) || parseFloat(liabForm.principal_amount) || 0,
        interest_rate_pct: parseFloat(liabForm.interest_rate_pct) || 0,
        tenure_months: parseInt(liabForm.tenure_months) || 12,
        emi_amount: parseFloat(liabForm.emi_amount) || 0,
      });
      let scheduleWarning = '';
      if (liabilitySchedule.enabled && Number(response.data.emi_amount) > 0) {
        try {
          await syncLinkedSchedule(api, {
            linkField: 'liability_id', linkId: response.data.id, enabled: true,
            accountId: liabilitySchedule.account_id, description: `${response.data.name} EMI`,
            amount: response.data.emi_amount, sourceType: 'EMI', frequency: 'MONTHLY',
            startDate: liabilitySchedule.first_due_date,
            endDate: response.data.tenure_months ? addMonthsToIsoDate(liabilitySchedule.first_due_date, Number(response.data.tenure_months) - 1) : null,
          });
        } catch (scheduleError) {
          scheduleWarning = `Loan saved, but its EMI schedule could not be linked: ${scheduleError.response?.data?.detail || scheduleError.message}`;
        }
      }
      setShowAddLiabModal(false);
      setLiabForm({
        name: '',
        liability_type: 'HOME_LOAN',
        principal_amount: '',
        current_outstanding: '',
        interest_rate_pct: '8.5',
        tenure_months: '120',
        emi_amount: '',
        lender: '',
        notes: '',
      });
      setLiabilitySchedule({ enabled: true, account_id: accounts[0]?.id || '', first_due_date: '' });
      fetchData();
      if (scheduleWarning) showToast(scheduleWarning, 'warning');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not save the liability.', 'error');
    }
  };

  const handleDeleteLiability = (id) => setDeleteCandidate({ type: 'liability', id });

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    if (deleteCandidate.type === 'asset') {
      await api.delete(`/assets/${deleteCandidate.id}`);
    } else if (deleteCandidate.type === 'allAssets') {
      await api.delete('/assets/all');
    } else if (deleteCandidate.type === 'liability') {
      await api.delete(`/liabilities/${deleteCandidate.id}`);
    }
    await fetchData();
  };

  const deleteDialog = deleteCandidate
    ? {
      asset: {
        title: 'Delete this asset holding?',
        description: 'This asset record will be permanently deleted. This cannot be undone.',
      },
      allAssets: {
        title: 'Delete all asset holdings?',
        description: 'All of your asset records will be permanently deleted. This cannot be undone.',
      },
      liability: {
        title: 'Delete this loan or liability?',
        description: 'This liability record will be permanently deleted. This cannot be undone.',
      },
    }[deleteCandidate.type]
    : null;

  const handleViewAmortization = async (id) => {
    try {
      const res = await api.get(`/liabilities/${id}/amortization`);
      setSelectedLiabAmortization(res.data);
      setShowAmortizationModal(true);
    } catch (err) {
      showToast('Could not load the amortization schedule.', 'error');
    }
  };

  const totalAssetCount = (wealthSummary?.asset_classes || []).reduce((acc, c) => acc + c.count, 0);
  const getAssetClassCount = (assetClass) => {
    if (assetClass === 'ALL') return totalAssetCount;
    return wealthSummary?.asset_classes?.find((item) => item.asset_class === assetClass)?.count || 0;
  };
  const assetCountSummary = ASSET_CLASSES
    .filter((assetClass) => assetClass.id !== 'ALL')
    .map((assetClass) => `${assetClass.label}: ${getAssetClassCount(assetClass.id)}`)
    .join('  |  ');
  const activeAssetIncomeSchedules = assetIncomeSchedules.filter((schedule) => schedule.is_active && schedule.flow_type === 'INCOME' && schedule.asset_id);
  const expectedMonthlyPassiveIncome = activeAssetIncomeSchedules.reduce((sum, schedule) => sum + monthlyEquivalent(schedule), 0);
  const linkedAssetIncomeScheduleIds = new Set(assetIncomeSchedules
    .filter((schedule) => schedule.flow_type === 'INCOME' && schedule.asset_id)
    .map((schedule) => String(schedule.id)));
  const passiveIncomeReceivedThisMonth = assetIncomeOccurrences
    .filter((occurrence) => occurrence.flow_type === 'INCOME' && occurrence.status === 'received' && linkedAssetIncomeScheduleIds.has(String(occurrence.schedule_id)))
    .reduce((sum, occurrence) => sum + Number(occurrence.actual_amount ?? occurrence.amount ?? 0), 0);
  const monthlyIncomeForAsset = (assetId) => activeAssetIncomeSchedules
    .filter((schedule) => String(schedule.asset_id) === String(assetId))
    .reduce((sum, schedule) => sum + monthlyEquivalent(schedule), 0);

  const currentCalendarYear = new Date().getFullYear();
  const dividendYears = Array.from(new Set([
    ...Array.from({ length: 11 }, (_, index) => String(currentCalendarYear - index)),
    ...dividendEvents.map((event) => String(event.event_date).slice(0, 4)),
  ])).sort((a, b) => Number(b) - Number(a));
  const visibleDividendEvents = dividendEvents.filter((event) => dividendYear === 'ALL' || String(event.event_date).slice(0, 4) === dividendYear);
  const recordedDividendEvents = visibleDividendEvents.filter((event) => event.transaction_id && Number(event.received_amount) > 0);
  const receivedDividendTotal = recordedDividendEvents.reduce((total, event) => total + Number(event.received_amount), 0);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Assets</h1>
          <p className="text-xs text-slate-500 mt-0.5">{assetCountSummary || 'No assets tracked by category'}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg w-48 sm:w-64 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {activeSubTab === 'assets' ? (
            <div className="flex flex-wrap items-center gap-2">
              {getAssetClassCount('EQUITY') > 0 && (
                <button
                  onClick={handleRefreshAllEquityPrices}
                  disabled={refreshingAllPrices}
                  className="px-3 py-2 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  title="Refresh prices for all equity holdings"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshingAllPrices ? 'animate-spin' : ''}`} />
                  {refreshingAllPrices ? 'Refreshing…' : 'Refresh Prices'}
                </button>
              )}
              {totalAssetCount > 0 && (
                <button
                  onClick={handleDeleteAllAssets}
                  className="px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Delete all asset holdings"
                >
                  <Trash2 className="w-4 h-4" /> Delete All
                </button>
              )}
              <button
                onClick={openAddAsset}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Asset
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddLiabModal(true)}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Liability
            </button>
          )}
        </div>
      </div>

      <PageGuide
        title={`Wealth: ${activeSubTab === 'networth' ? 'net worth' : activeSubTab}`}
        summary={activeSubTab === 'assets' ? 'Assets are things of financial value you own, such as account balances, investments, or property.' : activeSubTab === 'liabilities' ? 'Liabilities are debts you owe, such as loans. Track the current balance and payment details.' : activeSubTab === 'networth' ? 'Net worth is the value of tracked assets minus tracked liabilities. It is a snapshot, not spendable cash.' : 'Allocation shows how tracked asset value is divided among asset classes; it does not rate whether a mix is right for you.'}
        steps={activeSubTab === 'assets' ? ['Add an account or asset you want to track.', 'Use its current estimated value; update it when that value changes.'] : activeSubTab === 'liabilities' ? ['Add the current outstanding balance from your lender.', 'Include the rate and monthly payment if you know them.'] : activeSubTab === 'networth' ? ['Check that the accounts, assets, and debts you chose to track are up to date.', 'Compare snapshots over time.'] : ['Review the percentage in each class.', 'Missing classes may simply mean you have not added those records.']}
        terms={[{ term: 'Asset', definition: 'Something you own that has financial value.' }, { term: 'Liability', definition: 'A debt or obligation you owe.' }, { term: 'Net worth', definition: 'Tracked assets minus tracked liabilities.' }, { term: 'Allocation', definition: 'The share of tracked assets in each class.' }]}
      />

      {/* Sub Tabs Navigation */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-semibold">
        {['assets', 'liabilities', 'networth', 'allocation'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`pb-3 capitalize transition-all relative ${
              activeSubTab === tab
                ? 'text-emerald-800 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab === 'networth' ? 'Net Worth' : tab}
            {activeSubTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-800 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: ASSETS */}
      {activeSubTab === 'assets' && (
        <div className="space-y-6">
          {/* Class Filters Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-slate-400 font-medium mr-1">Filter:</span>
            {ASSET_CLASSES.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  selectedClass === cls.id
                    ? 'wealth-class-filter-active font-bold'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cls.label} ({getAssetClassCount(cls.id)})
              </button>
            ))}
          </div>

          {/* TOTAL ASSETS BANNER CARD (Finverse Screenshot Style) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
            <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">
              Total Assets
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
              <div>
                <span className="text-xs text-slate-400 uppercase font-medium">Invested</span>
                <p className="text-xl font-bold text-slate-900 mt-1">
                  {formatCurrency(wealthSummary?.total_assets_invested || 0)}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase font-medium">Current Value</span>
                <p className="text-xl font-extrabold text-slate-900 mt-1">
                  {formatCurrency(wealthSummary?.total_assets_current || 0)}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase font-medium">P&L</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xl font-extrabold ${
                    (wealthSummary?.total_assets_pnl || 0) >= 0 ? 'text-emerald-800' : 'text-red-600'
                  }`}>
                    {(wealthSummary?.total_assets_pnl || 0) >= 0 ? '+' : ''}
                    {formatCurrency(wealthSummary?.total_assets_pnl || 0)}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    (wealthSummary?.total_assets_pnl || 0) >= 0 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}>
                    {(wealthSummary?.total_assets_pnl_pct || 0) >= 0 ? '+' : ''}
                    {wealthSummary?.total_assets_pnl_pct || 0}%
                  </span>
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase font-medium">Expected passive income / month</span>
                <p className="text-xl font-extrabold text-emerald-700 mt-1">{formatCurrency(expectedMonthlyPassiveIncome)}</p>
                <p className="mt-1 text-[10px] text-slate-500">{activeAssetIncomeSchedules.length ? `Monthly average across ${activeAssetIncomeSchedules.length} active linked ${activeAssetIncomeSchedules.length === 1 ? 'schedule' : 'schedules'}; Money shows each full payment on its due date.` : 'No asset income schedule yet. Add one here or in Money → Schedule.'}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase font-medium">Passive income received this month</span>
                <p className="text-xl font-extrabold text-teal-700 mt-1">{formatCurrency(passiveIncomeReceivedThisMonth)}</p>
                <p className="mt-1 text-[10px] text-slate-500">Confirmed receipts linked from Money → Schedule</p>
              </div>
            </div>
          </div>

          {/* Grouped Asset Class Lists (Finverse Accordions) */}
          <div className="space-y-4">
            {(wealthSummary?.asset_classes || [])
              .filter(ac => selectedClass === 'ALL' || ac.asset_class === selectedClass)
              .map((ac) => {
                const isExpanded = expandedClasses[ac.asset_class] ?? true;
                const filteredItems = (ac.items || []).filter(item => 
                  !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
                );
                if (filteredItems.length === 0 && searchQuery) return null;

                return (
                  <div key={ac.asset_class} className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
                    {/* Accordion Header */}
                    <div 
                      onClick={() => toggleClassExpand(ac.asset_class)}
                      className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="p-1.5 bg-emerald-50 text-emerald-800 rounded-lg">
                          <TrendingUp className="w-4 h-4" />
                        </span>
                        <span className="text-sm font-bold text-slate-900 capitalize">
                          {ac.asset_class.replace('_', ' ').toLowerCase()}
                        </span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                          {ac.count}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold text-slate-900">
                          {formatCurrency(ac.total_current_value)}
                        </span>
                        <span className={`text-xs font-semibold ${ac.total_pnl >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {ac.total_pnl >= 0 ? '+' : ''}{ac.pnl_percentage}%
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>

                    {/* Accordion Table Content */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50/70 text-slate-400 font-semibold border-b border-slate-100">
                            <tr>
                              <th className="py-2.5 px-6">Holding Name</th>
                              <th className="py-2.5 px-4">Sub Type</th>
                              <th className="py-2.5 px-4 text-right">Quantity</th>
                              <th className="py-2.5 px-4 text-right">Buy Price</th>
                              <th className="py-2.5 px-4 text-right">Current Price</th>
                              <th className="py-2.5 px-4 text-right">Current Value</th>
                              <th className="py-2.5 px-4 text-right">Expected Income / Mo.</th>
                              <th className="py-2.5 px-4 text-right">P&L</th>
                              <th className="py-2.5 px-6 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredItems.map((item) => (
                              <tr
                                key={item.id}
                                onClick={() => handleOpenAsset(item)}
                                className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                              >
                                <td className="py-3 px-6 font-semibold text-slate-900">{item.name}</td>
                                <td className="py-3 px-4 text-slate-500">{item.sub_type || '-'}</td>
                                <td className="py-3 px-4 text-right text-slate-700">{item.quantity}</td>
                                <td className="py-3 px-4 text-right text-slate-700">{formatCurrency(item.buy_price || item.invested_amount)}</td>
                                <td className="py-3 px-4 text-right text-slate-700">{item.current_price > 0 ? formatCurrency(item.current_price) : '—'}</td>
                                <td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(item.current_value)}</td>
                                <td className="py-3 px-4 text-right font-semibold text-emerald-700">{monthlyIncomeForAsset(item.id) > 0 ? formatCurrency(monthlyIncomeForAsset(item.id)) : '—'}</td>
                                <td className={`py-3 px-4 text-right font-semibold ${item.pnl >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                  {item.pnl >= 0 ? '+' : ''}{formatCurrency(item.pnl)} ({item.pnl_percentage}%)
                                </td>
                                <td className="py-3 px-6 text-right">
                                  <button type="button" onClick={(event) => { event.stopPropagation(); openEditAsset(item); }} className="mr-2 p-1 text-slate-500 hover:text-emerald-700 transition-colors" title="Edit holding" aria-label={`Edit ${item.name}`}>
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDeleteAsset(item.id);
                                    }}
                                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                    title="Delete holding"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 2: LIABILITIES */}
      {activeSubTab === 'liabilities' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
            <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">
              Total Outstanding Debt
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <span className="text-xs text-slate-400 uppercase font-medium">Total Outstanding</span>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {formatCurrency(wealthSummary?.total_liabilities_outstanding || 0)}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase font-medium">Total Monthly EMI</span>
                <p className="text-2xl font-extrabold text-red-600 mt-1">
                  {formatCurrency(wealthSummary?.total_monthly_emi || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liabilities.length > 0 ? (
              liabilities.map((l) => (
                <div key={l.id} className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{l.name}</h3>
                      <p className="text-[11px] text-slate-400">{l.liability_type.replace('_', ' ')} • {l.lender || 'Bank'}</p>
                    </div>
                    <span className="badge-good">
                      {l.paid_percentage}% Paid
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px]">Outstanding</span>
                      <p className="font-bold text-slate-900">{formatCurrency(l.current_outstanding)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Interest Rate</span>
                      <p className="font-bold text-slate-900">{l.interest_rate_pct}%</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Monthly EMI</span>
                      <p className="font-bold text-emerald-800">{formatCurrency(l.emi_amount)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => handleViewAmortization(l.id)}
                      className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" /> Amortization Schedule
                    </button>
                    <button
                      onClick={() => handleDeleteLiability(l.id)}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                      title="Delete loan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 py-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                No debts or loans recorded. Great job staying debt-free!
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: NET WORTH */}
      {activeSubTab === 'networth' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Net Worth Composition</h2>
              <p className="text-xs text-slate-500">Assets minus liabilities breakdown</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Total Net Worth</span>
              <p className={`text-2xl font-black ${Number(wealthSummary?.net_worth || 0) < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{formatCurrency(wealthSummary?.net_worth || 0)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl">
              <span className="text-xs font-bold text-emerald-900 uppercase">Gross Assets</span>
              <p className="text-2xl font-extrabold text-emerald-900 mt-1">{formatCurrency(wealthSummary?.total_assets_current || 0)}</p>
              <p className="text-[11px] text-emerald-700 mt-1">Across {totalAssetCount} investment holdings</p>
            </div>
            <div className="p-4 bg-red-50/50 border border-red-200 rounded-xl">
              <span className="text-xs font-bold text-red-900 uppercase">Total Liabilities</span>
              <p className="text-2xl font-extrabold text-red-900 mt-1">{formatCurrency(wealthSummary?.total_liabilities_outstanding || 0)}</p>
              <p className="text-[11px] text-red-700 mt-1">Across {liabilities.length} active loan accounts</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ALLOCATION */}
      {activeSubTab === 'allocation' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6">
          <h2 className="text-base font-bold text-slate-900">Asset Class Allocation</h2>
          <div className="space-y-4">
            {(wealthSummary?.asset_classes || []).map((ac) => (
              <div key={ac.asset_class} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-800">{ac.asset_class.replace('_', ' ')}</span>
                  <span className="text-slate-900 font-bold">{formatCurrency(ac.total_current_value)} ({ac.allocation_percentage}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, ac.allocation_percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedAsset && (
        <div className="modal-overlay z-[60] items-start overflow-y-auto p-3 sm:items-center sm:p-5 animate-in fade-in duration-150" onClick={() => setSelectedAsset(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="holding-details-title"
            className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex shrink-0 items-start justify-between border-b border-slate-100 pb-4 sm:mb-5">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-emerald-700 uppercase">Holding Details</p>
                <h3 id="holding-details-title" className="mt-1 text-lg font-bold text-slate-900">{selectedAsset.name}</h3>
                <p className="text-xs text-slate-500">{selectedAsset.sub_type || selectedAsset.asset_class.replace('_', ' ')}</p>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="text-slate-400 hover:text-slate-600" title="Close details">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['Invested Amount', formatCurrency(selectedAsset.invested_amount)],
                ['Current Value', formatCurrency(selectedAsset.current_value)],
                ['Absolute Return', `${selectedAsset.pnl >= 0 ? '+' : ''}${formatCurrency(selectedAsset.pnl)}`],
                ['Return', `${selectedAsset.pnl_percentage >= 0 ? '+' : ''}${selectedAsset.pnl_percentage}%`],
                ['Quantity', selectedAsset.quantity],
                ['Buy Price', formatCurrency(selectedAsset.buy_price)],
                ['Current Price', formatCurrency(selectedAsset.current_price)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <span className="text-slate-400">{label}</span>
                  <p className={`font-bold mt-1 ${label === 'Return' || label === 'Absolute Return' ? (selectedAsset.pnl >= 0 ? 'text-emerald-700' : 'text-red-600') : 'text-slate-900'}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {selectedAsset.asset_class === 'EQUITY' && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-slate-800">Dividend history</h4>
                      <div className="group relative">
                        <button type="button" aria-label="About dividend calculations" aria-expanded={showDividendInfo} onClick={() => setShowDividendInfo((value) => !value)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-normal leading-relaxed text-white shadow-lg group-hover:block group-focus-within:block">Dividend per share × eligible shares on the record date is the gross dividend. Historical share quantities are not tracked, so enter the actual amount credited when recording a payout.</span>
                        {showDividendInfo && <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 text-[10px] leading-relaxed text-slate-600 shadow-xl sm:left-1/2 sm:-translate-x-1/2">
                          <div className="flex items-center justify-between gap-2"><p className="font-bold text-slate-800">How dividend values work</p><button type="button" onClick={() => setShowDividendInfo(false)} aria-label="Close dividend information" className="text-slate-400 hover:text-slate-700"><X className="h-3.5 w-3.5" /></button></div>
                          <p className="mt-1">The amount is prefilled as dividend per share × your current holding quantity. Edit it if the number of eligible shares on the record date was different.</p>
                          <p className="mt-1">Confirm the amount credited when paid. Tax deducted at source or other adjustments can make it differ from the gross dividend.</p>
                        </div>}
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={handleRefreshDividends} disabled={refreshingDividends} className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-2 text-[10px] font-semibold text-slate-700 disabled:opacity-60">
                    <RefreshCw className={`mr-1 inline h-3 w-3 ${refreshingDividends ? 'animate-spin' : ''}`} />
                    {refreshingDividends ? 'Loading…' : 'Refresh history'}
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <label className="text-[10px] font-semibold text-slate-600">Calendar year
                    <select value={dividendYear} onChange={(event) => setDividendYear(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[10px]">
                      <option value="ALL">All years</option>{dividendYears.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </label>
                  {dividendEvents.some((event) => !event.transaction_id) && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-bold text-amber-800">{dividendEvents.filter((event) => !event.transaction_id).length} to review</span>}
                </div>
                {recordedDividendEvents.length > 0 && <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                  <div><p className="text-[10px] font-semibold text-emerald-900">Dividend receipts recorded in Money</p><p className="text-[9px] text-emerald-800">For the announcements shown below</p></div>
                  <p className="text-sm font-extrabold text-emerald-800">{formatCurrency(receivedDividendTotal)}</p>
                </div>}
                {loadingDividends ? <p className="mt-3 text-xs text-slate-500">Loading dividend history…</p> : dividendEvents.length === 0 ? <p className="mt-3 text-xs text-slate-500">No dividend history found. Add a ticker and refresh history.</p> : visibleDividendEvents.length === 0 ? <p className="mt-3 text-xs text-slate-500">No dividend announcements found for {dividendYear}.</p> : (
                  <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                    {visibleDividendEvents.map((event) => (
                      <div key={event.id} className={`rounded-xl border p-3 ${event.transaction_id ? 'border-slate-200 bg-white' : 'border-amber-300 bg-amber-50'}`}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">{new Date(`${String(event.event_date).slice(0, 10)}T00:00:00`).toLocaleDateString()}</span>
                          <span className="font-bold text-emerald-700">{event.currency} {Number(event.amount_per_share).toFixed(4)} / share</span>
                        </div>
                        {event.transaction_id ? <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold text-emerald-700">{formatCurrency(event.received_amount)} received{event.payment_date ? ` on ${new Date(`${String(event.payment_date).slice(0, 10)}T00:00:00`).toLocaleDateString()}` : ''} · recorded in Money</p>
                          {onViewMoneyDate && event.payment_date && <button type="button" onClick={() => onViewMoneyDate(String(event.payment_date).slice(0, 10))} className="text-[10px] font-bold text-sky-700 hover:underline">View in Money ↗</button>}
                        </div> : (
                          <>
                          <p className="mt-2 text-[10px] font-bold text-amber-800">Announcement to review · record when paid</p>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <input aria-label="Estimated dividend amount credited; editable" type="number" min="0.01" step="0.01" placeholder="Amount credited" value={dividendAmounts[event.id] ?? (Number(event.amount_per_share || 0) * Number(selectedAsset.quantity || 0)).toFixed(2)} onChange={(e) => setDividendAmounts((current) => ({ ...current, [event.id]: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-xs" />
                            <input aria-label="Actual dividend payment date" type="date" value={dividendPaymentDates[event.id] || String(event.event_date).slice(0, 10)} onChange={(e) => setDividendPaymentDates((current) => ({ ...current, [event.id]: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-xs" />
                            <select aria-label="Account receiving dividend" value={dividendForm.accountId} onChange={(e) => setDividendForm((current) => ({ ...current, accountId: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-xs">
                              <option value="">Choose receiving account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                            </select>
                            <button type="button" onClick={() => handleRecordDividend(event)} disabled={recordingDividendId === event.id} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{recordingDividendId === event.id ? 'Saving…' : 'Record receipt'}</button>
                          </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            </div>

            <div className="mt-4 flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-white pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-slate-400">
                {assetPriceUpdatedAt ? `Last updated ${new Date(assetPriceUpdatedAt).toLocaleString()}` : 'Price update time unavailable'}
              </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button type="button" onClick={() => setSelectedAsset(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Close</button>
                  <button type="button" onClick={() => openEditAsset(selectedAsset)} className="px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5"><Edit2 className="h-3.5 w-3.5" />Edit Asset</button>
                  <button
                    onClick={handleRefreshAssetPrice}
                    disabled={refreshingAssetId === selectedAsset.id}
                    className="px-3 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingAssetId === selectedAsset.id ? 'animate-spin' : ''}`} />
                    {refreshingAssetId === selectedAsset.id ? 'Refreshing...' : 'Refresh Price'}
                  </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD ASSET MODAL */}
      {showAddAssetModal && (
        <div className="modal-overlay p-4 animate-in fade-in duration-150" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAddAssetModal(false); }}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">{editingAsset ? 'Edit Asset Holding' : 'Add New Asset Holding'}</h3>
              <button onClick={() => setShowAddAssetModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Asset Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Reliance Industries, Parag Parikh Flexi Cap, Gold Bar"
                  value={assetForm.name}
                  onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {['EQUITY', 'MUTUAL_FUND'].includes(assetForm.asset_class) && <div><label className="block font-semibold text-slate-700 mb-1">Ticker / lookup symbol</label><input type="text" placeholder={assetForm.asset_class === 'EQUITY' ? 'e.g. RELIANCE.NS' : 'Optional fund symbol'} value={assetForm.symbol} onChange={(event) => setAssetForm({ ...assetForm, symbol: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-emerald-500" /><p className="mt-1 text-[10px] text-slate-500">Used to identify this holding for quotes and future dividend history. Confirm the exchange suffix (such as .NS for NSE).</p></div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Asset Class</label>
                  <select
                    value={assetForm.asset_class}
                    onChange={(e) => {
                      const nextClass = e.target.value;
                      setAssetForm({ ...assetForm, asset_class: nextClass });
                      setAssetIncome((current) => ({ ...current, source_type: defaultIncomeSource(nextClass) }));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="EQUITY">Equity / Stocks</option>
                    <option value="MUTUAL_FUND">Mutual Funds</option>
                    <option value="COMMODITY_GOLD">Commodities / Gold</option>
                    <option value="REAL_ESTATE">Real Estate</option>
                    <option value="CASH_EQUIVALENT">Cash & Bank Savings</option>
                    <option value="FIXED_INCOME">Fixed Deposit / Bonds</option>
                    <option value="CRYPTO">Crypto</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sub Type</label>
                  <input
                    type="text"
                    placeholder="e.g. Physical Gold, Large Cap, SIP"
                    value={assetForm.sub_type}
                    onChange={(e) => setAssetForm({ ...assetForm, sub_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {['EQUITY', 'MUTUAL_FUND', 'COMMODITY_GOLD', 'CRYPTO'].includes(assetForm.asset_class) ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Buy Price per unit ({currencySymbol})</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 2400"
                        value={assetForm.buy_price}
                        onChange={(e) => setAssetForm({ ...assetForm, buy_price: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Current Price / NAV ({currencySymbol})</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 2650"
                        value={assetForm.current_price}
                        onChange={(e) => updateAssetUnitField('current_price', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Quantity / Units</label>
                      <input
                        type="number"
                        step="any"
                        value={assetForm.quantity}
                        onChange={(e) => updateAssetUnitField('quantity', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Total Current Value ({currencySymbol})</label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="Total value"
                        value={assetForm.current_value}
                        onChange={(e) => setAssetForm({ ...assetForm, current_value: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </>
              ) : assetForm.asset_class === 'CASH_EQUIVALENT' ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Balance / Value ({currencySymbol})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 50000"
                    value={assetForm.current_value}
                    onChange={(e) => setAssetForm({ ...assetForm, current_value: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Total Invested Amount ({currencySymbol})</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 500000"
                      value={assetForm.invested_amount}
                      onChange={(e) => setAssetForm({ ...assetForm, invested_amount: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Total Current Value ({currencySymbol})</label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="e.g. 650000"
                      value={assetForm.current_value}
                      onChange={(e) => setAssetForm({ ...assetForm, current_value: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <label className="flex items-start gap-2 font-semibold text-slate-800">
                  <input type="checkbox" checked={assetIncome.enabled} onChange={(event) => setAssetIncome({ ...assetIncome, enabled: event.target.checked })} className="mt-0.5 accent-emerald-700" />
                  <span>Track recurring income from this asset <span className="block mt-1 text-[11px] font-normal text-slate-600">Examples: rent from property, dividends, or interest. Expected income is added to Money → Schedule and won’t affect balances until received.</span></span>
                </label>
                {assetIncome.enabled && <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="font-semibold text-slate-700">Income type
                    <select value={assetIncome.source_type} onChange={(event) => setAssetIncome({ ...assetIncome, source_type: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                      <option value="RENTAL_INCOME">Rental income</option><option value="DIVIDEND">Dividend</option><option value="INTEREST">Interest</option><option value="OTHER">Other income</option>
                    </select>
                  </label>
                  <label className="font-semibold text-slate-700">Expected amount on each scheduled date ({currencySymbol})
                    <input required type="number" min="0.01" step="0.01" value={assetIncome.amount} onChange={(event) => setAssetIncome({ ...assetIncome, amount: event.target.value })} placeholder="e.g. 25000" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
                    {Number(assetIncome.amount) > 0 && <span className="mt-1 block text-[10px] font-normal text-slate-500">Average: {formatCurrency(monthlyEquivalent(assetIncome))} per month. The Money schedule shows the full {formatCurrency(assetIncome.amount)} on each due date.</span>}
                  </label>
                  <label className="font-semibold text-slate-700">Deposit account
                    <select required value={assetIncome.account_id} onChange={(event) => setAssetIncome({ ...assetIncome, account_id: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                      <option value="">Choose account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                    </select>
                  </label>
                  <label className="font-semibold text-slate-700">Repeat every
                    <div className="mt-1 flex gap-2"><input required type="number" min="1" max="12" value={assetIncome.interval_count} onChange={(event) => setAssetIncome({ ...assetIncome, interval_count: event.target.value })} className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-2" /><select value={assetIncome.frequency} onChange={(event) => setAssetIncome({ ...assetIncome, frequency: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="MONTHLY">month(s)</option><option value="QUARTERLY">quarter(s)</option><option value="YEARLY">year(s)</option></select></div>
                  </label>
                  <label className="font-semibold text-slate-700">Starts on
                    <input required type="date" value={assetIncome.start_date} onChange={(event) => setAssetIncome({ ...assetIncome, start_date: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
                  </label>
                  <label className="font-semibold text-slate-700">Ends on (optional)
                    <input type="date" min={assetIncome.start_date} value={assetIncome.end_date} onChange={(event) => setAssetIncome({ ...assetIncome, end_date: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
                  </label>
                  {!accounts.length && <p className="text-[11px] text-amber-800 sm:col-span-2">Add an account in Money before linking expected income.</p>}
                </div>}
              </section>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddAssetModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  {editingAsset ? 'Save Changes' : 'Save Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD LIABILITY MODAL */}
      {showAddLiabModal && (
        <div className="modal-overlay p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAddLiabModal(false); }}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Add New Loan / Liability</h3>
              <button onClick={() => setShowAddLiabModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLiability} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Loan / Debt Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Home Loan, Car Loan"
                  value={liabForm.name}
                  onChange={(e) => setLiabForm({ ...liabForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Loan Type</label>
                  <select
                    value={liabForm.liability_type}
                    onChange={(e) => setLiabForm({ ...liabForm, liability_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="HOME_LOAN">Home Loan</option>
                    <option value="CAR_LOAN">Car Loan</option>
                    <option value="PERSONAL_LOAN">Personal Loan</option>
                    <option value="EDUCATION_LOAN">Education Loan</option>
                    <option value="CREDIT_CARD">Credit Card Debt</option>
                    <option value="GOLD_LOAN">Gold Loan</option>
                    <option value="OTHER">Other Debt</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lender / Bank</label>
                  <input
                    type="text"
                    placeholder="e.g. SBI, HDFC, ICICI"
                    value={liabForm.lender}
                    onChange={(e) => setLiabForm({ ...liabForm, lender: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Principal Amount ({currencySymbol})</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 2500000"
                    value={liabForm.principal_amount}
                    onChange={(e) => setLiabForm({ ...liabForm, principal_amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Outstanding ({currencySymbol})</label>
                  <input
                    type="number"
                    placeholder="e.g. 2200000"
                    value={liabForm.current_outstanding}
                    onChange={(e) => setLiabForm({ ...liabForm, current_outstanding: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Interest Rate (% p.a.)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={liabForm.interest_rate_pct}
                    onChange={(e) => setLiabForm({ ...liabForm, interest_rate_pct: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tenure (Months)</label>
                  <input
                    type="number"
                    required
                    value={liabForm.tenure_months}
                    onChange={(e) => setLiabForm({ ...liabForm, tenure_months: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                <label className="flex items-start gap-2 text-xs font-semibold text-slate-800">
                  <input type="checkbox" checked={liabilitySchedule.enabled} onChange={(event) => setLiabilitySchedule({ ...liabilitySchedule, enabled: event.target.checked })} className="mt-0.5 accent-emerald-700" />
                  Add the monthly EMI to Money → Schedule
                </label>
                {liabilitySchedule.enabled && <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-slate-700">Payment account
                    <select required value={liabilitySchedule.account_id} onChange={(event) => setLiabilitySchedule({ ...liabilitySchedule, account_id: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
                      <option value="">Choose account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-700">First EMI due date
                    <input required type="date" value={liabilitySchedule.first_due_date} onChange={(event) => setLiabilitySchedule({ ...liabilitySchedule, first_due_date: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" />
                  </label>
                  {!accounts.length && <p className="text-[11px] text-amber-800 sm:col-span-2">Add an account in Money before linking an EMI schedule.</p>}
                </div>}
                <p className="text-[10px] text-slate-500">The schedule uses the calculated EMI and loan tenure. Recording a payment creates one expense transaction; the debt balance remains based on your lender statement.</p>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLiabModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Save Loan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AMORTIZATION SCHEDULE MODAL */}
      {showAmortizationModal && selectedLiabAmortization && (
        <div className="modal-overlay p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAmortizationModal(false); }}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Loan Amortization Schedule</h3>
                <p className="text-xs text-slate-500">{selectedLiabAmortization.liability?.name} • Monthly EMI: {formatCurrency(selectedLiabAmortization.monthly_emi)}</p>
              </div>
              <button onClick={() => setShowAmortizationModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 py-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 text-[10px]">Total Payment</span>
                <p className="font-bold text-slate-900">{formatCurrency(selectedLiabAmortization.total_payment)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 text-[10px]">Total Interest</span>
                <p className="font-bold text-red-600">{formatCurrency(selectedLiabAmortization.total_interest)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 text-[10px]">Interest / Total</span>
                <p className="font-bold text-slate-900">{selectedLiabAmortization.interest_percentage}%</p>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-100 rounded-xl mt-2">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 sticky top-0 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2 px-3">Month</th>
                    <th className="py-2 px-3 text-right">EMI</th>
                    <th className="py-2 px-3 text-right">Principal</th>
                    <th className="py-2 px-3 text-right">Interest</th>
                    <th className="py-2 px-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedLiabAmortization.amortization_schedule || []).map((row) => (
                    <tr key={row.month} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-700">M{row.month}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(row.emi)}</td>
                      <td className="py-2 px-3 text-right text-emerald-800">{formatCurrency(row.principal_paid)}</td>
                      <td className="py-2 px-3 text-right text-red-600">{formatCurrency(row.interest_paid)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">{formatCurrency(row.remaining_balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {deleteCandidate && deleteDialog && (
        <ConfirmDialog
          title={deleteDialog.title}
          description={deleteDialog.description}
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

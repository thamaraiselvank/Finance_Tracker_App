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
  FileText
} from 'lucide-react';
import api from '../services/api';

const ASSET_CLASSES = [
  { id: 'ALL', label: 'All Classes' },
  { id: 'EQUITY', label: 'Equity' },
  { id: 'MUTUAL_FUND', label: 'Mutual Funds' },
  { id: 'COMMODITY_GOLD', label: 'Commodities' },
  { id: 'REAL_ESTATE', label: 'Real Estate' },
  { id: 'CASH_EQUIVALENT', label: 'Cash & FDs' },
  { id: 'CRYPTO', label: 'Crypto' },
];

export default function Wealth({ hideAmounts }) {
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
  const [refreshingAssetId, setRefreshingAssetId] = useState(null);
  const [assetPriceUpdatedAt, setAssetPriceUpdatedAt] = useState(null);

  // Asset Form State
  const [assetForm, setAssetForm] = useState({
    name: '',
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
      const [wRes, lRes] = await Promise.all([
        api.get('/assets/summary'),
        api.get('/liabilities')
      ]);
      setWealthSummary(wRes.data);
      setLiabilities(lRes.data);
    } catch (err) {
      console.error('Failed to fetch wealth data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (val) => {
    if (hideAmounts) return '••••••';
    if (val === undefined || val === null) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const toggleClassExpand = (cls) => {
    setExpandedClasses((prev) => ({ ...prev, [cls]: !prev[cls] }));
  };

  const handleCreateAsset = async (e) => {
    e.preventDefault();
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

      await api.post('/assets', {
        ...assetForm,
        invested_amount: finalInvested,
        current_value: finalCurrentValue,
        quantity: finalQuantity,
        buy_price: finalBuyPrice,
        current_price: finalCurrentPrice,
      });
      setShowAddAssetModal(false);
      setAssetForm({
        name: '',
        asset_class: 'EQUITY',
        sub_type: '',
        invested_amount: '',
        current_value: '',
        quantity: '1',
        buy_price: '',
        current_price: '',
        notes: '',
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save asset');
    }
  };

  const handleDeleteAsset = async (id) => {
    if (window.confirm('Delete this asset holding?')) {
      try {
        await api.delete(`/assets/${id}`);
        fetchData();
      } catch (err) {
        alert('Failed to delete asset');
      }
    }
  };

  const handleDeleteAllAssets = async () => {
    if (window.confirm('Delete all asset holdings? This cannot be undone.')) {
      try {
        await api.delete('/assets/all');
        fetchData();
      } catch (err) {
        alert('Failed to delete all assets');
      }
    }
  };

  const handleOpenAsset = (asset) => {
    setSelectedAsset(asset);
    setAssetPriceUpdatedAt(asset.price_updated_at || asset.updated_at || null);
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
      alert(err.response?.data?.detail || 'Failed to refresh live price');
    } finally {
      setRefreshingAssetId(null);
    }
  };

  const handleCreateLiability = async (e) => {
    e.preventDefault();
    try {
      await api.post('/liabilities', {
        ...liabForm,
        principal_amount: parseFloat(liabForm.principal_amount) || 0,
        current_outstanding: parseFloat(liabForm.current_outstanding) || parseFloat(liabForm.principal_amount) || 0,
        interest_rate_pct: parseFloat(liabForm.interest_rate_pct) || 0,
        tenure_months: parseInt(liabForm.tenure_months) || 12,
        emi_amount: parseFloat(liabForm.emi_amount) || 0,
      });
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
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save liability');
    }
  };

  const handleDeleteLiability = async (id) => {
    if (window.confirm('Delete this loan/liability?')) {
      try {
        await api.delete(`/liabilities/${id}`);
        fetchData();
      } catch (err) {
        alert('Failed to delete liability');
      }
    }
  };

  const handleViewAmortization = async (id) => {
    try {
      const res = await api.get(`/liabilities/${id}/amortization`);
      setSelectedLiabAmortization(res.data);
      setShowAmortizationModal(true);
    } catch (err) {
      alert('Failed to load amortization schedule');
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
            <div className="flex items-center gap-2">
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
                onClick={() => setShowAddAssetModal(true)}
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
                    ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300'
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                              <th className="py-2.5 px-4 text-right">Current Value</th>
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
                                <td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(item.current_value)}</td>
                                <td className={`py-3 px-4 text-right font-semibold ${item.pnl >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                  {item.pnl >= 0 ? '+' : ''}{formatCurrency(item.pnl)} ({item.pnl_percentage}%)
                                </td>
                                <td className="py-3 px-6 text-right">
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
              <p className="text-2xl font-black text-emerald-800">{formatCurrency(wealthSummary?.net_worth || 0)}</p>
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
        <div className="modal-overlay p-4 animate-in fade-in duration-150" onClick={() => setSelectedAsset(null)}>
          <div
            className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-emerald-700 uppercase">Holding Details</p>
                <h3 className="font-bold text-slate-900 text-lg mt-1">{selectedAsset.name}</h3>
                <p className="text-xs text-slate-500">{selectedAsset.sub_type || selectedAsset.asset_class.replace('_', ' ')}</p>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="text-slate-400 hover:text-slate-600" title="Close details">
                <X className="w-4 h-4" />
              </button>
            </div>

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

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
              <p className="text-[11px] text-slate-400">
                {assetPriceUpdatedAt ? `Last updated ${new Date(assetPriceUpdatedAt).toLocaleString()}` : 'Price update time unavailable'}
              </p>
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
      )}

      {/* ADD ASSET MODAL */}
      {showAddAssetModal && (
        <div className="modal-overlay p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Add New Asset Holding</h3>
              <button onClick={() => setShowAddAssetModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="space-y-3 text-xs">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Asset Class</label>
                  <select
                    value={assetForm.asset_class}
                    onChange={(e) => setAssetForm({ ...assetForm, asset_class: e.target.value })}
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
                      <label className="block font-semibold text-slate-700 mb-1">Buy Price per unit (₹)</label>
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
                      <label className="block font-semibold text-slate-700 mb-1">Current Price / NAV (₹)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 2650"
                        value={assetForm.current_price}
                        onChange={(e) => setAssetForm({ ...assetForm, current_price: e.target.value })}
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
                        onChange={(e) => setAssetForm({ ...assetForm, quantity: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Total Current Value (₹)</label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder={
                          assetForm.current_price && assetForm.quantity
                            ? String(parseFloat(assetForm.current_price) * parseFloat(assetForm.quantity))
                            : "Total value"
                        }
                        value={assetForm.current_value}
                        onChange={(e) => setAssetForm({ ...assetForm, current_value: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </>
              ) : assetForm.asset_class === 'CASH_EQUIVALENT' ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Balance / Value (₹)</label>
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
                    <label className="block font-semibold text-slate-700 mb-1">Total Invested Amount (₹)</label>
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
                    <label className="block font-semibold text-slate-700 mb-1">Total Current Value (₹)</label>
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
                  Save Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD LIABILITY MODAL */}
      {showAddLiabModal && (
        <div className="modal-overlay p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
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
                  <label className="block font-semibold text-slate-700 mb-1">Principal Amount (₹)</label>
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
                  <label className="block font-semibold text-slate-700 mb-1">Current Outstanding (₹)</label>
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
        <div className="modal-overlay p-4">
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
    </div>
  );
}

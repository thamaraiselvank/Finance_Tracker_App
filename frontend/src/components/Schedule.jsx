import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, CircleAlert, Clock3, Download,
  Edit3, Pause, Play, Plus, Repeat2, Trash2, X,
} from 'lucide-react';
import api from '../services/api';
import useCurrency from '../utils/useCurrency';
import ConfirmDialog from './ConfirmDialog';

const pad = (value) => String(value).padStart(2, '0');
const toLocalDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const monthRange = (date) => ({
  start: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`,
  end: toLocalDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
});
const recurrenceLabel = (item) => {
  const units = { WEEKLY: 'week', MONTHLY: 'month', QUARTERLY: 'quarter', YEARLY: 'year' };
  const unit = units[item.frequency] || 'month';
  const interval = Math.max(1, Number(item.interval_count || 1));
  return `every ${interval > 1 ? `${interval} ` : ''}${unit}${interval > 1 ? 's' : ''}`;
};
const blankForm = (accountId = '') => ({
  description: '', flow_type: 'EXPENSE', source_type: 'BILL', amount: '',
  amount_is_estimate: false, frequency: 'MONTHLY', interval_count: 1,
  start_date: toLocalDate(new Date()), end_date: '', account_id: accountId,
  category_id: '', asset_id: '',
});

const SOURCE_OPTIONS = {
  INCOME: [
    ['SALARY', 'Salary'], ['RENTAL_INCOME', 'Rental income'], ['DIVIDEND', 'Dividend'],
    ['INTEREST', 'Interest'], ['OTHER', 'Other income'],
  ],
  EXPENSE: [
    ['BILL', 'Bill'], ['SUBSCRIPTION', 'Subscription'], ['EMI', 'Loan EMI'],
    ['INSURANCE_PREMIUM', 'Insurance premium'], ['OTHER', 'Other expense'],
  ],
};

function getApiError(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => item?.msg).filter(Boolean);
    if (messages.length) return messages.join(' ');
  }
  return fallback;
}

function ScheduleForm({ initial, accounts, categories, assets, onSave, onClose, saving }) {
  const [form, setForm] = useState(initial);
  const matchingCategories = categories.filter((category) => category.type === form.flow_type);

  const submit = (event) => {
    event.preventDefault();
    onSave({
      description: form.description.trim(),
      flow_type: form.flow_type,
      source_type: form.source_type,
      amount: Number(form.amount),
      amount_is_estimate: Boolean(form.amount_is_estimate),
      frequency: form.frequency,
      interval_count: Number(form.interval_count),
      start_date: form.start_date,
      category_id: form.category_id || null,
      asset_id: form.asset_id || null,
      account_id: form.account_id,
      end_date: form.end_date || null,
    });
  };

  const changeFlowType = (flow_type) => {
    const validSources = SOURCE_OPTIONS[flow_type].map(([value]) => value);
    setForm((current) => ({
      ...current,
      flow_type,
      source_type: validSources.includes(current.source_type) ? current.source_type : SOURCE_OPTIONS[flow_type][0][0],
      category_id: '',
      asset_id: flow_type === 'INCOME' ? current.asset_id : '',
    }));
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{initial.id ? 'Edit scheduled cash flow' : 'Add scheduled cash flow'}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">This creates expected calendar entries. It won’t change account balances until you record it as paid or received.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cash flow
            <select required value={form.flow_type} onChange={(event) => changeFlowType(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
              <option value="EXPENSE">Expense</option><option value="INCOME">Income</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Type
            <select required value={form.source_type} onChange={(event) => setForm({ ...form, source_type: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
              {SOURCE_OPTIONS[form.flow_type].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Name
          <input required maxLength={255} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder={form.flow_type === 'EXPENSE' ? 'e.g. Electricity bill or video subscription' : 'e.g. Salary, rental income, dividend'} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Expected amount
            <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            <span className="mt-1 block text-[11px] font-normal text-slate-500 dark:text-slate-400">Enter the amount for each scheduled date. Wealth converts recurring income to a monthly average; this schedule shows the full payment on its due date.</span>
          </label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Account
            <select required value={form.account_id} onChange={(event) => setForm({ ...form, account_id: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
              <option value="">Choose account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={form.amount_is_estimate} onChange={(event) => setForm({ ...form, amount_is_estimate: event.target.checked })} className="accent-emerald-700" />
          Amount varies; treat this value as an estimate
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Category
            <select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
              <option value="">No category</option>{matchingCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          {form.flow_type === 'INCOME' && (
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Related asset (optional)
              <select value={form.asset_id} onChange={(event) => setForm({ ...form, asset_id: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="">No linked asset</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Repeat every
            <div className="mt-1 flex gap-2">
              <input type="number" min="1" max="12" required value={form.interval_count} onChange={(event) => setForm({ ...form, interval_count: event.target.value })} className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              <select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="WEEKLY">week(s)</option><option value="MONTHLY">month(s)</option><option value="QUARTERLY">quarter(s)</option><option value="YEARLY">year(s)</option>
              </select>
            </div>
          </label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Starts on
            <input required type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </label>
        </div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Ends on (optional)
          <input type="date" min={form.start_date} value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:w-1/2" />
        </label>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancel</button>
          <button type="submit" disabled={saving || !accounts.length} className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-900 disabled:opacity-50">{saving ? 'Saving…' : initial.id ? 'Save changes' : 'Create schedule'}</button>
        </div>
      </form>
    </div>
  );
}

export default function Schedule({ setActiveSubTab }) {
  const { formatCurrency } = useCurrency();
  const [view, setView] = useState('calendar');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [schedules, setSchedules] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [matchTransactions, setMatchTransactions] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const range = useMemo(() => monthRange(month), [month]);
  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [schedulesResponse, occurrencesResponse] = await Promise.all([
        api.get('/schedules'),
        api.get('/schedules/occurrences', { params: range }),
      ]);
      setSchedules(Array.isArray(schedulesResponse.data) ? schedulesResponse.data : []);
      setOccurrences(Array.isArray(occurrencesResponse.data) ? occurrencesResponse.data : []);
    } catch (requestError) {
      setError(getApiError(requestError, 'Could not load scheduled cash flows.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      api.get('/accounts'), api.get('/categories'), api.get('/assets'),
    ]).then(([accountResponse, categoryResponse, assetResponse]) => {
      setAccounts((accountResponse.data || []).filter((account) => account.is_active !== false));
      setCategories(Array.isArray(categoryResponse.data) ? categoryResponse.data : []);
      setAssets(Array.isArray(assetResponse.data) ? assetResponse.data : []);
    }).catch(() => setError('Could not load accounts and categories. Try again or check Money > Accounts.'));
  }, []);

  useEffect(() => { refresh(); }, [range.start, range.end]);

  const monthEvents = useMemo(() => {
    const map = new Map();
    occurrences.forEach((occurrence) => {
      const list = map.get(occurrence.occurrence_date) || [];
      list.push(occurrence);
      map.set(occurrence.occurrence_date, list);
    });
    return map;
  }, [occurrences]);
  const days = useMemo(() => {
    const firstWeekday = new Date(`${range.start}T00:00:00`).getDay();
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array(firstWeekday).fill(null),
      ...Array.from({ length: count }, (_, index) => index + 1),
    ];
  }, [range.start, month]);
  const expectedTotals = occurrences.reduce((totals, occurrence) => {
    if (occurrence.status === 'paid' || occurrence.status === 'received') return totals;
    if (occurrence.flow_type === 'INCOME') totals.income += Number(occurrence.amount || 0);
    else totals.expense += Number(occurrence.amount || 0);
    return totals;
  }, { income: 0, expense: 0 });

  const openCreate = () => setModal({ ...blankForm(accounts[0]?.id || '') });
  const openEdit = (schedule) => setModal({ ...schedule, amount: String(schedule.amount), interval_count: String(schedule.interval_count), start_date: String(schedule.start_date).slice(0, 10), end_date: schedule.end_date ? String(schedule.end_date).slice(0, 10) : '', category_id: schedule.category_id || '', asset_id: schedule.asset_id || '', account_id: schedule.account_id || '' });

  const saveSchedule = async (values) => {
    setSaving(true);
    setError('');
    try {
      if (modal.id) await api.put(`/schedules/${modal.id}`, values);
      else await api.post('/schedules', values);
      setModal(null);
      await refresh();
    } catch (requestError) {
      setError(getApiError(requestError, 'Could not save this schedule.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleSchedule = async (schedule) => {
    try {
      await api.put(`/schedules/${schedule.id}`, { is_active: !schedule.is_active });
      await refresh();
    } catch (requestError) {
      setError(getApiError(requestError, 'Could not update this schedule.'));
    }
  };

  const startCompletion = async (occurrence) => {
    setCompletion({ occurrence, actual_amount: String(occurrence.amount), actual_date: toLocalDate(new Date()), transaction_id: '' });
    try {
      const lowerBound = toLocalDate(new Date(new Date(`${occurrence.occurrence_date}T00:00:00`).getTime() - 7 * 86400000));
      const upperBound = toLocalDate(new Date(new Date(`${occurrence.occurrence_date}T00:00:00`).getTime() + 7 * 86400000));
      const response = await api.get('/transactions', { params: { type: occurrence.flow_type, start_date: lowerBound, end_date: upperBound, limit: 200 } });
      setMatchTransactions((Array.isArray(response.data) ? response.data : []).filter((transaction) => !transaction.scheduled_cashflow_id));
    } catch {
      setMatchTransactions([]);
    }
  };

  const completeOccurrence = async (event) => {
    event.preventDefault();
    if (!completion) return;
    setSaving(true);
    setError('');
    try {
      const payload = completion.transaction_id
        ? { transaction_id: completion.transaction_id }
        : { actual_amount: Number(completion.actual_amount), actual_date: completion.actual_date };
      await api.post(`/schedules/${completion.occurrence.schedule_id}/occurrences/${completion.occurrence.occurrence_date}/complete`, payload);
      setCompletion(null);
      await refresh();
    } catch (requestError) {
      setError(getApiError(requestError, 'Could not record this cash flow.'));
    } finally {
      setSaving(false);
    }
  };

  const exportSchedule = () => {
    const selectedMonth = range.start.slice(0, 7);
    const monthOccurrences = occurrences.filter((item) => String(item.occurrence_date).slice(0, 7) === selectedMonth);
    const rows = [
      ['Date', 'Description', 'Flow', 'Expected Amount', 'Status', 'Category', 'Account', 'Related Asset'],
      ...monthOccurrences.map((item) => [item.occurrence_date, item.description, item.flow_type, item.amount, item.status, item.category_name || '', item.account_name || '', item.asset_name || '']),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finverse_cashflow_${range.start.slice(0, 7)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const deleteSchedule = async () => {
    if (!deleteTarget) return;
    await api.delete(`/schedules/${deleteTarget.id}`);
    setDeleteTarget(null);
    await refresh();
  };

  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const weekStarts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-emerald-700 dark:text-emerald-400" /><h2 className="text-lg font-bold text-slate-900 dark:text-white">Cash flow schedule</h2></div>
          <p className="mt-1 max-w-2xl text-xs text-slate-500 dark:text-slate-400">Plan recurring bills, subscriptions, EMIs, salary, rent, dividends, and interest. Scheduled amounts stay forecasts until recorded.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportSchedule} disabled={!occurrences.length} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Download className="h-3.5 w-3.5" />Export month</button>
          <button type="button" onClick={openCreate} disabled={!accounts.length} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-900 disabled:opacity-50"><Plus className="h-4 w-4" />Add schedule</button>
        </div>
      </header>

      {!accounts.length && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><span>Add an account before creating a schedule; confirmed cash flows update that account balance.</span><button type="button" onClick={() => setActiveSubTab('accounts')} className="font-bold underline">Open Accounts</button></div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><CircleAlert className="h-4 w-4 shrink-0" />{error}<button className="ml-auto" onClick={() => setError('')} aria-label="Dismiss error"><X className="h-4 w-4" /></button></div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Expected income" value={expectedTotals.income} tone="emerald" formatCurrency={formatCurrency} />
        <SummaryCard label="Expected expenses" value={expectedTotals.expense} tone="rose" formatCurrency={formatCurrency} />
        <SummaryCard label="Expected net" value={expectedTotals.income - expectedTotals.expense} tone={expectedTotals.income >= expectedTotals.expense ? 'sky' : 'amber'} formatCurrency={formatCurrency} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><ArrowLeft className="h-4 w-4" /></button>
          <h3 className="min-w-36 text-center text-sm font-bold text-slate-900 dark:text-white">{monthLabel}</h3>
          <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><ArrowRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40">This month</button>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-1 text-[11px] font-semibold dark:bg-slate-800">
          <button type="button" onClick={() => setView('calendar')} className={`rounded-md px-3 py-1.5 ${view === 'calendar' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Calendar</button>
          <button type="button" onClick={() => setView('schedules')} className={`rounded-md px-3 py-1.5 ${view === 'schedules' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Recurring items</button>
        </div>
      </div>

      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">Loading schedule…</div> : view === 'calendar' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">{weekStarts.map((day) => <div key={day} className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:px-3 sm:text-xs">{day}</div>)}</div>
          <div className="grid grid-cols-7">
            {days.map((day, index) => {
              const dayKey = day ? `${range.start.slice(0, 8)}${pad(day)}` : `empty-${index}`;
              const dayEvents = day ? (monthEvents.get(dayKey) || []) : [];
              return <div key={dayKey} className={`min-h-24 border-b border-r border-slate-100 p-1 last:border-r-0 sm:min-h-28 sm:p-2 dark:border-slate-800 ${day ? '' : 'bg-slate-50/70 dark:bg-slate-950/40'}`}>
                {day && <>
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${dayKey === toLocalDate(new Date()) ? 'bg-emerald-800 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{day}</span>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 2).map((item, eventIndex) => <div key={`${item.schedule_id}-${eventIndex}`} title={`${item.description} · ${formatCurrency(item.amount)}`} className={`truncate rounded px-1 py-1 text-[9px] font-semibold leading-tight sm:text-[10px] ${statusClass(item.status, item.flow_type)}`}>
                      <span className="hidden sm:inline">{item.flow_type === 'INCOME' ? '+' : '−'} </span>{item.description}
                    </div>)}
                    {dayEvents.length > 2 && <p className="text-[9px] text-slate-500">+{dayEvents.length - 2} more</p>}
                  </div>
                </>}
              </div>;
            })}
          </div>
          <div className="space-y-2 p-3 sm:p-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Scheduled items this month</h4>
            {!occurrences.length && <EmptySchedule onCreate={openCreate} />}
            {occurrences.map((item) => <OccurrenceRow key={`${item.schedule_id}-${item.occurrence_date}`} item={item} formatCurrency={formatCurrency} onComplete={() => startCompletion(item)} />)}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {!schedules.length && <EmptySchedule onCreate={openCreate} />}
          {schedules.map((schedule) => <ScheduleRow key={schedule.id} schedule={schedule} formatCurrency={formatCurrency} onEdit={() => openEdit(schedule)} onToggle={() => toggleSchedule(schedule)} onDelete={() => setDeleteTarget(schedule)} />)}
        </div>
      )}

      {modal && <ScheduleForm initial={modal} accounts={accounts} categories={categories} assets={assets} onSave={saveSchedule} onClose={() => setModal(null)} saving={saving} />}
      {completion && <CompletionDialog completion={completion} setCompletion={setCompletion} transactions={matchTransactions} formatCurrency={formatCurrency} saving={saving} onSubmit={completeOccurrence} onClose={() => setCompletion(null)} />}
      {deleteTarget && <ConfirmDialog title="Delete recurring schedule?" description={`This removes future expected entries for ${deleteTarget.description}. Transactions already recorded remain in your history.`} onConfirm={deleteSchedule} onCancel={() => setDeleteTarget(null)} />}
    </section>
  );
}

function SummaryCard({ label, value, tone, formatCurrency }) {
  const tones = { emerald: 'text-emerald-700 dark:text-emerald-300', rose: 'text-rose-700 dark:text-rose-300', sky: 'text-sky-700 dark:text-sky-300', amber: 'text-amber-700 dark:text-amber-300' };
  return <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className={`mt-1 text-xl font-bold ${tones[tone]}`}>{formatCurrency(value)}</p></div>;
}

function statusClass(status, flowType) {
  if (status === 'paid' || status === 'received') return 'bg-slate-100 text-slate-500 line-through dark:bg-slate-800 dark:text-slate-400';
  if (status === 'overdue') return 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300';
  return flowType === 'INCOME' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300';
}

function OccurrenceRow({ item, formatCurrency, onComplete }) {
  const completed = item.status === 'paid' || item.status === 'received';
  const canComplete = item.occurrence_date <= toLocalDate(new Date());
  const label = item.flow_type === 'INCOME' ? 'Received' : 'Paid';
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2.5 dark:border-slate-800">
    <div className="flex min-w-0 items-center gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.flow_type === 'INCOME' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'}`}><Clock3 className="h-4 w-4" /></div>
      <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{item.description}</p><p className="mt-0.5 text-[10px] text-slate-500">{new Date(`${item.occurrence_date}T00:00:00`).toLocaleDateString()} · {recurrenceLabel(item)} · {item.category_name || item.source_type.replaceAll('_', ' ').toLowerCase()} · {item.account_name || 'Account'}{item.linked_record_name ? ` · Linked to ${item.linked_record_name}` : ''}</p></div>
    </div>
    <div className="flex items-center gap-3"><div className="text-right"><p className={`text-xs font-bold ${item.flow_type === 'INCOME' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>{item.flow_type === 'INCOME' ? '+' : '−'}{formatCurrency(item.actual_amount ?? item.amount)}{item.amount_is_estimate && !completed && <span className="ml-1 text-[9px] font-normal text-amber-700">est.</span>}</p><p className={`text-[10px] capitalize ${item.status === 'overdue' ? 'text-rose-700' : 'text-slate-500'}`}>{item.status}</p></div>
      {!completed && canComplete && <button type="button" onClick={onComplete} className="inline-flex items-center gap-1 rounded-lg bg-emerald-800 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-900"><Check className="h-3 w-3" />{label}</button>}
    </div>
  </div>;
}

function ScheduleRow({ schedule, formatCurrency, onEdit, onToggle, onDelete }) {
  const frequencyText = schedule.frequency === 'WEEKLY'
    ? `Every ${schedule.interval_count > 1 ? `${schedule.interval_count} ` : ''}week${schedule.interval_count > 1 ? 's' : ''}`
    : `Every ${schedule.interval_count > 1 ? `${schedule.interval_count} ` : ''}${schedule.frequency.toLowerCase().replace('ly', '')}${schedule.interval_count > 1 ? 's' : ''}`;
  return <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 dark:bg-slate-900 ${schedule.is_active ? 'border-slate-200 dark:border-slate-800' : 'border-slate-100 opacity-70 dark:border-slate-800'}`}>
    <div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"><Repeat2 className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{schedule.description}</p><p className="mt-1 text-[11px] text-slate-500">{frequencyText} · starts {new Date(`${String(schedule.start_date).slice(0, 10)}T00:00:00`).toLocaleDateString()}{schedule.end_date ? ` · ends ${new Date(`${String(schedule.end_date).slice(0, 10)}T00:00:00`).toLocaleDateString()}` : ' · no end date'}{schedule.asset_name ? ` · ${schedule.asset_name}` : ''}{schedule.linked_record_name ? ` · linked to ${schedule.linked_record_name}` : ''}</p></div></div>
    <div className="flex items-center gap-2"><p className={`mr-2 text-xs font-bold ${schedule.flow_type === 'INCOME' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>{schedule.flow_type === 'INCOME' ? '+' : '−'}{formatCurrency(schedule.amount)}{schedule.amount_is_estimate && <span className="ml-1 text-[9px] font-normal text-amber-700">est.</span>}</p><button type="button" title="Edit schedule" onClick={onEdit} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Edit3 className="h-4 w-4" /></button><button type="button" title={schedule.is_active ? 'Pause schedule' : 'Resume schedule'} onClick={onToggle} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{schedule.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button><button type="button" title="Delete schedule" onClick={onDelete} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"><Trash2 className="h-4 w-4" /></button></div>
  </div>;
}

function EmptySchedule({ onCreate }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700"><CalendarDays className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">No scheduled cash flows yet</p><p className="mt-1 text-xs text-slate-500">Add a recurring bill or expected income to see it here.</p><button type="button" onClick={onCreate} className="mt-3 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white">Add schedule</button></div>;
}

function CompletionDialog({ completion, setCompletion, transactions, formatCurrency, saving, onSubmit, onClose }) {
  const item = completion.occurrence;
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between"><div><h2 className="text-base font-bold text-slate-900 dark:text-white">Record {item.flow_type === 'INCOME' ? 'received income' : 'paid bill'}</h2><p className="mt-1 text-xs text-slate-500">{item.description} · due {item.occurrence_date}</p></div><button type="button" onClick={onClose} aria-label="Close" className="text-slate-500"><X className="h-5 w-5" /></button></div>
      {transactions.length > 0 && <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Link an existing transaction
        <select value={completion.transaction_id} onChange={(event) => setCompletion({ ...completion, transaction_id: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Create a new transaction</option>{transactions.map((transaction) => <option key={transaction.id} value={transaction.id}>{transaction.date} · {transaction.description} · {formatCurrency(transaction.amount)}</option>)}</select>
      </label>}
      {!completion.transaction_id && <>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Actual amount
          <input required type="number" min="0.01" step="0.01" value={completion.actual_amount} onChange={(event) => setCompletion({ ...completion, actual_amount: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        </label>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Date received or paid
          <input required type="date" max={toLocalDate(new Date())} value={completion.actual_date} onChange={(event) => setCompletion({ ...completion, actual_date: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        </label>
        <p className="text-[11px] text-slate-500">This creates a transaction and updates the selected account balance.</p>
      </>}
      {completion.transaction_id && <p className="text-[11px] text-slate-500">This links an existing transaction without changing its amount or account balance.</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:text-slate-200">Cancel</button><button disabled={saving} className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : completion.transaction_id ? 'Link transaction' : item.flow_type === 'INCOME' ? 'Record received' : 'Record paid'}</button></div>
    </form>
  </div>;
}

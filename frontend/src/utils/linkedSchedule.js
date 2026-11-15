export async function syncLinkedSchedule(api, {
  linkField,
  linkId,
  enabled,
  accountId,
  description,
  amount,
  frequency = 'MONTHLY',
  intervalCount = 1,
  startDate,
  endDate = null,
  sourceType,
  flowType = 'EXPENSE',
  amountIsEstimate = false,
}) {
  if (!linkId) return;

  const response = await api.get('/schedules');
  const existing = (Array.isArray(response.data) ? response.data : [])
    .find((schedule) => String(schedule[linkField]) === String(linkId));

  if (!enabled) {
    if (existing?.is_active) await api.put(`/schedules/${existing.id}`, { is_active: false });
    return;
  }

  if (!accountId || !startDate || Number(amount) <= 0) {
    throw new Error('Choose an account and next due date, and enter a positive recurring payment amount.');
  }

  const payload = {
    account_id: accountId,
    description: description.trim(),
    flow_type: flowType,
    source_type: sourceType,
    amount: Number(amount),
    amount_is_estimate: amountIsEstimate,
    frequency,
    interval_count: Number(intervalCount),
    start_date: startDate,
    end_date: endDate || null,
    is_active: true,
    [linkField]: linkId,
  };

  if (existing) await api.put(`/schedules/${existing.id}`, payload);
  else await api.post('/schedules', payload);
}

export function addMonthsToIsoDate(dateValue, months) {
  if (!dateValue || !months) return null;
  const [year, month, day] = dateValue.split('-').map(Number);
  const monthIndex = month - 1 + Number(months);
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const targetDay = Math.min(day, new Date(targetYear, targetMonth + 1, 0).getDate());
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

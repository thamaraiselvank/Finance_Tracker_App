const currencyLocales = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
};

export const getCurrencySymbol = (currency = 'INR') => {
  const code = currencyLocales[currency] ? currency : 'INR';
  return new Intl.NumberFormat(currencyLocales[code], {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value || code;
};

export const formatCurrency = (value, currency = 'INR') => {
  const code = currencyLocales[currency] ? currency : 'INR';
  return new Intl.NumberFormat(currencyLocales[code], {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
};

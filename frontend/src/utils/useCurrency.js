import { useAuth } from '../context/AuthContext';
import { formatCurrency as formatAmount, getCurrencySymbol } from './currency';

export default function useCurrency() {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  return {
    currency,
    currencySymbol: getCurrencySymbol(currency),
    formatCurrency: (value) => formatAmount(value, currency),
  };
}

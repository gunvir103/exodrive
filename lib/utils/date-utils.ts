import { format, parseISO } from 'date-fns';

export const formatDate = (dateString: string, formatString: string = 'PPP') => {
  try {
    return format(parseISO(dateString), formatString);
  } catch (e) {
    return dateString; // Fallback to original string if parsing fails
  }
};

export const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};
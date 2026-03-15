export const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    CHF: 'CHF ',
    PLN: 'zł',
    SEK: 'kr',
    NOK: 'kr',
    DKK: 'kr'
  };
  return symbols[currency] || '€';
};

export const formatPrice = (price: number, currency: string): string => {
  const symbol = getCurrencySymbol(currency);
  
  // For CHF, put symbol after the number
  if (currency === 'CHF') {
    return `${price.toFixed(2)} ${symbol.trim()}`;
  }
  
  // For other currencies, put symbol before
  return `${symbol}${price.toFixed(2)}`;
};

export const formatPriceWithUnit = (price: number, currency: string, unit: string): string => {
  return `${formatPrice(price, currency)} / ${unit}`;
};

export const getCountryCurrency = (country: string): string => {
  const mapping: Record<string, string> = {
    // Eurozone countries
    'DE': 'EUR',
    'IT': 'EUR',
    'FR': 'EUR',
    'ES': 'EUR',
    'NL': 'EUR',
    'BE': 'EUR',
    'AT': 'EUR',
    'PT': 'EUR',
    'IE': 'EUR',
    'GR': 'EUR',
    'FI': 'EUR',
    'EE': 'EUR',
    'LV': 'EUR',
    'LT': 'EUR',
    'SK': 'EUR',
    'SI': 'EUR',
    'CY': 'EUR',
    'MT': 'EUR',
    'LU': 'EUR',
    
    // Other European countries
    'GB': 'GBP',
    'UK': 'GBP',
    'CH': 'CHF',
    'PL': 'PLN',
    'SE': 'SEK',
    'NO': 'NOK',
    'DK': 'DKK',
    
    // Other countries
    'US': 'USD'
  };
  return mapping[country] || 'EUR';
};
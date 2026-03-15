// Multi-currency support utilities for RESTOS
export interface CurrencyConfig {
  symbol: string
  decimals: number
  position: 'before' | 'after'
  name: string
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  'EUR': { symbol: '€', decimals: 2, position: 'after', name: 'Euro' },
  'USD': { symbol: '$', decimals: 2, position: 'before', name: 'US Dollar' },
  'GBP': { symbol: '£', decimals: 2, position: 'before', name: 'British Pound' },
  'CHF': { symbol: 'CHF', decimals: 2, position: 'after', name: 'Swiss Franc' },
  'CAD': { symbol: 'C$', decimals: 2, position: 'before', name: 'Canadian Dollar' },
  'AUD': { symbol: 'A$', decimals: 2, position: 'before', name: 'Australian Dollar' },
  'JPY': { symbol: '¥', decimals: 0, position: 'before', name: 'Japanese Yen' },
  'SEK': { symbol: 'kr', decimals: 2, position: 'after', name: 'Swedish Krona' },
  'NOK': { symbol: 'kr', decimals: 2, position: 'after', name: 'Norwegian Krone' },
  'DKK': { symbol: 'kr', decimals: 2, position: 'after', name: 'Danish Krone' },
  'PLN': { symbol: 'zł', decimals: 2, position: 'after', name: 'Polish Złoty' },
  'CZK': { symbol: 'Kč', decimals: 2, position: 'after', name: 'Czech Koruna' }
}

// Country to currency mapping
const COUNTRY_CURRENCY_MAP: Record<string, { code: string; symbol: string }> = {
  'IT': { code: 'EUR', symbol: '€' },
  'ES': { code: 'EUR', symbol: '€' },
  'FR': { code: 'EUR', symbol: '€' },
  'DE': { code: 'EUR', symbol: '€' },
  'GB': { code: 'GBP', symbol: '£' },
  'US': { code: 'USD', symbol: '$' },
  'CH': { code: 'CHF', symbol: 'CHF' },
  'CA': { code: 'CAD', symbol: 'C$' },
  'AU': { code: 'AUD', symbol: 'A$' },
  'LT': { code: 'EUR', symbol: '€' },
}

// Country to language mapping
const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  'IT': 'it',
  'ES': 'es',
  'FR': 'fr',
  'DE': 'de',
  'GB': 'en',
  'US': 'en',
  'CH': 'de',
  'CA': 'en',
  'AU': 'en',
  'LT': 'en',
}

/**
 * Format a monetary amount with proper currency symbol and positioning
 */
export function formatCurrency(
  amount: number, 
  currencyCode: string = 'EUR',
  showSymbol: boolean = true
): string {
  const config = SUPPORTED_CURRENCIES[currencyCode.toUpperCase()] || SUPPORTED_CURRENCIES['EUR']
  
  // Format the number with appropriate decimals
  const formattedAmount = (Number(amount) || 0).toFixed(config.decimals)
  
  if (!showSymbol) {
    return formattedAmount
  }
  
  // Position the symbol correctly
  if (config.position === 'before') {
    return `${config.symbol}${formattedAmount}`
  } else {
    return `${formattedAmount} ${config.symbol}`
  }
}

/**
 * Alias for formatCurrency - commonly used name
 */
export function formatPrice(
  amount: number, 
  currencyCode: string = 'EUR',
  showSymbol: boolean = true
): string {
  return formatCurrency(amount, currencyCode, showSymbol)
}

/**
 * Get currency symbol for a currency code
 */
export function getCurrencySymbol(currencyCode: string): string {
  const config = SUPPORTED_CURRENCIES[currencyCode.toUpperCase()] || SUPPORTED_CURRENCIES['EUR']
  return config.symbol
}

/**
 * Get currency configuration for a country
 */
export function getCurrencyForCountry(countryCode: string): { code: string; symbol: string } {
  return COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()] || COUNTRY_CURRENCY_MAP['IT']
}

/**
 * Get language for a country
 */
export function getLanguageForCountry(countryCode: string): string {
  return COUNTRY_LANGUAGE_MAP[countryCode.toUpperCase()] || 'it'
}

/**
 * Parse currency from text (useful for OCR results)
 */
export function parseCurrencyFromText(text: string): string {
  const upperText = text.toUpperCase()
  
  // Check for explicit currency codes
  for (const [code, config] of Object.entries(SUPPORTED_CURRENCIES)) {
    if (upperText.includes(code)) {
      return code
    }
  }
  
  // Check for currency symbols
  if (text.includes('€')) return 'EUR'
  if (text.includes('$') && !text.includes('A$') && !text.includes('C$')) return 'USD'
  if (text.includes('£')) return 'GBP'
  if (text.includes('CHF')) return 'CHF'
  if (text.includes('C$')) return 'CAD'
  if (text.includes('A$')) return 'AUD'
  if (text.includes('¥')) return 'JPY'
  if (text.includes('kr')) {
    // Need more context to distinguish between SEK, NOK, DKK
    if (upperText.includes('SEK') || upperText.includes('SWEDEN')) return 'SEK'
    if (upperText.includes('NOK') || upperText.includes('NORWAY')) return 'NOK'
    if (upperText.includes('DKK') || upperText.includes('DENMARK')) return 'DKK'
    return 'SEK' // Default to SEK
  }
  if (text.includes('zł')) return 'PLN'
  if (text.includes('Kč')) return 'CZK'
  
  // Default fallback
  return 'EUR'
}

/**
 * Get currency configuration
 */
export function getCurrencyConfig(currencyCode: string): CurrencyConfig {
  return SUPPORTED_CURRENCIES[currencyCode.toUpperCase()] || SUPPORTED_CURRENCIES['EUR']
}

/**
 * Get list of supported currencies for dropdowns
 */
export function getSupportedCurrencies(): Array<{ code: string; name: string; symbol: string }> {
  return Object.entries(SUPPORTED_CURRENCIES).map(([code, config]) => ({
    code,
    name: config.name,
    symbol: config.symbol
  }))
}

/**
 * Convert amount between currencies (placeholder for future exchange rate integration)
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRate?: number
): number {
  // For now, return the same amount (no conversion)
  // In the future, integrate with exchange rate API
  if (fromCurrency === toCurrency) {
    return amount
  }
  
  if (exchangeRate) {
    return amount * exchangeRate
  }
  
  // Placeholder conversion rates (should be replaced with real-time rates)
  const placeholderRates: Record<string, Record<string, number>> = {
    'EUR': { 'USD': 1.10, 'GBP': 0.85, 'CHF': 1.05 },
    'USD': { 'EUR': 0.91, 'GBP': 0.77, 'CHF': 0.95 },
    'GBP': { 'EUR': 1.18, 'USD': 1.30, 'CHF': 1.24 }
  }
  
  const rate = placeholderRates[fromCurrency]?.[toCurrency]
  return rate ? amount * rate : amount
}

/**
 * Validate if currency code is supported
 */
export function isSupportedCurrency(currencyCode: string): boolean {
  return currencyCode.toUpperCase() in SUPPORTED_CURRENCIES
}
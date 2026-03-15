// VAT rates and discount validation utilities for RESTOS
export interface VATConfig {
  country: string
  countryCode: string
  rates: number[]
  defaultRate: number
  currency: string
}

export const VAT_RATES_BY_COUNTRY: Record<string, VATConfig> = {
  'IT': {
    country: 'Italia',
    countryCode: 'IT',
    rates: [4, 10, 22],
    defaultRate: 22,
    currency: 'EUR'
  },
  'ES': {
    country: 'España',
    countryCode: 'ES', 
    rates: [4, 10, 21],
    defaultRate: 21,
    currency: 'EUR'
  },
  'FR': {
    country: 'France',
    countryCode: 'FR',
    rates: [5.5, 10, 20],
    defaultRate: 20,
    currency: 'EUR'
  },
  'DE': {
    country: 'Deutschland',
    countryCode: 'DE',
    rates: [7, 19],
    defaultRate: 19,
    currency: 'EUR'
  },
  'GB': {
    country: 'United Kingdom',
    countryCode: 'GB',
    rates: [0, 5, 20],
    defaultRate: 20,
    currency: 'GBP'
  },
  'US': {
    country: 'United States',
    countryCode: 'US',
    rates: [0, 3, 5, 6, 7, 8, 8.5, 9, 10, 11, 12],
    defaultRate: 8,
    currency: 'USD'
  },
  'CH': {
    country: 'Switzerland',
    countryCode: 'CH',
    rates: [2.5, 7.7],
    defaultRate: 7.7,
    currency: 'CHF'
  },
  'CA': {
    country: 'Canada',
    countryCode: 'CA',
    rates: [5, 13, 14, 15],
    defaultRate: 13,
    currency: 'CAD'
  },
  'AU': {
    country: 'Australia',
    countryCode: 'AU',
    rates: [10],
    defaultRate: 10,
    currency: 'AUD'
  }
}

/**
 * Get VAT configuration for a country
 */
export function getVATConfig(countryCode: string): VATConfig {
  return VAT_RATES_BY_COUNTRY[countryCode.toUpperCase()] || VAT_RATES_BY_COUNTRY['IT']
}

/**
 * Get valid VAT rates for a country
 */
export function getValidVATRates(countryCode: string): number[] {
  const config = getVATConfig(countryCode)
  return config.rates
}

/**
 * Get default VAT rate for a country
 */
export function getDefaultVATRate(countryCode: string): number {
  const config = getVATConfig(countryCode)
  return config.defaultRate
}

/**
 * Get VAT rate for a product based on country and category
 */
export function getVATRateForProduct(countryCode: string, category?: string): number {
  const config = getVATConfig(countryCode)
  
  // Category-specific VAT rates (simplified logic)
  if (category) {
    const lowerCategory = category.toLowerCase()
    
    // Food and essential items often have reduced VAT rates
    if (lowerCategory.includes('food') || lowerCategory.includes('essential')) {
      // Return the lowest non-zero rate for food items
      const nonZeroRates = config.rates.filter(rate => rate > 0)
      return nonZeroRates.length > 0 ? Math.min(...nonZeroRates) : config.defaultRate
    }
    
    // Books, newspapers often have reduced rates
    if (lowerCategory.includes('book') || lowerCategory.includes('newspaper')) {
      const nonZeroRates = config.rates.filter(rate => rate > 0)
      return nonZeroRates.length > 0 ? Math.min(...nonZeroRates) : config.defaultRate
    }
  }
  
  // Default to standard VAT rate
  return config.defaultRate
}

/**
 * Validate if a VAT rate is valid for a country
 */
export function isValidVATRate(vatRate: number, countryCode: string): boolean {
  const validRates = getValidVATRates(countryCode)
  return validRates.includes(vatRate)
}

/**
 * Find the closest valid VAT rate for a country
 */
export function findClosestVATRate(vatRate: number, countryCode: string): number {
  const validRates = getValidVATRates(countryCode)
  
  if (validRates.includes(vatRate)) {
    return vatRate
  }
  
  // Find the closest rate
  let closest = validRates[0]
  let minDiff = Math.abs(vatRate - closest)
  
  for (const rate of validRates) {
    const diff = Math.abs(vatRate - rate)
    if (diff < minDiff) {
      minDiff = diff
      closest = rate
    }
  }
  
  return closest
}

/**
 * Validate discount percentage
 */
export function isValidDiscountPercent(discountPercent: number): boolean {
  return discountPercent >= 0 && discountPercent <= 100
}

/**
 * Normalize discount percentage to valid range
 */
export function normalizeDiscountPercent(discountPercent: number): number {
  if (discountPercent < 0) return 0
  if (discountPercent > 100) return 100
  return Math.round(discountPercent * 100) / 100 // Round to 2 decimals
}

/**
 * Calculate discount amount from percentage and base price
 */
export function calculateDiscountAmount(basePrice: number, discountPercent: number): number {
  const normalizedPercent = normalizeDiscountPercent(discountPercent)
  return (basePrice * normalizedPercent) / 100
}

/**
 * Calculate final price after discount
 */
export function calculateDiscountedPrice(basePrice: number, discountPercent: number): number {
  const discountAmount = calculateDiscountAmount(basePrice, discountPercent)
  return basePrice - discountAmount
}

/**
 * Calculate VAT amount from price and VAT rate
 */
export function calculateVATAmount(price: number, vatRate: number): number {
  return (price * vatRate) / 100
}

/**
 * Calculate price including VAT
 */
export function calculatePriceWithVAT(price: number, vatRate: number): number {
  const vatAmount = calculateVATAmount(price, vatRate)
  return price + vatAmount
}

/**
 * Detect country from VAT rate (best guess)
 */
export function detectCountryFromVATRate(vatRate: number): string {
  // Check each country's valid rates
  for (const [countryCode, config] of Object.entries(VAT_RATES_BY_COUNTRY)) {
    if (config.rates.includes(vatRate)) {
      // If multiple countries have the same rate, prefer EU countries for common rates
      if (vatRate === 20 && countryCode === 'GB') return 'GB'
      if (vatRate === 21 && countryCode === 'ES') return 'ES'
      if (vatRate === 22 && countryCode === 'IT') return 'IT'
      if (vatRate === 19 && countryCode === 'DE') return 'DE'
      return countryCode
    }
  }
  
  // Default fallback
  return 'IT'
}

/**
 * Get all supported countries with their VAT info
 */
export function getSupportedCountries(): Array<{
  code: string
  name: string
  rates: number[]
  defaultRate: number
  currency: string
}> {
  return Object.entries(VAT_RATES_BY_COUNTRY).map(([code, config]) => ({
    code,
    name: config.country,
    rates: config.rates,
    defaultRate: config.defaultRate,
    currency: config.currency
  }))
}
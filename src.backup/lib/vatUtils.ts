// VAT rates by country (Standard rates)
export const VAT_RATES: Record<string, number> = {
  // European Union
  IT: 22, // Italy
  ES: 21, // Spain
  FR: 20, // France
  DE: 19, // Germany
  GB: 20, // United Kingdom (Great Britain)
  UK: 20, // United Kingdom (alternative code)
  LT: 21, // Lithuania
  PT: 23, // Portugal
  NL: 21, // Netherlands
  BE: 21, // Belgium
  AT: 20, // Austria
  PL: 23, // Poland
  RO: 19, // Romania
  GR: 24, // Greece
  CZ: 21, // Czech Republic
  SE: 25, // Sweden
  HU: 27, // Hungary
  DK: 25, // Denmark
  FI: 24, // Finland
  SK: 20, // Slovakia
  IE: 23, // Ireland
  HR: 25, // Croatia
  BG: 20, // Bulgaria
  SI: 22, // Slovenia
  LV: 21, // Latvia
  EE: 22, // Estonia
  CY: 19, // Cyprus
  LU: 17, // Luxembourg
  MT: 18, // Malta
  
  // Non-EU European countries
  CH: 7.7, // Switzerland
  NO: 25,  // Norway
  IS: 24,  // Iceland
  
  // North America
  US: 0,   // United States (no federal VAT, state sales tax varies)
  CA: 5,   // Canada (GST, provincial taxes vary)
  MX: 16,  // Mexico
  
  // Other major countries
  AU: 10,  // Australia (GST)
  NZ: 15,  // New Zealand (GST)
  JP: 10,  // Japan
  CN: 13,  // China
  IN: 18,  // India (GST)
  BR: 17,  // Brazil (average ICMS)
  AR: 21,  // Argentina
  CL: 19,  // Chile
  CO: 19,  // Colombia
  ZA: 15,  // South Africa
  TR: 18,  // Turkey
  RU: 20,  // Russia
  KR: 10,  // South Korea
  SG: 8,   // Singapore (GST)
  MY: 6,   // Malaysia (SST)
  TH: 7,   // Thailand
  ID: 11,  // Indonesia
  PH: 12,  // Philippines
  VN: 10,  // Vietnam
};

/**
 * Get VAT rate for a country
 */
export function getVATRate(countryCode: string): number {
  return VAT_RATES[countryCode] || 0;
}

/**
 * Calculate price with VAT
 */
export function calculatePriceWithVAT(price: number, vatRate: number): number {
  return price * (1 + vatRate / 100);
}

/**
 * Calculate price without VAT from price with VAT
 */
export function calculatePriceWithoutVAT(priceWithVAT: number, vatRate: number): number {
  return priceWithVAT / (1 + vatRate / 100);
}

/**
 * Calculate VAT amount
 */
export function calculateVATAmount(price: number, vatRate: number): number {
  return price * (vatRate / 100);
}

/**
 * Format price with currency symbol
 */
export function formatPrice(price: number, showVAT: boolean = false, vatRate: number = 0): string {
  const finalPrice = showVAT ? calculatePriceWithVAT(price, vatRate) : price;
  return `€${finalPrice.toFixed(2)}`;
}

/**
 * Get country name and VAT rate info
 */
export function getCountryVATInfo(countryCode: string): { rate: number; hasVAT: boolean } {
  const rate = getVATRate(countryCode);
  return {
    rate,
    hasVAT: rate > 0
  };
}
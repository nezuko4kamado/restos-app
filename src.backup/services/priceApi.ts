import axios from 'axios';

/**
 * PriceAPI.com Service
 * 
 * PriceAPI.com provides LIVE product prices from major supermarkets across multiple countries.
 * This service integrates with their API to fetch real-time pricing data.
 * 
 * API Documentation: https://www.priceapi.com/documentation
 * Base URL: https://api.priceapi.com/v2
 */

const PRICE_API_KEY = 'PCFYDNAZSLQEBFJVGFQJOVCVRVFYCSSLMSAYZSZFVYWMEMHVSWYYALDHGYLPTRWH';
const PRICE_API_BASE = 'https://api.priceapi.com/v2';
const REQUEST_TIMEOUT = 15000; // 15 seconds

export interface PriceAPIStore {
  code: string;
  name: string;
  country: string;
  logo?: string;
}

export interface PriceAPIPrice {
  ean: string;
  productName: string;
  brand?: string;
  price: number;
  currency: string;
  storeName: string;
  storeCode: string;
  country: string;
  countryCode: string;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  imageUrl?: string;
  productUrl?: string;
  timestamp: string;
  pricePerUnit?: string;
  unit?: string;
  discount?: {
    isActive: boolean;
    originalPrice: number;
    discountPercentage: number;
  };
  source: 'price_api';
}

export interface PriceAPIResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: {
    name?: string;
    brand?: string;
    price?: number;
    currency?: string;
    availability?: string;
    image?: string;
    url?: string;
    unit_price?: string;
    unit?: string;
    original_price?: number;
  }[];
  error?: string;
}

// Supported stores by country
export const SUPPORTED_STORES: Record<string, PriceAPIStore[]> = {
  ES: [
    { code: 'mercadona_es', name: 'Mercadona', country: 'Spain' },
    { code: 'carrefour_es', name: 'Carrefour', country: 'Spain' },
    { code: 'makro_es', name: 'Makro', country: 'Spain' },
    { code: 'alcampo_es', name: 'Alcampo', country: 'Spain' },
    { code: 'dia_es', name: 'Dia', country: 'Spain' },
  ],
  IT: [
    { code: 'esselunga_it', name: 'Esselunga', country: 'Italy' },
    { code: 'coop_it', name: 'Coop', country: 'Italy' },
    { code: 'carrefour_it', name: 'Carrefour', country: 'Italy' },
    { code: 'conad_it', name: 'Conad', country: 'Italy' },
    { code: 'makro_it', name: 'Makro', country: 'Italy' },
  ],
  DE: [
    { code: 'rewe_de', name: 'Rewe', country: 'Germany' },
    { code: 'edeka_de', name: 'Edeka', country: 'Germany' },
    { code: 'aldi_de', name: 'Aldi', country: 'Germany' },
    { code: 'lidl_de', name: 'Lidl', country: 'Germany' },
    { code: 'kaufland_de', name: 'Kaufland', country: 'Germany' },
    { code: 'metro_de', name: 'Metro', country: 'Germany' },
  ],
  GB: [
    { code: 'tesco_gb', name: 'Tesco', country: 'United Kingdom' },
    { code: 'sainsburys_gb', name: "Sainsbury's", country: 'United Kingdom' },
    { code: 'asda_gb', name: 'Asda', country: 'United Kingdom' },
    { code: 'morrisons_gb', name: 'Morrisons', country: 'United Kingdom' },
    { code: 'makro_gb', name: 'Makro', country: 'United Kingdom' },
  ],
  FR: [
    { code: 'carrefour_fr', name: 'Carrefour', country: 'France' },
    { code: 'auchan_fr', name: 'Auchan', country: 'France' },
    { code: 'leclerc_fr', name: 'Leclerc', country: 'France' },
    { code: 'intermarche_fr', name: 'Intermarché', country: 'France' },
    { code: 'metro_fr', name: 'Metro', country: 'France' },
  ],
  LT: [
    { code: 'maxima_lt', name: 'Maxima', country: 'Lithuania' },
    { code: 'rimi_lt', name: 'Rimi', country: 'Lithuania' },
    { code: 'iki_lt', name: 'Iki', country: 'Lithuania' },
    { code: 'norfa_lt', name: 'Norfa', country: 'Lithuania' },
  ],
  US: [
    { code: 'walmart_us', name: 'Walmart', country: 'USA' },
    { code: 'costco_us', name: 'Costco', country: 'USA' },
    { code: 'target_us', name: 'Target', country: 'USA' },
    { code: 'kroger_us', name: 'Kroger', country: 'USA' },
    { code: 'wholefoods_us', name: 'Whole Foods', country: 'USA' },
  ],
};

// Country codes and names
export const COUNTRIES = [
  { code: 'ES', name: 'Spagna', flag: '🇪🇸' },
  { code: 'IT', name: 'Italia', flag: '🇮🇹' },
  { code: 'DE', name: 'Germania', flag: '🇩🇪' },
  { code: 'GB', name: 'Regno Unito', flag: '🇬🇧' },
  { code: 'FR', name: 'Francia', flag: '🇫🇷' },
  { code: 'LT', name: 'Lituania', flag: '🇱🇹' },
  { code: 'US', name: 'USA', flag: '🇺🇸' },
];

/**
 * Fetch live price for a product from a specific store
 * @param ean - Product EAN/barcode
 * @param storeCode - Store code (e.g., 'mercadona_es')
 * @param countryCode - Country code (e.g., 'ES')
 * @returns Price data or null if not found
 */
export async function fetchPriceFromStore(
  ean: string,
  storeCode: string,
  countryCode: string
): Promise<PriceAPIPrice | null> {
  try {
    console.log(`[PriceAPI] Fetching price for EAN ${ean} from ${storeCode}`);

    // Create job to fetch price
    const response = await axios.get<PriceAPIResponse>(
      `${PRICE_API_BASE}/jobs`,
      {
        params: {
          source: storeCode,
          sku: ean,
          country: countryCode.toLowerCase(),
        },
        headers: {
          'Authorization': `Bearer ${PRICE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: REQUEST_TIMEOUT,
      }
    );

    if (!response.data || response.data.status === 'failed') {
      console.log(`[PriceAPI] No data found for ${storeCode}`);
      return null;
    }

    // Wait for job to complete (poll if needed)
    let jobData = response.data;
    let attempts = 0;
    const maxAttempts = 5;

    while (jobData.status === 'pending' || jobData.status === 'processing') {
      if (attempts >= maxAttempts) {
        console.log(`[PriceAPI] Job timeout for ${storeCode}`);
        return null;
      }

      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const jobResponse = await axios.get<PriceAPIResponse>(
        `${PRICE_API_BASE}/jobs/${jobData.job_id}`,
        {
          headers: {
            'Authorization': `Bearer ${PRICE_API_KEY}`,
          },
          timeout: REQUEST_TIMEOUT,
        }
      );

      jobData = jobResponse.data;
      attempts++;
    }

    if (jobData.status !== 'completed' || !jobData.results || jobData.results.length === 0) {
      console.log(`[PriceAPI] No results for ${storeCode}`);
      return null;
    }

    const result = jobData.results[0];
    const store = SUPPORTED_STORES[countryCode]?.find(s => s.code === storeCode);

    if (!result.price || !store) {
      return null;
    }

    // Calculate discount if applicable
    let discount;
    if (result.original_price && result.original_price > result.price) {
      discount = {
        isActive: true,
        originalPrice: result.original_price,
        discountPercentage: Math.round(((result.original_price - result.price) / result.original_price) * 100),
      };
    }

    const priceData: PriceAPIPrice = {
      ean,
      productName: result.name || 'Product',
      brand: result.brand,
      price: result.price,
      currency: result.currency || 'EUR',
      storeName: store.name,
      storeCode,
      country: store.country,
      countryCode,
      availability: (result.availability as 'in_stock' | 'out_of_stock' | 'unknown') || 'unknown',
      imageUrl: result.image,
      productUrl: result.url,
      timestamp: new Date().toISOString(),
      pricePerUnit: result.unit_price,
      unit: result.unit,
      discount,
      source: 'price_api',
    };

    console.log(`[PriceAPI] ✓ Found price in ${store.name}: ${result.currency} ${result.price}`);
    return priceData;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        console.error(`[PriceAPI] Timeout for ${storeCode}`);
      } else if (error.response?.status === 404) {
        console.log(`[PriceAPI] Product not found in ${storeCode}`);
      } else {
        console.error(`[PriceAPI] Error for ${storeCode}:`, error.message);
      }
    } else {
      console.error(`[PriceAPI] Unexpected error for ${storeCode}:`, error);
    }
    return null;
  }
}

/**
 * Fetch live prices from all stores in a country
 * @param ean - Product EAN/barcode
 * @param countryCode - Country code (e.g., 'ES')
 * @returns Array of prices from different stores
 */
export async function fetchPricesFromCountry(
  ean: string,
  countryCode: string
): Promise<PriceAPIPrice[]> {
  const stores = SUPPORTED_STORES[countryCode];
  if (!stores) {
    console.error(`[PriceAPI] Country ${countryCode} not supported`);
    return [];
  }

  console.log(`[PriceAPI] Fetching prices from ${stores.length} stores in ${countryCode}`);

  // Fetch prices from all stores in parallel
  const pricePromises = stores.map(store =>
    fetchPriceFromStore(ean, store.code, countryCode)
  );

  const results = await Promise.allSettled(pricePromises);
  
  const prices = results
    .filter((result): result is PromiseFulfilledResult<PriceAPIPrice | null> => 
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value as PriceAPIPrice);

  console.log(`[PriceAPI] Found ${prices.length} prices in ${countryCode}`);
  return prices;
}

/**
 * Fetch live prices from multiple countries
 * @param ean - Product EAN/barcode
 * @param countryCodes - Array of country codes (e.g., ['ES', 'IT'])
 * @returns Array of prices from different stores and countries
 */
export async function fetchPricesFromCountries(
  ean: string,
  countryCodes: string[]
): Promise<PriceAPIPrice[]> {
  console.log(`[PriceAPI] Fetching prices from ${countryCodes.length} countries`);

  const countryPromises = countryCodes.map(code =>
    fetchPricesFromCountry(ean, code)
  );

  const results = await Promise.all(countryPromises);
  const allPrices = results.flat();

  console.log(`[PriceAPI] Total prices found: ${allPrices.length}`);
  return allPrices;
}

/**
 * Get the best (lowest) price from a list of prices
 * @param prices - Array of prices
 * @returns The lowest price or null if no prices
 */
export function getBestPrice(prices: PriceAPIPrice[]): PriceAPIPrice | null {
  if (!prices || prices.length === 0) return null;
  
  return prices.reduce((best, current) => {
    return current.price < best.price ? current : best;
  });
}

/**
 * Group prices by country
 * @param prices - Array of prices
 * @returns Map of country code to prices
 */
export function groupPricesByCountry(prices: PriceAPIPrice[]): Map<string, PriceAPIPrice[]> {
  const grouped = new Map<string, PriceAPIPrice[]>();
  
  prices.forEach(price => {
    const existing = grouped.get(price.countryCode) || [];
    existing.push(price);
    grouped.set(price.countryCode, existing);
  });
  
  return grouped;
}

/**
 * Format timestamp for display
 * @param timestamp - ISO timestamp string
 * @returns Formatted date and time (e.g., "23 Nov 2025, 10:30")
 */
export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  } catch {
    return timestamp;
  }
}

/**
 * Calculate savings between two prices
 * @param price1 - First price
 * @param price2 - Second price (reference)
 * @returns Savings amount and percentage
 */
export function calculateSavings(price1: number, price2: number): { amount: number; percentage: number } {
  const amount = Math.abs(price1 - price2);
  const percentage = price2 > 0 ? Math.round((amount / price2) * 100) : 0;
  
  return { amount, percentage };
}

/**
 * Get country name from code
 * @param code - Country code (e.g., 'ES')
 * @returns Country name in Italian
 */
export function getCountryName(code: string): string {
  return COUNTRIES.find(c => c.code === code)?.name || code;
}

/**
 * Get country flag emoji from code
 * @param code - Country code (e.g., 'ES')
 * @returns Flag emoji
 */
export function getCountryFlag(code: string): string {
  return COUNTRIES.find(c => c.code === code)?.flag || '🌍';
}

/**
 * Detect user's country from browser
 * @returns Country code or 'ES' as default
 */
export function detectUserCountry(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Map common timezones to countries
    const timezoneMap: Record<string, string> = {
      'Europe/Madrid': 'ES',
      'Europe/Rome': 'IT',
      'Europe/Berlin': 'DE',
      'Europe/London': 'GB',
      'Europe/Paris': 'FR',
      'Europe/Vilnius': 'LT',
      'America/New_York': 'US',
      'America/Chicago': 'US',
      'America/Los_Angeles': 'US',
    };
    
    return timezoneMap[timezone] || 'ES';
  } catch {
    return 'ES'; // Default to Spain
  }
}
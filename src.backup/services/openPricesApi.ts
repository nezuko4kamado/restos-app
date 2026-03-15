import axios from 'axios';

/**
 * Open Prices API Service
 * 
 * Open Prices is a crowdsourced database of product prices from Open Food Facts.
 * It provides real prices from stores worldwide including Makro, Metro, Carrefour, etc.
 * 
 * API Documentation: https://prices.openfoodfacts.org/api/docs
 * Base URL: https://prices.openfoodfacts.org/api/v1
 */

export interface OpenPrice {
  id: number;
  product_code: string;
  product_name?: string;
  price: number;
  currency: string;
  location_osm_id?: number;
  location_osm_type?: string;
  date: string;
  proof_id?: number;
  owner?: string;
  created?: string;
  price_per?: string;
  price_without_discount?: number;
  price_is_discounted?: boolean;
  location?: {
    osm_id: number;
    osm_type: string;
    osm_name?: string;
    osm_display_name?: string;
    osm_address_city?: string;
    osm_address_country?: string;
  };
  product?: {
    code: string;
    product_name?: string;
    image_url?: string;
    brands?: string;
    categories?: string;
  };
}

export interface OpenPricesResponse {
  items: OpenPrice[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ProcessedPrice {
  ean: string;
  productName: string;
  price: number;
  currency: string;
  storeName: string;
  storeLocation: string;
  city?: string;
  country?: string;
  date: string;
  pricePerUnit?: string;
  isDiscounted: boolean;
  originalPrice?: number;
  source: 'open_prices';
}

const OPEN_PRICES_API_BASE = 'https://prices.openfoodfacts.org/api/v1';
const REQUEST_TIMEOUT = 10000; // 10 seconds

/**
 * Fetch prices for a product by EAN code
 * @param ean - Product EAN/barcode
 * @returns Array of prices from different stores
 */
export async function fetchPricesByEAN(ean: string): Promise<ProcessedPrice[]> {
  try {
    console.log(`[Open Prices API] Fetching prices for EAN: ${ean}`);
    
    const response = await axios.get<OpenPricesResponse>(
      `${OPEN_PRICES_API_BASE}/prices`,
      {
        params: {
          product_code: ean,
          order_by: '-date', // Most recent first
          size: 50 // Get up to 50 prices
        },
        timeout: REQUEST_TIMEOUT,
        headers: {
          'User-Agent': 'RESTO-PriceScanner/1.0'
        }
      }
    );

    if (!response.data || !response.data.items || response.data.items.length === 0) {
      console.log(`[Open Prices API] No prices found for EAN: ${ean}`);
      return [];
    }

    console.log(`[Open Prices API] Found ${response.data.items.length} prices for EAN: ${ean}`);

    // Process and format prices
    const processedPrices: ProcessedPrice[] = response.data.items
      .filter(item => item.price && item.price > 0)
      .map(item => {
        const storeName = item.location?.osm_name || 
                         item.location?.osm_display_name?.split(',')[0] || 
                         'Store';
        
        const city = item.location?.osm_address_city || '';
        const country = item.location?.osm_address_country || '';
        const storeLocation = [city, country].filter(Boolean).join(', ') || 'Unknown';

        const productName = item.product?.product_name || 
                           item.product_name || 
                           'Product';

        return {
          ean: item.product_code,
          productName,
          price: item.price,
          currency: item.currency || 'EUR',
          storeName,
          storeLocation,
          city,
          country,
          date: item.date,
          pricePerUnit: item.price_per,
          isDiscounted: item.price_is_discounted || false,
          originalPrice: item.price_without_discount,
          source: 'open_prices' as const
        };
      });

    return processedPrices;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        console.error('[Open Prices API] Request timeout');
        throw new Error('Request timeout - Open Prices API non risponde');
      }
      if (error.response?.status === 404) {
        console.log(`[Open Prices API] No prices found for EAN: ${ean}`);
        return [];
      }
      console.error('[Open Prices API] Error:', error.message);
      throw new Error(`Errore API Open Prices: ${error.message}`);
    }
    console.error('[Open Prices API] Unexpected error:', error);
    throw new Error('Errore durante la ricerca dei prezzi');
  }
}

/**
 * Get the best (lowest) price from a list of prices
 * @param prices - Array of prices
 * @returns The lowest price or null if no prices
 */
export function getBestPrice(prices: ProcessedPrice[]): ProcessedPrice | null {
  if (!prices || prices.length === 0) return null;
  
  return prices.reduce((best, current) => {
    return current.price < best.price ? current : best;
  });
}

/**
 * Group prices by store name
 * @param prices - Array of prices
 * @returns Map of store name to prices
 */
export function groupPricesByStore(prices: ProcessedPrice[]): Map<string, ProcessedPrice[]> {
  const grouped = new Map<string, ProcessedPrice[]>();
  
  prices.forEach(price => {
    const existing = grouped.get(price.storeName) || [];
    existing.push(price);
    grouped.set(price.storeName, existing);
  });
  
  return grouped;
}

/**
 * Get the most recent price for each store
 * @param prices - Array of prices
 * @returns Array of most recent prices per store
 */
export function getLatestPricePerStore(prices: ProcessedPrice[]): ProcessedPrice[] {
  const grouped = groupPricesByStore(prices);
  const latest: ProcessedPrice[] = [];
  
  grouped.forEach((storePrices) => {
    // Sort by date descending and take the first (most recent)
    const sorted = storePrices.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    latest.push(sorted[0]);
  });
  
  return latest;
}

/**
 * Format date for display
 * @param dateString - ISO date string
 * @returns Formatted date (e.g., "15 Gen 2024")
 */
export function formatPriceDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  } catch {
    return dateString;
  }
}

/**
 * Calculate price difference percentage
 * @param price1 - First price
 * @param price2 - Second price
 * @returns Percentage difference
 */
export function calculatePriceDifference(price1: number, price2: number): number {
  if (price2 === 0) return 0;
  return Math.round(((price1 - price2) / price2) * 100);
}
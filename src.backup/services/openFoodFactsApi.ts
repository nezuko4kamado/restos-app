import axios from 'axios';

export interface OpenFoodFactsProduct {
  ean: string;
  productName: string;
  brand?: string;
  imageUrl?: string;
  quantity?: string;
  category?: string;
  source: 'openfoodfacts';
}

interface OpenFoodFactsApiResponse {
  status: number;
  status_verbose?: string;
  product?: {
    product_name?: string;
    product_name_it?: string;
    product_name_es?: string;
    brands?: string;
    image_url?: string;
    image_front_url?: string;
    quantity?: string;
    categories?: string;
  };
}

/**
 * Fetch product information from Open Food Facts API by EAN barcode
 * @param ean - The EAN/UPC barcode number
 * @returns Product data or null if not found
 */
export async function fetchProductByEAN(ean: string): Promise<OpenFoodFactsProduct | null> {
  try {
    // Validate EAN format (8, 12, 13, or 14 digits)
    if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(ean)) {
      console.error('Invalid EAN format:', ean);
      return null;
    }

    const url = `https://world.openfoodfacts.org/api/v0/product/${ean}.json`;
    console.log('Fetching from Open Food Facts:', url);

    const response = await axios.get<OpenFoodFactsApiResponse>(url, {
      timeout: 10000, // 10 seconds timeout
      headers: {
        'User-Agent': 'RESTO-App/1.0 (Contact: support@resto.app)'
      }
    });

    // Check if product was found
    if (response.data.status !== 1 || !response.data.product) {
      console.log('Product not found in Open Food Facts:', ean);
      return null;
    }

    const product = response.data.product;

    // Try to get product name in Italian, Spanish, or default
    const productName = product.product_name_it || 
                       product.product_name_es || 
                       product.product_name || 
                       'Prodotto Sconosciuto';

    // Get the best available image
    const imageUrl = product.image_front_url || product.image_url;

    return {
      ean,
      productName,
      brand: product.brands || undefined,
      imageUrl: imageUrl || undefined,
      quantity: product.quantity || undefined,
      category: product.categories?.split(',')[0]?.trim() || undefined,
      source: 'openfoodfacts'
    };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        console.error('Open Food Facts API timeout:', ean);
      } else if (error.response?.status === 404) {
        console.log('Product not found (404):', ean);
        return null;
      } else {
        console.error('Open Food Facts API error:', error.message);
      }
    } else {
      console.error('Unexpected error fetching product:', error);
    }
    return null;
  }
}

/**
 * Fetch multiple products by EAN (batch operation)
 * @param eans - Array of EAN barcodes
 * @returns Array of products (null for not found)
 */
export async function fetchProductsByEANs(eans: string[]): Promise<(OpenFoodFactsProduct | null)[]> {
  const promises = eans.map(ean => fetchProductByEAN(ean));
  return Promise.all(promises);
}

/**
 * Search products by name in Open Food Facts
 * @param query - Search query
 * @param page - Page number (default 1)
 * @returns Array of products
 */
export async function searchProducts(query: string, page: number = 1): Promise<OpenFoodFactsProduct[]> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl`;
    const response = await axios.get(url, {
      params: {
        search_terms: query,
        page,
        page_size: 20,
        json: 1
      },
      timeout: 10000
    });

    if (!response.data.products || !Array.isArray(response.data.products)) {
      return [];
    }

    return response.data.products
      .filter((p: { code?: string; product_name?: string }) => p.code && p.product_name)
      .map((p: { code: string; product_name?: string; product_name_it?: string; product_name_es?: string; brands?: string; image_front_url?: string; image_url?: string; quantity?: string; categories?: string }) => ({
        ean: p.code,
        productName: p.product_name_it || p.product_name_es || p.product_name || 'Prodotto Sconosciuto',
        brand: p.brands || undefined,
        imageUrl: p.image_front_url || p.image_url || undefined,
        quantity: p.quantity || undefined,
        category: p.categories?.split(',')[0]?.trim() || undefined,
        source: 'openfoodfacts' as const
      }));

  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
}
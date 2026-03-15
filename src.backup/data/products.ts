export interface CashAndCarryProduct {
  ean: string;
  name: string;
  brand: string;
  supplier: 'Makro' | 'Metro' | 'Transgourmet' | 'Mayorista';
  price: number;
  format: string;
  unit: string;
  pricePerUnit: number;
  category: string;
}

export interface SupplierProduct {
  name: string;
  supplier: string;
  price: number;
  format: string;
  unit: string;
  pricePerUnit: number;
  matchPercentage: number;
}

export interface ProductComparison {
  cashAndCarry: CashAndCarryProduct[];
  bestPrice: CashAndCarryProduct;
  supplierProducts: SupplierProduct[];
  savings: {
    amount: number;
    percentage: number;
  };
}

// Database completo di prodotti Cash & Carry con codici EAN reali
export const cashAndCarryProducts: CashAndCarryProduct[] = [
  // ========== MAKRO ==========
  // Aceites
  {
    ean: '8410000123456',
    name: 'Aceite de Oliva Virgen Extra',
    brand: 'Hacendado',
    supplier: 'Makro',
    price: 8.99,
    format: '1L',
    unit: 'L',
    pricePerUnit: 8.99,
    category: 'Aceites'
  },
  {
    ean: '8410000123457',
    name: 'Aceite de Girasol',
    brand: 'Coosol',
    supplier: 'Makro',
    price: 12.50,
    format: '5L',
    unit: 'L',
    pricePerUnit: 2.50,
    category: 'Aceites'
  },
  // Pasta
  {
    ean: '8480000123457',
    name: 'Pasta Spaghetti',
    brand: 'Barilla',
    supplier: 'Makro',
    price: 1.49,
    format: '500g',
    unit: 'kg',
    pricePerUnit: 2.98,
    category: 'Pasta'
  },
  {
    ean: '8480000123458',
    name: 'Pasta Penne',
    brand: 'Barilla',
    supplier: 'Makro',
    price: 7.45,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 1.49,
    category: 'Pasta'
  },
  {
    ean: '8480000123459',
    name: 'Pasta Fusilli',
    brand: 'De Cecco',
    supplier: 'Makro',
    price: 8.90,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 1.78,
    category: 'Pasta'
  },
  // Arroz
  {
    ean: '8410000234567',
    name: 'Arroz Largo',
    brand: 'SOS',
    supplier: 'Makro',
    price: 2.99,
    format: '1kg',
    unit: 'kg',
    pricePerUnit: 2.99,
    category: 'Arroz'
  },
  {
    ean: '8410000234568',
    name: 'Arroz Basmati',
    brand: 'SOS',
    supplier: 'Makro',
    price: 18.90,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 3.78,
    category: 'Arroz'
  },
  // Conservas
  {
    ean: '8480000345678',
    name: 'Tomate Triturado',
    brand: 'Orlando',
    supplier: 'Makro',
    price: 0.89,
    format: '400g',
    unit: 'kg',
    pricePerUnit: 2.23,
    category: 'Conservas'
  },
  {
    ean: '8480000345679',
    name: 'Tomate Frito',
    brand: 'Orlando',
    supplier: 'Makro',
    price: 8.70,
    format: '3kg',
    unit: 'kg',
    pricePerUnit: 2.90,
    category: 'Conservas'
  },
  {
    ean: '8480000567890',
    name: 'Atún en Aceite',
    brand: 'Calvo',
    supplier: 'Makro',
    price: 1.99,
    format: '3x80g',
    unit: 'kg',
    pricePerUnit: 8.29,
    category: 'Conservas'
  },
  // Lácteos
  {
    ean: '8410000456789',
    name: 'Leche Entera',
    brand: 'Pascual',
    supplier: 'Makro',
    price: 1.19,
    format: '1L',
    unit: 'L',
    pricePerUnit: 1.19,
    category: 'Lácteos'
  },
  {
    ean: '8410000456790',
    name: 'Nata para Cocinar',
    brand: 'Pascual',
    supplier: 'Makro',
    price: 4.50,
    format: '1L',
    unit: 'L',
    pricePerUnit: 4.50,
    category: 'Lácteos'
  },
  // Café
  {
    ean: '8480000789012',
    name: 'Café Molido Natural',
    brand: 'Marcilla',
    supplier: 'Makro',
    price: 3.49,
    format: '250g',
    unit: 'kg',
    pricePerUnit: 13.96,
    category: 'Café'
  },
  {
    ean: '8480000789013',
    name: 'Café en Grano',
    brand: 'Lavazza',
    supplier: 'Makro',
    price: 16.90,
    format: '1kg',
    unit: 'kg',
    pricePerUnit: 16.90,
    category: 'Café'
  },
  // Harinas y Condimentos
  {
    ean: '8410000890123',
    name: 'Harina de Trigo',
    brand: 'Gallo',
    supplier: 'Makro',
    price: 0.99,
    format: '1kg',
    unit: 'kg',
    pricePerUnit: 0.99,
    category: 'Harinas'
  },
  {
    ean: '8480000901234',
    name: 'Sal Marina',
    brand: 'Hacendado',
    supplier: 'Makro',
    price: 0.49,
    format: '1kg',
    unit: 'kg',
    pricePerUnit: 0.49,
    category: 'Condimentos'
  },
  {
    ean: '8410000678901',
    name: 'Azúcar Blanco',
    brand: 'Azucarera',
    supplier: 'Makro',
    price: 1.29,
    format: '1kg',
    unit: 'kg',
    pricePerUnit: 1.29,
    category: 'Azúcar'
  },
  // Bebidas
  {
    ean: '8410000111111',
    name: 'Agua Mineral',
    brand: 'Font Vella',
    supplier: 'Makro',
    price: 3.50,
    format: '6x1.5L',
    unit: 'L',
    pricePerUnit: 0.39,
    category: 'Bebidas'
  },
  {
    ean: '8410000111112',
    name: 'Coca Cola',
    brand: 'Coca Cola',
    supplier: 'Makro',
    price: 12.90,
    format: '12x330ml',
    unit: 'L',
    pricePerUnit: 3.26,
    category: 'Bebidas'
  },

  // ========== METRO ==========
  // Aceites
  {
    ean: '8410000123456',
    name: 'Aceite de Oliva Virgen Extra',
    brand: 'Carbonell',
    supplier: 'Metro',
    price: 8.45,
    format: '1L',
    unit: 'L',
    pricePerUnit: 8.45,
    category: 'Aceites'
  },
  {
    ean: '8410000123457',
    name: 'Aceite de Girasol',
    brand: 'Koipe',
    supplier: 'Metro',
    price: 11.90,
    format: '5L',
    unit: 'L',
    pricePerUnit: 2.38,
    category: 'Aceites'
  },
  {
    ean: '8410000223456',
    name: 'Aceite de Oliva Suave',
    brand: 'Carbonell',
    supplier: 'Metro',
    price: 35.50,
    format: '5L',
    unit: 'L',
    pricePerUnit: 7.10,
    category: 'Aceites'
  },
  // Pasta
  {
    ean: '8480000123457',
    name: 'Pasta Spaghetti',
    brand: 'Barilla',
    supplier: 'Metro',
    price: 1.39,
    format: '500g',
    unit: 'kg',
    pricePerUnit: 2.78,
    category: 'Pasta'
  },
  {
    ean: '8480000123458',
    name: 'Pasta Penne',
    brand: 'Barilla',
    supplier: 'Metro',
    price: 6.95,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 1.39,
    category: 'Pasta'
  },
  {
    ean: '8480000223457',
    name: 'Pasta Rigatoni',
    brand: 'Garofalo',
    supplier: 'Metro',
    price: 9.50,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 1.90,
    category: 'Pasta'
  },
  {
    ean: '8480000223458',
    name: 'Pasta Linguine',
    brand: 'De Cecco',
    supplier: 'Metro',
    price: 8.75,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 1.75,
    category: 'Pasta'
  },
  // Arroz
  {
    ean: '8410000234567',
    name: 'Arroz Largo',
    brand: 'La Fallera',
    supplier: 'Metro',
    price: 2.79,
    format: '1kg',
    unit: 'kg',
    pricePerUnit: 2.79,
    category: 'Arroz'
  },
  {
    ean: '8410000334567',
    name: 'Arroz Bomba',
    brand: 'La Fallera',
    supplier: 'Metro',
    price: 22.50,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 4.50,
    category: 'Arroz'
  },
  {
    ean: '8410000234568',
    name: 'Arroz Basmati',
    brand: 'Tilda',
    supplier: 'Metro',
    price: 17.50,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 3.50,
    category: 'Arroz'
  },
  // Conservas
  {
    ean: '8480000345678',
    name: 'Tomate Triturado',
    brand: 'Mutti',
    supplier: 'Metro',
    price: 0.95,
    format: '400g',
    unit: 'kg',
    pricePerUnit: 2.38,
    category: 'Conservas'
  },
  {
    ean: '8480000345679',
    name: 'Tomate Frito',
    brand: 'Mutti',
    supplier: 'Metro',
    price: 8.40,
    format: '3kg',
    unit: 'kg',
    pricePerUnit: 2.80,
    category: 'Conservas'
  },
  {
    ean: '8480000445678',
    name: 'Tomate Pelado',
    brand: 'Mutti',
    supplier: 'Metro',
    price: 11.70,
    format: '3kg',
    unit: 'kg',
    pricePerUnit: 3.90,
    category: 'Conservas'
  },
  // Lácteos
  {
    ean: '8410000456789',
    name: 'Leche Entera',
    brand: 'Central Lechera Asturiana',
    supplier: 'Metro',
    price: 1.15,
    format: '1L',
    unit: 'L',
    pricePerUnit: 1.15,
    category: 'Lácteos'
  },
  {
    ean: '8410000556789',
    name: 'Leche Semidesnatada',
    brand: 'Central Lechera Asturiana',
    supplier: 'Metro',
    price: 1.09,
    format: '1L',
    unit: 'L',
    pricePerUnit: 1.09,
    category: 'Lácteos'
  },
  {
    ean: '8410000456790',
    name: 'Nata para Cocinar',
    brand: 'President',
    supplier: 'Metro',
    price: 4.25,
    format: '1L',
    unit: 'L',
    pricePerUnit: 4.25,
    category: 'Lácteos'
  },
  // Café
  {
    ean: '8480000789012',
    name: 'Café Molido Natural',
    brand: 'Illy',
    supplier: 'Metro',
    price: 3.75,
    format: '250g',
    unit: 'kg',
    pricePerUnit: 15.00,
    category: 'Café'
  },
  {
    ean: '8480000789013',
    name: 'Café en Grano',
    brand: 'Lavazza',
    supplier: 'Metro',
    price: 15.90,
    format: '1kg',
    unit: 'kg',
    pricePerUnit: 15.90,
    category: 'Café'
  },
  // Bebidas
  {
    ean: '8410000111111',
    name: 'Agua Mineral',
    brand: 'Bezoya',
    supplier: 'Metro',
    price: 3.30,
    format: '6x1.5L',
    unit: 'L',
    pricePerUnit: 0.37,
    category: 'Bebidas'
  },
  {
    ean: '8410000111112',
    name: 'Coca Cola',
    brand: 'Coca Cola',
    supplier: 'Metro',
    price: 12.50,
    format: '12x330ml',
    unit: 'L',
    pricePerUnit: 3.16,
    category: 'Bebidas'
  },

  // ========== TRANSGOURMET ==========
  // Aceites
  {
    ean: '8410000123456',
    name: 'Aceite de Oliva Virgen Extra',
    brand: 'Ybarra',
    supplier: 'Transgourmet',
    price: 8.75,
    format: '1L',
    unit: 'L',
    pricePerUnit: 8.75,
    category: 'Aceites'
  },
  {
    ean: '8410000123457',
    name: 'Aceite de Girasol',
    brand: 'Ybarra',
    supplier: 'Transgourmet',
    price: 12.20,
    format: '5L',
    unit: 'L',
    pricePerUnit: 2.44,
    category: 'Aceites'
  },
  {
    ean: '8410000323456',
    name: 'Aceite de Oliva Intenso',
    brand: 'Hojiblanca',
    supplier: 'Transgourmet',
    price: 42.50,
    format: '5L',
    unit: 'L',
    pricePerUnit: 8.50,
    category: 'Aceites'
  },
  // Pasta
  {
    ean: '8480000123457',
    name: 'Pasta Spaghetti',
    brand: 'Barilla',
    supplier: 'Transgourmet',
    price: 1.45,
    format: '500g',
    unit: 'kg',
    pricePerUnit: 2.90,
    category: 'Pasta'
  },
  {
    ean: '8480000123458',
    name: 'Pasta Penne',
    brand: 'Barilla',
    supplier: 'Transgourmet',
    price: 7.25,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 1.45,
    category: 'Pasta'
  },
  {
    ean: '8480000323457',
    name: 'Pasta Farfalle',
    brand: 'Rummo',
    supplier: 'Transgourmet',
    price: 10.50,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 2.10,
    category: 'Pasta'
  },
  {
    ean: '8480000323458',
    name: 'Pasta Tagliatelle',
    brand: 'Rummo',
    supplier: 'Transgourmet',
    price: 11.25,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 2.25,
    category: 'Pasta'
  },
  // Arroz
  {
    ean: '8410000234567',
    name: 'Arroz Largo',
    brand: 'Brillante',
    supplier: 'Transgourmet',
    price: 2.89,
    format: '1kg',
    unit: 'kg',
    pricePerUnit: 2.89,
    category: 'Arroz'
  },
  {
    ean: '8410000434567',
    name: 'Arroz Integral',
    brand: 'Brillante',
    supplier: 'Transgourmet',
    price: 16.50,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 3.30,
    category: 'Arroz'
  },
  // Conservas
  {
    ean: '8480000345678',
    name: 'Tomate Triturado',
    brand: 'Hida',
    supplier: 'Transgourmet',
    price: 0.85,
    format: '400g',
    unit: 'kg',
    pricePerUnit: 2.13,
    category: 'Conservas'
  },
  {
    ean: '8480000345679',
    name: 'Tomate Frito',
    brand: 'Hida',
    supplier: 'Transgourmet',
    price: 8.55,
    format: '3kg',
    unit: 'kg',
    pricePerUnit: 2.85,
    category: 'Conservas'
  },
  {
    ean: '8480000545678',
    name: 'Pimientos Asados',
    brand: 'Hida',
    supplier: 'Transgourmet',
    price: 14.90,
    format: '3kg',
    unit: 'kg',
    pricePerUnit: 4.97,
    category: 'Conservas'
  },
  // Lácteos
  {
    ean: '8410000456789',
    name: 'Leche Entera',
    brand: 'Kaiku',
    supplier: 'Transgourmet',
    price: 1.12,
    format: '1L',
    unit: 'L',
    pricePerUnit: 1.12,
    category: 'Lácteos'
  },
  {
    ean: '8410000656789',
    name: 'Leche sin Lactosa',
    brand: 'Kaiku',
    supplier: 'Transgourmet',
    price: 1.35,
    format: '1L',
    unit: 'L',
    pricePerUnit: 1.35,
    category: 'Lácteos'
  },
  {
    ean: '8410000456790',
    name: 'Nata para Cocinar',
    brand: 'Elle & Vire',
    supplier: 'Transgourmet',
    price: 4.40,
    format: '1L',
    unit: 'L',
    pricePerUnit: 4.40,
    category: 'Lácteos'
  },
  // Café
  {
    ean: '8480000789012',
    name: 'Café Molido Natural',
    brand: 'Saimaza',
    supplier: 'Transgourmet',
    price: 3.25,
    format: '250g',
    unit: 'kg',
    pricePerUnit: 13.00,
    category: 'Café'
  },
  {
    ean: '8480000789013',
    name: 'Café en Grano',
    brand: 'Lavazza',
    supplier: 'Transgourmet',
    price: 16.50,
    format: '1kg',
    unit: 'kg',
    pricePerUnit: 16.50,
    category: 'Café'
  },
  // Bebidas
  {
    ean: '8410000111111',
    name: 'Agua Mineral',
    brand: 'Solán de Cabras',
    supplier: 'Transgourmet',
    price: 3.60,
    format: '6x1.5L',
    unit: 'L',
    pricePerUnit: 0.40,
    category: 'Bebidas'
  },
  {
    ean: '8410000111112',
    name: 'Coca Cola',
    brand: 'Coca Cola',
    supplier: 'Transgourmet',
    price: 12.75,
    format: '12x330ml',
    unit: 'L',
    pricePerUnit: 3.22,
    category: 'Bebidas'
  },

  // ========== MAYORISTA ==========
  // Aceites
  {
    ean: '8410000123456',
    name: 'Aceite de Oliva Virgen Extra',
    brand: 'La Española',
    supplier: 'Mayorista',
    price: 9.20,
    format: '1L',
    unit: 'L',
    pricePerUnit: 9.20,
    category: 'Aceites'
  },
  {
    ean: '8410000123457',
    name: 'Aceite de Girasol',
    brand: 'La Española',
    supplier: 'Mayorista',
    price: 12.80,
    format: '5L',
    unit: 'L',
    pricePerUnit: 2.56,
    category: 'Aceites'
  },
  {
    ean: '8410000423456',
    name: 'Aceite de Oliva Virgen',
    brand: 'Borges',
    supplier: 'Mayorista',
    price: 38.90,
    format: '5L',
    unit: 'L',
    pricePerUnit: 7.78,
    category: 'Aceites'
  },
  // Pasta
  {
    ean: '8480000123457',
    name: 'Pasta Spaghetti',
    brand: 'Barilla',
    supplier: 'Mayorista',
    price: 1.55,
    format: '500g',
    unit: 'kg',
    pricePerUnit: 3.10,
    category: 'Pasta'
  },
  {
    ean: '8480000123458',
    name: 'Pasta Penne',
    brand: 'Barilla',
    supplier: 'Mayorista',
    price: 7.75,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 1.55,
    category: 'Pasta'
  },
  {
    ean: '8480000423457',
    name: 'Pasta Macarrones',
    brand: 'Gallo',
    supplier: 'Mayorista',
    price: 7.20,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 1.44,
    category: 'Pasta'
  },
  {
    ean: '8480000423458',
    name: 'Pasta Espirales',
    brand: 'Gallo',
    supplier: 'Mayorista',
    price: 7.35,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 1.47,
    category: 'Pasta'
  },
  // Arroz
  {
    ean: '8410000234567',
    name: 'Arroz Largo',
    brand: 'Nomen',
    supplier: 'Mayorista',
    price: 3.10,
    format: '1kg',
    unit: 'kg',
    pricePerUnit: 3.10,
    category: 'Arroz'
  },
  {
    ean: '8410000534567',
    name: 'Arroz Redondo',
    brand: 'Nomen',
    supplier: 'Mayorista',
    price: 14.50,
    format: '5kg',
    unit: 'kg',
    pricePerUnit: 2.90,
    category: 'Arroz'
  },
  // Conservas
  {
    ean: '8480000345678',
    name: 'Tomate Triturado',
    brand: 'Apis',
    supplier: 'Mayorista',
    price: 0.92,
    format: '400g',
    unit: 'kg',
    pricePerUnit: 2.30,
    category: 'Conservas'
  },
  {
    ean: '8480000345679',
    name: 'Tomate Frito',
    brand: 'Apis',
    supplier: 'Mayorista',
    price: 8.85,
    format: '3kg',
    unit: 'kg',
    pricePerUnit: 2.95,
    category: 'Conservas'
  },
  {
    ean: '8480000645678',
    name: 'Garbanzos Cocidos',
    brand: 'Apis',
    supplier: 'Mayorista',
    price: 9.90,
    format: '3kg',
    unit: 'kg',
    pricePerUnit: 3.30,
    category: 'Conservas'
  },
  // Lácteos
  {
    ean: '8410000456789',
    name: 'Leche Entera',
    brand: 'Covap',
    supplier: 'Mayorista',
    price: 1.25,
    format: '1L',
    unit: 'L',
    pricePerUnit: 1.25,
    category: 'Lácteos'
  },
  {
    ean: '8410000756789',
    name: 'Leche Desnatada',
    brand: 'Covap',
    supplier: 'Mayorista',
    price: 1.20,
    format: '1L',
    unit: 'L',
    pricePerUnit: 1.20,
    category: 'Lácteos'
  },
  {
    ean: '8410000456790',
    name: 'Nata para Cocinar',
    brand: 'Clesa',
    supplier: 'Mayorista',
    price: 4.60,
    format: '1L',
    unit: 'L',
    pricePerUnit: 4.60,
    category: 'Lácteos'
  },
  // Café
  {
    ean: '8480000789012',
    name: 'Café Molido Natural',
    brand: 'Bonka',
    supplier: 'Mayorista',
    price: 3.60,
    format: '250g',
    unit: 'kg',
    pricePerUnit: 14.40,
    category: 'Café'
  },
  {
    ean: '8480000789013',
    name: 'Café en Grano',
    brand: 'Lavazza',
    supplier: 'Mayorista',
    price: 17.20,
    format: '1kg',
    unit: 'kg',
    pricePerUnit: 17.20,
    category: 'Café'
  },
  // Bebidas
  {
    ean: '8410000111111',
    name: 'Agua Mineral',
    brand: 'Aquabona',
    supplier: 'Mayorista',
    price: 3.75,
    format: '6x1.5L',
    unit: 'L',
    pricePerUnit: 0.42,
    category: 'Bebidas'
  },
  {
    ean: '8410000111112',
    name: 'Coca Cola',
    brand: 'Coca Cola',
    supplier: 'Mayorista',
    price: 13.20,
    format: '12x330ml',
    unit: 'L',
    pricePerUnit: 3.33,
    category: 'Bebidas'
  },
  // Harinas y Condimentos
  {
    ean: '8410000890123',
    name: 'Harina de Trigo',
    brand: 'Harimsa',
    supplier: 'Mayorista',
    price: 1.05,
    format: '1kg',
    unit: 'kg',
    pricePerUnit: 1.05,
    category: 'Harinas'
  },
  {
    ean: '8480000901234',
    name: 'Sal Marina',
    brand: 'Sal Costa',
    supplier: 'Mayorista',
    price: 0.55,
    format: '1kg',
    unit: 'kg',
    pricePerUnit: 0.55,
    category: 'Condimentos'
  },
  {
    ean: '8410000678901',
    name: 'Azúcar Blanco',
    brand: 'Acor',
    supplier: 'Mayorista',
    price: 1.35,
    format: '1kg',
    unit: 'kg',
    pricePerUnit: 1.35,
    category: 'Azúcar'
  }
];

// Simula prodotti dei fornitori per confronto
export const getSupplierProducts = (cashAndCarryProduct: CashAndCarryProduct): SupplierProduct[] => {
  const basePrice = cashAndCarryProduct.pricePerUnit;
  
  return [
    {
      name: cashAndCarryProduct.name,
      supplier: 'Oleificio Rossi',
      price: basePrice * 0.78 * 5,
      format: '5L',
      unit: cashAndCarryProduct.unit,
      pricePerUnit: basePrice * 0.78,
      matchPercentage: 95
    },
    {
      name: `${cashAndCarryProduct.name} Biologico`,
      supplier: 'Bio Italia',
      price: basePrice * 1.06 * 3,
      format: '3L',
      unit: cashAndCarryProduct.unit,
      pricePerUnit: basePrice * 1.06,
      matchPercentage: 78
    },
    {
      name: `${cashAndCarryProduct.name.split(' ')[0]} Classico`,
      supplier: 'Fornitore Locale',
      price: basePrice * 0.69 * 10,
      format: '10L',
      unit: cashAndCarryProduct.unit,
      pricePerUnit: basePrice * 0.69,
      matchPercentage: 65
    }
  ];
};

export const searchProductByEAN = (
  ean: string, 
  selectedSupplier: 'Tutti' | 'Makro' | 'Metro' | 'Transgourmet' | 'Mayorista' = 'Tutti'
): CashAndCarryProduct[] => {
  let results = cashAndCarryProducts.filter(product => product.ean === ean);
  
  if (selectedSupplier !== 'Tutti') {
    results = results.filter(product => product.supplier === selectedSupplier);
  }
  
  return results;
};

export const getProductComparison = (
  ean: string,
  selectedSupplier: 'Tutti' | 'Makro' | 'Metro' | 'Transgourmet' | 'Mayorista' = 'Tutti'
): ProductComparison | null => {
  const cashAndCarryMatches = searchProductByEAN(ean, selectedSupplier);
  
  if (cashAndCarryMatches.length === 0) {
    return null;
  }
  
  // Trova il prodotto con il prezzo migliore
  const bestPrice = cashAndCarryMatches.reduce((min, product) => 
    product.pricePerUnit < min.pricePerUnit ? product : min
  );
  
  const supplierProducts = getSupplierProducts(bestPrice);
  const bestSupplierPrice = Math.min(...supplierProducts.map(p => p.pricePerUnit));
  const savingsAmount = bestPrice.pricePerUnit - bestSupplierPrice;
  const savingsPercentage = Math.round((savingsAmount / bestPrice.pricePerUnit) * 100);
  
  return {
    cashAndCarry: cashAndCarryMatches,
    bestPrice,
    supplierProducts,
    savings: {
      amount: savingsAmount,
      percentage: savingsPercentage
    }
  };
};

export const getAllSuppliers = (): Array<'Tutti' | 'Makro' | 'Metro' | 'Transgourmet' | 'Mayorista'> => {
  return ['Tutti', 'Makro', 'Metro', 'Transgourmet', 'Mayorista'];
};

export const getSupplierStats = () => {
  const stats = {
    Makro: { count: 0, categories: new Set<string>() },
    Metro: { count: 0, categories: new Set<string>() },
    Transgourmet: { count: 0, categories: new Set<string>() },
    Mayorista: { count: 0, categories: new Set<string>() }
  };
  
  cashAndCarryProducts.forEach(product => {
    stats[product.supplier].count++;
    stats[product.supplier].categories.add(product.category);
  });
  
  return stats;
};
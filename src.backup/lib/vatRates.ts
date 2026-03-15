import { VATCategory } from '@/types';

export interface CountryVATRates {
  code: string;
  name: string;
  flag: string;
  rates: {
    [key in VATCategory]: number;
  };
  categories: {
    [category: string]: VATCategory;
  };
}

export const VAT_RATES: Record<string, CountryVATRates> = {
  IT: {
    code: 'IT',
    name: 'Italia',
    flag: '🇮🇹',
    rates: {
      essential: 4,   // Pane, farina, latte, pasta
      reduced: 10,    // Carne, pesce, ristoranti
      standard: 22,   // Altri prodotti
    },
    categories: {
      'PANE': 'essential', 'BREAD': 'essential',
      'FARINA': 'essential', 'FLOUR': 'essential',
      'LATTE': 'essential', 'MILK': 'essential',
      'PASTA': 'essential',
      'RISO': 'essential', 'RICE': 'essential',
      'CARNE': 'reduced', 'MEAT': 'reduced',
      'PESCE': 'reduced', 'FISH': 'reduced',
      'FORMAGGIO': 'reduced', 'CHEESE': 'reduced',
      'SALUMI': 'reduced',
      'VERDURA': 'reduced', 'VEGETABLES': 'reduced',
      'FRUTTA': 'reduced', 'FRUITS': 'reduced',
      'BEVANDE': 'standard', 'BEVERAGES': 'standard',
      'VINO': 'standard', 'WINE': 'standard',
      'OLIO': 'reduced', 'OIL': 'reduced',
      'CONSERVE': 'reduced', 'CANNED': 'reduced',
      'SURGELATI': 'reduced', 'FROZEN': 'reduced',
      'DOLCI': 'standard', 'SWEETS': 'standard',
      'ALTRO': 'standard', 'OTHER': 'standard',
    },
  },
  ES: {
    code: 'ES',
    name: 'España',
    flag: '🇪🇸',
    rates: {
      essential: 4,   // Pan, harina, leche
      reduced: 10,    // Alimentos básicos
      standard: 21,   // Otros productos
    },
    categories: {
      'PAN': 'essential', 'BREAD': 'essential',
      'HARINA': 'essential', 'FLOUR': 'essential',
      'LECHE': 'essential', 'MILK': 'essential',
      'PASTA': 'reduced',
      'ARROZ': 'reduced', 'RICE': 'reduced',
      'CARNE': 'reduced', 'MEAT': 'reduced',
      'PESCADO': 'reduced', 'FISH': 'reduced',
      'QUESO': 'reduced', 'CHEESE': 'reduced',
      'EMBUTIDOS': 'reduced',
      'VERDURAS': 'reduced', 'VEGETABLES': 'reduced',
      'FRUTAS': 'reduced', 'FRUITS': 'reduced',
      'BEBIDAS': 'standard', 'BEVERAGES': 'standard',
      'VINO': 'reduced', 'WINE': 'reduced',
      'ACEITE': 'reduced', 'OIL': 'reduced',
      'CONSERVAS': 'reduced', 'CANNED': 'reduced',
      'CONGELADOS': 'reduced', 'FROZEN': 'reduced',
      'DULCES': 'standard', 'SWEETS': 'standard',
      'OTRO': 'standard', 'OTHER': 'standard',
    },
  },
  FR: {
    code: 'FR',
    name: 'France',
    flag: '🇫🇷',
    rates: {
      essential: 5.5,  // Aliments de base
      reduced: 10,     // Restaurants
      standard: 20,    // Autres produits
    },
    categories: {
      'PAIN': 'essential', 'BREAD': 'essential',
      'FARINE': 'essential', 'FLOUR': 'essential',
      'LAIT': 'essential', 'MILK': 'essential',
      'PÂTES': 'essential', 'PASTA': 'essential',
      'RIZ': 'essential', 'RICE': 'essential',
      'VIANDE': 'essential', 'MEAT': 'essential',
      'POISSON': 'essential', 'FISH': 'essential',
      'FROMAGE': 'essential', 'CHEESE': 'essential',
      'CHARCUTERIE': 'essential',
      'LÉGUMES': 'essential', 'VEGETABLES': 'essential',
      'FRUITS': 'essential',
      'BOISSONS': 'standard', 'BEVERAGES': 'standard',
      'VIN': 'standard', 'WINE': 'standard',
      'HUILE': 'essential', 'OIL': 'essential',
      'CONSERVES': 'essential', 'CANNED': 'essential',
      'SURGELÉS': 'essential', 'FROZEN': 'essential',
      'DESSERTS': 'essential', 'SWEETS': 'essential',
      'AUTRE': 'standard', 'OTHER': 'standard',
    },
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    rates: {
      essential: 0,    // Zero-rated food
      reduced: 5,      // Reduced rate
      standard: 20,    // Standard rate
    },
    categories: {
      'BREAD': 'essential',
      'FLOUR': 'essential',
      'MILK': 'essential',
      'PASTA': 'essential',
      'RICE': 'essential',
      'MEAT': 'essential',
      'FISH': 'essential',
      'CHEESE': 'essential',
      'VEGETABLES': 'essential',
      'FRUITS': 'essential',
      'BEVERAGES': 'standard',
      'WINE': 'standard',
      'OIL': 'essential',
      'CANNED': 'essential',
      'FROZEN': 'essential',
      'SWEETS': 'standard',
      'OTHER': 'standard',
    },
  },
  DE: {
    code: 'DE',
    name: 'Deutschland',
    flag: '🇩🇪',
    rates: {
      essential: 7,    // Lebensmittel
      reduced: 7,      // Reduced rate
      standard: 19,    // Standard rate
    },
    categories: {
      'BROT': 'essential', 'BREAD': 'essential',
      'MEHL': 'essential', 'FLOUR': 'essential',
      'MILCH': 'essential', 'MILK': 'essential',
      'NUDELN': 'essential', 'PASTA': 'essential',
      'REIS': 'essential', 'RICE': 'essential',
      'FLEISCH': 'essential', 'MEAT': 'essential',
      'FISCH': 'essential', 'FISH': 'essential',
      'KÄSE': 'essential', 'CHEESE': 'essential',
      'GEMÜSE': 'essential', 'VEGETABLES': 'essential',
      'OBST': 'essential', 'FRUITS': 'essential',
      'GETRÄNKE': 'standard', 'BEVERAGES': 'standard',
      'WEIN': 'standard', 'WINE': 'standard',
      'ÖL': 'essential', 'OIL': 'essential',
      'KONSERVEN': 'essential', 'CANNED': 'essential',
      'TIEFKÜHL': 'essential', 'FROZEN': 'essential',
      'SÜSSWAREN': 'standard', 'SWEETS': 'standard',
      'ANDERE': 'standard', 'OTHER': 'standard',
    },
  },
  US: {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    rates: {
      essential: 0,    // No federal VAT
      reduced: 0,      // No federal VAT
      standard: 0,     // No federal VAT (state sales tax varies)
    },
    categories: {
      'BREAD': 'essential', 'PANE': 'essential',
      'FLOUR': 'essential', 'FARINA': 'essential',
      'MILK': 'essential', 'LATTE': 'essential',
      'PASTA': 'essential',
      'RICE': 'essential', 'RISO': 'essential',
      'MEAT': 'essential', 'CARNE': 'essential',
      'FISH': 'essential', 'PESCE': 'essential',
      'CHEESE': 'essential', 'FORMAGGIO': 'essential',
      'VEGETABLES': 'essential', 'VERDURA': 'essential',
      'FRUITS': 'essential', 'FRUTTA': 'essential',
      'BEVERAGES': 'standard', 'BEVANDE': 'standard',
      'WINE': 'standard', 'VINO': 'standard',
      'OIL': 'essential', 'OLIO': 'essential',
      'CANNED': 'essential', 'CONSERVE': 'essential',
      'FROZEN': 'essential', 'SURGELATI': 'essential',
      'SWEETS': 'standard', 'DOLCI': 'standard',
      'OTHER': 'standard', 'ALTRO': 'standard',
    },
  },
  LT: {
    code: 'LT',
    name: 'Lietuva',
    flag: '🇱🇹',
    rates: {
      essential: 5,    // Maisto produktai
      reduced: 9,      // Reduced rate
      standard: 21,    // Standard rate
    },
    categories: {
      'DUONA': 'essential', 'BREAD': 'essential',
      'MILTAI': 'essential', 'FLOUR': 'essential',
      'PIENAS': 'essential', 'MILK': 'essential',
      'MAKARONAI': 'essential', 'PASTA': 'essential',
      'RYŽIAI': 'essential', 'RICE': 'essential',
      'MĖSA': 'essential', 'MEAT': 'essential',
      'ŽUVIS': 'essential', 'FISH': 'essential',
      'SŪRIS': 'essential', 'CHEESE': 'essential',
      'DARŽOVĖS': 'essential', 'VEGETABLES': 'essential',
      'VAISIAI': 'essential', 'FRUITS': 'essential',
      'GĖRIMAI': 'standard', 'BEVERAGES': 'standard',
      'VYNAS': 'standard', 'WINE': 'standard',
      'ALIEJUS': 'essential', 'OIL': 'essential',
      'KONSERVAI': 'essential', 'CANNED': 'essential',
      'ŠALDYTI': 'essential', 'FROZEN': 'essential',
      'SALDUMYNAI': 'standard', 'SWEETS': 'standard',
      'KITA': 'standard', 'OTHER': 'standard',
    },
  },
  // Additional EU countries
  PT: {
    code: 'PT',
    name: 'Portugal',
    flag: '🇵🇹',
    rates: { essential: 6, reduced: 13, standard: 23 },
    categories: {
      'BREAD': 'essential', 'FLOUR': 'essential', 'MILK': 'essential',
      'PASTA': 'essential', 'RICE': 'essential', 'MEAT': 'reduced',
      'FISH': 'reduced', 'CHEESE': 'reduced', 'VEGETABLES': 'essential',
      'FRUITS': 'essential', 'BEVERAGES': 'standard', 'WINE': 'reduced',
      'OIL': 'essential', 'CANNED': 'reduced', 'FROZEN': 'reduced',
      'SWEETS': 'standard', 'OTHER': 'standard',
    },
  },
  NL: {
    code: 'NL',
    name: 'Netherlands',
    flag: '🇳🇱',
    rates: { essential: 0, reduced: 9, standard: 21 },
    categories: {
      'BREAD': 'essential', 'FLOUR': 'essential', 'MILK': 'essential',
      'PASTA': 'essential', 'RICE': 'essential', 'MEAT': 'reduced',
      'FISH': 'reduced', 'CHEESE': 'reduced', 'VEGETABLES': 'reduced',
      'FRUITS': 'reduced', 'BEVERAGES': 'standard', 'WINE': 'standard',
      'OIL': 'reduced', 'CANNED': 'reduced', 'FROZEN': 'reduced',
      'SWEETS': 'standard', 'OTHER': 'standard',
    },
  },
  BE: {
    code: 'BE',
    name: 'Belgium',
    flag: '🇧🇪',
    rates: { essential: 6, reduced: 12, standard: 21 },
    categories: {
      'BREAD': 'essential', 'FLOUR': 'essential', 'MILK': 'essential',
      'PASTA': 'essential', 'RICE': 'essential', 'MEAT': 'essential',
      'FISH': 'essential', 'CHEESE': 'essential', 'VEGETABLES': 'essential',
      'FRUITS': 'essential', 'BEVERAGES': 'standard', 'WINE': 'reduced',
      'OIL': 'essential', 'CANNED': 'essential', 'FROZEN': 'essential',
      'SWEETS': 'standard', 'OTHER': 'standard',
    },
  },
  AT: {
    code: 'AT',
    name: 'Austria',
    flag: '🇦🇹',
    rates: { essential: 10, reduced: 13, standard: 20 },
    categories: {
      'BREAD': 'essential', 'FLOUR': 'essential', 'MILK': 'essential',
      'PASTA': 'essential', 'RICE': 'essential', 'MEAT': 'essential',
      'FISH': 'essential', 'CHEESE': 'essential', 'VEGETABLES': 'essential',
      'FRUITS': 'essential', 'BEVERAGES': 'standard', 'WINE': 'reduced',
      'OIL': 'essential', 'CANNED': 'essential', 'FROZEN': 'essential',
      'SWEETS': 'standard', 'OTHER': 'standard',
    },
  },
  PL: {
    code: 'PL',
    name: 'Poland',
    flag: '🇵🇱',
    rates: { essential: 5, reduced: 8, standard: 23 },
    categories: {
      'BREAD': 'essential', 'FLOUR': 'essential', 'MILK': 'essential',
      'PASTA': 'essential', 'RICE': 'essential', 'MEAT': 'reduced',
      'FISH': 'reduced', 'CHEESE': 'reduced', 'VEGETABLES': 'reduced',
      'FRUITS': 'reduced', 'BEVERAGES': 'standard', 'WINE': 'standard',
      'OIL': 'reduced', 'CANNED': 'reduced', 'FROZEN': 'reduced',
      'SWEETS': 'standard', 'OTHER': 'standard',
    },
  },
  SE: {
    code: 'SE',
    name: 'Sweden',
    flag: '🇸🇪',
    rates: { essential: 6, reduced: 12, standard: 25 },
    categories: {
      'BREAD': 'reduced', 'FLOUR': 'reduced', 'MILK': 'reduced',
      'PASTA': 'reduced', 'RICE': 'reduced', 'MEAT': 'reduced',
      'FISH': 'reduced', 'CHEESE': 'reduced', 'VEGETABLES': 'reduced',
      'FRUITS': 'reduced', 'BEVERAGES': 'standard', 'WINE': 'standard',
      'OIL': 'reduced', 'CANNED': 'reduced', 'FROZEN': 'reduced',
      'SWEETS': 'standard', 'OTHER': 'standard',
    },
  },
  DK: {
    code: 'DK',
    name: 'Denmark',
    flag: '🇩🇰',
    rates: { essential: 0, reduced: 0, standard: 25 },
    categories: {
      'BREAD': 'standard', 'FLOUR': 'standard', 'MILK': 'standard',
      'PASTA': 'standard', 'RICE': 'standard', 'MEAT': 'standard',
      'FISH': 'standard', 'CHEESE': 'standard', 'VEGETABLES': 'standard',
      'FRUITS': 'standard', 'BEVERAGES': 'standard', 'WINE': 'standard',
      'OIL': 'standard', 'CANNED': 'standard', 'FROZEN': 'standard',
      'SWEETS': 'standard', 'OTHER': 'standard',
    },
  },
  GR: {
    code: 'GR',
    name: 'Greece',
    flag: '🇬🇷',
    rates: { essential: 6, reduced: 13, standard: 24 },
    categories: {
      'BREAD': 'reduced', 'FLOUR': 'reduced', 'MILK': 'reduced',
      'PASTA': 'reduced', 'RICE': 'reduced', 'MEAT': 'reduced',
      'FISH': 'reduced', 'CHEESE': 'reduced', 'VEGETABLES': 'reduced',
      'FRUITS': 'reduced', 'BEVERAGES': 'standard', 'WINE': 'reduced',
      'OIL': 'reduced', 'CANNED': 'reduced', 'FROZEN': 'reduced',
      'SWEETS': 'standard', 'OTHER': 'standard',
    },
  },
  IE: {
    code: 'IE',
    name: 'Ireland',
    flag: '🇮🇪',
    rates: { essential: 0, reduced: 9, standard: 23 },
    categories: {
      'BREAD': 'essential', 'FLOUR': 'essential', 'MILK': 'essential',
      'PASTA': 'essential', 'RICE': 'essential', 'MEAT': 'essential',
      'FISH': 'essential', 'CHEESE': 'essential', 'VEGETABLES': 'essential',
      'FRUITS': 'essential', 'BEVERAGES': 'standard', 'WINE': 'standard',
      'OIL': 'essential', 'CANNED': 'essential', 'FROZEN': 'essential',
      'SWEETS': 'standard', 'OTHER': 'standard',
    },
  },
  // Non-EU European
  CH: {
    code: 'CH',
    name: 'Switzerland',
    flag: '🇨🇭',
    rates: { essential: 2.5, reduced: 2.5, standard: 7.7 },
    categories: {
      'BREAD': 'reduced', 'FLOUR': 'reduced', 'MILK': 'reduced',
      'PASTA': 'reduced', 'RICE': 'reduced', 'MEAT': 'reduced',
      'FISH': 'reduced', 'CHEESE': 'reduced', 'VEGETABLES': 'reduced',
      'FRUITS': 'reduced', 'BEVERAGES': 'standard', 'WINE': 'standard',
      'OIL': 'reduced', 'CANNED': 'reduced', 'FROZEN': 'reduced',
      'SWEETS': 'standard', 'OTHER': 'standard',
    },
  },
  NO: {
    code: 'NO',
    name: 'Norway',
    flag: '🇳🇴',
    rates: { essential: 0, reduced: 15, standard: 25 },
    categories: {
      'BREAD': 'reduced', 'FLOUR': 'reduced', 'MILK': 'reduced',
      'PASTA': 'reduced', 'RICE': 'reduced', 'MEAT': 'reduced',
      'FISH': 'reduced', 'CHEESE': 'reduced', 'VEGETABLES': 'reduced',
      'FRUITS': 'reduced', 'BEVERAGES': 'standard', 'WINE': 'standard',
      'OIL': 'reduced', 'CANNED': 'reduced', 'FROZEN': 'reduced',
      'SWEETS': 'standard', 'OTHER': 'standard',
    },
  },
  // Americas
  CA: {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    rates: { essential: 0, reduced: 0, standard: 5 },
    categories: {
      'BREAD': 'essential', 'FLOUR': 'essential', 'MILK': 'essential',
      'PASTA': 'essential', 'RICE': 'essential', 'MEAT': 'essential',
      'FISH': 'essential', 'CHEESE': 'essential', 'VEGETABLES': 'essential',
      'FRUITS': 'essential', 'BEVERAGES': 'standard', 'WINE': 'standard',
      'OIL': 'essential', 'CANNED': 'essential', 'FROZEN': 'essential',
      'SWEETS': 'standard', 'OTHER': 'standard',
    },
  },
  MX: {
    code: 'MX',
    name: 'Mexico',
    flag: '🇲🇽',
    rates: { essential: 0, reduced: 0, standard: 16 },
    categories: {
      'BREAD': 'essential', 'FLOUR': 'essential', 'MILK': 'essential',
      'PASTA': 'essential', 'RICE': 'essential', 'MEAT': 'essential',
      'FISH': 'essential', 'CHEESE': 'essential', 'VEGETABLES': 'essential',
      'FRUITS': 'essential', 'BEVERAGES': 'standard', 'WINE': 'standard',
      'OIL': 'essential', 'CANNED': 'essential', 'FROZEN': 'essential',
      'SWEETS': 'standard', 'OTHER': 'standard',
    },
  },
  // Asia-Pacific
  AU: {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    rates: { essential: 0, reduced: 0, standard: 10 },
    categories: {
      'BREAD': 'essential', 'FLOUR': 'essential', 'MILK': 'essential',
      'PASTA': 'essential', 'RICE': 'essential', 'MEAT': 'essential',
      'FISH': 'essential', 'CHEESE': 'essential', 'VEGETABLES': 'essential',
      'FRUITS': 'essential', 'BEVERAGES': 'standard', 'WINE': 'standard',
      'OIL': 'essential', 'CANNED': 'essential', 'FROZEN': 'essential',
      'SWEETS': 'standard', 'OTHER': 'standard',
    },
  },
  JP: {
    code: 'JP',
    name: 'Japan',
    flag: '🇯🇵',
    rates: { essential: 8, reduced: 8, standard: 10 },
    categories: {
      'BREAD': 'reduced', 'FLOUR': 'reduced', 'MILK': 'reduced',
      'PASTA': 'reduced', 'RICE': 'reduced', 'MEAT': 'reduced',
      'FISH': 'reduced', 'CHEESE': 'reduced', 'VEGETABLES': 'reduced',
      'FRUITS': 'reduced', 'BEVERAGES': 'standard', 'WINE': 'standard',
      'OIL': 'reduced', 'CANNED': 'reduced', 'FROZEN': 'reduced',
      'SWEETS': 'standard', 'OTHER': 'standard',
    },
  },
};

export function getVATRateForProduct(country: string, category?: string): number {
  const countryData = VAT_RATES[country] || VAT_RATES.IT;
  
  if (!category) {
    return countryData.rates.standard;
  }

  const categoryUpper = category.toUpperCase();
  const vatCategory = countryData.categories[categoryUpper] || 'standard';
  return countryData.rates[vatCategory];
}

export function calculatePriceWithVAT(price: number, vatRate: number): number {
  return price * (1 + vatRate / 100);
}

export function calculateVATAmount(price: number, vatRate: number): number {
  return price * (vatRate / 100);
}

export function getCountries(): CountryVATRates[] {
  return Object.values(VAT_RATES);
}
// Phone prefix utilities for international phone numbers

export interface CountryPhoneData {
  code: string;
  name: string;
  prefix: string;
  flag: string;
}

export const COUNTRY_PHONE_PREFIXES: Record<string, CountryPhoneData> = {
  IT: { code: 'IT', name: 'Italia', prefix: '+39', flag: '🇮🇹' },
  ES: { code: 'ES', name: 'España', prefix: '+34', flag: '🇪🇸' },
  FR: { code: 'FR', name: 'France', prefix: '+33', flag: '🇫🇷' },
  DE: { code: 'DE', name: 'Deutschland', prefix: '+49', flag: '🇩🇪' },
  LT: { code: 'LT', name: 'Lietuva', prefix: '+370', flag: '🇱🇹' },
  GB: { code: 'GB', name: 'United Kingdom', prefix: '+44', flag: '🇬🇧' },
  US: { code: 'US', name: 'United States', prefix: '+1', flag: '🇺🇸' },
  PT: { code: 'PT', name: 'Portugal', prefix: '+351', flag: '🇵🇹' },
  GR: { code: 'GR', name: 'Greece', prefix: '+30', flag: '🇬🇷' },
  PL: { code: 'PL', name: 'Poland', prefix: '+48', flag: '🇵🇱' },
};

/**
 * Get phone prefix for a country code
 */
export function getPhonePrefix(countryCode: string): string {
  return COUNTRY_PHONE_PREFIXES[countryCode]?.prefix || '+39';
}

/**
 * Format phone number with country prefix
 */
export function formatPhoneWithPrefix(phone: string, countryCode: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // If already has a prefix, return as is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // Get prefix for country
  const prefix = getPhonePrefix(countryCode);
  
  // Add prefix
  return `${prefix}${cleaned}`;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  
  // Remove all non-numeric characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Must start with + and have at least 8 digits
  return /^\+\d{8,}$/.test(cleaned);
}

/**
 * Get display format for phone number (with spaces for readability)
 */
export function getPhoneDisplayFormat(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Format: +XX XXX XXX XXX
  if (cleaned.startsWith('+')) {
    const prefix = cleaned.substring(0, cleaned.length > 10 ? 4 : 3);
    const rest = cleaned.substring(prefix.length);
    
    // Split rest into groups of 3
    const groups = rest.match(/.{1,3}/g) || [];
    return `${prefix} ${groups.join(' ')}`;
  }
  
  return cleaned;
}
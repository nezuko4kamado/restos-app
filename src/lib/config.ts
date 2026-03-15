// Configuration management for the application
// UPDATED: Removed all localStorage usage - API keys now use environment variables only

// Try to get API key from environment variable
const ENV_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const DEFAULT_API_KEY = ENV_API_KEY || 'AIzaSyCovh7lc2BECIkfc0sEQ-MeqJEhJZlKqzo';

export interface AppConfig {
  googleApiKey?: string;
}

// Default configuration with the API key
const DEFAULT_CONFIG: AppConfig = {
  googleApiKey: DEFAULT_API_KEY,
};

export const getConfig = (): AppConfig => {
  // Always return default config from environment
  return DEFAULT_CONFIG;
};

export const saveConfig = (config: AppConfig): void => {
  // No-op: Config is now read-only from environment variables
  console.warn('⚠️ Config is read-only. API keys must be set via environment variables.');
};

// Export for backward compatibility with ocrService.ts
export const getGeminiApiKey = (): string => {
  const apiKey = DEFAULT_API_KEY;
  
  // Log warning if no API key is configured
  if (!apiKey || apiKey === 'your_google_gemini_api_key_here') {
    console.warn('⚠️ Google Gemini API key not configured. OCR features may not work.');
  }
  
  return apiKey;
};

export const setGeminiApiKey = (apiKey: string): void => {
  // No-op: API keys must be set via environment variables
  console.warn('⚠️ API keys are read-only. Please set VITE_GOOGLE_API_KEY in your environment.');
};

export const clearGeminiApiKey = (): void => {
  // No-op: API keys must be set via environment variables
  console.warn('⚠️ API keys are read-only. Cannot clear environment variable.');
};

export const hasCustomApiKey = (): boolean => {
  return !!ENV_API_KEY;
};

export const getGoogleApiKey = (): string => {
  return getGeminiApiKey();
};

export const isApiKeyConfigured = (): boolean => {
  const apiKey = getGeminiApiKey();
  return !!apiKey && apiKey !== 'your_google_gemini_api_key_here';
};
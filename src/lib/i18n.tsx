// Internationalization system for the restaurant management app
// Supports Italian, English, Spanish, French, German, and Lithuanian

import { createContext, useContext, useState, ReactNode } from 'react';

// Import translation files
import itTranslations from '../locales/it.json';
import enTranslations from '../locales/en.json';
import esTranslations from '../locales/es.json';
import frTranslations from '../locales/fr.json';
import deTranslations from '../locales/de.json';
import ltTranslations from '../locales/lt.json';

// Twinr mobile app bridge for language switching
declare global {
  interface Window {
    twinr_language_onchange?: (languageCode: string) => void;
  }
}

export type Language = 'it' | 'en' | 'es' | 'fr' | 'de' | 'lt';

// Type for translation object
type TranslationObject = Record<string, string | TranslationObject>;

// Type for translation function that supports nested keys
type TranslationFunction = (key: string, params?: Record<string, string | number>) => string;

export interface Translations {
  appTitle: string;
  demoMode: string;
  dataSavedLocally: string;
  clearData: string;
  clearDataConfirm: string;
  dataCleared: string;
  clearDataDialogTitle: string;
  clearDataDialogMessage: string;
  yes: string;
  no: string;
  products: string;
  suppliers: string;
  orders: string;
  notifications: string;
  dashboard: string;
  settings: string;
  login: string;
  register: string;
  loginTitle: string;
  registerTitle: string;
  loginDescription: string;
  registerDescription: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  confirmPasswordPlaceholder: string;
  loginButton: string;
  registerButton: string;
  noAccount: string;
  hasAccount: string;
  dataSyncedCloud: string;
  enterEmailPassword: string;
  passwordsDontMatch: string;
  passwordMinLength: string;
  emailOrPasswordIncorrect: string;
  emailAlreadyRegistered: string;
  registrationComplete: string;
  authError: string;
  loading: string;
  selectLanguage: string;
  emailConfirmationNotice: string;
  productsList: string;
  addProduct: string;
  editProduct: string;
  deleteProduct: string;
  productName: string;
  category: string;
  supplier: string;
  price: string;
  unit: string;
  lastPrice: string;
  priceHistory: string;
  actions: string;
  noProducts: string;
  addFirstProduct: string;
  productAdded: string;
  productUpdated: string;
  productDeleted: string;
  deleteProductConfirm: string;
  save: string;
  cancel: string;
  selectSupplier: string;
  detectedCategory: string;
  export: string;
  exportExcel: string;
  exportPDF: string;
  saveInvoiceIn: string;
  savePDF: string;
  beverages: string;
  meat: string;
  fish: string;
  vegetables: string;
  fruit: string;
  breadCereals: string;
  dairy: string;
  sweets: string;
  condiments: string;
  other: string;
  suppliersList: string;
  addSupplier: string;
  editSupplier: string;
  deleteSupplier: string;
  supplierName: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  noSuppliers: string;
  addFirstSupplier: string;
  supplierAdded: string;
  supplierUpdated: string;
  supplierDeleted: string;
  deleteSupplierConfirm: string;
  supplierAlreadyExists: string;
  mobile: string;
  together: string;
  supplierDeletedWithInvoices: string;
  ordersList: string;
  addOrder: string;
  editOrder: string;
  deleteOrder: string;
  orderDate: string;
  totalAmount: string;
  status: string;
  recurring: string;
  frequency: string;
  nextOrder: string;
  noOrders: string;
  addFirstOrder: string;
  orderAdded: string;
  orderUpdated: string;
  orderDeleted: string;
  deleteOrderConfirm: string;
  selectProducts: string;
  quantity: string;
  uploadInvoice: string;
  uploadOrder: string;
  searchProducts: string;
  createOrderMode: string;
  createNewOrder: string;
  uploadOrderDescription: string;
  importFromPhoto: string;
  productNameLabel: string;
  supplierLabel: string;
  selectSupplierPlaceholder: string;
  supplierNamePlaceholder: string;
  whatsappPlaceholder: string;
  emailOptionalPlaceholder: string;
  create: string;
  cancelCreation: string;
  pending: string;
  completed: string;
  cancelled: string;
  daily: string;
  weekly: string;
  monthly: string;
  generalSettings: string;
  configurePreferences: string;
  country: string;
  language: string;
  notificationSettings: string;
  manageAlertsReminders: string;
  priceChangeAlerts: string;
  priceChangeAlertsDesc: string;
  changeThreshold: string;
  changeThresholdDesc: string;
  recurringOrderReminders: string;
  recurringOrderRemindersDesc: string;
  reminderAdvance: string;
  reminderAdvanceDesc: string;
  days: string;
  saveSettings: string;
  settingsSaved: string;
  settingsInfo: string;
  dataManagement: string;
  dataManagementDesc: string;
  clearDataWarning: string;
  clearDataWarningDesc: string;
  allProducts: string;
  allSuppliers: string;
  allOrders: string;
  allNotifications: string;
  allSettings: string;
  cannotBeUndone: string;
  analytics: string;
  viewAnalytics: string;
  topProducts: string;
  topSuppliers: string;
  mainSuppliers: string;
  priceAlerts30Days: string;
  recentOrders: string;
  priceAlerts: string;
  recurringReminders: string;
  noData: string;
  noAlerts: string;
  noReminders: string;
  priceIncreased: string;
  priceDecreased: string;
  upcomingOrder: string;
  acknowledge: string;
  securePayment: string;
  manageSubscription: string;
  manageSubscriptionDesc: string;
  securePaymentDesc: string;
  paymentProcessedSecurely: string;
  fullAccessToFeatures: string;
  perMonth: string;
  unlimitedProductSupplierManagement: string;
  invoiceUploadWithOCR: string;
  advancedStatisticsAnalytics: string;
  personalizedNotificationsReminders: string;
  paymentSecurityMessage: string;
  managePlan: string;
  subscription: string;
  logout: string;
  connectedAs: string;
  subscriptionStatus: string;
  subscriptionActive: string;
  trialPeriod: string;
  subscriptionExpired: string;
  unknownStatus: string;
  manageYourPlan: string;
  daysRemaining: string;
  lastDay: string;
  type: string;
  monthlyPlan: string;
  lifetimeAccess: string;
  freeTrial: string;
  active: string;
  paymentOverdue: string;
  startDate: string;
  expiredOn: string;
  renewal: string;
  willBeCancelled: string;
  renewSubscription: string;
  activatePremium: string;
  fullAccessMessage: string;
  unlimitedManagement: string;
  advancedOCR: string;
  detailedStats: string;
  customNotifications: string;
  noSubscriptionFound: string;
  activateSubscription: string;
  featureLockedTitle: string;
  featureLockedMessage: string;
  activateSubscriptionButton: string;
  tutorialWelcomeTitle: string;
  tutorialWelcomeContent: string;
  tutorialProductsTitle: string;
  tutorialProductsContent: string;
  tutorialUploadTitle: string;
  tutorialUploadContent: string;
  tutorialAddProductTitle: string;
  tutorialAddProductContent: string;
  tutorialSuppliersTitle: string;
  tutorialSuppliersContent: string;
  tutorialOrdersTitle: string;
  tutorialOrdersContent: string;
  tutorialCompleteTitle: string;
  tutorialCompleteContent: string;
  tutorialCompleteTip: string;
  tutorialBack: string;
  tutorialClose: string;
  tutorialLast: string;
  tutorialNext: string;
  tutorialSkip: string;
  search: string;
  filter: string;
  import: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  details: string;
  statistics: string;
  invoices: string;
  invoicesCount: string;
  totalInvoices: string;
  totalProducts: string;
  monthlyAverage: string;
  totalSpent: string;
  invoiceManagement: string;
  invoiceNumber: string;
  date: string;
  amount: string;
  manualEntry: string;
  fillRequiredFields: string;
  invoiceAddedSuccess: string;
  invoiceAddError: string;
  incompleteInvoiceData: string;
  invoiceData: string;
  extractedProducts: string;
  match: string;
  partial: string;
  new: string;
  qty: string;
  priceChanged: string;
  addInvoice: string;
  uploadInvoicePdfOrImage: string;
  processingInProgress: string;
  invoiceProcessedSuccess: string;
  invoiceProcessingError: string;
  registeredInvoices: string;
  clickToExpandYearMonth: string;
  noInvoicesRegistered: string;
  confirmDeleteInvoice: string;
  invoiceDeleted: string;
  featureNotAvailable: string;
  invoiceMarkedPaid: string;
  invoiceMarkedUnpaid: string;
  invoiceUpdateError: string;
  paid: string;
  unpaid: string;
  markAsPaid: string;
  markAsUnpaid: string;
  deleteInvoice: string;
  totalPaid: string;
  totalUnpaid: string;
  openingInvoiceManagement: string;
  unlimitedProductsSuppliers: string;
  fullAccessToAllFeatures: string;
  advancedStatistics: string;
  paymentCompleted: string;
  paymentCancelled: string;
  paymentError: string;
  stripeNotConfigured: string;
  portalError: string;
  portalNotConfigured: string;
  subscriptionActiveTitle: string;
  subscriptionActiveMessage: string;
  redirecting: string;
  manageSubscriptionButton: string;
  manageSubscriptionInfo: string;
  stripePortalFeatures: string;
  viewPaymentHistory: string;
  updatePaymentMethod: string;
  downloadReceipts: string;
  cancelSubscription: string;
  paymentServiceConfiguring: string;
  paymentServiceConfiguringMessage: string;
  contactSupportToActivate: string;
  supportChatComing: string;
  chatWithSupport: string;
  securePaymentInfo: string;
  searchExisting: string;
  createNew: string;
  contactUs: string;
  contactDescription: string;
  name: string;
  namePlaceholder: string;
  subject: string;
  subjectPlaceholder: string;
  message: string;
  messagePlaceholder: string;
  send: string;
  sending: string;
  messageSentSuccess: string;
  messageSendError: string;
  nameRequired: string;
  emailRequired: string;
  invalidEmail: string;
  subjectRequired: string;
  messageRequired: string;
  note: string;
  contactNote: string;
  back: string;
  [key: string]: string | TranslationObject; // Allow nested objects
}

export const translations: Record<Language, TranslationObject> = {
  it: itTranslations as TranslationObject,
  en: enTranslations as TranslationObject,
  es: esTranslations as TranslationObject,
  fr: frTranslations as TranslationObject,
  de: deTranslations as TranslationObject,
  lt: ltTranslations as TranslationObject,
};

// Helper function to get nested value from object using dot notation
function getNestedValue(obj: TranslationObject, path: string, params?: Record<string, string | number>): string {
  const keys = path.split('.');
  let current: string | TranslationObject = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return path; // Return the key itself if not found
    }
  }
  
  if (typeof current === 'string') {
    // Replace parameters in the format {paramName}
    if (params) {
      return current.replace(/\{(\w+)\}/g, (match, paramName) => {
        return params[paramName]?.toString() || match;
      });
    }
    return current;
  }
  
  return path; // Return the key itself if not a string
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationFunction;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Detect the user's preferred language from the browser.
 * Maps browser locale codes (e.g. "es-MX", "en-US", "it-IT") to supported languages.
 * Falls back to 'en' (English) if no match is found.
 */
export function detectBrowserLanguage(): Language {
  const supported: Language[] = ['it', 'en', 'es', 'fr', 'de', 'lt'];

  // Try all browser languages in preference order
  const browserLanguages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language || 'en'];

  for (const lang of browserLanguages) {
    const primaryLang = lang.split('-')[0].toLowerCase();
    if (supported.includes(primaryLang as Language)) {
      return primaryLang as Language;
    }
  }

  return 'en';
}

/**
 * Also auto-detect the country from the browser locale.
 * Maps locale region subtags (e.g. "it-IT" → "IT", "en-US" → "US") to supported countries.
 */
export function detectBrowserCountry(): string {
  const supportedCountries = ['IT', 'ES', 'FR', 'DE', 'GB', 'LT', 'US'];

  const browserLanguages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language || 'it-IT'];

  for (const lang of browserLanguages) {
    const parts = lang.split('-');
    if (parts.length >= 2) {
      const region = parts[1].toUpperCase();
      if (supportedCountries.includes(region)) {
        return region;
      }
    }
  }

  // Fallback: map primary language to most likely country
  const langToCountry: Record<string, string> = {
    'it': 'IT',
    'es': 'ES',
    'fr': 'FR',
    'de': 'DE',
    'en': 'GB',
    'lt': 'LT',
  };

  const detectedLang = detectBrowserLanguage();
  return langToCountry[detectedLang] || 'IT';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // 1. Check saved preference first
    const savedLang = localStorage.getItem('language');
    if (savedLang && ['it', 'en', 'es', 'fr', 'de', 'lt'].includes(savedLang)) {
      return savedLang as Language;
    }

    // 2. Auto-detect from browser locale
    const detected = detectBrowserLanguage();

    // 3. Persist the auto-detected language so it's consistent everywhere
    localStorage.setItem('language', detected);

    return detected;
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    
    if (typeof window !== 'undefined' && window.twinr_language_onchange) {
      console.log(`🌐 Twinr bridge: Switching to language "${lang}"`);
      window.twinr_language_onchange(lang);
    }
  };

  // Create translation function directly without useMemo
  const t: TranslationFunction = (key: string, params?: Record<string, string | number>) => {
    const currentTranslations = translations[language] || translations.it;
    return getNestedValue(currentTranslations, key, params);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export function getLanguage(): Language {
  const savedLang = localStorage.getItem('language');
  if (savedLang && ['it', 'en', 'es', 'fr', 'de', 'lt'].includes(savedLang)) {
    return savedLang as Language;
  }
  const detected = detectBrowserLanguage();
  localStorage.setItem('language', detected);
  return detected;
}

export function setLanguage(lang: Language): void {
  localStorage.setItem('language', lang);
  
  if (typeof window !== 'undefined' && window.twinr_language_onchange) {
    console.log(`🌐 Twinr bridge (legacy): Switching to language "${lang}"`);
    window.twinr_language_onchange(lang);
  }
}

export function getAvailableLanguages() {
  return [
    { code: 'it' as Language, name: 'Italiano', flag: '🇮🇹' },
    { code: 'en' as Language, name: 'English', flag: '🇬🇧' },
    { code: 'es' as Language, name: 'Español', flag: '🇪🇸' },
    { code: 'fr' as Language, name: 'Français', flag: '🇫🇷' },
    { code: 'de' as Language, name: 'Deutsch', flag: '🇩🇪' },
    { code: 'lt' as Language, name: 'Lietuvių', flag: '🇱🇹' },
  ];
}

export function useTranslations(language: Language): TranslationFunction {
  return (key: string, params?: Record<string, string | number>) => {
    const currentTranslations = translations[language] || translations.it;
    return getNestedValue(currentTranslations, key, params);
  };
}

export const languageOptions = [
  { value: 'it' as Language, label: '🇮🇹 Italiano', flag: '🇮🇹' },
  { value: 'en' as Language, label: '🇬🇧 English', flag: '🇬🇧' },
  { value: 'es' as Language, label: '🇪🇸 Español', flag: '🇪🇸' },
  { value: 'fr' as Language, label: '🇫🇷 Français', flag: '🇫🇷' },
  { value: 'de' as Language, label: '🇩🇪 Deutsch', flag: '🇩🇪' },
  { value: 'lt' as Language, label: '🇱🇹 Lietuvių', flag: '🇱🇹' },
];
// Standalone t() function for non-React contexts (e.g. orderUtils.ts, CountrySelector.tsx)
// Reads language from localStorage at call time
export function t(key: string, params?: Record<string, string | number>): string {
  const savedLang = localStorage.getItem('language');
  const lang: Language = (savedLang && ['it', 'en', 'es', 'fr', 'de', 'lt'].includes(savedLang))
    ? savedLang as Language
    : 'it';
  const currentTranslations = translations[lang] || translations.it;
  return getNestedValue(currentTranslations, key, params);
}

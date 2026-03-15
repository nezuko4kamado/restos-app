export interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
  supplierId?: string;
  supplier_id?: string;
  category?: string;
  priceHistory?: PriceHistory[];
  price_history?: PriceHistory[];
  vatRate?: number; // VAT percentage (e.g., 4, 10, 22)
  discountPercent?: number; // Discount percentage (e.g., 10, 15, 20)
  originalPrice?: number; // Original price before discount
  original_price?: number;
  discount?: number;
  unit?: string;
  notes?: string;
  code?: string; // Product code
  ean_code?: string; // EAN barcode - ENHANCED for matching
  created_at?: string;
  updated_at?: string;
  last_price_change?: string;
  stock_quantity?: number; // For inventory tracking
  min_stock_level?: number; // Minimum stock level for alerts
}

export interface PriceHistory {
  price: number;
  date: string;
  change_percent?: number;
  source?: string; // e.g., "Fattura FT-2024-001"
  invoice_id?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  mobile?: string; // Mobile phone number for WhatsApp
  email?: string;
  products: string[]; // Array of product IDs
  address?: string;
  notes?: string;
  country?: string; // Country code for phone prefix
  created_at?: string;
  updated_at?: string;
  is_whitelisted?: boolean; // Whitelist flag
  contact?: string; // Contact person name
}

export interface Invoice {
  id: string;
  supplierId: string;
  supplier_id?: string;
  invoiceNumber: string;
  invoice_number?: string;
  date: string; // ISO date string
  amount: number;
  total_amount?: number;
  vat_amount?: number; // VAT amount
  notes?: string;
  fileUrl?: string; // URL to uploaded file (PDF/image)
  items?: ExtractedInvoiceItem[]; // Extracted items from invoice
  discountPercent?: number; // Invoice-level discount percentage
  discountAmount?: number; // Invoice-level discount amount
  originalAmount?: number; // Original amount before discount
  createdAt?: string;
  created_at?: string;
  updated_at?: string;
  isPaid?: boolean; // Payment status
  is_paid?: boolean;
  payment_date?: string; // Payment date
  payment_method?: string; // Payment method
  supplier_name?: string; // Supplier name for display
  invoice_date?: string; // Invoice date for advanced features
  user_id?: string; // User ID for multi-tenant support
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  vatRate?: number; // VAT percentage
  discountPercent?: number; // Discount percentage
}

export interface ExtractedInvoiceItem {
  name: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  vatRate?: number;
  matchedProductId?: string; // ID of matched product in database
  matchScore?: number; // Similarity score (0-100)
  matchStatus: 'matched' | 'partial' | 'new'; // Match status
  priceChanged?: boolean; // Whether price differs from database
  oldPrice?: number; // Previous price in database
  priceChangePercent?: number; // Percentage change
  ean_code?: string; // EAN code for matching
}

export interface OrderItem {
  productId: string;
  product_id?: string;
  productName: string;
  quantity: number;
  price: number;
  supplierId?: string;
  supplier_id?: string;
  supplierName?: string;
  vatRate?: number; // VAT percentage
  discountPercent?: number; // Discount percentage
}

export interface Order {
  id: string;
  date: string;
  order_date?: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'sent' | 'completed';
  is_recurring?: boolean;
  recurrence_frequency?: 'weekly' | 'biweekly' | 'monthly';
  next_order_date?: string;
  created_at?: string;
  updated_at?: string;
  supplier_id?: string; // For single supplier orders
  order_number?: string; // Order number for PDF
}

export interface OrderBySupplier {
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  items: OrderItem[];
  total: number;
}

export interface OCRResult {
  supplier?: {
    name: string;
    phone?: string;
    email?: string;
  };
  products?: Array<{
    name: string;
    price: number;
    category?: string;
    vatRate?: number; // VAT percentage extracted from invoice
    discountPercent?: number; // Discount percentage extracted from invoice
    originalPrice?: number; // Original price before discount
  }>;
  suppliers?: Array<{
    name: string;
    phone: string;
    email?: string;
  }>;
  orderItems?: Array<{
    name: string;
    quantity: number;
    price: number;
    vatRate?: number; // VAT percentage
    discountPercent?: number; // Discount percentage
  }>;
  invoice?: {
    date: string;
    amount?: number;
    items?: InvoiceItem[];
  };
}

export interface AppSettings {
  country: string; // ISO country code (IT, ES, FR, etc.)
  language: string; // Language code (it, es, en)
}

export interface Settings {
  country: string;
  language: string;
  defaultCurrency?: string; // Default currency (EUR, USD, GBP, etc.)
  fontSize?: 'small' | 'medium' | 'large'; // Font size preference
  layoutMode?: 'compact' | 'expanded'; // Layout mode preference
  priceApiKey?: string; // PriceAPI.com personal API key
  notifications?: NotificationSettings;
}

export interface NotificationSettings {
  price_change_threshold: number; // Percentage threshold for price change alerts (e.g., 10 = 10%)
  recurring_order_reminder_days: number; // Days before next order to send reminder
  enable_recurring_reminders: boolean;
}

export interface PriceAlert {
  id: string;
  product_id: string;
  product_name: string;
  old_price: number;
  new_price: number;
  change_percent: number;
  date: string;
  acknowledged: boolean;
  supplier_name?: string; // Supplier name for advanced features
  change_type?: 'increase' | 'decrease'; // Change type
  is_read?: boolean; // Read status
  alert_date?: string; // Alert date
}

export interface RecurringOrderReminder {
  id: string;
  order_id: string;
  next_order_date: string;
  days_until: number;
  acknowledged: boolean;
}

export type VATCategory = 'essential' | 'reduced' | 'standard';

export interface ProductCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface InvoiceStats {
  totalSpent: number;
  averageMonthlySpent: number;
  highestMonth: {
    month: string;
    amount: number;
  };
  totalInvoices: number;
  monthlyData: Array<{
    month: string;
    year: number;
    amount: number;
    invoiceCount: number;
  }>;
  yearlyComparison: {
    currentYear: number;
    previousYear: number;
    percentageChange: number;
  };
}

export interface PriceUpdateAction {
  productId: string;
  productName: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  apply: boolean; // Whether to apply this update
}

// Advanced feature types
export interface PriceHistoryEntry {
  id: string;
  product_id: string;
  old_price: number;
  new_price: number;
  change_percent: number;
  change_date: string;
  source: string;
  invoice_id?: string;
  user_id: string;
  created_at: string;
  product_name?: string; // Product name for display
  supplier_name?: string; // Supplier name for display
  price_change_percent?: number; // Alias for change_percent
}

export interface SupplierWhitelist {
  id: string;
  user_id: string;
  supplier_name: string;
  aliases?: string[];
  created_at: string;
  updated_at: string;
  is_active?: boolean;
  priority?: number;
  notes?: string;
}

export interface PriceComparison {
  product_id: string;
  product_name: string;
  suppliers: Array<{
    supplier_id: string;
    supplier_name: string;
    price: number;
    last_updated: string;
    is_available?: boolean;
    is_whitelisted?: boolean;
  }>;
  best_price: number;
  best_supplier_id?: string;
  best_supplier?: string;
  potential_savings: number;
  ean_code?: string;
  savings_percent?: number;
}

export interface SupplierPrice {
  supplier_name: string;
  price: number;
  last_updated: string;
  is_available: boolean;
  is_whitelisted: boolean;
}

export interface MatchSuggestion {
  product_name: string;
  supplier_name: string;
  confidence: number;
  matched_product?: {
    id: string;
    name: string;
    ean_code?: string;
  };
  suggestions: Array<{
    id: string;
    name: string;
    ean_code?: string;
    similarity: number;
  }>;
}

export interface ExportOptions {
  format?: 'excel' | 'csv';
  date_range?: {
    start: string;
    end: string;
  };
  suppliers?: string[];
  include_paid?: boolean;
  include_unpaid?: boolean;
}

// Re-export advanced types from advanced.ts for convenience
export type {
  Invoice as AdvancedInvoice,
  InvoiceItem as AdvancedInvoiceItem,
  PriceHistory as AdvancedPriceHistory,
  SupplierWhitelist as AdvancedSupplierWhitelist,
  PriceComparison as AdvancedPriceComparison,
  SupplierPrice as AdvancedSupplierPrice,
  PriceAlert as AdvancedPriceAlert,
  MatchSuggestion as AdvancedMatchSuggestion,
  InvoiceStats as AdvancedInvoiceStats,
  ExportOptions as AdvancedExportOptions
} from './advanced';
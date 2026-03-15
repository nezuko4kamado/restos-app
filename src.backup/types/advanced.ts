// Advanced Features Types for RESTO Project

export interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string;
  supplier_name: string;
  invoice_date: string;
  total_amount: number;
  vat_amount: number;
  is_paid: boolean;
  payment_date?: string;
  notes?: string;
  file_url?: string;
  items: InvoiceItem[];
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  vat_rate: number;
  ean_code?: string;
}

export interface PriceHistory {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  supplier_name: string;
  old_price?: number;
  new_price: number;
  price_change_percent?: number;
  invoice_id?: string;
  change_date: string;
  created_at: string;
}

export interface SupplierWhitelist {
  id: string;
  user_id: string;
  supplier_name: string;
  is_active: boolean;
  priority: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PriceComparison {
  product_id: string;
  product_name: string;
  ean_code?: string;
  suppliers: SupplierPrice[];
  best_price: number;
  best_supplier: string;
  potential_savings: number;
  savings_percent: number;
}

export interface SupplierPrice {
  supplier_name: string;
  price: number;
  last_updated: string;
  is_available: boolean;
  is_whitelisted: boolean;
}

export interface PriceAlert {
  id: string;
  product_id: string;
  product_name: string;
  supplier_name: string;
  old_price: number;
  new_price: number;
  change_percent: number;
  change_type: 'increase' | 'decrease';
  alert_date: string;
  is_read: boolean;
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

export interface InvoiceStats {
  total_invoices: number;
  paid_invoices: number;
  unpaid_invoices: number;
  total_amount: number;
  paid_amount: number;
  unpaid_amount: number;
  total_vat: number;
  by_supplier: Array<{
    supplier_name: string;
    count: number;
    total_amount: number;
  }>;
}

export interface ExportOptions {
  format: 'excel' | 'csv';
  date_range?: {
    start: string;
    end: string;
  };
  suppliers?: string[];
  include_paid?: boolean;
  include_unpaid?: boolean;
}
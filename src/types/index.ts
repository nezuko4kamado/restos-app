export interface Product {
  id: string;
  name: string;
  category: string;
  supplier_id: string;
  price: number;
  unit?: string;
  code?: string;
  code_description?: string;
  ean_code?: string;
  vat_rate?: number;
  vatRate?: number;
  discountPercent?: number;
  original_price?: number;
  discount?: number;
  notes?: string;
  price_history?: Array<{ price: number; date: string }>;
  last_price_change?: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

export interface OrderItem {
  product_id: string;
  quantity: number;
  price: number;
  custom_product_name?: string;
  custom_unit?: string;
}

export interface Order {
  id: string;
  supplier_id: string;
  items: OrderItem[];
  order_date: string;
  total_amount?: number;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  recurring?: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly';
  next_order_date?: string;
  custom_supplier_name?: string;
  custom_supplier_phone?: string;
  custom_supplier_email?: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

export interface Invoice {
  id: string;
  supplier_id: string;
  supplier_name?: string; // CRITICAL FIX: Add supplier_name for filtering
  invoice_number: string;
  date: string;
  amount: number;
  items: Array<{
    product_id: string;
    quantity: number;
    price: number;
    custom_product_name?: string;
  }>;
  paid: boolean;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

export interface Settings {
  country: string;
  language: string;
  defaultCurrency: string;
  storeName: string;
  theme?: string;
  fontSize?: 'small' | 'medium' | 'large';
  layoutMode?: 'compact' | 'expanded';
  notifications?: {
    price_change_threshold: number;
    recurring_order_reminder_days: number;
    enable_recurring_reminders: boolean;
  };
  messageTemplates?: {
    whatsapp: string;
    email: string;
  };
}

export interface OrderImage {
  id: string;
  order_id: string;
  image_url: string;
  image_name: string;
  created_at: string;
  user_id?: string;
}

export interface Notification {
  id: string;
  type: 'price_change' | 'recurring_order';
  title: string;
  message: string;
  product_id?: string;
  order_id?: string;
  read: boolean;
  created_at: string;
}
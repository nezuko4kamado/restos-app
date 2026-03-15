// Extended product types for internal use
export interface ProductWithExtendedFields {
  unit_price?: number;
  discounted_price?: number;
  discount_percent?: number;
  discount_amount?: number;
  vatRate?: number;
  vat_rate?: number;
  [key: string]: unknown;
}

export interface VATBreakdown {
  rate: number;
  amount: number;
  taxable_amount: number;
}

export interface OrderProduct {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  category?: string;
  supplier_id?: string;
  vat_rate?: number;
  discount_percent?: number;
  discount_amount?: number;
  [key: string]: unknown;
}
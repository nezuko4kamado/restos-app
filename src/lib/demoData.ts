import type { Product, Supplier, Order, Invoice, Settings } from '@/types';

/**
 * Realistic demo data for the RESTOS restaurant management app.
 * Used when users enter "Demo Mode" without registering.
 */

const now = new Date().toISOString();
const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

export const DEMO_USER_ID = 'demo-user-000';

export const demoSuppliers: Supplier[] = [
  {
    id: 'demo-sup-001',
    name: 'Ortofruit S.r.l.',
    contact: 'Marco Bianchi',
    email: 'info@ortofruit.it',
    phone: '+39 02 1234567',
    address: 'Via Roma 42, Milano',
    notes: 'Consegna lunedì e giovedì',
    created_at: oneMonthAgo,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
  {
    id: 'demo-sup-002',
    name: 'Macelleria Rossi',
    contact: 'Giuseppe Rossi',
    email: 'ordini@macelleriarossi.it',
    phone: '+39 06 7654321',
    address: 'Via Garibaldi 15, Roma',
    notes: 'Carne premium, ordine minimo €200',
    created_at: oneMonthAgo,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
  {
    id: 'demo-sup-003',
    name: 'Bevande Express',
    contact: 'Anna Verdi',
    email: 'ordini@bevandeexpress.it',
    phone: '+39 055 9876543',
    address: 'Via Dante 8, Firenze',
    notes: 'Consegna in 24h',
    created_at: oneMonthAgo,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
];

export const demoProducts: Product[] = [
  {
    id: 'demo-prod-001',
    name: 'Pomodori San Marzano',
    category: 'Verdure',
    supplier_id: 'demo-sup-001',
    price: 2.80,
    unit: 'kg',
    vat_rate: 4,
    price_history_data: [
      { price: 3.10, date: oneMonthAgo },
      { price: 2.90, date: twoWeeksAgo },
      { price: 2.80, date: now },
    ],
    created_at: oneMonthAgo,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
  {
    id: 'demo-prod-002',
    name: 'Mozzarella di Bufala DOP',
    category: 'Latticini',
    supplier_id: 'demo-sup-001',
    price: 12.50,
    unit: 'kg',
    vat_rate: 4,
    price_history_data: [
      { price: 11.80, date: oneMonthAgo },
      { price: 12.50, date: now },
    ],
    created_at: oneMonthAgo,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
  {
    id: 'demo-prod-003',
    name: 'Filetto di Manzo',
    category: 'Carne',
    supplier_id: 'demo-sup-002',
    price: 38.00,
    unit: 'kg',
    vat_rate: 10,
    price_history_data: [
      { price: 36.50, date: oneMonthAgo },
      { price: 38.00, date: now },
    ],
    created_at: oneMonthAgo,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
  {
    id: 'demo-prod-004',
    name: 'Petto di Pollo',
    category: 'Carne',
    supplier_id: 'demo-sup-002',
    price: 8.90,
    unit: 'kg',
    vat_rate: 10,
    price_history_data: [
      { price: 9.20, date: oneMonthAgo },
      { price: 8.90, date: now },
    ],
    created_at: oneMonthAgo,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
  {
    id: 'demo-prod-005',
    name: 'Olio Extra Vergine di Oliva',
    category: 'Condimenti',
    supplier_id: 'demo-sup-001',
    price: 9.50,
    unit: 'lt',
    vat_rate: 4,
    price_history_data: [
      { price: 8.90, date: oneMonthAgo },
      { price: 9.50, date: now },
    ],
    created_at: oneMonthAgo,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
  {
    id: 'demo-prod-006',
    name: 'Vino Chianti Classico',
    category: 'Bevande',
    supplier_id: 'demo-sup-003',
    price: 7.80,
    unit: 'bt',
    vat_rate: 22,
    price_history_data: [
      { price: 7.50, date: oneMonthAgo },
      { price: 7.80, date: now },
    ],
    created_at: oneMonthAgo,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
  {
    id: 'demo-prod-007',
    name: 'Acqua Minerale Naturale',
    category: 'Bevande',
    supplier_id: 'demo-sup-003',
    price: 0.35,
    unit: 'bt',
    vat_rate: 22,
    price_history_data: [
      { price: 0.32, date: oneMonthAgo },
      { price: 0.35, date: now },
    ],
    created_at: oneMonthAgo,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
  {
    id: 'demo-prod-008',
    name: 'Farina 00',
    category: 'Dispensa',
    supplier_id: 'demo-sup-001',
    price: 1.20,
    unit: 'kg',
    vat_rate: 4,
    price_history_data: [
      { price: 1.10, date: oneMonthAgo },
      { price: 1.20, date: now },
    ],
    created_at: oneMonthAgo,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
];

export const demoOrders: Order[] = [
  {
    id: 'demo-ord-001',
    supplier_id: 'demo-sup-001',
    items: [
      { product_id: 'demo-prod-001', quantity: 10, price: 2.80 },
      { product_id: 'demo-prod-002', quantity: 5, price: 12.50 },
      { product_id: 'demo-prod-005', quantity: 3, price: 9.50 },
    ],
    order_date: oneWeekAgo,
    total_amount: 119.00,
    status: 'delivered',
    created_at: oneWeekAgo,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
  {
    id: 'demo-ord-002',
    supplier_id: 'demo-sup-002',
    items: [
      { product_id: 'demo-prod-003', quantity: 3, price: 38.00 },
      { product_id: 'demo-prod-004', quantity: 8, price: 8.90 },
    ],
    order_date: now,
    total_amount: 185.20,
    status: 'pending',
    created_at: now,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
  {
    id: 'demo-ord-003',
    supplier_id: 'demo-sup-003',
    items: [
      { product_id: 'demo-prod-006', quantity: 12, price: 7.80 },
      { product_id: 'demo-prod-007', quantity: 48, price: 0.35 },
    ],
    order_date: twoWeeksAgo,
    total_amount: 110.40,
    status: 'confirmed',
    created_at: twoWeeksAgo,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
];

export const demoInvoices: Invoice[] = [
  {
    id: 'demo-inv-001',
    supplier_id: 'demo-sup-001',
    supplier_name: 'Ortofruit S.r.l.',
    invoice_number: 'FT-2025-0142',
    date: oneWeekAgo,
    amount: 119.00,
    items: [
      { product_id: 'demo-prod-001', quantity: 10, price: 2.80, custom_product_name: 'Pomodori San Marzano' },
      { product_id: 'demo-prod-002', quantity: 5, price: 12.50, custom_product_name: 'Mozzarella di Bufala DOP' },
      { product_id: 'demo-prod-005', quantity: 3, price: 9.50, custom_product_name: 'Olio Extra Vergine di Oliva' },
    ],
    paid: true,
    created_at: oneWeekAgo,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
  {
    id: 'demo-inv-002',
    supplier_id: 'demo-sup-002',
    supplier_name: 'Macelleria Rossi',
    invoice_number: 'FT-2025-0087',
    date: twoWeeksAgo,
    amount: 245.50,
    items: [
      { product_id: 'demo-prod-003', quantity: 4, price: 38.00, custom_product_name: 'Filetto di Manzo' },
      { product_id: 'demo-prod-004', quantity: 10, price: 8.90, custom_product_name: 'Petto di Pollo' },
    ],
    paid: true,
    created_at: twoWeeksAgo,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
  {
    id: 'demo-inv-003',
    supplier_id: 'demo-sup-003',
    supplier_name: 'Bevande Express',
    invoice_number: 'FT-2025-0203',
    date: now,
    amount: 110.40,
    items: [
      { product_id: 'demo-prod-006', quantity: 12, price: 7.80, custom_product_name: 'Vino Chianti Classico' },
      { product_id: 'demo-prod-007', quantity: 48, price: 0.35, custom_product_name: 'Acqua Minerale Naturale' },
    ],
    paid: false,
    created_at: now,
    updated_at: now,
    user_id: DEMO_USER_ID,
  },
];

export const demoSettings: Settings = {
  country: 'IT',
  language: 'it',
  defaultCurrency: 'EUR',
  storeName: 'Ristorante Demo',
  notifications: {
    price_change_threshold: 10,
    recurring_order_reminder_days: 3,
    enable_price_alerts: true,
    enable_recurring_reminders: true,
  },
};

export const demoPriceAlerts = [
  {
    product: demoProducts[0], // Pomodori
    oldPrice: 3.10,
    newPrice: 2.80,
    changePercent: -9.7,
  },
  {
    product: demoProducts[2], // Filetto
    oldPrice: 36.50,
    newPrice: 38.00,
    changePercent: 4.1,
  },
];
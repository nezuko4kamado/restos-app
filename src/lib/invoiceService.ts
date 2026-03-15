import { supabase } from './supabase';
import * as XLSX from 'xlsx';

// CRITICAL FIX: Use the correct invoice table name
const INVOICES_TABLE = 'app_43909_invoices';

interface VATBreakdownItem {
  rate: number;
  vatAmount: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  supplier_id: string;
  supplier_name: string;
  date: string;
  total_amount: number;
  is_paid: boolean;
  payment_date?: string;
  notes?: string;
  vat_breakdown?: VATBreakdownItem[];
  items?: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total: number;
    vat_rate?: number;
  }>;
  created_at: string;
  updated_at: string;
}

export interface InvoiceFilters {
  supplier?: string;
  isPaid?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface InvoiceStats {
  total_invoices: number;
  paid_invoices: number;
  unpaid_invoices: number;
  total_amount: number;
  paid_amount: number;
  unpaid_amount: number;
  total_vat: number;
}

export interface ProductLink {
  invoice_id: string;
  invoice_product_name: string;
  catalog_product_id: string;
  created_at: string;
}

export class InvoiceService {
  static async getInvoices(filters?: InvoiceFilters): Promise<Invoice[]> {
    try {
      console.log('🔍 InvoiceService.getInvoices() - Querying table:', INVOICES_TABLE);
      let query = supabase
        .from(INVOICES_TABLE)
        .select('*')
        .order('date', { ascending: false });

      if (filters?.supplier) {
        query = query.eq('supplier_name', filters.supplier);
      }

      if (filters?.isPaid !== undefined) {
        query = query.eq('is_paid', filters.isPaid);
      }

      if (filters?.dateFrom) {
        query = query.gte('date', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('date', filters.dateTo);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching invoices from', INVOICES_TABLE, ':', error);
        throw error;
      }

      console.log('✅ InvoiceService.getInvoices() - Found', data?.length || 0, 'invoices');
      return data || [];
    } catch (error) {
      console.error('❌ Error in getInvoices:', error);
      return [];
    }
  }

  static async getInvoiceStats(): Promise<InvoiceStats> {
    try {
      console.log('📊 InvoiceService.getInvoiceStats() - Querying table:', INVOICES_TABLE);
      const { data: invoices, error } = await supabase
        .from(INVOICES_TABLE)
        .select('*');

      if (error) {
        console.error('❌ Error fetching invoice stats from', INVOICES_TABLE, ':', error);
        throw error;
      }

      const stats: InvoiceStats = {
        total_invoices: invoices?.length || 0,
        paid_invoices: 0,
        unpaid_invoices: 0,
        total_amount: 0,
        paid_amount: 0,
        unpaid_amount: 0,
        total_vat: 0
      };

      invoices?.forEach(invoice => {
        stats.total_amount += invoice.total_amount || 0;
        
        if (invoice.is_paid) {
          stats.paid_invoices++;
          stats.paid_amount += invoice.total_amount || 0;
        } else {
          stats.unpaid_invoices++;
          stats.unpaid_amount += invoice.total_amount || 0;
        }

        // Calculate total VAT
        if (invoice.vat_breakdown && Array.isArray(invoice.vat_breakdown)) {
          invoice.vat_breakdown.forEach((vat: VATBreakdownItem) => {
            stats.total_vat += vat.vatAmount || 0;
          });
        }
      });

      console.log('✅ InvoiceService.getInvoiceStats() - Stats:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Error calculating invoice stats:', error);
      return {
        total_invoices: 0,
        paid_invoices: 0,
        unpaid_invoices: 0,
        total_amount: 0,
        paid_amount: 0,
        unpaid_amount: 0,
        total_vat: 0
      };
    }
  }

  static async markAsPaid(invoiceId: string): Promise<void> {
    const { error } = await supabase
      .from(INVOICES_TABLE)
      .update({ 
        is_paid: true,
        payment_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId);

    if (error) throw error;
  }

  static async markAsUnpaid(invoiceId: string): Promise<void> {
    const { error } = await supabase
      .from(INVOICES_TABLE)
      .update({ 
        is_paid: false,
        payment_date: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId);

    if (error) throw error;
  }

  static async deleteInvoice(invoiceId: string): Promise<void> {
    // First delete product links
    await supabase
      .from('invoice_product_links')
      .delete()
      .eq('invoice_id', invoiceId);

    // Then delete the invoice
    const { error } = await supabase
      .from(INVOICES_TABLE)
      .delete()
      .eq('id', invoiceId);

    if (error) throw error;
  }

  static async exportToExcel(options: {
    include_paid?: boolean;
    include_unpaid?: boolean;
    suppliers?: string[];
  }): Promise<Blob> {
    const filters: InvoiceFilters = {};
    
    if (options.suppliers && options.suppliers.length > 0) {
      // Note: This will only work for single supplier, multiple suppliers need OR logic
      filters.supplier = options.suppliers[0];
    }

    const invoices = await this.getInvoices(filters);
    
    // Filter by payment status
    const filteredInvoices = invoices.filter(inv => {
      if (options.include_paid === false && inv.is_paid) return false;
      if (options.include_unpaid === false && !inv.is_paid) return false;
      return true;
    });

    // Prepare data for Excel
    const excelData = filteredInvoices.map(inv => ({
      'Numero Fattura': inv.invoice_number,
      'Fornitore': inv.supplier_name,
      'Data': inv.date,
      'Importo Totale': inv.total_amount,
      'Stato': inv.is_paid ? 'Pagata' : 'Non Pagata',
      'Data Pagamento': inv.payment_date || '',
      'Note': inv.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fatture');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  static async exportToCSV(options: {
    include_paid?: boolean;
    include_unpaid?: boolean;
    suppliers?: string[];
  }): Promise<string> {
    const filters: InvoiceFilters = {};
    
    if (options.suppliers && options.suppliers.length > 0) {
      filters.supplier = options.suppliers[0];
    }

    const invoices = await this.getInvoices(filters);
    
    const filteredInvoices = invoices.filter(inv => {
      if (options.include_paid === false && inv.is_paid) return false;
      if (options.include_unpaid === false && !inv.is_paid) return false;
      return true;
    });

    const headers = ['Numero Fattura', 'Fornitore', 'Data', 'Importo Totale', 'Stato', 'Data Pagamento', 'Note'];
    const rows = filteredInvoices.map(inv => [
      inv.invoice_number,
      inv.supplier_name,
      inv.date,
      inv.total_amount.toString(),
      inv.is_paid ? 'Pagata' : 'Non Pagata',
      inv.payment_date || '',
      inv.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  // Product linking methods
  static async getProductLinks(): Promise<ProductLink[]> {
    try {
      const { data, error } = await supabase
        .from('invoice_product_links')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching product links:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getProductLinks:', error);
      return [];
    }
  }

  static async linkProduct(
    invoiceId: string,
    invoiceProductName: string,
    catalogProductId: string
  ): Promise<void> {
    try {
      // Check if link already exists
      const { data: existing } = await supabase
        .from('invoice_product_links')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('invoice_product_name', invoiceProductName)
        .single();

      if (existing) {
        // Update existing link
        const { error } = await supabase
          .from('invoice_product_links')
          .update({
            catalog_product_id: catalogProductId,
            created_at: new Date().toISOString()
          })
          .eq('invoice_id', invoiceId)
          .eq('invoice_product_name', invoiceProductName);

        if (error) throw error;
      } else {
        // Create new link
        const { error } = await supabase
          .from('invoice_product_links')
          .insert({
            invoice_id: invoiceId,
            invoice_product_name: invoiceProductName,
            catalog_product_id: catalogProductId,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error linking product:', error);
      throw error;
    }
  }

  static async unlinkProduct(invoiceId: string, invoiceProductName: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('invoice_product_links')
        .delete()
        .eq('invoice_id', invoiceId)
        .eq('invoice_product_name', invoiceProductName);

      if (error) throw error;
    } catch (error) {
      console.error('Error unlinking product:', error);
      throw error;
    }
  }
}
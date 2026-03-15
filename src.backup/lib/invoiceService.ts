import { supabase } from './supabase';
import * as XLSX from 'xlsx';

export interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  vat_rate?: number;
  discount_percent?: number;
}

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

export class InvoiceService {
  /**
   * Create a new invoice
   */
  static async createInvoice(invoice: Omit<Invoice, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Invoice> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('app_43909_invoices')
        .insert({
          user_id: user.id,
          invoice_number: invoice.invoice_number,
          supplier_name: invoice.supplier_name,
          invoice_date: invoice.invoice_date,
          total_amount: invoice.total_amount,
          vat_amount: invoice.vat_amount,
          is_paid: invoice.is_paid || false,
          payment_date: invoice.payment_date,
          notes: invoice.notes,
          file_url: invoice.file_url,
          items: invoice.items || [],
        })
        .select()
        .single();

      if (error) throw error;
      
      console.log('✅ Invoice created:', data.invoice_number);
      return data;
    } catch (error) {
      console.error('❌ Error creating invoice:', error);
      throw error;
    }
  }

  /**
   * Get all invoices with optional filters
   */
  static async getInvoices(filters?: InvoiceFilters): Promise<Invoice[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('app_43909_invoices')
        .select('*')
        .eq('user_id', user.id);

      if (filters?.supplier) {
        query = query.eq('supplier_name', filters.supplier);
      }

      if (filters?.isPaid !== undefined) {
        query = query.eq('is_paid', filters.isPaid);
      }

      if (filters?.dateFrom) {
        query = query.gte('invoice_date', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('invoice_date', filters.dateTo);
      }

      query = query.order('invoice_date', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching invoices:', error);
      return [];
    }
  }

  /**
   * Get a single invoice by ID
   */
  static async getInvoiceById(id: string): Promise<Invoice | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('app_43909_invoices')
        .select('*')
        .eq('user_id', user.id)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error fetching invoice:', error);
      return null;
    }
  }

  /**
   * Update an invoice
   */
  static async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('app_43909_invoices')
        .update(updates)
        .eq('user_id', user.id)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      console.log('✅ Invoice updated:', id);
      return data;
    } catch (error) {
      console.error('❌ Error updating invoice:', error);
      throw error;
    }
  }

  /**
   * Delete an invoice
   */
  static async deleteInvoice(id: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('app_43909_invoices')
        .delete()
        .eq('user_id', user.id)
        .eq('id', id);

      if (error) throw error;
      
      console.log('✅ Invoice deleted:', id);
    } catch (error) {
      console.error('❌ Error deleting invoice:', error);
      throw error;
    }
  }

  /**
   * Mark invoice as paid
   */
  static async markAsPaid(id: string, paymentDate?: string): Promise<Invoice> {
    try {
      return await this.updateInvoice(id, {
        is_paid: true,
        payment_date: paymentDate || new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      console.error('❌ Error marking invoice as paid:', error);
      throw error;
    }
  }

  /**
   * Mark invoice as unpaid
   */
  static async markAsUnpaid(id: string): Promise<Invoice> {
    try {
      return await this.updateInvoice(id, {
        is_paid: false,
        payment_date: undefined,
      });
    } catch (error) {
      console.error('❌ Error marking invoice as unpaid:', error);
      throw error;
    }
  }

  /**
   * Calculate VAT automatically
   */
  static calculateVAT(amount: number, vatRate: number): number {
    return (amount * vatRate) / 100;
  }

  /**
   * Calculate total with VAT
   */
  static calculateTotalWithVAT(amount: number, vatRate: number): number {
    return amount + this.calculateVAT(amount, vatRate);
  }

  /**
   * Get invoice statistics
   */
  static async getInvoiceStats(): Promise<InvoiceStats> {
    try {
      const invoices = await this.getInvoices();

      const stats: InvoiceStats = {
        total_invoices: invoices.length,
        paid_invoices: invoices.filter(inv => inv.is_paid).length,
        unpaid_invoices: invoices.filter(inv => !inv.is_paid).length,
        total_amount: invoices.reduce((sum, inv) => sum + inv.total_amount, 0),
        paid_amount: invoices.filter(inv => inv.is_paid).reduce((sum, inv) => sum + inv.total_amount, 0),
        unpaid_amount: invoices.filter(inv => !inv.is_paid).reduce((sum, inv) => sum + inv.total_amount, 0),
        total_vat: invoices.reduce((sum, inv) => sum + inv.vat_amount, 0),
      };

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
        total_vat: 0,
      };
    }
  }

  /**
   * Export invoices to CSV
   */
  static async exportToCSV(filters?: {
    format?: 'csv' | 'xlsx';
    include_paid?: boolean;
    include_unpaid?: boolean;
    suppliers?: string[];
  }): Promise<string> {
    try {
      let invoices = await this.getInvoices();

      // Apply filters
      if (filters?.include_paid === false) {
        invoices = invoices.filter(inv => !inv.is_paid);
      }
      if (filters?.include_unpaid === false) {
        invoices = invoices.filter(inv => inv.is_paid);
      }
      if (filters?.suppliers && filters.suppliers.length > 0) {
        invoices = invoices.filter(inv => filters.suppliers!.includes(inv.supplier_name));
      }

      // Prepare data for export
      const exportData = invoices.map(inv => ({
        'Invoice Number': inv.invoice_number,
        'Supplier': inv.supplier_name,
        'Date': inv.invoice_date,
        'Total Amount': inv.total_amount.toFixed(2),
        'VAT Amount': inv.vat_amount.toFixed(2),
        'Status': inv.is_paid ? 'Paid' : 'Unpaid',
        'Payment Date': inv.payment_date || '-',
        'Notes': inv.notes || '-',
      }));

      // Convert to CSV
      const headers = Object.keys(exportData[0] || {});
      const csvRows = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            const value = row[header as keyof typeof row];
            // Escape commas and quotes
            return typeof value === 'string' && (value.includes(',') || value.includes('"'))
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          }).join(',')
        ),
      ];

      return csvRows.join('\n');
    } catch (error) {
      console.error('❌ Error exporting to CSV:', error);
      throw error;
    }
  }

  /**
   * Export invoices to Excel
   */
  static async exportToExcel(filters?: {
    include_paid?: boolean;
    include_unpaid?: boolean;
    suppliers?: string[];
  }): Promise<Blob> {
    try {
      let invoices = await this.getInvoices();

      // Apply filters
      if (filters?.include_paid === false) {
        invoices = invoices.filter(inv => !inv.is_paid);
      }
      if (filters?.include_unpaid === false) {
        invoices = invoices.filter(inv => inv.is_paid);
      }
      if (filters?.suppliers && filters.suppliers.length > 0) {
        invoices = invoices.filter(inv => filters.suppliers!.includes(inv.supplier_name));
      }

      // Prepare data for export
      const exportData = invoices.map(inv => ({
        'Invoice Number': inv.invoice_number,
        'Supplier': inv.supplier_name,
        'Date': inv.invoice_date,
        'Total Amount': inv.total_amount,
        'VAT Amount': inv.vat_amount,
        'Status': inv.is_paid ? 'Paid' : 'Unpaid',
        'Payment Date': inv.payment_date || '-',
        'Notes': inv.notes || '-',
      }));

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Invoices');

      // Generate Excel file
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    } catch (error) {
      console.error('❌ Error exporting to Excel:', error);
      throw error;
    }
  }

  /**
   * Get invoices by supplier
   */
  static async getInvoicesBySupplier(supplierName: string): Promise<Invoice[]> {
    try {
      return await this.getInvoices({ supplier: supplierName });
    } catch (error) {
      console.error('❌ Error fetching invoices by supplier:', error);
      return [];
    }
  }

  /**
   * Get overdue invoices
   */
  static async getOverdueInvoices(daysOverdue: number = 30): Promise<Invoice[]> {
    try {
      const invoices = await this.getInvoices({ isPaid: false });
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

      return invoices.filter(inv => {
        const invoiceDate = new Date(inv.invoice_date);
        return invoiceDate < cutoffDate;
      });
    } catch (error) {
      console.error('❌ Error fetching overdue invoices:', error);
      return [];
    }
  }
}
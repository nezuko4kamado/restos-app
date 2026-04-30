import { supabase } from '@/lib/supabase';
import { Invoice, InvoiceStats, ExportOptions } from '@/types/advanced';
import { PriceHistoryService } from './priceHistoryService';

export class InvoiceService {
  /**
   * Create a new invoice
   */
  static async createInvoice(invoice: Omit<Invoice, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Invoice | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('app_43909_invoices')
        .insert({
          user_id: user.id,
          ...invoice,
        })
        .select()
        .single();

      if (error) throw error;

      // Track price changes for each item
      if (data && invoice.items) {
        for (const item of invoice.items) {
          // Get the last price from price history
          const priceHistory = await PriceHistoryService.getProductPriceHistory(
            item.product_id,
            invoice.supplier_name
          );
          
          // Get the old price (most recent price before this invoice)
          const oldPrice = priceHistory.length > 0 ? priceHistory[0].new_price : undefined;
          
          console.log(`📊 [PRICE TRACKING] Product: ${item.product_name}`);
          console.log(`   Old price: ${oldPrice !== undefined ? oldPrice + ' €' : 'N/A (first time)'}`);
          console.log(`   New price: ${item.unit_price} €`);
          
          // Track price change with old price
          await PriceHistoryService.trackPriceChange(
            item.product_id,
            item.product_name,
            invoice.supplier_name,
            item.unit_price,
            oldPrice,
            data.id
          );
          
          // Update price_history_data in the products table
          await PriceHistoryService.updateProductPriceHistoryData(
            item.product_id,
            invoice.supplier_name,
            item.unit_price
          );
        }
      }

      return data;
    } catch (error) {
      console.error('Error creating invoice:', error);
      return null;
    }
  }

  /**
   * Get all invoices for current user
   */
  static async getInvoices(filters?: {
    supplier?: string;
    isPaid?: boolean;
    startDate?: string;
    endDate?: string;
  }): Promise<Invoice[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('app_43909_invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (filters?.supplier) {
        query = query.eq('supplier_name', filters.supplier);
      }

      if (filters?.isPaid !== undefined) {
        query = query.eq('is_paid', filters.isPaid);
      }

      if (filters?.startDate) {
        query = query.gte('date', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('date', filters.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching invoices:', error);
      return [];
    }
  }

  /**
   * Get invoice by ID
   */
  static async getInvoiceById(id: string): Promise<Invoice | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('app_43909_invoices')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching invoice:', error);
      return null;
    }
  }

  /**
   * Update invoice
   */
  static async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('app_43909_invoices')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating invoice:', error);
      return null;
    }
  }

  /**
   * Mark invoice as paid
   */
  static async markAsPaid(id: string, paymentDate?: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('app_43909_invoices')
        .update({
          is_paid: true,
          payment_date: paymentDate || new Date().toISOString().split('T')[0],
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      return false;
    }
  }

  /**
   * Delete invoice
   */
  static async deleteInvoice(id: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('app_43909_invoices')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting invoice:', error);
      return false;
    }
  }

  /**
   * Get invoice statistics
   */
  static async getInvoiceStats(startDate?: string, endDate?: string): Promise<InvoiceStats> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return this.getEmptyStats();
      }

      let query = supabase
        .from('app_43909_invoices')
        .select('*')
        .eq('user_id', user.id);

      if (startDate) {
        query = query.gte('date', startDate);
      }

      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      const invoices = data || [];

      const stats: InvoiceStats = {
        total_invoices: invoices.length,
        paid_invoices: invoices.filter(inv => inv.is_paid).length,
        unpaid_invoices: invoices.filter(inv => !inv.is_paid).length,
        total_amount: invoices.reduce((sum, inv) => sum + inv.total_amount, 0),
        paid_amount: invoices.filter(inv => inv.is_paid).reduce((sum, inv) => sum + inv.total_amount, 0),
        unpaid_amount: invoices.filter(inv => !inv.is_paid).reduce((sum, inv) => sum + inv.total_amount, 0),
        total_vat: invoices.reduce((sum, inv) => sum + inv.vat_amount, 0),
        by_supplier: this.groupBySupplier(invoices),
      };

      return stats;
    } catch (error) {
      console.error('Error fetching invoice stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Group invoices by supplier
   */
  private static groupBySupplier(invoices: Invoice[]): Array<{
    supplier_name: string;
    count: number;
    total_amount: number;
  }> {
    const grouped = invoices.reduce((acc, inv) => {
      if (!acc[inv.supplier_name]) {
        acc[inv.supplier_name] = {
          supplier_name: inv.supplier_name,
          count: 0,
          total_amount: 0,
        };
      }
      acc[inv.supplier_name].count++;
      acc[inv.supplier_name].total_amount += inv.total_amount;
      return acc;
    }, {} as Record<string, { supplier_name: string; count: number; total_amount: number }>);

    return Object.values(grouped).sort((a, b) => b.total_amount - a.total_amount);
  }

  /**
   * Get empty stats object
   */
  private static getEmptyStats(): InvoiceStats {
    return {
      total_invoices: 0,
      paid_invoices: 0,
      unpaid_invoices: 0,
      total_amount: 0,
      paid_amount: 0,
      unpaid_amount: 0,
      total_vat: 0,
      by_supplier: [],
    };
  }

  /**
   * Export invoices to CSV
   */
  static async exportToCSV(options: ExportOptions): Promise<string> {
    try {
      const invoices = await this.getInvoices({
        startDate: options.date_range?.start,
        endDate: options.date_range?.end,
      });

      let filteredInvoices = invoices;

      if (options.suppliers && options.suppliers.length > 0) {
        filteredInvoices = filteredInvoices.filter(inv => 
          options.suppliers!.includes(inv.supplier_name)
        );
      }

      if (options.include_paid === false) {
        filteredInvoices = filteredInvoices.filter(inv => !inv.is_paid);
      }

      if (options.include_unpaid === false) {
        filteredInvoices = filteredInvoices.filter(inv => inv.is_paid);
      }

      // CSV header
      const headers = [
        'Invoice Number',
        'Supplier',
        'Date',
        'Total Amount',
        'VAT Amount',
        'Paid',
        'Payment Date',
        'Notes'
      ];

      // CSV rows
      const rows = filteredInvoices.map(inv => [
        inv.invoice_number,
        inv.supplier_name,
        inv.date,
        inv.total_amount.toFixed(2),
        inv.vat_amount.toFixed(2),
        inv.is_paid ? 'Yes' : 'No',
        inv.payment_date || '',
        inv.notes || ''
      ]);

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      return csvContent;
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw error;
    }
  }
}
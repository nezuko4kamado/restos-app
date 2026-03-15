import type { Invoice, InvoiceStats } from '@/types';

export function calculateInvoiceStats(invoices: Invoice[]): InvoiceStats {
  console.log('📊 [STATS] calculateInvoiceStats called with', invoices.length, 'invoices');
  
  if (invoices.length === 0) {
    console.log('📊 [STATS] No invoices, returning zero stats');
    return {
      totalSpent: 0,
      averageMonthlySpent: 0,
      highestMonth: { month: '', amount: 0 },
      totalInvoices: 0,
      monthlyData: [],
      yearlyComparison: { currentYear: 0, previousYear: 0, percentageChange: 0 }
    };
  }

  const currentYear = new Date().getFullYear();
  
  // CRITICAL FIX: Use total_amount || totalAmount || amount to handle all field variations
  const totalSpent = invoices.reduce((sum, inv) => {
    const amount = inv.total_amount || inv.totalAmount || inv.amount || 0;
    console.log('📊 [STATS] Invoice amount:', {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      total_amount: inv.total_amount,
      totalAmount: inv.totalAmount,
      amount: inv.amount,
      used: amount
    });
    return sum + amount;
  }, 0);
  
  console.log('📊 [STATS] Total spent calculated:', totalSpent);
  
  // Group by month and year
  const monthlyMap = new Map<string, { amount: number; count: number; year: number; month: number }>();
  
  invoices.forEach(invoice => {
    // Validate date before processing
    const date = new Date(invoice.date);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date in invoice:', invoice.date);
      return; // Skip this invoice
    }
    
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${month}`;
    
    // CRITICAL FIX: Use total_amount || totalAmount || amount
    const invoiceAmount = invoice.total_amount || invoice.totalAmount || invoice.amount || 0;
    
    const existing = monthlyMap.get(key) || { amount: 0, count: 0, year, month };
    existing.amount += invoiceAmount;
    existing.count += 1;
    monthlyMap.set(key, existing);
  });

  // Convert to array and sort
  const monthlyData = Array.from(monthlyMap.entries())
    .map(([key, data]) => ({
      month: getMonthName(data.month),
      year: data.year,
      amount: data.amount,
      invoiceCount: data.count
    }))
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month.localeCompare(a.month);
    });

  // Calculate average monthly spent (last 12 months)
  const last12Months = monthlyData.slice(0, 12);
  const averageMonthlySpent = last12Months.length > 0
    ? last12Months.reduce((sum, m) => sum + m.amount, 0) / last12Months.length
    : 0;

  console.log('📊 [STATS] Average monthly spent:', averageMonthlySpent, '(from', last12Months.length, 'months)');

  // Find highest month
  const highestMonth = monthlyData.reduce(
    (max, curr) => (curr.amount > max.amount ? curr : max),
    { month: '', year: 0, amount: 0, invoiceCount: 0 }
  );

  // Calculate yearly comparison
  const currentYearTotal = invoices
    .filter(inv => {
      const date = new Date(inv.date);
      return !isNaN(date.getTime()) && date.getFullYear() === currentYear;
    })
    .reduce((sum, inv) => {
      const amount = inv.total_amount || inv.totalAmount || inv.amount || 0;
      return sum + amount;
    }, 0);
  
  const previousYearTotal = invoices
    .filter(inv => {
      const date = new Date(inv.date);
      return !isNaN(date.getTime()) && date.getFullYear() === currentYear - 1;
    })
    .reduce((sum, inv) => {
      const amount = inv.total_amount || inv.totalAmount || inv.amount || 0;
      return sum + amount;
    }, 0);

  const percentageChange = previousYearTotal > 0
    ? ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100
    : 0;

  const result = {
    totalSpent,
    averageMonthlySpent,
    highestMonth: {
      month: `${highestMonth.month} ${highestMonth.year}`,
      amount: highestMonth.amount
    },
    totalInvoices: invoices.length,
    monthlyData,
    yearlyComparison: {
      currentYear: currentYearTotal,
      previousYear: previousYearTotal,
      percentageChange
    }
  };
  
  console.log('📊 [STATS] Final result:', result);
  
  return result;
}

export function groupInvoicesByMonth(invoices: Invoice[]): Map<string, { invoices: Invoice[]; total: number }> {
  const grouped = new Map<string, { invoices: Invoice[]; total: number }>();
  
  invoices.forEach(invoice => {
    // Validate date before processing
    const date = new Date(invoice.date);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date in invoice:', invoice.date);
      return; // Skip this invoice
    }
    
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const displayKey = `${getMonthName(month)} ${year}`;
    
    // CRITICAL FIX: Use total_amount || totalAmount || amount
    const invoiceAmount = invoice.total_amount || invoice.totalAmount || invoice.amount || 0;
    
    const existing = grouped.get(displayKey) || { invoices: [], total: 0 };
    existing.invoices.push(invoice);
    existing.total += invoiceAmount;
    grouped.set(displayKey, existing);
  });

  return grouped;
}

function getMonthName(monthIndex: number): string {
  const months = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];
  return months[monthIndex];
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

export function formatDate(dateString: string): string {
  // Validate date before formatting
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    console.warn('⚠️ Invalid date string:', dateString);
    return 'Data non valida';
  }
  
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}
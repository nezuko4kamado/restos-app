import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Trash2, ChevronDown, ChevronRight, Percent, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import type { Invoice, Supplier } from '@/types';
import { calculateInvoiceStats, formatCurrency } from '@/lib/invoiceStats';
import { useLanguage } from '@/lib/i18n';
import { formatPrice } from '@/lib/currency';

interface AllInvoicesViewProps {
  invoices: Invoice[];
  suppliers: Supplier[];
  onDeleteInvoice: (invoiceId: string) => void;
  currency?: string;
}

interface GroupedInvoices {
  [year: string]: {
    [month: string]: Invoice[];
  };
}

interface InvoiceItem {
  discount_percent?: number;
  [key: string]: unknown;
}

export default function AllInvoicesView({ invoices, suppliers, onDeleteInvoice, currency = 'EUR' }: AllInvoicesViewProps) {
  const { language, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [showMonthlySummary, setShowMonthlySummary] = useState(true);
  const [expandedSummaryYears, setExpandedSummaryYears] = useState<Set<string>>(new Set());
  const [expandedSummaryMonths, setExpandedSummaryMonths] = useState<Set<string>>(new Set());

  // Month translation mapping
  const getMonthName = (monthIndex: number): string => {
    const monthKeys = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ] as const;
    return t[monthKeys[monthIndex]];
  };

  const getSupplierName = (invoice: Invoice): string => {
    const supplierId = invoice.supplierId || invoice.supplier_id;
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || invoice.supplier_name || t('unknownSupplier');
  };

  const groupInvoicesByYearMonth = (invoices: Invoice[]): GroupedInvoices => {
    const grouped: GroupedInvoices = {};
    
    invoices.forEach(invoice => {
      const date = new Date(invoice.date);
      const year = date.getFullYear().toString();
      const monthIndex = date.getMonth();
      const month = getMonthName(monthIndex);
      
      if (!grouped[year]) {
        grouped[year] = {};
      }
      if (!grouped[year][month]) {
        grouped[year][month] = [];
      }
      grouped[year][month].push(invoice);
    });
    
    return grouped;
  };

  const toggleYear = (year: string) => {
    const newExpanded = new Set(expandedYears);
    if (newExpanded.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
    }
    setExpandedYears(newExpanded);
  };

  const toggleMonth = (yearMonth: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(yearMonth)) {
      newExpanded.delete(yearMonth);
    } else {
      newExpanded.add(yearMonth);
    }
    setExpandedMonths(newExpanded);
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    if (confirm(t('confirmDeleteInvoice'))) {
      onDeleteInvoice(invoiceId);
      toast.success(t('invoiceDeleted'));
    }
  };

  // Get invoice total amount using new structure
  const getInvoiceTotal = (invoice: Invoice): number => {
    return invoice.total_amount || invoice.totalAmount || invoice.amount || 0;
  };

  // Filter invoices based on search
  const filteredInvoices = invoices.filter(invoice => {
    const query = searchQuery.toLowerCase();
    const supplierName = getSupplierName(invoice);
    return (
      invoice.invoiceNumber?.toLowerCase().includes(query) ||
      invoice.invoice_number?.toLowerCase().includes(query) ||
      supplierName.toLowerCase().includes(query) ||
      invoice.notes?.toLowerCase().includes(query)
    );
  });

  const stats = calculateInvoiceStats(filteredInvoices);
  const groupedInvoices = groupInvoicesByYearMonth(filteredInvoices);
  const years = Object.keys(groupedInvoices).sort((a, b) => parseInt(b) - parseInt(a));

  // Monthly supplier summary data
  const monthlySupplierData = invoices.reduce((acc, invoice) => {
    const date = new Date(invoice.date);
    const year = date.getFullYear().toString();
    const monthIndex = date.getMonth();
    const monthName = getMonthName(monthIndex);
    const supplierName = getSupplierName(invoice);
    const amount = getInvoiceTotal(invoice);
    const isPaid = invoice.is_paid || invoice.isPaid;

    if (!acc[year]) acc[year] = {};
    if (!acc[year][monthName]) acc[year][monthName] = { suppliers: {}, monthIndex };
    if (!acc[year][monthName].suppliers[supplierName]) {
      acc[year][monthName].suppliers[supplierName] = { paid: 0, unpaid: 0 };
    }
    if (isPaid) acc[year][monthName].suppliers[supplierName].paid += amount;
    else acc[year][monthName].suppliers[supplierName].unpaid += amount;
    return acc;
  }, {} as Record<string, Record<string, { suppliers: Record<string, { paid: number; unpaid: number }>; monthIndex: number }>>);

  const summaryYears = Object.keys(monthlySupplierData).sort((a, b) => parseInt(b) - parseInt(a));

  const toggleSummaryYear = (year: string) => {
    const newExpanded = new Set(expandedSummaryYears);
    if (newExpanded.has(year)) newExpanded.delete(year);
    else newExpanded.add(year);
    setExpandedSummaryYears(newExpanded);
  };

  const toggleSummaryMonth = (key: string) => {
    const newExpanded = new Set(expandedSummaryMonths);
    if (newExpanded.has(key)) newExpanded.delete(key);
    else newExpanded.add(key);
    setExpandedSummaryMonths(newExpanded);
  };

  // Create month order mapping for sorting
  const getMonthOrder = (monthName: string): number => {
    const monthKeys = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    
    // Find the month index by comparing translated names
    for (let i = 0; i < monthKeys.length; i++) {
      if (t[monthKeys[i] as keyof typeof t] === monthName) {
        return i;
      }
    }
    return 0;
  };

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <p className="text-sm text-slate-600 mb-1">{t('totalSpent')}</p>
          <p className="text-2xl font-bold text-green-600">{formatPrice(stats.totalSpent, currency)}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <p className="text-sm text-slate-600 mb-1">{t('monthlyAverage')}</p>
          <p className="text-2xl font-bold text-blue-600">{formatPrice(stats.averageMonthlySpent, currency)}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
          <p className="text-sm text-slate-600 mb-1">{t('totalInvoices')}</p>
          <p className="text-2xl font-bold text-purple-600">{stats.totalInvoices}</p>
        </Card>
      </div>

      {/* Monthly Supplier Summary */}
      <Card className="p-6">
        <div
          className="flex justify-between items-center cursor-pointer"
          onClick={() => setShowMonthlySummary(!showMonthlySummary)}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-lg text-slate-800">
              {t('monthlySupplierSummary') || 'Riepilogo Mensile per Fornitore'}
            </h3>
          </div>
          <Button variant="ghost" size="sm">
            {showMonthlySummary ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {showMonthlySummary && (
          <div className="mt-4 space-y-2">
            {summaryYears.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">
                {t('noInvoicesRegistered') || 'Nessuna fattura registrata'}
              </p>
            ) : (
              summaryYears.map(year => {
                const yearExpanded = expandedSummaryYears.has(year);
                const monthsInYear = Object.keys(monthlySupplierData[year]).sort(
                  (a, b) => monthlySupplierData[year][b].monthIndex - monthlySupplierData[year][a].monthIndex
                );
                const yearPaid = monthsInYear.reduce((sum, m) =>
                  sum + Object.values(monthlySupplierData[year][m].suppliers).reduce((s, v) => s + v.paid, 0), 0);
                const yearUnpaid = monthsInYear.reduce((sum, m) =>
                  sum + Object.values(monthlySupplierData[year][m].suppliers).reduce((s, v) => s + v.unpaid, 0), 0);

                return (
                  <div key={year} className="border-2 border-slate-200 rounded-xl overflow-hidden">
                    {/* Year Header */}
                    <div
                      className="flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
                      onClick={() => toggleSummaryYear(year)}
                    >
                      <div className="flex items-center gap-3">
                        {yearExpanded ? <ChevronDown className="h-5 w-5 text-slate-600" /> : <ChevronRight className="h-5 w-5 text-slate-600" />}
                        <span className="font-bold text-slate-800 text-xl">{year}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-green-600 font-semibold">✓ {formatPrice(yearPaid, currency)}</span>
                        <span className="text-orange-500 font-semibold">⏳ {formatPrice(yearUnpaid, currency)}</span>
                      </div>
                    </div>

                    {yearExpanded && (
                      <div className="divide-y divide-slate-200">
                        {monthsInYear.map(month => {
                          const monthKey = `summary-${year}-${month}`;
                          const monthExpanded = expandedSummaryMonths.has(monthKey);
                          const suppliersData = monthlySupplierData[year][month].suppliers;
                          const monthPaid = Object.values(suppliersData).reduce((s, v) => s + v.paid, 0);
                          const monthUnpaid = Object.values(suppliersData).reduce((s, v) => s + v.unpaid, 0);
                          const monthTotal = monthPaid + monthUnpaid;

                          return (
                            <div key={monthKey}>
                              {/* Month Header */}
                              <div
                                className="flex justify-between items-center p-3 pl-12 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                                onClick={() => toggleSummaryMonth(monthKey)}
                              >
                                <div className="flex items-center gap-2">
                                  {monthExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                                  <span className="font-semibold text-slate-700 capitalize">{month}</span>
                                  <span className="text-xs text-slate-400">({Object.keys(suppliersData).length} {t('supplierName') || 'fornitori'})</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="text-green-600 font-medium">{formatPrice(monthPaid, currency)}</span>
                                  <span className="text-orange-500 font-medium">{formatPrice(monthUnpaid, currency)}</span>
                                  <span className="text-indigo-600 font-bold">{formatPrice(monthTotal, currency)}</span>
                                </div>
                              </div>

                              {/* Supplier rows */}
                              {monthExpanded && (
                                <div className="bg-slate-50">
                                  {/* Table Header */}
                                  <div className="grid grid-cols-4 gap-2 px-16 py-2 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
                                    <span>{t('supplierName') || 'Fornitore'}</span>
                                    <span className="text-green-600 text-right">{t('paid') || 'Pagato'}</span>
                                    <span className="text-orange-500 text-right">{t('unpaid') || 'Da Pagare'}</span>
                                    <span className="text-indigo-600 text-right">Totale</span>
                                  </div>
                                  {Object.entries(suppliersData).map(([supplierName, amounts]) => (
                                    <div key={supplierName} className="grid grid-cols-4 gap-2 px-16 py-2 text-sm hover:bg-white transition-colors border-b border-slate-100">
                                      <span className="font-medium text-slate-700 truncate">{supplierName}</span>
                                      <span className="text-green-600 text-right font-medium">{formatPrice(amounts.paid, currency)}</span>
                                      <span className="text-orange-500 text-right font-medium">{formatPrice(amounts.unpaid, currency)}</span>
                                      <span className="text-indigo-600 text-right font-bold">{formatPrice(amounts.paid + amounts.unpaid, currency)}</span>
                                    </div>
                                  ))}
                                  {/* Month Total Row */}
                                  <div className="grid grid-cols-4 gap-2 px-16 py-2 bg-indigo-50 border-t-2 border-indigo-200 text-sm font-bold">
                                    <span className="text-slate-700">{t('monthlyTotal') || 'Totale Mese'}</span>
                                    <span className="text-green-700 text-right">{formatPrice(monthPaid, currency)}</span>
                                    <span className="text-orange-600 text-right">{formatPrice(monthUnpaid, currency)}</span>
                                    <span className="text-indigo-700 text-right">{formatPrice(monthTotal, currency)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </Card>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
        <Input
          type="text"
          placeholder={`${t('search')} ${t('invoices')?.toLowerCase()}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 border-2 focus:border-indigo-500 rounded-xl"
        />
      </div>

      {/* Invoice List */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-lg text-slate-800">
            {t('invoices')} ({filteredInvoices.length})
          </h3>
          <p className="text-xs text-slate-500 italic">
            💡 {t('clickToExpandYearMonth')}
          </p>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg">
              {t('noInvoicesRegistered')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {years.map(year => {
              const yearExpanded = expandedYears.has(year);
              const months = Object.keys(groupedInvoices[year]).sort((a, b) => {
                return getMonthOrder(b) - getMonthOrder(a);
              });
              const yearTotal = months.reduce((sum, month) => {
                return sum + groupedInvoices[year][month].reduce((s, inv) => s + getInvoiceTotal(inv), 0);
              }, 0);
              
              return (
                <div key={year} className="border-2 border-slate-200 rounded-xl overflow-hidden">
                  {/* Year Header */}
                  <div 
                    className="flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
                    onClick={() => toggleYear(year)}
                  >
                    <div className="flex items-center gap-3">
                      {yearExpanded ? (
                        <ChevronDown className="h-5 w-5 text-slate-600" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-slate-600" />
                      )}
                      <span className="font-bold text-slate-800 text-xl">{year}</span>
                      <span className="text-sm text-slate-600">
                        ({months.reduce((sum, month) => sum + groupedInvoices[year][month].length, 0)} {t('invoices')?.toLowerCase()})
                      </span>
                    </div>
                    <span className="font-bold text-indigo-600 text-lg">{formatPrice(yearTotal, currency)}</span>
                  </div>
                  
                  {/* Months */}
                  {yearExpanded && (
                    <div className="divide-y divide-slate-200">
                      {months.map(month => {
                        const monthKey = `${year}-${month}`;
                        const monthExpanded = expandedMonths.has(monthKey);
                        const monthInvoices = groupedInvoices[year][month];
                        const monthTotal = monthInvoices.reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);
                        
                        return (
                          <div key={monthKey}>
                            {/* Month Header */}
                            <div 
                              className="flex justify-between items-center p-3 pl-12 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                              onClick={() => toggleMonth(monthKey)}
                            >
                              <div className="flex items-center gap-2">
                                {monthExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-slate-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-500" />
                                )}
                                <span className="font-semibold text-slate-700 capitalize">{month}</span>
                                <span className="text-sm text-slate-500">({monthInvoices.length} {t('invoices')?.toLowerCase()})</span>
                              </div>
                              <span className="font-bold text-blue-600">{formatPrice(monthTotal, currency)}</span>
                            </div>
                            
                            {/* Invoices */}
                            {monthExpanded && (
                              <div className="bg-slate-50 divide-y divide-slate-200">
                                {monthInvoices.map((invoice) => (
                                  <div key={invoice.id} className="flex justify-between items-center p-3 pl-16 hover:bg-white transition-colors group">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-1">
                                        <p className="font-semibold text-slate-800">
                                          {invoice.invoiceNumber || invoice.invoice_number}
                                        </p>
                                        <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded">
                                          {getSupplierName(invoice)}
                                        </span>
                                        {/* Payment Status Badge */}
                                        {invoice.is_paid || invoice.isPaid ? (
                                          <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                                            Pagata
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                                            Non Pagata
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 text-sm text-slate-600">
                                        <span>{new Date(invoice.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US')}</span>
                                        <span className="font-bold text-indigo-600">{formatPrice(getInvoiceTotal(invoice), currency)}</span>
                                        {invoice.items && invoice.items.length > 0 && (
                                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                                            {invoice.items.length} {t('products')?.toLowerCase()}
                                          </span>
                                        )}
                                        {/* Show discount info if available */}
                                        {invoice.items && (invoice.items as InvoiceItem[]).some((item) => (item.discount_percent || 0) > 0) && (
                                          <Badge className="bg-green-100 text-green-600 border-green-300 text-xs flex items-center gap-1">
                                            <Percent className="h-3 w-3" />
                                            Sconti
                                          </Badge>
                                        )}
                                      </div>
                                      {invoice.notes && (
                                        <p className="text-xs text-slate-500 mt-1 italic">{invoice.notes}</p>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteInvoice(invoice.id);
                                      }}
                                      className="hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title={t('deleteInvoice')}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
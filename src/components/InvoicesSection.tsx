import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  FileText, 
  Search, 
  Filter, 
  Download,
  CheckCircle2,
  Circle,
  Calendar,
  Trash2,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  X
} from 'lucide-react';
import { InvoiceService, type Invoice as InvoiceType, type InvoiceFilters } from '@/lib/invoiceService';
import { getProducts, type Product } from '@/lib/storage';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { formatPrice } from '@/lib/currency';
import type { Settings } from '@/types';
import { useLanguage } from '@/lib/i18n';

interface VATBreakdown {
  rate: number;
  amount: number;
}

interface InvoiceProduct {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  vat_rate?: number;
}

interface InvoicesSectionProps {
  settings: Settings;
  onInvoicesChanged?: () => void;
}

/**
 * Normalize an invoice item from any source (OCR, manual, DB) into a consistent InvoiceProduct shape.
 * Handles field name variations: price/unit_price, totalLine/total/total_price, vatRate/vat_rate, etc.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeInvoiceItem(raw: any): InvoiceProduct {
  const name = raw.name || raw.custom_product_name || raw.description || '';
  const quantity = Number(raw.quantity) || 0;
  const unit_price = Number(raw.unit_price ?? raw.price ?? raw.discounted_price ?? 0);
  const total = Number(raw.total ?? raw.totalLine ?? raw.total_price ?? raw.total_amount ?? (unit_price * quantity));
  const vat_rate = raw.vat_rate !== undefined
    ? Number(raw.vat_rate)
    : raw.vatRate !== undefined
      ? Number(raw.vatRate)
      : undefined;

  return { name, quantity, unit_price, total, vat_rate };
}

export function InvoicesSection({ settings, onInvoicesChanged }: InvoicesSectionProps) {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState<InvoiceType[]>([]);
  const [stats, setStats] = useState({
    total_invoices: 0,
    paid_invoices: 0,
    unpaid_invoices: 0,
    total_amount: 0,
    paid_amount: 0,
    unpaid_amount: 0,
    total_vat: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [suppliers, setSuppliers] = useState<string[]>([]);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Expansion and linking states
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedInvoiceProduct, setSelectedInvoiceProduct] = useState<{
    invoiceId: string;
    productName: string;
  } | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productLinks, setProductLinks] = useState<Map<string, string>>(new Map());

  const currency = settings.defaultCurrency || 'EUR';

  useEffect(() => {
    console.log('🔄 InvoicesSection useEffect triggered');
    loadData();
  }, [filterStatus, filterSupplier, dateFrom, dateTo]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterSupplier, dateFrom, dateTo]);

  useEffect(() => {
    if (linkDialogOpen) {
      loadCatalogProducts();
    }
  }, [linkDialogOpen]);

  const loadData = async () => {
    try {
      console.log('🔄 InvoicesSection.loadData() called');
      setLoading(true);
      
      const filters: InvoiceFilters = {};
      if (filterSupplier !== 'all') {
        filters.supplier = filterSupplier;
      }
      if (filterStatus !== 'all') {
        filters.isPaid = filterStatus === 'paid';
      }
      if (dateFrom) {
        filters.dateFrom = dateFrom;
      }
      if (dateTo) {
        filters.dateTo = dateTo;
      }

      const [loadedInvoices, invoiceStats] = await Promise.all([
        InvoiceService.getInvoices(filters),
        InvoiceService.getInvoiceStats()
      ]);

      setInvoices(loadedInvoices);
      setStats(invoiceStats);

      const uniqueSuppliers = [...new Set(loadedInvoices.map(inv => inv.supplier_name))]
        .filter(supplier => supplier && supplier.trim() !== '');
      setSuppliers(uniqueSuppliers);

      // Load product links
      await loadProductLinks();
    } catch (error) {
      console.error('❌ Error loading invoices in InvoicesSection:', error);
      toast.error(t('invoicesSection.errorLoadingInvoices'));
    } finally {
      setLoading(false);
    }
  };

  const loadProductLinks = async () => {
    try {
      const links = await InvoiceService.getProductLinks();
      const linkMap = new Map<string, string>();
      links.forEach(link => {
        const key = `${link.invoice_id}_${link.invoice_product_name}`;
        linkMap.set(key, link.catalog_product_id);
      });
      setProductLinks(linkMap);
    } catch (error) {
      console.error('❌ Error loading product links:', error);
    }
  };

  const loadCatalogProducts = async () => {
    try {
      setLoadingProducts(true);
      const products = await getProducts();
      setCatalogProducts(products);
    } catch (error) {
      console.error('❌ Error loading catalog products:', error);
      toast.error('Errore caricando prodotti dal catalogo');
    } finally {
      setLoadingProducts(false);
    }
  };

  const toggleInvoiceExpansion = (invoiceId: string) => {
    setExpandedInvoices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId);
      } else {
        newSet.add(invoiceId);
      }
      return newSet;
    });
  };

  const handleOpenLinkDialog = (invoiceId: string, productName: string) => {
    setSelectedInvoiceProduct({ invoiceId, productName });
    setLinkDialogOpen(true);
    setProductSearchQuery('');
  };

  const handleLinkProduct = async (catalogProductId: string) => {
    if (!selectedInvoiceProduct) return;

    try {
      await InvoiceService.linkProduct(
        selectedInvoiceProduct.invoiceId,
        selectedInvoiceProduct.productName,
        catalogProductId
      );
      
      toast.success(t('invoicesSection.productLinked') || 'Prodotto collegato con successo');
      setLinkDialogOpen(false);
      await loadProductLinks();
    } catch (error) {
      console.error('❌ Error linking product:', error);
      toast.error(t('invoicesSection.errorLinkingProduct') || 'Errore collegando il prodotto');
    }
  };

  const handleUnlinkProduct = async (invoiceId: string, productName: string) => {
    try {
      await InvoiceService.unlinkProduct(invoiceId, productName);
      toast.success(t('invoicesSection.productUnlinked') || 'Collegamento rimosso');
      await loadProductLinks();
    } catch (error) {
      console.error('❌ Error unlinking product:', error);
      toast.error(t('invoicesSection.errorUnlinkingProduct') || 'Errore rimuovendo il collegamento');
    }
  };

  const getLinkedProduct = (invoiceId: string, productName: string): Product | null => {
    const key = `${invoiceId}_${productName}`;
    const catalogProductId = productLinks.get(key);
    if (!catalogProductId) return null;
    
    return catalogProducts.find(p => p.id === catalogProductId) || null;
  };

  const calculatePriceDifference = (invoicePrice: number, catalogPrice: number) => {
    const diff = invoicePrice - catalogPrice;
    const percent = catalogPrice > 0 ? (diff / catalogPrice) * 100 : 0;
    return { diff, percent };
  };

  const handleTogglePaymentStatus = async (invoice: InvoiceType) => {
    try {
      if (invoice.is_paid) {
        await InvoiceService.markAsUnpaid(invoice.id);
        toast.success(t('invoicesSection.invoiceMarkedUnpaid'));
      } else {
        await InvoiceService.markAsPaid(invoice.id);
        toast.success(t('invoicesSection.invoiceMarkedPaid'));
      }
      
      await loadData();
      
      if (onInvoicesChanged) {
        onInvoicesChanged();
      }
    } catch (error) {
      console.error('❌ Error toggling payment status:', error);
      toast.error(t('invoicesSection.errorUpdatingStatus'));
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm(t('invoicesSection.confirmDeleteInvoice'))) return;

    try {
      await InvoiceService.deleteInvoice(invoiceId);
      toast.success(t('invoicesSection.invoiceDeleted'));
      await loadData();
      
      if (onInvoicesChanged) {
        onInvoicesChanged();
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error(t('invoicesSection.errorDeletingInvoice'));
    }
  };

  const handleExportExcel = async () => {
    try {
      const blob = await InvoiceService.exportToExcel({
        include_paid: filterStatus !== 'unpaid',
        include_unpaid: filterStatus !== 'paid',
        suppliers: filterSupplier !== 'all' ? [filterSupplier] : undefined
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fatture_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(t('invoicesSection.exportExcelCompleted'));
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error(t('invoicesSection.errorExportingExcel'));
    }
  };

  const handleExportCSV = async () => {
    try {
      const csv = await InvoiceService.exportToCSV({
        include_paid: filterStatus !== 'unpaid',
        include_unpaid: filterStatus !== 'paid',
        suppliers: filterSupplier !== 'all' ? [filterSupplier] : undefined
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fatture_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(t('invoicesSection.exportCSVCompleted'));
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      toast.error(t('invoicesSection.errorExportingCSV'));
    }
  };

  const getVATBreakdown = (invoice: InvoiceType): VATBreakdown[] => {
    if (invoice.vat_breakdown && invoice.vat_breakdown.length > 0) {
      return invoice.vat_breakdown.map(item => ({
        rate: item.rate,
        amount: item.vatAmount
      }));
    }
    return [];
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy', { locale: it });
    } catch {
      return dateString;
    }
  };

  const getVATBadgeColor = (vatRate: number) => {
    if (vatRate === 0) return 'bg-gray-100 text-gray-600 border-gray-300';
    if (vatRate <= 5) return 'bg-blue-100 text-blue-600 border-blue-300';
    if (vatRate <= 10) return 'bg-green-100 text-green-600 border-green-300';
    if (vatRate <= 20) return 'bg-yellow-100 text-yellow-600 border-yellow-300';
    return 'bg-red-100 text-red-600 border-red-300';
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const filteredCatalogProducts = catalogProducts.filter(product =>
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    product.category?.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const PaginationControls = () => (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-2">
        <Label className="text-sm text-slate-600">{t('invoicesSection.itemsPerPage') || 'Fatture per pagina'}:</Label>
        <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">
          {t('invoicesSection.page') || 'Pagina'} {currentPage} {t('invoicesSection.of') || 'di'} {totalPages}
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-slate-600">{t('invoicesSection.loadingInvoices')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">{t('invoicesSection.totalInvoices')}</p>
                <p className="text-3xl font-bold text-blue-600">{stats.total_invoices}</p>
              </div>
              <FileText className="h-12 w-12 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">{t('invoicesSection.paid')}</p>
                <p className="text-3xl font-bold text-green-600">{stats.paid_invoices}</p>
                <p className="text-xs text-slate-500 mt-1">{formatPrice(stats.paid_amount, currency)}</p>
              </div>
              <CheckCircle2 className="h-12 w-12 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">{t('invoicesSection.unpaid')}</p>
                <p className="text-3xl font-bold text-orange-600">{stats.unpaid_invoices}</p>
                <p className="text-xs text-slate-500 mt-1">{formatPrice(stats.unpaid_amount, currency)}</p>
              </div>
              <Circle className="h-12 w-12 text-orange-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">{t('invoicesSection.searchInvoice')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('invoicesSection.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm mb-2 block">{t('invoicesSection.state')}</Label>
                <Select value={filterStatus} onValueChange={(value: 'all' | 'paid' | 'unpaid') => setFilterStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('invoicesSection.all')}</SelectItem>
                    <SelectItem value="paid">{t('invoicesSection.paidStatus')}</SelectItem>
                    <SelectItem value="unpaid">{t('invoicesSection.unpaidStatus')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm mb-2 block">{t('invoicesSection.supplier')}</Label>
                <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('invoicesSection.allSuppliers')}</SelectItem>
                    {suppliers.map(supplier => (
                      <SelectItem key={supplier} value={supplier}>
                        {supplier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm mb-2 block">{t('invoicesSection.dateFrom')}</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-sm mb-2 block">{t('invoicesSection.dateTo')}</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {t('invoicesSection.exportExcel')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {t('invoicesSection.exportCSV')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                  setFilterSupplier('all');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                {t('invoicesSection.resetFilters')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredInvoices.length > 0 && <PaginationControls />}

      <div className="space-y-3">
        {filteredInvoices.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">{t('invoicesSection.noInvoicesFound')}</p>
              <p className="text-sm text-slate-500 mt-2">
                {t('invoicesSection.noInvoicesFoundDesc')}
              </p>
            </CardContent>
          </Card>
        ) : (
          paginatedInvoices.map((invoice) => {
            const vatBreakdown = getVATBreakdown(invoice);
            const isExpanded = expandedInvoices.has(invoice.id);
            // ✅ Normalize invoice items to handle both OCR and invoice field naming conventions
            const invoiceProducts: InvoiceProduct[] = (invoice.items || []).map(normalizeInvoiceItem);

            return (
              <Card key={invoice.id} className="hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4">
                    {/* Invoice Header */}
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleInvoiceExpansion(invoice.id)}
                              className="h-8 w-8 p-0"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                            <div>
                              <h3 className="font-bold text-lg text-slate-800">
                                {invoice.invoice_number}
                              </h3>
                              <p className="text-sm text-slate-600">{invoice.supplier_name}</p>
                            </div>
                          </div>
                          <Badge
                            className={invoice.is_paid 
                              ? 'bg-green-600 hover:bg-green-700' 
                              : 'bg-orange-600 hover:bg-orange-700'
                            }
                          >
                            {invoice.is_paid ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {t('paid')}
                              </>
                            ) : (
                              <>
                                <Circle className="h-3 w-3 mr-1" />
                                {t('unpaid')}
                              </>
                            )}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-slate-600">{t('date')}</p>
                            <p className="font-semibold flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(invoice.date)}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-600">{t('amount')}</p>
                            <p className="font-semibold text-indigo-600">
                              {formatPrice(invoice.total_amount, currency)}
                            </p>
                          </div>
                          {invoice.payment_date && (
                            <div>
                              <p className="text-slate-600">{t('invoicesSection.paymentDate')}</p>
                              <p className="font-semibold text-green-600">
                                {formatDate(invoice.payment_date)}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* VAT Breakdown Summary */}
                        {vatBreakdown.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="text-xs text-slate-500">{t('invoicesSection.vat')}:</span>
                            {vatBreakdown.map((vat, idx) => (
                              <Badge 
                                key={idx} 
                                variant="outline" 
                                className={`text-xs ${getVATBadgeColor(vat.rate)}`}
                              >
                                {vat.rate}% - {formatPrice(vat.amount, currency)}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {invoice.notes && (
                          <p className="text-sm text-slate-600 mt-3 italic">
                            📝 {invoice.notes}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex md:flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePaymentStatus(invoice);
                          }}
                          className={invoice.is_paid 
                            ? 'hover:bg-orange-100 hover:text-orange-600' 
                            : 'hover:bg-green-100 hover:text-green-600'
                          }
                        >
                          {invoice.is_paid ? (
                            <>
                              <Circle className="h-4 w-4 mr-2" />
                              {t('invoicesSection.markAsUnpaid')}
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              {t('invoicesSection.markAsPaid')}
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteInvoice(invoice.id);
                          }}
                          className="hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Products List */}
                    {isExpanded && invoiceProducts.length > 0 && (
                      <div className="mt-4 border-t pt-4">
                        <h4 className="font-semibold text-sm text-slate-700 mb-3">
                          {t('invoicesSection.products') || 'Prodotti'} ({invoiceProducts.length})
                        </h4>
                        <div className="space-y-2">
                          {invoiceProducts.map((product, idx) => {
                            const linkedProduct = getLinkedProduct(invoice.id, product.name);
                            const isLinked = !!linkedProduct;
                            const priceDiff = linkedProduct 
                              ? calculatePriceDifference(product.unit_price, linkedProduct.price)
                              : null;

                            return (
                              <div 
                                key={idx} 
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm">{product.name}</p>
                                    {isLinked && (
                                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        {t('invoicesSection.linked') || 'Collegato'}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-3 text-xs text-slate-600 mt-1">
                                    <span>{t('invoicesSection.quantity') || 'Quantità'}: {product.quantity}</span>
                                    <span>{t('invoicesSection.unitPrice') || 'Prezzo unitario'}: {formatPrice(product.unit_price, currency)}</span>
                                    <span className="font-semibold">{t('invoicesSection.total') || 'Totale'}: {formatPrice(product.total, currency)}</span>
                                    {product.vat_rate !== undefined && (
                                      <span>IVA: {product.vat_rate}%</span>
                                    )}
                                  </div>
                                  
                                  {/* Price Comparison */}
                                  {linkedProduct && priceDiff && (
                                    <div className="mt-2 p-2 bg-white rounded border border-slate-200">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-600">
                                          {t('invoicesSection.catalogPrice') || 'Prezzo catalogo'}: {formatPrice(linkedProduct.price, currency)}
                                        </span>
                                        <span className={`font-semibold ${priceDiff.diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                          {priceDiff.diff > 0 ? '+' : ''}{formatPrice(priceDiff.diff, currency)} 
                                          ({priceDiff.percent > 0 ? '+' : ''}{(Number(priceDiff.percent) || 0).toFixed(1)}%)
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex gap-1 ml-4">
                                  {isLinked ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleUnlinkProduct(invoice.id, product.name)}
                                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                      title={t('invoicesSection.unlinkProduct') || 'Rimuovi collegamento'}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleOpenLinkDialog(invoice.id, product.name)}
                                      className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      title={t('invoicesSection.linkProduct') || 'Collega prodotto'}
                                    >
                                      <LinkIcon className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {filteredInvoices.length > 0 && <PaginationControls />}

      {/* Product Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('invoicesSection.linkProductTitle') || 'Collega prodotto al catalogo'}</DialogTitle>
            <DialogDescription>
              {t('invoicesSection.linkProductDesc') || 'Seleziona un prodotto dal catalogo per confrontare i prezzi'}
              {selectedInvoiceProduct && (
                <span className="block mt-2 font-semibold text-slate-700">
                  {selectedInvoiceProduct.productName}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t('invoicesSection.searchCatalogProducts') || 'Cerca prodotti nel catalogo...'}
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Products List */}
            <div className="flex-1 overflow-y-auto border rounded-lg">
              {loadingProducts ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : filteredCatalogProducts.length === 0 ? (
                <div className="text-center p-8 text-slate-500">
                  {t('invoicesSection.noProductsFound') || 'Nessun prodotto trovato'}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredCatalogProducts.map(product => (
                    <div
                      key={product.id}
                      className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => handleLinkProduct(product.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{product.name}</p>
                          <div className="flex gap-3 text-xs text-slate-600 mt-1">
                            <span>{formatPrice(product.price, currency)}</span>
                            {product.unit && <span>{product.unit}</span>}
                            {product.category && <span className="text-slate-500">• {product.category}</span>}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLinkProduct(product.id);
                          }}
                        >
                          {t('invoicesSection.select') || 'Seleziona'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
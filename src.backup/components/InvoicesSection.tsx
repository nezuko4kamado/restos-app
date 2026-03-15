import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Search, 
  Filter, 
  Download,
  Upload,
  CheckCircle2,
  Circle,
  Calendar,
  DollarSign,
  TrendingUp,
  Eye,
  Trash2,
  FileSpreadsheet,
  Camera
} from 'lucide-react';
import { InvoiceService, type Invoice as InvoiceType, type InvoiceFilters } from '@/lib/invoiceService';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  original_price?: number;
  vat_rate?: number;
  discount_percent?: number;
}

export function InvoicesSection() {
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
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [filterStatus, filterSupplier, dateFrom, dateTo]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const filters: InvoiceFilters = {};
      if (filterSupplier !== 'all') filters.supplier = filterSupplier;
      if (filterStatus !== 'all') filters.isPaid = filterStatus === 'paid';
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;

      const [loadedInvoices, invoiceStats] = await Promise.all([
        InvoiceService.getInvoices(filters),
        InvoiceService.getInvoiceStats()
      ]);

      setInvoices(loadedInvoices);
      setStats(invoiceStats);

      // Extract unique suppliers
      const uniqueSuppliers = [...new Set(loadedInvoices.map(inv => inv.supplier_name))];
      setSuppliers(uniqueSuppliers);
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast.error('Errore nel caricamento delle fatture');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePaymentStatus = async (invoice: InvoiceType) => {
    try {
      if (invoice.is_paid) {
        await InvoiceService.markAsUnpaid(invoice.id);
        toast.success('Fattura segnata come non pagata');
      } else {
        await InvoiceService.markAsPaid(invoice.id);
        toast.success('Fattura segnata come pagata');
      }
      await loadData();
    } catch (error) {
      console.error('Error toggling payment status:', error);
      toast.error('Errore nell\'aggiornamento dello stato');
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa fattura?')) return;

    try {
      await InvoiceService.deleteInvoice(invoiceId);
      toast.success('Fattura eliminata');
      await loadData();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Errore nell\'eliminazione della fattura');
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

      toast.success('Export Excel completato');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Errore nell\'export Excel');
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

      toast.success('Export CSV completato');
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      toast.error('Errore nell\'export CSV');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy', { locale: it });
    } catch {
      return dateString;
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-slate-600">Caricamento fatture...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Totale Fatture</p>
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
                <p className="text-sm text-slate-600 mb-1">Pagate</p>
                <p className="text-3xl font-bold text-green-600">{stats.paid_invoices}</p>
                <p className="text-xs text-slate-500 mt-1">{formatCurrency(stats.paid_amount)}</p>
              </div>
              <CheckCircle2 className="h-12 w-12 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Non Pagate</p>
                <p className="text-3xl font-bold text-orange-600">{stats.unpaid_invoices}</p>
                <p className="text-xs text-slate-500 mt-1">{formatCurrency(stats.unpaid_amount)}</p>
              </div>
              <Circle className="h-12 w-12 text-orange-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">IVA Totale</p>
                <p className="text-3xl font-bold text-purple-600">{formatCurrency(stats.total_vat)}</p>
              </div>
              <DollarSign className="h-12 w-12 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Search */}
            <div>
              <Label className="text-sm mb-2 block">Cerca Fattura</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Numero fattura, fornitore, note..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm mb-2 block">Stato</Label>
                <Select value={filterStatus} onValueChange={(value: 'all' | 'paid' | 'unpaid') => setFilterStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte</SelectItem>
                    <SelectItem value="paid">Pagate</SelectItem>
                    <SelectItem value="unpaid">Non Pagate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Fornitore</Label>
                <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i fornitori</SelectItem>
                    {suppliers.map(supplier => (
                      <SelectItem key={supplier} value={supplier}>
                        {supplier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Data Da</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-sm mb-2 block">Data A</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
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
                Reset Filtri
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <div className="space-y-3">
        {filteredInvoices.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">Nessuna fattura trovata</p>
              <p className="text-sm text-slate-500 mt-2">
                Prova a modificare i filtri o aggiungi una nuova fattura
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredInvoices.map((invoice) => (
            <Card 
              key={invoice.id} 
              className="hover:shadow-lg transition-all cursor-pointer"
              onClick={() => setExpandedInvoice(expandedInvoice === invoice.id ? null : invoice.id)}
            >
              <CardContent className="p-6">
                {/* Main Info */}
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-lg text-slate-800">
                          {invoice.invoice_number}
                        </h3>
                        <p className="text-sm text-slate-600">{invoice.supplier_name}</p>
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
                            Pagata
                          </>
                        ) : (
                          <>
                            <Circle className="h-3 w-3 mr-1" />
                            Non Pagata
                          </>
                        )}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-slate-600">Data</p>
                        <p className="font-semibold flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(invoice.invoice_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600">Importo</p>
                        <p className="font-semibold text-indigo-600">
                          {formatCurrency(invoice.total_amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600">IVA</p>
                        <p className="font-semibold">
                          {formatCurrency(invoice.vat_amount)}
                        </p>
                      </div>
                      {invoice.payment_date && (
                        <div>
                          <p className="text-slate-600">Data Pagamento</p>
                          <p className="font-semibold text-green-600">
                            {formatDate(invoice.payment_date)}
                          </p>
                        </div>
                      )}
                    </div>

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
                          Segna Non Pagata
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Segna Pagata
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

                {/* Expanded Details */}
                {expandedInvoice === invoice.id && invoice.items && invoice.items.length > 0 && (
                  <div className="mt-6 pt-6 border-t-2 border-slate-200">
                    <h4 className="font-semibold text-slate-800 mb-4">
                      Prodotti ({invoice.items.length})
                    </h4>
                    <div className="space-y-2">
                      {(invoice.items as InvoiceItem[]).map((item: InvoiceItem, idx: number) => (
                        <div 
                          key={idx}
                          className="p-3 bg-slate-50 rounded-lg flex justify-between items-center"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800">{item.name}</p>
                            <div className="flex items-center gap-3 text-sm text-slate-600 mt-1">
                              <span>Qtà: {item.quantity}</span>
                              {item.vat_rate && <span>IVA: {item.vat_rate}%</span>}
                              {item.discount_percent && (
                                <Badge variant="outline" className="text-green-600 border-green-300">
                                  -{item.discount_percent}%
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-indigo-600">
                              {formatCurrency(item.price)}
                            </p>
                            {item.original_price && item.original_price !== item.price && (
                              <p className="text-sm text-slate-500 line-through">
                                {formatCurrency(item.original_price)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
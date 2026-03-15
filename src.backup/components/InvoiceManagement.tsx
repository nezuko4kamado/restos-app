import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, Upload, FileText, AlertTriangle, TrendingUp, TrendingDown, Check, X, ChevronDown, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import type { Invoice, Product, Supplier, ExtractedInvoiceItem } from '@/types';
import { extractInvoiceData, type InvoiceDataExtracted } from '@/lib/ocrService';
import { ProductMatcher } from '@/lib/productMatcher';
import { calculateInvoiceStats, formatCurrency } from '@/lib/invoiceStats';
import { useTranslations, type Language } from '@/lib/i18n';

interface InvoiceManagementProps {
  supplierId: string;
  supplierName: string;
  invoices: Invoice[];
  products: Product[];
  suppliers: Supplier[];
  onAddInvoice: (invoice: Invoice) => Promise<void>;
  onDeleteInvoice: (invoiceId: string) => void;
  onUpdateInvoice?: (invoice: Invoice) => Promise<void>;
  onUpdateProducts: () => void;
  onAddProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
  pendingInvoiceFile?: File;
  pendingInvoiceData?: InvoiceDataExtracted;
  language?: Language;
}

interface GroupedInvoices {
  [year: string]: {
    [month: string]: Invoice[];
  };
}

function InvoiceManagement({
  supplierId,
  supplierName,
  invoices,
  products,
  suppliers,
  onAddInvoice,
  onDeleteInvoice,
  onUpdateInvoice,
  onUpdateProducts,
  onAddProduct,
  isOpen,
  onClose,
  pendingInvoiceFile,
  pendingInvoiceData,
  language = 'it',
}: InvoiceManagementProps) {
  const t = useTranslations(language);
  const [newInvoice, setNewInvoice] = useState({
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    notes: '',
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<InvoiceDataExtracted | null>(null);
  const [extractedItems, setExtractedItems] = useState<ExtractedInvoiceItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual');
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // Handle pending invoice from parent
  useEffect(() => {
    if (pendingInvoiceFile && pendingInvoiceData) {
      console.log('📄 Processing pending invoice:', pendingInvoiceFile.name);
      setSelectedFile(pendingInvoiceFile);
      setExtractedData(pendingInvoiceData);
      processExtractedData(pendingInvoiceData);
      setActiveTab('upload');
    }
  }, [pendingInvoiceFile, pendingInvoiceData]);

  // Auto-expand the most recent year and month when dialog opens
  useEffect(() => {
    if (isOpen && invoices.length > 0) {
      const groupedInvoices = groupInvoicesByYearMonth(invoices);
      const years = Object.keys(groupedInvoices).sort((a, b) => parseInt(b) - parseInt(a));
      
      if (years.length > 0) {
        const latestYear = years[0];
        setExpandedYears(new Set([latestYear]));
        
        const months = Object.keys(groupedInvoices[latestYear]);
        if (months.length > 0) {
          const monthNames = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 
                             'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
          const sortedMonths = months.sort((a, b) => 
            monthNames.indexOf(b.toLowerCase()) - monthNames.indexOf(a.toLowerCase())
          );
          const latestMonth = sortedMonths[0];
          setExpandedMonths(new Set([`${latestYear}-${latestMonth}`]));
        }
      }
    }
  }, [isOpen, invoices.length]);

  const processExtractedData = async (data: InvoiceDataExtracted) => {
    console.log('🔍 Processing extracted data:', data);
    
    // Set invoice basic info
    if (data.invoiceNumber) {
      setNewInvoice(prev => ({ ...prev, invoiceNumber: data.invoiceNumber || '' }));
    }
    if (data.date) {
      setNewInvoice(prev => ({ ...prev, date: data.date || '' }));
    }
    if (data.totalAmount) {
      setNewInvoice(prev => ({ ...prev, amount: data.totalAmount?.toString() || '' }));
    } else if (data.amount) {
      setNewInvoice(prev => ({ ...prev, amount: data.amount?.toString() || '' }));
    }

    // Process items and match with existing products
    if (data.items && data.items.length > 0) {
      const supplierProducts = products.filter(p => p.supplierId === supplierId || p.supplier_id === supplierId);
      
      const processedItems: ExtractedInvoiceItem[] = [];
      
      for (const item of data.items) {
        const matchResult = await ProductMatcher.matchProduct(
          item.name,
          undefined, // ean_code
          supplierName
        );
        
        if (matchResult.matched && matchResult.product && matchResult.confidence >= 70) {
          const matchedProduct = matchResult.product;
          const priceChanged = Math.abs(matchedProduct.price - item.price) > 0.01;
          const priceChangePercent = priceChanged 
            ? ((item.price - matchedProduct.price) / matchedProduct.price) * 100 
            : 0;

          processedItems.push({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            originalPrice: item.originalPrice,
            discountPercent: item.discountPercent,
            vatRate: item.vatRate,
            matchedProductId: matchedProduct.id,
            matchScore: matchResult.confidence,
            matchStatus: matchResult.confidence >= 90 ? 'matched' : 'partial',
            priceChanged,
            oldPrice: matchedProduct.price,
            priceChangePercent,
          });
        } else {
          processedItems.push({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            originalPrice: item.originalPrice,
            discountPercent: item.discountPercent,
            vatRate: item.vatRate,
            matchStatus: 'new' as const,
          });
        }
      }

      setExtractedItems(processedItems);
      console.log('✅ Processed items:', processedItems);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      console.log('📤 Uploading file:', file.name);
      const data = await extractInvoiceData(file);
      console.log('✅ Extracted data:', data);
      
      setExtractedData(data);
      await processExtractedData(data);
      
      toast.success(`✅ ${t.invoiceProcessedSuccess}`);
    } catch (error) {
      console.error('❌ Error processing invoice:', error);
      toast.error(t.invoiceProcessingError);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddManualInvoice = async () => {
    if (!newInvoice.invoiceNumber || !newInvoice.amount) {
      toast.error(t.fillRequiredFields);
      return;
    }

    console.log('💾 Creating manual invoice...');
    console.log('  - supplierId:', supplierId);
    console.log('  - invoiceNumber:', newInvoice.invoiceNumber);
    console.log('  - date:', newInvoice.date);
    console.log('  - amount:', newInvoice.amount);

    const invoice: Invoice = {
      id: crypto.randomUUID(),
      supplierId: supplierId,
      supplier_id: supplierId,
      invoiceNumber: newInvoice.invoiceNumber,
      invoice_number: newInvoice.invoiceNumber,
      date: newInvoice.date,
      amount: parseFloat(newInvoice.amount),
      notes: newInvoice.notes,
      items: [],
      isPaid: false, // Default to unpaid
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    console.log('📋 Invoice object created:', invoice);

    try {
      await onAddInvoice(invoice);
      setNewInvoice({
        invoiceNumber: '',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        notes: '',
      });
      toast.success(`✅ ${t.invoiceAddedSuccess}`);
    } catch (error) {
      console.error('❌ Error adding invoice:', error);
      if (error instanceof Error) {
        toast.error(`${t.error}: ${error.message}`);
      } else {
        toast.error(t.invoiceAddError);
      }
    }
  };

  const handleAddExtractedInvoice = async () => {
    if (!extractedData || !newInvoice.invoiceNumber) {
      toast.error(t.incompleteInvoiceData);
      return;
    }

    console.log('💾 Adding extracted invoice...');
    console.log('  - supplierId:', supplierId);
    console.log('  - invoiceNumber:', newInvoice.invoiceNumber);
    console.log('  - date:', newInvoice.date);
    console.log('  - amount:', newInvoice.amount);
    console.log('  - items count:', extractedItems.length);

    try {
      // Create invoice object
      const invoice: Invoice = {
        id: crypto.randomUUID(),
        supplierId: supplierId,
        supplier_id: supplierId,
        invoiceNumber: newInvoice.invoiceNumber,
        invoice_number: newInvoice.invoiceNumber,
        date: newInvoice.date,
        amount: parseFloat(newInvoice.amount || '0'),
        notes: newInvoice.notes,
        items: extractedItems,
        isPaid: false, // Default to unpaid
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      console.log('📋 Invoice object created:', invoice);

      // Save invoice
      await onAddInvoice(invoice);
      console.log('✅ Invoice saved successfully');

      // Process items - add new products or update prices
      for (const item of extractedItems) {
        if (item.matchStatus === 'new') {
          // Add new product
          console.log('➕ Adding new product:', item.name);
          const newProduct: Omit<Product, 'id'> = {
            name: item.name,
            price: item.price,
            supplierId: supplierId,
            supplier_id: supplierId,
            vatRate: item.vatRate,
            discountPercent: item.discountPercent,
            originalPrice: item.originalPrice,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await onAddProduct(newProduct);
        } else if (item.matchedProductId && item.priceChanged) {
          // Log price change (actual update would need an updateProduct function)
          console.log('📝 Product price changed:', item.name, 'from', item.oldPrice, 'to', item.price);
        }
      }

      onUpdateProducts();
      
      // Reset form
      setNewInvoice({
        invoiceNumber: '',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        notes: '',
      });
      setExtractedData(null);
      setExtractedItems([]);
      setSelectedFile(null);
      
      toast.success(`✅ ${t.invoiceAddedSuccess}`);
    } catch (error) {
      console.error('❌ Error adding invoice:', error);
      if (error instanceof Error) {
        toast.error(`${t.error}: ${error.message}`);
      } else {
        toast.error(t.invoiceAddError);
      }
    }
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    if (confirm(t.confirmDeleteInvoice)) {
      onDeleteInvoice(invoiceId);
      toast.success(t.invoiceDeleted);
    }
  };

  const handleTogglePaymentStatus = async (invoice: Invoice) => {
    if (!onUpdateInvoice) {
      toast.error(t.featureNotAvailable);
      return;
    }

    const updatedInvoice = {
      ...invoice,
      isPaid: !invoice.isPaid,
      updated_at: new Date().toISOString(),
    };

    try {
      await onUpdateInvoice(updatedInvoice);
      toast.success(updatedInvoice.isPaid ? t.invoiceMarkedPaid : t.invoiceMarkedUnpaid);
    } catch (error) {
      console.error('❌ Error updating invoice:', error);
      toast.error(t.invoiceUpdateError);
    }
  };

  // Group invoices by year and month
  const groupInvoicesByYearMonth = (invoices: Invoice[]): GroupedInvoices => {
    const grouped: GroupedInvoices = {};
    
    invoices.forEach(invoice => {
      const date = new Date(invoice.date);
      const year = date.getFullYear().toString();
      const month = date.toLocaleDateString('it-IT', { month: 'long' });
      
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

  const stats = calculateInvoiceStats(invoices);
  const groupedInvoices = groupInvoicesByYearMonth(invoices);
  const years = Object.keys(groupedInvoices).sort((a, b) => parseInt(b) - parseInt(a));

  // Calculate paid/unpaid statistics
  const paidInvoices = invoices.filter(inv => inv.isPaid);
  const unpaidInvoices = invoices.filter(inv => !inv.isPaid);
  const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            {t.invoiceManagement} - {supplierName}
          </DialogTitle>
        </DialogHeader>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Card className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
            <p className="text-xs text-slate-600 mb-1">{t.totalSpent}</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(stats.totalSpent)}</p>
          </Card>
          <Card className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
            <p className="text-xs text-slate-600 mb-1">{t.monthlyAverage}</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.averageMonthlySpent)}</p>
          </Card>
          <Card className="p-3 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
            <p className="text-xs text-slate-600 mb-1">{t.totalInvoices}</p>
            <p className="text-lg font-bold text-purple-600">{stats.totalInvoices}</p>
          </Card>
          <Card className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200">
            <p className="text-xs text-slate-600 mb-1">{t.totalPaid}</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
          </Card>
          <Card className="p-3 bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200">
            <p className="text-xs text-slate-600 mb-1">{t.totalUnpaid}</p>
            <p className="text-lg font-bold text-orange-600">{formatCurrency(totalUnpaid)}</p>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'manual' | 'upload')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">{t.manualEntry}</TabsTrigger>
            <TabsTrigger value="upload">{t.uploadInvoice}</TabsTrigger>
          </TabsList>

          {/* Manual Entry Tab */}
          <TabsContent value="manual" className="space-y-4">
            <div className="space-y-4 p-4 border-2 border-slate-200 rounded-xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t.invoiceNumber} *</Label>
                  <Input
                    value={newInvoice.invoiceNumber}
                    onChange={(e) => setNewInvoice({ ...newInvoice, invoiceNumber: e.target.value })}
                    placeholder="FT-2024-001"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>{t.date} *</Label>
                  <Input
                    type="date"
                    value={newInvoice.date}
                    onChange={(e) => setNewInvoice({ ...newInvoice, date: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <Label>{t.amount} (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newInvoice.amount}
                  onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                  placeholder="0.00"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>{t.notes}</Label>
                <Textarea
                  value={newInvoice.notes}
                  onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                  placeholder={`${t.notes}...`}
                  className="mt-2"
                />
              </div>
              <Button 
                onClick={handleAddManualInvoice}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t.addInvoice}
              </Button>
            </div>
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-4">
              {!extractedData ? (
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
                  <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600 mb-4">{t.uploadInvoicePdfOrImage}</p>
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    disabled={isProcessing}
                    className="max-w-xs mx-auto"
                  />
                  {isProcessing && (
                    <p className="text-sm text-slate-500 mt-4">{t.processingInProgress}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Invoice Details */}
                  <div className="p-4 border-2 border-indigo-200 bg-indigo-50 rounded-xl space-y-4">
                    <h3 className="font-semibold text-slate-800">{t.invoiceData}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{t.invoiceNumber} *</Label>
                        <Input
                          value={newInvoice.invoiceNumber}
                          onChange={(e) => setNewInvoice({ ...newInvoice, invoiceNumber: e.target.value })}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>{t.date} *</Label>
                        <Input
                          type="date"
                          value={newInvoice.date}
                          onChange={(e) => setNewInvoice({ ...newInvoice, date: e.target.value })}
                          className="mt-2"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>{t.amount} (€) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newInvoice.amount}
                        onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                        className="mt-2"
                      />
                    </div>
                  </div>

                  {/* Extracted Items */}
                  {extractedItems.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-slate-800">{t.extractedProducts} ({extractedItems.length})</h3>
                      {extractedItems.map((item, index) => (
                        <Card key={index} className={`p-4 ${
                          item.matchStatus === 'matched' ? 'border-2 border-green-200 bg-green-50' :
                          item.matchStatus === 'partial' ? 'border-2 border-yellow-200 bg-yellow-50' :
                          'border-2 border-blue-200 bg-blue-50'
                        }`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="font-semibold text-slate-800">{item.name}</p>
                                {item.matchStatus === 'matched' && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                    ✓ {t.match} {item.matchScore}%
                                  </span>
                                )}
                                {item.matchStatus === 'partial' && (
                                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                                    ~ {t.partial} {item.matchScore}%
                                  </span>
                                )}
                                {item.matchStatus === 'new' && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                    + {t.new}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-slate-600">{t.qty}: {item.quantity}</span>
                                <span className="font-bold text-slate-800">€{item.price.toFixed(2)}</span>
                                {item.vatRate && (
                                  <span className="text-xs bg-slate-100 px-2 py-1 rounded">IVA {item.vatRate}%</span>
                                )}
                                {item.discountPercent && (
                                  <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                                    -{item.discountPercent}%
                                  </span>
                                )}
                              </div>
                              {item.priceChanged && (
                                <Alert className="mt-2 border-orange-200 bg-orange-50">
                                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                                  <AlertDescription className="text-sm">
                                    <div className="flex items-center gap-2">
                                      <span>{t.priceChanged}: €{item.oldPrice?.toFixed(2)} → €{item.price.toFixed(2)}</span>
                                      {item.priceChangePercent && (
                                        <span className={`flex items-center gap-1 ${
                                          item.priceChangePercent > 0 ? 'text-red-600' : 'text-green-600'
                                        }`}>
                                          {item.priceChangePercent > 0 ? (
                                            <TrendingUp className="h-3 w-3" />
                                          ) : (
                                            <TrendingDown className="h-3 w-3" />
                                          )}
                                          {Math.abs(item.priceChangePercent).toFixed(1)}%
                                        </span>
                                      )}
                                    </div>
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button 
                      onClick={handleAddExtractedInvoice}
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t.addInvoice}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setExtractedData(null);
                        setExtractedItems([]);
                        setSelectedFile(null);
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      {t.cancel}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Invoice List - Grouped by Year and Month */}
        <div className="mt-6 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">{t.registeredInvoices} ({invoices.length})</h3>
            <p className="text-xs text-slate-500 italic">💡 {t.clickToExpandYearMonth}</p>
          </div>
          {invoices.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t.noInvoicesRegistered}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {years.map(year => {
                const yearExpanded = expandedYears.has(year);
                const months = Object.keys(groupedInvoices[year]).sort((a, b) => {
                  const monthNames = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 
                                     'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
                  return monthNames.indexOf(b.toLowerCase()) - monthNames.indexOf(a.toLowerCase());
                });
                const yearTotal = months.reduce((sum, month) => {
                  return sum + groupedInvoices[year][month].reduce((s, inv) => s + inv.amount, 0);
                }, 0);
                
                return (
                  <div key={year} className="border-2 border-slate-200 rounded-xl overflow-hidden">
                    {/* Year Header */}
                    <div 
                      className="flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
                      onClick={() => toggleYear(year)}
                    >
                      <div className="flex items-center gap-2">
                        {yearExpanded ? (
                          <ChevronDown className="h-5 w-5 text-slate-600" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-slate-600" />
                        )}
                        <span className="font-bold text-slate-800 text-lg">{year}</span>
                        <span className="text-sm text-slate-600">
                          ({months.reduce((sum, month) => sum + groupedInvoices[year][month].length, 0)} {t.invoices?.toLowerCase()})
                        </span>
                      </div>
                      <span className="font-bold text-indigo-600">{formatCurrency(yearTotal)}</span>
                    </div>
                    
                    {/* Months */}
                    {yearExpanded && (
                      <div className="divide-y divide-slate-200">
                        {months.map(month => {
                          const monthKey = `${year}-${month}`;
                          const monthExpanded = expandedMonths.has(monthKey);
                          const monthInvoices = groupedInvoices[year][month];
                          const monthTotal = monthInvoices.reduce((sum, inv) => sum + inv.amount, 0);
                          
                          return (
                            <div key={monthKey}>
                              {/* Month Header */}
                              <div 
                                className="flex justify-between items-center p-3 pl-8 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                                onClick={() => toggleMonth(monthKey)}
                              >
                                <div className="flex items-center gap-2">
                                  {monthExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-slate-500" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-slate-500" />
                                  )}
                                  <span className="font-semibold text-slate-700 capitalize">{month}</span>
                                  <span className="text-sm text-slate-500">({monthInvoices.length} {t.invoices?.toLowerCase()})</span>
                                </div>
                                <span className="font-bold text-blue-600">{formatCurrency(monthTotal)}</span>
                              </div>
                              
                              {/* Invoices */}
                              {monthExpanded && (
                                <div className="bg-slate-50 divide-y divide-slate-200">
                                  {monthInvoices.map((invoice) => (
                                    <div key={invoice.id} className="flex justify-between items-center p-3 pl-12 hover:bg-white transition-colors group">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="font-semibold text-slate-800">{invoice.invoiceNumber}</p>
                                          {invoice.isPaid ? (
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                                              <CheckCircle2 className="h-3 w-3" />
                                              {t.paid}
                                            </span>
                                          ) : (
                                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded flex items-center gap-1">
                                              <Circle className="h-3 w-3" />
                                              {t.unpaid}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-600">
                                          <span>{new Date(invoice.date).toLocaleDateString('it-IT')}</span>
                                          <span className="font-bold text-indigo-600">{formatCurrency(invoice.amount)}</span>
                                          {invoice.items && invoice.items.length > 0 && (
                                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                                              {invoice.items.length} {t.products?.toLowerCase()}
                                            </span>
                                          )}
                                        </div>
                                        {invoice.notes && (
                                          <p className="text-xs text-slate-500 mt-1 italic">{invoice.notes}</p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleTogglePaymentStatus(invoice);
                                          }}
                                          className={`hover:scale-105 transition-all ${
                                            invoice.isPaid 
                                              ? 'hover:bg-orange-100 hover:text-orange-600' 
                                              : 'hover:bg-green-100 hover:text-green-600'
                                          }`}
                                          title={invoice.isPaid ? t.markAsUnpaid : t.markAsPaid}
                                        >
                                          {invoice.isPaid ? (
                                            <Circle className="h-4 w-4" />
                                          ) : (
                                            <CheckCircle2 className="h-4 w-4" />
                                          )}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteInvoice(invoice.id);
                                          }}
                                          className="hover:bg-red-100 hover:text-red-600 transition-all"
                                          title={t.deleteInvoice}
                                        >
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      </div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default InvoiceManagement;
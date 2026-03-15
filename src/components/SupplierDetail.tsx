import { useState } from 'react';
import { Supplier, Product, Invoice } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Package, FileText, Upload, Calendar, TrendingUp, BarChart3, ZoomIn, ArrowUp, ArrowDown, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { extractDataFromImage } from '@/lib/ocrService';

// Safe toFixed helper - handles undefined, null, NaN
const safeToFixed = (value: number | undefined | null, decimals: number = 2): string => {
  if (value === undefined || value === null || isNaN(value)) return '0.' + '0'.repeat(decimals);
  return Number(value).toFixed(decimals);
};

interface SupplierDetailProps {
  supplier: Supplier;
  products: Product[];
  invoices: Invoice[];
  onBack: () => void;
  onAddInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoiceId: string) => void;
}

export default function SupplierDetail({
  supplier,
  products,
  invoices,
  onBack,
  onAddInvoice,
  onDeleteInvoice,
}: SupplierDetailProps) {
  const { t, language } = useLanguage();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Filter products for this supplier
  const supplierProducts = products.filter(p => p.supplierId === supplier.id);

  // Get unique categories
  const categories = ['all', ...new Set(supplierProducts.map(p => p.category).filter(Boolean))];

  // Filter products by category
  const filteredProducts = selectedCategory === 'all' 
    ? supplierProducts 
    : supplierProducts.filter(p => p.category === selectedCategory);

  // Group invoices by year and month
  const groupedInvoices = invoices.reduce((acc, invoice) => {
    const date = new Date(invoice.date);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    if (!acc[year]) acc[year] = {};
    if (!acc[year][month]) acc[year][month] = [];
    
    acc[year][month].push(invoice);
    return acc;
  }, {} as Record<number, Record<number, Invoice[]>>);

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  // Calculate price change for a product
  const calculatePriceChange = (product: Product) => {
    if (!product.priceHistory || product.priceHistory.length < 2) {
      return null;
    }

    // Get current price (most recent)
    const currentPrice = product.priceHistory[0].price;
    // Get previous price (second most recent)
    const previousPrice = product.priceHistory[1].price;

    if (!previousPrice || previousPrice === 0) return null;
    if (currentPrice === undefined || currentPrice === null) return null;

    const change = currentPrice - previousPrice;
    const changePercent = (change / previousPrice) * 100;

    return {
      change,
      changePercent,
      previousPrice,
      isIncrease: change > 0,
      isDecrease: change < 0,
    };
  };

  // Calculate statistics
  const calculateStats = () => {
    console.log('📊 [SUPPLIER DETAIL] calculateStats called with', invoices.length, 'invoices');
    
    // CRITICAL FIX: Use total_amount || totalAmount || amount
    const totalSpent = invoices.reduce((sum, inv) => {
      const amount = Number(inv.total_amount || inv.totalAmount || inv.amount || 0) || 0;
      console.log('📊 [SUPPLIER DETAIL] Invoice amount:', {
        id: inv.id,
        total_amount: inv.total_amount,
        totalAmount: inv.totalAmount,
        amount: inv.amount,
        used: amount
      });
      return sum + amount;
    }, 0);
    
    console.log('📊 [SUPPLIER DETAIL] Total spent:', totalSpent);
    
    // Group by month for trend
    const monthlySpending: Record<string, number> = {};
    invoices.forEach(inv => {
      const date = new Date(inv.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const amount = Number(inv.total_amount || inv.totalAmount || inv.amount || 0) || 0;
      monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + amount;
    });

    // Most purchased products
    const productCount: Record<string, { name: string; count: number; total: number }> = {};
    invoices.forEach(inv => {
      if (inv.items && Array.isArray(inv.items)) {
        inv.items.forEach(item => {
          if (!item || !item.name) return;
          const itemPrice = Number(item.price) || 0;
          const itemQuantity = Number(item.quantity) || 0;
          if (!productCount[item.name]) {
            productCount[item.name] = { name: item.name, count: 0, total: 0 };
          }
          productCount[item.name].count += itemQuantity;
          productCount[item.name].total += itemPrice * itemQuantity;
        });
      }
    });

    const topProducts = Object.values(productCount)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const averageInvoice = invoices.length > 0 ? totalSpent / invoices.length : 0;
    
    console.log('📊 [SUPPLIER DETAIL] Stats calculated:', {
      totalSpent,
      invoiceCount: invoices.length,
      averageInvoice
    });

    return {
      totalSpent,
      invoiceCount: invoices.length,
      monthlySpending,
      topProducts,
      averageInvoice,
    };
  };

  const stats = calculateStats();

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Convert image to base64 for storage
      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageUrl = event.target?.result as string;

        // Extract invoice data using OCR
        const result = await extractDataFromImage(file, 'invoice');
        
        if (!result.invoice?.date) {
          toast.error(t('invoiceProcessingError'));
          setIsUploading(false);
          return;
        }

        const newInvoice: Invoice = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          supplierId: supplier.id,
          date: result.invoice.date,
          imageUrl: imageUrl,
          amount: result.invoice.amount,
          items: result.invoice.items,
        };

        onAddInvoice(newInvoice);
        
        const invoiceDate = new Date(result.invoice.date);
        toast.success(`${t('invoiceAdded')}: ${invoiceDate.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US')}`);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('error'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteInvoice = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the invoice detail dialog
    
    if (confirm(t('confirmDeleteInvoice'))) {
      onDeleteInvoice(invoiceId);
      toast.success(t('invoiceDeleted'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold">{supplier.name}</h2>
          <p className="text-muted-foreground">
            {supplier.phone} {supplier.email && `• ${supplier.email}`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {t('products')} ({supplierProducts.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('invoices')} ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('statistics')}
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          {/* Category Filter */}
          {categories.length > 1 && (
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">{t('filter')}:</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('category')}</SelectItem>
                  {categories.filter(c => c !== 'all').map(category => (
                    <SelectItem key={category} value={category as string}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {filteredProducts.length} {t('products')?.toLowerCase()}
              </span>
            </div>
          )}

          {filteredProducts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {t('noProducts')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const priceChange = calculatePriceChange(product);
                
                return (
                  <Card key={product.id}>
                    <CardHeader>
                      {product.image && (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-32 object-cover rounded-md mb-2"
                        />
                      )}
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {/* Current Price with Discount Info */}
                        <div>
                          {product.discountPercent && product.originalPrice ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="text-lg line-through text-muted-foreground">
                                  €{safeToFixed(product.originalPrice, 2)}
                                </p>
                                <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                                  <Tag className="h-3 w-3" />
                                  -{product.discountPercent}%
                                </span>
                              </div>
                              <p className="text-2xl font-bold text-primary">
                                €{safeToFixed(product.price, 2)}
                              </p>
                            </div>
                          ) : (
                            <p className="text-2xl font-bold text-primary">
                              €{safeToFixed(product.price, 2)}
                            </p>
                          )}
                        </div>

                        {/* Price Change Indicator */}
                        {priceChange && (
                          <div className="pt-2 border-t">
                            <div className="flex items-center gap-2">
                              {priceChange.isIncrease ? (
                                <div className="flex items-center gap-1 text-red-600 font-semibold">
                                  <ArrowUp className="h-4 w-4" />
                                  <span>+{safeToFixed(Math.abs(priceChange.changePercent), 1)}%</span>
                                </div>
                              ) : priceChange.isDecrease ? (
                                <div className="flex items-center gap-1 text-green-600 font-semibold">
                                  <ArrowDown className="h-4 w-4" />
                                  <span>-{safeToFixed(Math.abs(priceChange.changePercent), 1)}%</span>
                                </div>
                              ) : null}
                              <span className="text-xs text-muted-foreground">
                                (€{safeToFixed(priceChange.previousPrice, 2)})
                              </span>
                            </div>
                            {priceChange.isIncrease && (
                              <p className="text-xs text-red-600 mt-1">
                                {t('priceIncreased')} €{safeToFixed(Math.abs(priceChange.change), 2)}
                              </p>
                            )}
                            {priceChange.isDecrease && (
                              <p className="text-xs text-green-600 mt-1">
                                {t('priceDecreased')} €{safeToFixed(Math.abs(priceChange.change), 2)}
                              </p>
                            )}
                          </div>
                        )}

                        {product.category && (
                          <p className="text-muted-foreground">
                            {t('category')}: {product.category}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-6">
          {/* Upload Button */}
          <div>
            <label htmlFor="invoice-upload">
              <Button disabled={isUploading} asChild>
                <span className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  {isUploading ? t('loading') : t('uploadInvoice')}
                </span>
              </Button>
            </label>
            <input
              id="invoice-upload"
              type="file"
              accept="image/*"
              onChange={handleInvoiceUpload}
              disabled={isUploading}
              className="hidden"
            />
          </div>

          {/* Invoices by Year and Month */}
          {Object.keys(groupedInvoices).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {t('noInvoicesRegistered')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.keys(groupedInvoices)
                .sort((a, b) => Number(b) - Number(a))
                .map((year) => (
                  <div key={year} className="space-y-4">
                    <h3 className="text-2xl font-bold flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {year}
                    </h3>
                    {Object.keys(groupedInvoices[Number(year)])
                      .sort((a, b) => Number(b) - Number(a))
                      .map((month) => {
                        const monthInvoices = groupedInvoices[Number(year)][Number(month)];
                        // CRITICAL FIX: Use total_amount || totalAmount || amount
                        const monthTotal = monthInvoices.reduce((sum, inv) => {
                          const amount = Number(inv.total_amount || inv.totalAmount || inv.amount || 0) || 0;
                          return sum + amount;
                        }, 0);
                        
                        return (
                          <div key={month} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="text-lg font-semibold text-muted-foreground">
                                {monthNames[Number(month)]}
                              </h4>
                              <span className="text-sm font-medium">
                                {t('totalAmount')}: €{safeToFixed(monthTotal, 2)}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {monthInvoices.map((invoice) => {
                                // CRITICAL FIX: Use total_amount || totalAmount || amount
                                const invoiceAmount = Number(invoice.total_amount || invoice.totalAmount || invoice.amount || 0) || 0;
                                
                                return (
                                  <Card 
                                    key={invoice.id} 
                                    className="cursor-pointer hover:shadow-lg transition-shadow group relative"
                                    onClick={() => setSelectedInvoice(invoice)}
                                  >
                                    {/* DELETE BUTTON */}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => handleDeleteInvoice(invoice.id, e)}
                                      className="absolute top-2 right-2 z-10 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm"
                                      title={t('deleteInvoice')}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>

                                    <CardHeader>
                                      <div className="relative group/image">
                                        <img
                                          src={invoice.imageUrl}
                                          alt={t('invoices')}
                                          className="w-full h-48 object-cover rounded-md"
                                        />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                                          <ZoomIn className="h-8 w-8 text-white" />
                                        </div>
                                      </div>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-2 text-sm">
                                        <p className="font-semibold">
                                          {new Date(invoice.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                          })}
                                        </p>
                                        {invoiceAmount > 0 && (
                                          <p className="text-lg font-bold text-primary">
                                            €{safeToFixed(invoiceAmount, 2)}
                                          </p>
                                        )}
                                        {invoice.items && invoice.items.length > 0 && (
                                          <p className="text-muted-foreground">
                                            {invoice.items.length} {t('products')?.toLowerCase()}
                                          </p>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ))}
            </div>
          )}
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats" className="space-y-6">
          {invoices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {t('noData')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Summary Cards */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('totalSpent')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">
                    €{safeToFixed(stats.totalSpent, 2)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {stats.invoiceCount} {t('invoices')?.toLowerCase()}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('averagePerInvoice')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">
                    €{safeToFixed(stats.averageInvoice, 2)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('amount')}
                  </p>
                </CardContent>
              </Card>

              {/* Monthly Spending Trend */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {t('monthlyAverage')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stats.monthlySpending)
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .slice(0, 6)
                      .map(([month, amount]) => {
                        const [year, monthNum] = month.split('-');
                        const maxAmount = Math.max(...Object.values(stats.monthlySpending), 1);
                        const safeAmount = Number(amount) || 0;
                        const percentage = (safeAmount / maxAmount) * 100;
                        
                        return (
                          <div key={month} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">
                                {monthNames[parseInt(monthNum) - 1]} {year}
                              </span>
                              <span className="font-bold text-primary">
                                €{safeToFixed(safeAmount, 2)}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className="bg-primary rounded-full h-2 transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>

              {/* Top Products */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {t('topProducts')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.topProducts.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      {t('noProducts')}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {stats.topProducts.map((product, index) => (
                        <div key={product.name} className="flex items-center gap-4">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {t('quantity')}: {product.count}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">
                              €{safeToFixed(product.total, 2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('invoiceDetail')} - {selectedInvoice && new Date(selectedInvoice.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Image */}
              <div className="relative">
                <img
                  src={selectedInvoice.imageUrl}
                  alt={t('invoices')}
                  className="w-full rounded-lg border"
                />
              </div>

              {/* Invoice Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('date')}</p>
                  <p className="font-semibold">
                    {new Date(selectedInvoice.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US')}
                  </p>
                </div>
                {(() => {
                  const invoiceAmount = Number(selectedInvoice.total_amount || selectedInvoice.totalAmount || selectedInvoice.amount || 0) || 0;
                  return invoiceAmount > 0 ? (
                    <div>
                      <p className="text-sm text-muted-foreground">{t('totalAmount')}</p>
                      <p className="font-semibold text-primary text-xl">
                        €{safeToFixed(invoiceAmount, 2)}
                      </p>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Invoice Items */}
              {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">{t('products')}</h4>
                  <div className="space-y-2">
                    {selectedInvoice.items.map((item, index) => {
                      const itemPrice = Number(item.price) || 0;
                      const itemQuantity = Number(item.quantity) || 0;
                      return (
                        <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {t('quantity')}: {itemQuantity} × €{safeToFixed(itemPrice, 2)}
                            </p>
                          </div>
                          <p className="font-bold text-primary">
                            €{safeToFixed(itemQuantity * itemPrice, 2)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
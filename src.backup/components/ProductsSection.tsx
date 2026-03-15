import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Upload, Plus, Trash2, Edit, Search, X, Check, Info, Download, FileSpreadsheet, FileText, FileCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { Product, Supplier, Settings } from '@/types';
import { extractDataFromImage, extractInvoiceData, type InvoiceDataExtracted } from '@/lib/ocrService';
import { getVATRate, calculatePriceWithVAT } from '@/lib/vatUtils';
import { getVATRateForProduct } from '@/lib/vatRates';
import { useLanguage } from '@/contexts/LanguageContext';
import { addProduct, updateProduct, deleteProduct, addSupplier } from '@/lib/storage';
import { exportProductsToExcel, exportProductsToPDF } from '@/lib/exportUtils';
import { findSimilarSupplier } from '@/lib/supplierUtils';
import PriceChangeIndicator from '@/components/PriceChangeIndicator';
import { formatPrice } from '@/lib/currency';

interface ProductsSectionProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  settings: Settings;
  onSaveInvoiceRequest: (file: File, supplierId: string, supplierName: string, invoiceData?: InvoiceDataExtracted) => void;
}

export default function ProductsSection({ 
  products, 
  setProducts, 
  suppliers, 
  setSuppliers, 
  settings,
  onSaveInvoiceRequest 
}: ProductsSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Partial<Product>>({});
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    price: 0,
    unit: 'kg',
    notes: '',
  });
  
  // State for pending invoice save
  const [pendingInvoiceData, setPendingInvoiceData] = useState<{
    file: File;
    supplierId: string;
    supplierName: string;
    invoiceData?: InvoiceDataExtracted;
  } | null>(null);

  const { language, t } = useLanguage();
  const countryVATRate = getVATRate(settings.country);
  const currency = settings.defaultCurrency || 'EUR';

  console.log('💱 ProductsSection using currency:', currency, 'from settings:', settings);

  // Auto-update VAT rates when country changes
  useEffect(() => {
    const updateVATRates = async () => {
      console.log('🔄 Country changed to:', settings.country, '- Updating VAT rates for all products...');
      
      const updatedProducts = products.map(product => {
        // Calculate new VAT rate based on product category and country
        const newVATRate = getVATRateForProduct(settings.country, product.category);
        
        // Only update if VAT rate actually changed
        if (product.vatRate !== newVATRate && product.vat_rate !== newVATRate) {
          console.log(`📊 Updating VAT for "${product.name}": ${product.vatRate || product.vat_rate || 0}% → ${newVATRate}%`);
          
          return {
            ...product,
            vatRate: newVATRate,
            vat_rate: newVATRate,
            updated_at: new Date().toISOString(),
          };
        }
        
        return product;
      });

      // Check if any products were updated
      const hasChanges = updatedProducts.some((p, i) => 
        p.vatRate !== products[i].vatRate || p.vat_rate !== products[i].vat_rate
      );

      if (hasChanges) {
        setProducts(updatedProducts);
        
        // Update all products in database
        for (const product of updatedProducts) {
          if (product.vatRate !== products.find(p => p.id === product.id)?.vatRate) {
            try {
              await updateProduct(product.id, {
                vatRate: product.vatRate,
                vat_rate: product.vat_rate,
                updated_at: product.updated_at,
              });
            } catch (error) {
              console.error(`❌ Error updating VAT for product ${product.id}:`, error);
            }
          }
        }
        
        toast.success(
          `✅ ${t.vatRatesUpdated || 'VAT rates updated'} ${settings.country} (${countryVATRate}%)`,
          { duration: 4000 }
        );
      }
    };

    // Only run if products exist and we're not in initial load
    if (products.length > 0) {
      updateVATRates();
    }
  }, [settings.country]); // Only trigger when country changes

  const handleExportExcel = () => {
    try {
      exportProductsToExcel(products, suppliers);
      toast.success(t.exportSuccess || '✅ Products exported to Excel successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t.exportError || 'Error exporting to Excel');
    }
  };

  const handleExportPDF = () => {
    try {
      exportProductsToPDF(products, suppliers);
      toast.success(t.exportSuccess || '✅ Products exported to PDF successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t.exportError || 'Error exporting to PDF');
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price) {
      toast.error(`${t.productName || 'Product Name'} ${t.price || 'Price'} ${t.areRequired || 'are required'}`);
      return;
    }

    try {
      // Calculate VAT rate based on category and country
      const productVATRate = getVATRateForProduct(settings.country, newProduct.category);
      
      const productData = {
        name: newProduct.name,
        price: newProduct.price,
        category: newProduct.category || 'general',
        unit: newProduct.unit || 'kg',
        supplier_id: newProduct.supplier_id,
        vatRate: productVATRate,
        vat_rate: productVATRate,
        notes: newProduct.notes,
        priceHistory: [{
          price: newProduct.price,
          date: new Date().toISOString(),
          reason: t.productCreated || 'Product created'
        }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const savedProduct = await addProduct(productData);
      console.log('✅ Product added successfully:', savedProduct.name, 'with VAT rate:', productVATRate);
      
      setProducts([...products, savedProduct]);
      setNewProduct({ name: '', price: 0, unit: 'kg', notes: '' });
      setIsAdding(false);
      
      toast.success(t.productAdded || 'Product added successfully', { duration: 3000 });
    } catch (error) {
      console.error('❌ Error adding product:', error);
      toast.error(t.errorSavingProduct || 'Error saving product');
    }
  };

  const handleStartEdit = (product: Product) => {
    setEditingId(product.id);
    setEditingProduct({ ...product });
  };

  const handleSaveEdit = async () => {
    if (!editingProduct.name || !editingProduct.price) {
      toast.error(`${t.productName || 'Product Name'} ${t.price || 'Price'} ${t.areRequired || 'are required'}`);
      return;
    }

    try {
      const currentProduct = products.find(p => p.id === editingId);
      const updates: Partial<Product> = {
        name: editingProduct.name,
        price: editingProduct.price,
        unit: editingProduct.unit,
        supplier_id: editingProduct.supplier_id,
        notes: editingProduct.notes,
        updated_at: new Date().toISOString(),
      };

      if (currentProduct && currentProduct.price !== editingProduct.price) {
        const existingHistory = currentProduct.priceHistory || [];
        updates.priceHistory = [
          ...existingHistory,
          {
            price: editingProduct.price!,
            date: new Date().toISOString(),
            reason: t.manualEdit || 'Manual edit'
          }
        ];
        
        updates.original_price = currentProduct.price;
        updates.last_price_change = new Date().toISOString();
        
        const changePercent = ((editingProduct.price! - currentProduct.price) / currentProduct.price) * 100;
        const direction = changePercent > 0 ? (t.priceIncreased || 'Price increased') : (t.priceDecreased || 'Price decreased');
        toast.info(
          `${t.price || 'Price'} ${direction} ${Math.abs(changePercent).toFixed(1)}%`,
          { duration: 4000 }
        );
      }

      await updateProduct(editingId!, updates);
      console.log('✅ Product updated successfully:', editingProduct.name);

      const updatedProducts = products.map((p) => 
        p.id === editingId ? { ...p, ...updates } : p
      );
      setProducts(updatedProducts);
      
      setEditingId(null);
      setEditingProduct({});
      toast.success(t.productUpdated || 'Product updated successfully');
    } catch (error) {
      console.error('❌ Error updating product:', error);
      toast.error(t.errorUpdatingProduct || 'Error updating product');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingProduct({});
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteProduct(id);
      console.log('✅ Product deleted successfully');
      
      const updatedProducts = products.filter((p) => p.id !== id);
      setProducts(updatedProducts);
      
      toast.success(t.productDeleted || 'Product deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting product:', error);
      toast.error(t.errorDeletingProduct || 'Error deleting product');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t.pleaseUploadImage || 'Please upload an image (JPG, PNG, WebP)');
      return;
    }

    setUploading(true);
    const loadingToast = toast.loading(t.analyzingInvoice || '🔍 Analyzing invoice with AI...');

    try {
      // Extract invoice metadata (date, invoice number, amount)
      let invoiceData: InvoiceDataExtracted | undefined;
      try {
        console.log('📄 Extracting invoice metadata...');
        invoiceData = await extractInvoiceData(file);
        console.log('✅ Invoice metadata extracted:', invoiceData);
      } catch (error) {
        console.warn('⚠️ Failed to extract invoice metadata:', error);
        // Continue even if invoice metadata extraction fails
      }

      // Extract products from invoice
      const result = await extractDataFromImage(file, 'products');

      if (!result.products || result.products.length === 0) {
        toast.error(t.noProductsFoundInInvoice || 'No products found in invoice', { id: loadingToast });
        return;
      }

      // Find or create supplier using name, email, AND phone
      let supplierId: string | undefined;
      let supplierName = '';
      
      if (result.supplier?.name) {
        supplierName = result.supplier.name;
        
        const similarSupplier = findSimilarSupplier(
          result.supplier.name,
          suppliers,
          80,
          result.supplier.email,
          result.supplier.phone
        );
        
        if (similarSupplier) {
          supplierId = similarSupplier.id;
          console.log(`✅ Using existing supplier: ${similarSupplier.name}`);
          toast.info(`${t.supplierRecognized || 'Supplier recognized'}: ${similarSupplier.name}`, { duration: 3000 });
        } else {
          const newSupplierData = {
            name: result.supplier.name,
            phone: result.supplier.phone || '',
            email: result.supplier.email,
            products: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          const newSupplier = await addSupplier(newSupplierData);
          setSuppliers([...suppliers, newSupplier]);
          supplierId = newSupplier.id;
          console.log(`✅ Created new supplier: ${newSupplier.name}`);
          toast.success(`${t.supplierAdded || 'Supplier added'}: ${result.supplier.name}`);
        }
      }

      // Save products
      const savedProducts: Product[] = [];
      let successCount = 0;
      let updatedCount = 0;
      let failCount = 0;

      for (const extracted of result.products) {
        try {
          const existingProduct = products.find(
            p => p.name.toLowerCase() === extracted.name.toLowerCase() && 
                 p.supplier_id === supplierId
          );

          // Calculate VAT rate based on category
          const productVATRate = getVATRateForProduct(settings.country, extracted.category);

          if (existingProduct) {
            if (existingProduct.price !== extracted.price) {
              const existingHistory = existingProduct.priceHistory || [];
              const updates: Partial<Product> = {
                price: extracted.price,
                original_price: extracted.originalPrice,
                discount: extracted.discountPercent,
                vat_rate: extracted.vatRate || productVATRate,
                vatRate: extracted.vatRate || productVATRate,
                notes: extracted.discountPercent ? `${t.discount || 'Discount'} ${extracted.discountPercent}%` : existingProduct.notes,
                priceHistory: [
                  ...existingHistory,
                  {
                    price: extracted.price,
                    date: new Date().toISOString(),
                    reason: t.updatedFromInvoice || 'Updated from invoice'
                  }
                ],
                updated_at: new Date().toISOString(),
              };

              await updateProduct(existingProduct.id, updates);
              
              const updatedProduct = { ...existingProduct, ...updates };
              savedProducts.push(updatedProduct);
              updatedCount++;
              console.log('✅ Product updated from invoice:', existingProduct.name);
            } else {
              console.log('ℹ️ Product exists with same price, skipping:', existingProduct.name);
            }
          } else {
            const productData = {
              name: extracted.name,
              price: extracted.price,
              category: extracted.category || 'general',
              original_price: extracted.originalPrice,
              discount: extracted.discountPercent,
              unit: 'kg',
              supplier_id: supplierId,
              vat_rate: extracted.vatRate || productVATRate,
              vatRate: extracted.vatRate || productVATRate,
              notes: extracted.discountPercent ? `${t.discount || 'Discount'} ${extracted.discountPercent}%` : '',
              priceHistory: [{
                price: extracted.price,
                date: new Date().toISOString(),
                reason: t.importedFromInvoice || 'Imported from invoice'
              }],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            const savedProduct = await addProduct(productData);
            savedProducts.push(savedProduct);
            successCount++;
            console.log('✅ Product from invoice saved:', savedProduct.name);
          }
        } catch (error) {
          failCount++;
          console.error('❌ Failed to save/update product:', extracted.name, error);
        }
      }

      // Update local state
      const updatedProductsList = [...products];
      for (const savedProduct of savedProducts) {
        const index = updatedProductsList.findIndex(p => p.id === savedProduct.id);
        if (index !== -1) {
          updatedProductsList[index] = savedProduct;
        } else {
          updatedProductsList.push(savedProduct);
        }
      }
      setProducts(updatedProductsList);

      // Store pending invoice data for later save (including invoice metadata)
      if (supplierId && supplierName) {
        setPendingInvoiceData({
          file,
          supplierId,
          supplierName,
          invoiceData
        });
      }

      // Show success message
      if (successCount > 0 || updatedCount > 0) {
        const messages = [];
        if (successCount > 0) messages.push(`${successCount} ${t.newProducts || 'new'}`);
        if (updatedCount > 0) messages.push(`${updatedCount} ${t.updated || 'updated'}`);
        
        const productsText = t.products ? t.products.toLowerCase() : 'products';
        toast.success(
          `✅ ${messages.join(', ')} ${productsText}!${supplierName ? ` ${t.supplier || 'Supplier'}: ${supplierName}` : ''}${failCount > 0 ? ` (${failCount} ${t.failed || 'failed'})` : ''}`,
          { id: loadingToast, duration: 4000 }
        );
      } else {
        toast.error(t.noProductsSaved || 'No products saved. Check logs for details.', { id: loadingToast });
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMsg = t.errorUploadingInvoice || 'Error uploading invoice';
      const verifyMsg = t.verifyImageClear || 'Verify that the image is clear and readable';
      toast.error(
        error instanceof Error ? error.message : `${errorMsg}. ${verifyMsg}`,
        { id: loadingToast }
      );
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSaveInvoice = () => {
    if (pendingInvoiceData) {
      onSaveInvoiceRequest(
        pendingInvoiceData.file,
        pendingInvoiceData.supplierId,
        pendingInvoiceData.supplierName,
        pendingInvoiceData.invoiceData
      );
      setPendingInvoiceData(null);
    }
  };

  const renderPriceWithVAT = (product: Product) => {
    const vatRate = product.vatRate || product.vat_rate || countryVATRate;
    const priceWithVAT = calculatePriceWithVAT(product.price, vatRate);
    
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          {product.original_price && product.discount ? (
            <>
              <span className="line-through text-slate-400 text-sm">{formatPrice(product.original_price, currency)}</span>
              <span className="font-bold text-green-600 text-lg">{formatPrice(product.price, currency)}</span>
            </>
          ) : (
            <span className="font-bold text-blue-600 text-lg">{formatPrice(product.price, currency)}</span>
          )}
          <span className="text-slate-500 text-sm">/ {product.unit}</span>
          
          <PriceChangeIndicator product={product} />
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Info className="h-3 w-3" />
          <span>{t.withVAT || 'With VAT'} ({vatRate}%): {formatPrice(priceWithVAT, currency)}</span>
        </div>
      </div>
    );
  };

  const filteredProducts = products.filter((product) => {
    const query = searchQuery.toLowerCase();
    const supplierName = suppliers.find((s) => s.id === product.supplier_id)?.name?.toLowerCase() || '';
    
    return (
      product.name.toLowerCase().includes(query) ||
      supplierName.includes(query) ||
      product.notes?.toLowerCase().includes(query)
    );
  });

  // Safe lowercase helper for translations
  const safeToLower = (str: string | undefined) => str ? str.toLowerCase() : '';

  return (
    <Card className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-white/20 dark:border-slate-700/20 shadow-xl w-full max-w-full overflow-hidden">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="w-full md:w-auto">
            <CardTitle className="text-xl sm:text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              {t.products || 'Products'}
            </CardTitle>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              {filteredProducts.length} {safeToLower(t.products) || 'products'} • {t.vat || 'VAT'} {countryVATRate}% ({settings.country}) • {currency}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap w-full md:w-auto">
            {pendingInvoiceData && (
              <Button
                data-tour="save-invoice"
                onClick={handleSaveInvoice}
                className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:scale-105 transition-all animate-pulse min-h-[44px] text-xs sm:text-sm"
              >
                <FileCheck className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">{t.saveInvoiceIn || 'Save Invoice in'} {pendingInvoiceData.supplierName}</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 sm:flex-none border-2 hover:border-green-500 hover:text-green-600 transition-all hover:scale-105 min-h-[44px] text-xs sm:text-sm dark:border-slate-700 dark:hover:border-green-500"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t.export || 'Export'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 dark:bg-slate-800">
                <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                  {t.exportExcel || 'Export Excel'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
                  <FileText className="h-4 w-4 mr-2 text-red-600" />
                  {t.exportPDF || 'Export PDF'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              data-tour="add-product"
              onClick={() => setIsAdding(true)} 
              size="sm"
              className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all hover:scale-105 min-h-[44px] text-xs sm:text-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t.addProduct || 'Add Product'}
            </Button>
            <label htmlFor="invoice-upload" className="flex-1 sm:flex-none">
              <Button 
                data-tour="upload-invoice"
                variant="outline" 
                size="sm" 
                asChild 
                disabled={uploading}
                className="w-full border-2 hover:border-blue-500 hover:text-blue-600 transition-all hover:scale-105 min-h-[44px] text-xs sm:text-sm dark:border-slate-700 dark:hover:border-blue-500"
              >
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? (t.loading || 'Loading') + '...' : t.uploadInvoice}
                  <input 
                    id="invoice-upload"
                    type="file" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </span>
              </Button>
            </label>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <Input
              type="text"
              placeholder={`${t.search || 'Search'} ${safeToLower(t.productName) || 'product name'}, ${safeToLower(t.supplier) || 'supplier'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-10 h-12 border-2 focus:border-blue-500 rounded-xl transition-all dark:bg-slate-800 dark:border-slate-700"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {isAdding && (
          <div className="mb-6 p-4 sm:p-6 border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-2xl space-y-4 shadow-lg">
            <div>
              <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t.productName || 'Product Name'}</Label>
              <Input
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                placeholder="Es: Pomodori, Vino Rosso, Pane..."
                className="mt-2 border-2 focus:border-blue-500 rounded-xl h-11 sm:h-10 text-sm sm:text-base dark:bg-slate-800 dark:border-slate-700"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t.price || 'Price'} ({currency} {t.withoutVAT || 'without VAT'})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
                  className="mt-2 border-2 focus:border-blue-500 rounded-xl h-11 sm:h-10 text-sm sm:text-base dark:bg-slate-800 dark:border-slate-700"
                />
                {newProduct.price && newProduct.price > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t.withVAT || 'With VAT'} ({countryVATRate}%): {formatPrice(calculatePriceWithVAT(newProduct.price, countryVATRate), currency)}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t.unit || 'Unit'}</Label>
                <Select value={newProduct.unit} onValueChange={(value) => setNewProduct({ ...newProduct, unit: value })}>
                  <SelectTrigger className="mt-2 border-2 focus:border-blue-500 rounded-xl h-11 sm:h-10 text-sm sm:text-base dark:bg-slate-800 dark:border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-800">
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="l">l</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="pz">pz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t.supplier || 'Supplier'}</Label>
              <Select
                value={newProduct.supplier_id}
                onValueChange={(value) => setNewProduct({ ...newProduct, supplier_id: value })}
              >
                <SelectTrigger className="mt-2 border-2 focus:border-blue-500 rounded-xl h-11 sm:h-10 text-sm sm:text-base dark:bg-slate-800 dark:border-slate-700">
                  <SelectValue placeholder={t.selectSupplier || 'Select Supplier'} />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800">
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t.notes || 'Notes'}</Label>
              <Textarea
                value={newProduct.notes}
                onChange={(e) => setNewProduct({ ...newProduct, notes: e.target.value })}
                placeholder={(t.notes || 'Notes') + '...'}
                className="mt-2 border-2 focus:border-blue-500 rounded-xl text-sm sm:text-base dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button 
                onClick={handleAddProduct}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:scale-105 transition-all min-h-[44px] text-sm sm:text-base"
              >
                <Check className="h-4 w-4 mr-2" />
                {t.save || 'Save'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsAdding(false)}
                className="flex-1 border-2 hover:border-red-500 hover:text-red-500 hover:scale-105 transition-all min-h-[44px] text-sm sm:text-base dark:border-slate-700"
              >
                <X className="h-4 w-4 mr-2" />
                {t.cancel || 'Cancel'}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {filteredProducts.map((product) => (
            <div key={product.id}>
              {editingId === product.id ? (
                <div className="p-4 sm:p-6 border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-950 dark:to-yellow-950 rounded-2xl space-y-4 shadow-lg">
                  <div>
                    <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t.productName || 'Product Name'}</Label>
                    <Input
                      value={editingProduct.name}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                      className="mt-2 border-2 focus:border-orange-500 rounded-xl h-11 sm:h-10 text-sm sm:text-base dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t.price || 'Price'} ({currency} {t.withoutVAT || 'without VAT'})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingProduct.price}
                        onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })}
                        className="mt-2 border-2 focus:border-orange-500 rounded-xl h-11 sm:h-10 text-sm sm:text-base dark:bg-slate-800 dark:border-slate-700"
                      />
                      {editingProduct.price && editingProduct.price > 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {t.withVAT || 'With VAT'} ({countryVATRate}%): {formatPrice(calculatePriceWithVAT(editingProduct.price, countryVATRate), currency)}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t.unit || 'Unit'}</Label>
                      <Select 
                        value={editingProduct.unit} 
                        onValueChange={(value) => setEditingProduct({ ...editingProduct, unit: value })}
                      >
                        <SelectTrigger className="mt-2 border-2 focus:border-orange-500 rounded-xl h-11 sm:h-10 text-sm sm:text-base dark:bg-slate-800 dark:border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-slate-800">
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="l">l</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                          <SelectItem value="pz">pz</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t.supplier || 'Supplier'}</Label>
                    <Select
                      value={editingProduct.supplier_id}
                      onValueChange={(value) => setEditingProduct({ ...editingProduct, supplier_id: value })}
                    >
                      <SelectTrigger className="mt-2 border-2 focus:border-orange-500 rounded-xl h-11 sm:h-10 text-sm sm:text-base dark:bg-slate-800 dark:border-slate-700">
                        <SelectValue placeholder={t.selectSupplier || 'Select Supplier'} />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-slate-800">
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t.notes || 'Notes'}</Label>
                    <Textarea
                      value={editingProduct.notes}
                      onChange={(e) => setEditingProduct({ ...editingProduct, notes: e.target.value })}
                      className="mt-2 border-2 focus:border-orange-500 rounded-xl text-sm sm:text-base dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button 
                      onClick={handleSaveEdit}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:scale-105 transition-all min-h-[44px] text-sm sm:text-base"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {t.save || 'Save'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleCancelEdit}
                      className="flex-1 border-2 hover:border-red-500 hover:text-red-500 hover:scale-105 transition-all min-h-[44px] text-sm sm:text-base dark:border-slate-700"
                    >
                      <X className="h-4 w-4 mr-2" />
                      {t.cancel || 'Cancel'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-slate-800 hover:shadow-lg transition-all hover:scale-[1.02] gap-3">
                  <div className="flex-1 min-w-0 w-full sm:w-auto">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm sm:text-base break-words">{product.name}</span>
                      {((product.discount && product.discount > 0) || (product.discountPercent && product.discountPercent > 0)) && (
                        <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 text-xs">
                          -{(product.discount || product.discountPercent)}%
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {renderPriceWithVAT(product)}
                      {product.supplier_id && (
                        <span className="text-slate-500 dark:text-slate-400 text-xs mt-1 block truncate">
                          • {suppliers.find((s) => s.id === product.supplier_id)?.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity w-full sm:w-auto justify-end">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleStartEdit(product)}
                      className="hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 transition-all h-9 w-9 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDeleteProduct(product.id)}
                      className="hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-600 dark:hover:text-red-400 transition-all h-9 w-9 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && !isAdding && (
          <div className="text-center py-12 sm:py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 mb-4">
              <Search className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
              {searchQuery ? (
                <>{t.noProducts || 'No products available'} "<span className="font-semibold text-blue-600 dark:text-blue-400">{searchQuery}</span>"</>
              ) : (
                t.addFirstProduct || 'Add your first product to get started'
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
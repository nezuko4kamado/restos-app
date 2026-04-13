import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Upload, Plus, Trash2, Edit, Search, X, Check, Info, Download, FileSpreadsheet, FileText, FileCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Product, Supplier, Settings } from '@/types';
import { extractDataFromImage, extractInvoiceData, type InvoiceDataExtracted } from '@/lib/ocrService';
import { getVATRate, calculatePriceWithVAT } from '@/lib/vatUtils';
import { getVATRateForProduct } from '@/lib/vatRates';
import { useLanguage } from '@/lib/i18n';
import { addProduct, updateProduct, deleteProduct, addSupplier } from '@/lib/storage';
import { exportProductsToExcel, exportProductsToPDF } from '@/lib/exportUtils';
import { findSimilarSupplier } from '@/lib/supplierUtils';
import PriceChangeIndicator from '@/components/PriceChangeIndicator';
import { formatPrice } from '@/lib/currency';

interface ExtractedProduct {
  name: string;
  price: number;
  category?: string;
  originalPrice?: number;
  discountPercent?: number;
  vatRate?: number;
  vat_rate?: number;
}

interface ProductsSectionProps {
  products: Product[];
  setProducts: (products: Product[]) => void;
  suppliers: Supplier[];
  setSuppliers: (suppliers: Supplier[]) => void;
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
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Partial<Product>>({});
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    price: 0,
    unit: 'kg',
    notes: '',
  });
  
  // State for OCR processing dialog
  const [processingSupplier, setProcessingSupplier] = useState('');
  const [processingProductCount, setProcessingProductCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
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

  console.log('💱 ProductsSection RENDER - products.length:', products.length);

  // REMOVED: Auto-update VAT rates when country changes
  // This was causing the issue where VAT rates from invoices were being overwritten
  // VAT rates should only be updated manually or when explicitly requested by the user

  const handleExportExcel = () => {
    try {
      exportProductsToExcel(products, suppliers);
      toast.success(t('exportSuccess') || '✅ Products exported to Excel successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('exportError') || 'Error exporting to Excel');
    }
  };

  const handleExportPDF = () => {
    try {
      exportProductsToPDF(products, suppliers);
      toast.success(t('exportSuccess') || '✅ Products exported to PDF successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('exportError') || 'Error exporting to PDF');
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price) {
      toast.error(t('fillRequiredFields') || 'Please fill in all required fields');
      return;
    }

    try {
      const productData = {
        ...newProduct,
        vat_rate: newProduct.vat_rate || countryVATRate,
        vatRate: newProduct.vatRate || countryVATRate,
        priceHistory: [{
          price: newProduct.price || 0,
          date: new Date().toISOString(),
          reason: t('initialPrice') || 'Initial price'
        }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const savedProduct = await addProduct(productData);
      setProducts([...products, savedProduct]);
      setNewProduct({ name: '', price: 0, unit: 'kg', notes: '' });
      setIsAdding(false);
      toast.success(t('productAdded') || 'Product added successfully!');
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error(t('errorAddingProduct') || 'Error adding product');
    }
  };

  const handleEditProduct = async (id: string) => {
    if (!editingProduct.name || !editingProduct.price) {
      toast.error(t('fillRequiredFields') || 'Please fill in all required fields');
      return;
    }

    try {
      const product = products.find(p => p.id === id);
      if (!product) return;

      const priceChanged = product.price !== editingProduct.price;
      const updates: Partial<Product> = {
        ...editingProduct,
        priceHistory: priceChanged 
          ? [
              ...(product.priceHistory || []),
              {
                price: editingProduct.price || 0,
                date: new Date().toISOString(),
                reason: t('manualUpdate') || 'Manual update'
              }
            ]
          : product.priceHistory,
        updated_at: new Date().toISOString(),
      };

      await updateProduct(id, updates);
      setProducts(products.map(p => p.id === id ? { ...p, ...updates } : p));
      setEditingId(null);
      setEditingProduct({});
      toast.success(t('productUpdated') || 'Product updated successfully!');
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error(t('errorUpdatingProduct') || 'Error updating product');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm(t('confirmDeleteProduct') || 'Are you sure you want to delete this product?')) return;

    try {
      await deleteProduct(id);
      setProducts(products.filter(p => p.id !== id));
      toast.success(t('productDeleted') || 'Product deleted successfully!');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error(t('errorDeletingProduct') || 'Error deleting product');
    }
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setEditingProduct(product);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingProduct({});
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // PREVENT MULTIPLE SIMULTANEOUS UPLOADS
    if (isProcessingUpload) {
      console.warn('⚠️ Upload already in progress, ignoring duplicate call');
      return;
    }
    setIsProcessingUpload(true);

    // Validate all files are images
    const invalidFiles = files.filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      toast.error(t('pleaseUploadImage') || 'Please upload images only (JPG, PNG, WebP)');
      setIsProcessingUpload(false);
      return;
    }

    setUploading(true);
    setTotalPages(files.length);
    setCurrentPage(0);
    setProcessingProductCount(0);
    setProcessingSupplier('');

    try {
      console.log(`📤 Processing ${files.length} file(s)...`);
      console.log(`📊 BEFORE UPLOAD - products.length: ${products.length}`);
      
      let invoiceData: InvoiceDataExtracted | undefined;
      const allExtractedProducts: ExtractedProduct[] = [];
      let supplierId: string | undefined;
      let supplierName = '';

      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isLastFile = i === files.length - 1;
        
        setCurrentPage(i + 1);
        console.log(`📄 Processing file ${i + 1}/${files.length}: ${file.name}`);

        const result = await extractDataFromImage(file);
        
        if (result.data?.products && result.data.products.length > 0) {
          console.log(`✅ Extracted ${result.data.products.length} products from page ${i + 1}`);
          allExtractedProducts.push(...result.data.products);
          setProcessingProductCount(allExtractedProducts.length);
        }

        if (!supplierId && result.data?.supplier?.name) {
          supplierName = result.data.supplier.name;
          setProcessingSupplier(supplierName);
        }

        // Extract invoice metadata from last file only
        if (isLastFile) {
          try {
            console.log('📋 Extracting invoice metadata from last page...');
            
            const invoiceResult = await extractInvoiceData(file);
            invoiceData = invoiceResult.data;
            console.log('✅ Invoice metadata extracted:', invoiceData);
          } catch (error) {
            console.warn('⚠️ Failed to extract invoice metadata:', error);
          }
        }
      }

      console.log(`📦 Total products extracted from ${files.length} page(s): ${allExtractedProducts.length}`);

      if (allExtractedProducts.length === 0) {
        toast.error(t('noProductsFoundInInvoice') || 'No products found in invoice');
        return;
      }

      // Save products
      const savedProducts: Product[] = [];
      let successCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let failCount = 0;

      for (const extracted of allExtractedProducts) {
        try {
          // DEDUPLICATION FIX: Match by product code first (most reliable), then fall back to name+supplier
          const existingProduct = products.find(p => {
            const extractedCode = (extracted.code_description || extracted.codeDescription)?.trim();
            const productCode = p.code_description?.trim();
            if (extractedCode && productCode && extractedCode === productCode && p.supplier_id === supplierId) {
              return true;
            }
            if (extractedCode && productCode && extractedCode === productCode) {
              return true;
            }
            return p.name.toLowerCase() === extracted.name.toLowerCase() && p.supplier_id === supplierId;
          });

          const productVATRate = extracted.vat_rate || extracted.vatRate || 0;
          
          console.log(`📊 Product "${extracted.name}": Using VAT ${productVATRate}% (vat_rate: ${extracted.vat_rate || 'N/A'}, vatRate: ${extracted.vatRate || 'N/A'})`);

          if (existingProduct) {
            if (existingProduct.price !== extracted.price) {
              const existingHistory = existingProduct.priceHistory || [];
              const updates: Partial<Product> = {
                price: extracted.price,
                unit_price: extracted.originalPrice,
                discounted_price: extracted.price,
                discount_percent: extracted.discountPercent,
                vat_rate: productVATRate,
                vatRate: productVATRate,
                notes: extracted.discountPercent ? `${t('discount') || 'Discount'} ${extracted.discountPercent}%` : existingProduct.notes,
                priceHistory: [
                  ...existingHistory,
                  {
                    price: extracted.price,
                    date: new Date().toISOString(),
                    reason: t('updatedFromInvoice') || 'Updated from invoice'
                  }
                ],
                updated_at: new Date().toISOString(),
              };

              await updateProduct(existingProduct.id, updates);
              
              const updatedProduct = { ...existingProduct, ...updates };
              savedProducts.push(updatedProduct);
              updatedCount++;
              console.log('✅ Product updated from invoice:', existingProduct.name, 'with VAT:', productVATRate);
            } else {
              savedProducts.push(existingProduct);
              skippedCount++;
              console.log('ℹ️ Product exists with same price, keeping in list:', existingProduct.name);
            }
          } else {
            const productData = {
              name: extracted.name,
              price: extracted.price,
              category: extracted.category || 'general',
              unit_price: extracted.originalPrice,
              discounted_price: extracted.price,
              discount_percent: extracted.discountPercent,
              unit: 'kg',
              supplier_id: supplierId,
              vat_rate: productVATRate,
              vatRate: productVATRate,
              notes: extracted.discountPercent ? `${t('discount') || 'Discount'} ${extracted.discountPercent}%` : '',
              priceHistory: [{
                price: extracted.price,
                date: new Date().toISOString(),
                reason: t('importedFromInvoice') || 'Imported from invoice'
              }],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            const savedProduct = await addProduct(productData);
            savedProducts.push(savedProduct);
            successCount++;
            console.log('✅ Product from invoice saved:', savedProduct.name, 'ID:', savedProduct.id, 'VAT:', productVATRate);
          }
        } catch (error) {
          failCount++;
          console.error('❌ Failed to save/update product:', extracted.name, error);
        }
      }

      console.log(`📊 savedProducts.length: ${savedProducts.length}`);
      console.log(`📊 savedProducts IDs:`, savedProducts.map(p => `${p.name} (${p.id})`).join(', '));
      
      // Update local state - keep ALL existing products and update/add new ones
      const updatedProductsList = [...products];
      console.log(`📊 Starting with ${updatedProductsList.length} existing products`);
      
      for (const savedProduct of savedProducts) {
        const index = updatedProductsList.findIndex(p => p.id === savedProduct.id);
        if (index !== -1) {
          console.log(`🔄 Updating existing product at index ${index}:`, savedProduct.name);
          updatedProductsList[index] = savedProduct;
        } else {
          console.log(`➕ Adding new product:`, savedProduct.name);
          updatedProductsList.push(savedProduct);
        }
      }
      
      console.log(`📊 FINAL updatedProductsList.length: ${updatedProductsList.length}`);
      
      setProducts(updatedProductsList);

      // Handle supplier and invoice saving
      if (supplierName) {
        const similarSupplier = findSimilarSupplier(supplierName, suppliers);
        supplierId = similarSupplier?.id;

        if (!supplierId) {
          const newSupplier = await addSupplier({
            name: supplierName,
            contact: '',
            email: '',
            phone: '',
            address: '',
            notes: t('autoCreatedFromInvoice') || 'Auto-created from invoice upload',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          setSuppliers([...suppliers, newSupplier]);
          supplierId = newSupplier.id;
        }

        setPendingInvoiceData({
          file: files[0],
          supplierId,
          supplierName,
          invoiceData
        });
      }

      // Show success message
      if (successCount > 0 || updatedCount > 0 || skippedCount > 0) {
        const messages = [];
        if (successCount > 0) messages.push(`${successCount} ${t('newProducts') || 'new'}`);
        if (updatedCount > 0) messages.push(`${updatedCount} ${t('updated') || 'updated'}`);
        if (skippedCount > 0) messages.push(`${skippedCount} unchanged`);
        
        const productsText = t.products ? t('products').toLowerCase() : 'products';
        const pagesText = files.length > 1 ? ` from ${files.length} pages` : '';
        toast.success(
          `✅ ${messages.join(', ')} ${productsText}${pagesText}!${supplierName ? ` ${t('supplier') || 'Supplier'}: ${supplierName}` : ''}${failCount > 0 ? ` (${failCount} ${t('failed') || 'failed'})` : ''}`,
          { duration: 4000 }
        );
      } else {
        toast.error(t('noProductsSaved') || 'No products saved. Check logs for details.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMsg = t('errorUploadingInvoice') || 'Error uploading invoice';
      const verifyMsg = t('verifyImageClear') || 'Verify that the image is clear and readable';
      toast.error(
        error instanceof Error ? error.message : `${errorMsg}. ${verifyMsg}`
      );
    } finally {
      setUploading(false);
      setIsProcessingUpload(false);
      setCurrentPage(0);
      setTotalPages(0);
      setProcessingProductCount(0);
      setProcessingSupplier('');
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
      toast.success(t('invoiceSaved') || 'Invoice saved successfully!');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    suppliers.find(s => s.id === product.supplier_id)?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* OCR Processing Dialog */}
      {uploading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                {language === 'it' ? '🔄 Analisi fattura in corso...' : '🔄 Analyzing invoice...'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {totalPages > 1 && (
                <div className="text-sm">
                  📄 {language === 'it' ? 'Pagina' : 'Page'}: {currentPage}/{totalPages}
                </div>
              )}
              {processingSupplier && (
                <div className="text-sm">
                  🏢 {language === 'it' ? 'Fornitore' : 'Supplier'}: <span className="font-semibold">{processingSupplier}</span>
                </div>
              )}
              <div className="text-sm">
                📦 {language === 'it' ? 'Prodotti estratti' : 'Products extracted'}: <span className="font-semibold">{processingProductCount}</span>
              </div>
              <div className="flex justify-center pt-2">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t('products') || 'Products'}</span>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    {t('export') || 'Export'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleExportExcel}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    {t('exportExcel') || 'Export to Excel'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    {t('exportPDF') || 'Export to PDF'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => setIsAdding(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t('addProduct') || 'Add Product'}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  {t('uploadInvoice') || 'Upload Invoice'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingInvoiceData && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    {t('invoiceReadyToSave') || 'Invoice ready to save'}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {t('supplier') || 'Supplier'}: {pendingInvoiceData.supplierName}
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleSaveInvoice}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <FileCheck className="h-4 w-4 mr-2" />
                {t('saveInvoice') || 'Save Invoice'}
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t('searchProducts') || 'Search products...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {isAdding && (
            <Card className="border-2 border-primary">
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('productName') || 'Product Name'} *</Label>
                    <Input
                      value={newProduct.name || ''}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      placeholder={t('enterProductName') || 'Enter product name'}
                    />
                  </div>
                  <div>
                    <Label>{t('price') || 'Price'} ({currency}) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newProduct.price || ''}
                      onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>{t('category') || 'Category'}</Label>
                    <Select
                      value={newProduct.category || 'general'}
                      onValueChange={(value) => setNewProduct({ ...newProduct, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">{t('general') || 'General'}</SelectItem>
                        <SelectItem value="meat">{t('meat') || 'Meat'}</SelectItem>
                        <SelectItem value="vegetables">{t('vegetables') || 'Vegetables'}</SelectItem>
                        <SelectItem value="dairy">{t('dairy') || 'Dairy'}</SelectItem>
                        <SelectItem value="beverages">{t('beverages') || 'Beverages'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('unit') || 'Unit'}</Label>
                    <Select
                      value={newProduct.unit || 'kg'}
                      onValueChange={(value) => setNewProduct({ ...newProduct, unit: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="l">l</SelectItem>
                        <SelectItem value="ml">ml</SelectItem>
                        <SelectItem value="pcs">{t('pieces') || 'pcs'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('supplier') || 'Supplier'}</Label>
                    <Select
                      value={newProduct.supplier_id || ''}
                      onValueChange={(value) => setNewProduct({ ...newProduct, supplier_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectSupplier') || 'Select supplier'} />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('vatRate') || 'VAT Rate'} (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={newProduct.vat_rate || countryVATRate}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value) || 0;
                        setNewProduct({ ...newProduct, vat_rate: rate, vatRate: rate });
                      }}
                      placeholder={countryVATRate.toString()}
                    />
                  </div>
                </div>
                <div>
                  <Label>{t('notes') || 'Notes'}</Label>
                  <Textarea
                    value={newProduct.notes || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, notes: e.target.value })}
                    placeholder={t('addNotes') || 'Add notes...'}
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddProduct} className="flex-1">
                    <Check className="h-4 w-4 mr-2" />
                    {t('save') || 'Save'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAdding(false);
                      setNewProduct({ name: '', price: 0, unit: 'kg', notes: '' });
                    }}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t('cancel') || 'Cancel'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery
                  ? t('noProductsFound') || 'No products found'
                  : t('noProductsYet') || 'No products yet. Add one or upload an invoice.'}
              </div>
            ) : (
              filteredProducts.map((product) => (
                <Card key={product.id}>
                  <CardContent className="pt-6">
                    {editingId === product.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>{t('productName') || 'Product Name'} *</Label>
                            <Input
                              value={editingProduct.name || ''}
                              onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>{t('price') || 'Price'} ({currency}) *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingProduct.price || ''}
                              onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label>{t('category') || 'Category'}</Label>
                            <Select
                              value={editingProduct.category || 'general'}
                              onValueChange={(value) => setEditingProduct({ ...editingProduct, category: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="general">{t('general') || 'General'}</SelectItem>
                                <SelectItem value="meat">{t('meat') || 'Meat'}</SelectItem>
                                <SelectItem value="vegetables">{t('vegetables') || 'Vegetables'}</SelectItem>
                                <SelectItem value="dairy">{t('dairy') || 'Dairy'}</SelectItem>
                                <SelectItem value="beverages">{t('beverages') || 'Beverages'}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>{t('unit') || 'Unit'}</Label>
                            <Select
                              value={editingProduct.unit || 'kg'}
                              onValueChange={(value) => setEditingProduct({ ...editingProduct, unit: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="kg">kg</SelectItem>
                                <SelectItem value="g">g</SelectItem>
                                <SelectItem value="l">l</SelectItem>
                                <SelectItem value="ml">ml</SelectItem>
                                <SelectItem value="pcs">{t('pieces') || 'pcs'}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>{t('supplier') || 'Supplier'}</Label>
                            <Select
                              value={editingProduct.supplier_id || ''}
                              onValueChange={(value) => setEditingProduct({ ...editingProduct, supplier_id: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('selectSupplier') || 'Select supplier'} />
                              </SelectTrigger>
                              <SelectContent>
                                {suppliers.map((supplier) => (
                                  <SelectItem key={supplier.id} value={supplier.id}>
                                    {supplier.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>{t('vatRate') || 'VAT Rate'} (%)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={editingProduct.vat_rate || countryVATRate}
                              onChange={(e) => {
                                const rate = parseFloat(e.target.value) || 0;
                                setEditingProduct({ ...editingProduct, vat_rate: rate, vatRate: rate });
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>{t('notes') || 'Notes'}</Label>
                          <Textarea
                            value={editingProduct.notes || ''}
                            onChange={(e) => setEditingProduct({ ...editingProduct, notes: e.target.value })}
                            rows={2}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => handleEditProduct(product.id)} className="flex-1">
                            <Check className="h-4 w-4 mr-2" />
                            {t('save') || 'Save'}
                          </Button>
                          <Button variant="outline" onClick={cancelEdit} className="flex-1">
                            <X className="h-4 w-4 mr-2" />
                            {t('cancel') || 'Cancel'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{product.name}</h3>
                            {product.category && (
                              <Badge variant="secondary">{product.category}</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{t('price') || 'Price'}:</span>
                              <span className="font-semibold text-lg">
                                {formatPrice(product.price, currency)}
                              </span>
                              {product.priceHistory && product.priceHistory.length > 1 && (
                                <PriceChangeIndicator priceHistory={product.priceHistory} />
                              )}
                            </div>
                            {product.unit_price && product.unit_price !== product.price && (
                              <div>
                                <span className="font-medium">{t('originalPrice') || 'Original'}:</span>{' '}
                                <span className="line-through">{formatPrice(product.unit_price, currency)}</span>
                              </div>
                            )}
                            {product.discount_percent && (
                              <div>
                                <span className="font-medium">{t('discount') || 'Discount'}:</span>{' '}
                                <Badge variant="destructive">{product.discount_percent}%</Badge>
                              </div>
                            )}
                            <div>
                              <span className="font-medium">{t('unit') || 'Unit'}:</span> {product.unit}
                            </div>
                            {product.supplier_id && (
                              <div>
                                <span className="font-medium">{t('supplier') || 'Supplier'}:</span>{' '}
                                {suppliers.find(s => s.id === product.supplier_id)?.name || t('unknown') || 'Unknown'}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">{t('vatRate') || 'VAT'}:</span>{' '}
                              {(Number(product.vat_rate || product.vatRate) || 0).toFixed(1)}%
                            </div>
                            <div>
                              <span className="font-medium">{t('priceWithVAT') || 'Price with VAT'}:</span>{' '}
                              {formatPrice(calculatePriceWithVAT(product.price, product.vat_rate || product.vatRate || 0), currency)}
                            </div>
                          </div>
                          {product.notes && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                              {product.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEdit(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
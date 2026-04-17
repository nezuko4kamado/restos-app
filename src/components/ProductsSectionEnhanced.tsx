import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogOverlay } from '@/components/ui/dialog';
import { Upload, Plus, Trash2, Edit, Search, X, Check, Info, Download, FileSpreadsheet, FileText, Percent, Link, Hash, Filter, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Product, Supplier, Settings } from '@/types';
import { extractDataFromImage, type InvoiceDataExtracted } from '@/lib/ocrService';
import { getVATRate, calculatePriceWithVAT } from '@/lib/vatUtils';
import { getVATRateForProduct, isValidDiscountPercent, calculateDiscountAmount, calculateDiscountedPrice } from '@/lib/vatRates';
import { useLanguage } from '@/lib/i18n';
import { addProduct, updateProduct, deleteProduct, addSupplier, batchAddProducts, batchUpdateProducts, updateSupplier, saveProductComparison, checkScanLimit, incrementScanCount, checkProductLimitDetailed } from '@/lib/storage';
import { exportProductsToExcel, exportProductsToPDF } from '@/lib/exportUtils';
import { findSimilarSupplier } from '@/lib/supplierUtils';
import PriceChangeIndicator from '@/components/PriceChangeIndicator';
import { formatPrice } from '@/lib/currency';

interface ExtractedProduct {
  name: string;
  unit_price: number;
  discounted_price: number;
  discount_amount: number;
  discount_percent: number;
  category?: string;
  vatRate?: number;
  quantity?: number;
  code_description?: string;
}

interface ProductsSectionEnhancedProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  settings: Settings;
  onSaveInvoiceRequest: (file: File, supplierId: string, supplierName: string, invoiceData?: InvoiceDataExtracted) => void;
  onNavigateToComparison?: (productId: string) => void;
}

interface TranslationFunction {
  (key: string): string | undefined;
  withVAT?: string;
  [key: string]: string | undefined | ((key: string) => string | undefined);
}

// ✅ Helper: Get price history from product, supporting both camelCase and snake_case
function getProductPriceHistory(product: Product | Partial<Product>): Array<{ price: number; date: string; reason?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = product as any;
  return p.priceHistory || p.price_history || [];
}

const ProductCard = memo(({ 
  product, 
  suppliers, 
  countryVATRate, 
  currency, 
  t,
  onEdit,
  onDelete,
  onOpenCompareDialog
}: {
  product: Product;
  suppliers: Supplier[];
  countryVATRate: number;
  currency: string;
  t: TranslationFunction;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onOpenCompareDialog: (product: Product) => void;
}) => {
  // ✅ DEBUG: Log product data to check code_description
  console.log(`🔍 [PRODUCT CARD] Rendering product "${product.name}":`, {
    id: product.id,
    code_description: product.code_description,
    has_code_description: !!product.code_description,
    code_description_length: product.code_description?.length || 0,
  });

  // ✅ FIX: Always use Klippa's extracted VAT rate, fallback to 0% instead of country default
  const vatRate = product.vatRate || product.vat_rate || 0;
  const unitPrice = product.unit_price || product.price;
  const discountedPrice = product.discounted_price || product.price;
  const discountPercent = product.discount_percent || 0;
  const discountAmount = product.discount_amount || 0;
  const hasDiscount = discountPercent > 0;
  const priceWithVAT = calculatePriceWithVAT(discountedPrice, vatRate);

  return (
    <div className="group flex flex-col items-start justify-between p-3 sm:p-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-slate-800 hover:shadow-lg transition-all gap-2 sm:gap-3 w-full overflow-hidden box-border">
      <div className="min-w-0 w-full overflow-hidden">
        <div className="flex items-start gap-1.5 sm:gap-2 flex-wrap">
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm break-words min-w-0">{product.name}</span>
          {hasDiscount && (
            <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 text-[10px] sm:text-xs flex items-center gap-0.5 sm:gap-1 shrink-0 px-1.5 py-0.5">
              <Percent className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              -{discountPercent}%
            </Badge>
          )}
        </div>
        
        {/* ✅ ENHANCED: Display product code_description with better visibility and debug logging */}
        {product.code_description && product.code_description.trim() !== '' ? (
          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium overflow-hidden">
            <Hash className="h-3 w-3 shrink-0" />
            <span className="font-mono bg-blue-50 dark:bg-blue-900/30 px-1.5 sm:px-2 py-0.5 rounded truncate">{product.code_description}</span>
          </div>
        ) : (
          // ✅ DEBUG: Show when code_description is missing
          console.log(`⚠️ [PRODUCT CARD] No code_description for product "${product.name}"`)
        )}
        
        <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {hasDiscount ? (
                <>
                  <span className="line-through text-slate-400 text-xs sm:text-sm">{formatPrice(unitPrice, currency)}</span>
                  <span className="font-bold text-green-600 text-base sm:text-lg">{formatPrice(discountedPrice, currency)}</span>
                  {discountAmount > 0 && (
                    <span className="text-[10px] sm:text-xs text-green-600">(-{formatPrice(discountAmount, currency)})</span>
                  )}
                </>
              ) : (
                <span className="font-bold text-blue-600 text-base sm:text-lg">{formatPrice(discountedPrice, currency)}</span>
              )}
              <PriceChangeIndicator product={product} />
            </div>
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-500">
              <Info className="h-3 w-3 shrink-0" />
              <span className="truncate">{t('withVAT') || 'With VAT'} ({vatRate}%): {formatPrice(priceWithVAT, currency)}</span>
            </div>
          </div>
          {product.supplier_id && (
            <span className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs mt-1 block truncate">
              • {suppliers.find((s) => s.id === product.supplier_id)?.name}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity w-full justify-end shrink-0">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onOpenCompareDialog(product)}
          className="hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 transition-all h-8 w-8 sm:h-9 sm:w-9 p-0"
          title={t('compareProduct') || 'Compare with another product'}
        >
          <Link className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onEdit(product)}
          className="hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 transition-all h-8 w-8 sm:h-9 sm:w-9 p-0"
        >
          <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onDelete(product.id)}
          className="hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-600 dark:hover:text-red-400 transition-all h-8 w-8 sm:h-9 sm:w-9 p-0"
        >
          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

export default function ProductsSectionEnhanced({ 
  products, 
  setProducts, 
  suppliers, 
  setSuppliers, 
  settings,
  onSaveInvoiceRequest,
  onNavigateToComparison
}: ProductsSectionEnhancedProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [processingSupplier, setProcessingSupplier] = useState('');
  const [processingProductCount, setProcessingProductCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');
  const [editingProduct, setEditingProduct] = useState<Partial<Product>>({});
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    price: 0,
    unit: 'kg',
    notes: '',
  });

  // Comparison dialog states
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [selectedProductA, setSelectedProductA] = useState<Product | null>(null);
  const [compareSearchQuery, setCompareSearchQuery] = useState('');

  const { language, t } = useLanguage();
  const countryVATRate = getVATRate(settings.country);
  const currency = settings.defaultCurrency || 'EUR';

  // ✅ Component mount/unmount logging
  useEffect(() => {
    console.log('🎨 [COMPONENT] ProductsSectionEnhanced mounted');
    console.log('🎨 [COMPONENT] onSaveInvoiceRequest function:', typeof onSaveInvoiceRequest, onSaveInvoiceRequest ? 'DEFINED' : 'UNDEFINED');
    
    // ✅ DEBUG: Log all products with their code_description on mount
    console.log('🔍 [PRODUCTS DEBUG] All products on mount:', products.map(p => ({
      name: p.name,
      code_description: p.code_description,
      has_code: !!p.code_description,
    })));
    
    return () => console.log('🎨 [COMPONENT] ProductsSectionEnhanced unmounted');
  }, []);

  // ✅ DEBUG: Log products whenever they change
  useEffect(() => {
    console.log('🔍 [PRODUCTS DEBUG] Products updated:', products.length, 'products');
    console.log('🔍 [PRODUCTS DEBUG] Products with code_description:', 
      products.filter(p => p.code_description).map(p => ({
        name: p.name,
        code: p.code_description
      }))
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return products.filter((product) => {
      const supplierName = suppliers.find((s) => s.id === product.supplier_id)?.name?.toLowerCase() || '';
      const codeDescription = product.code_description?.toLowerCase() || '';
      
      // Apply supplier filter
      const matchesSupplier = selectedSupplierFilter === 'all' || product.supplier_id === selectedSupplierFilter;
      
      // Apply search query
      const matchesSearch = 
        product.name.toLowerCase().includes(query) ||
        supplierName.includes(query) ||
        codeDescription.includes(query) ||
        (product.notes && product.notes.toLowerCase().includes(query));
      
      return matchesSupplier && matchesSearch;
    });
  }, [products, suppliers, searchQuery, selectedSupplierFilter]);

  const filteredCompareProducts = useMemo(() => {
    if (!selectedProductA) return [];
    
    const query = compareSearchQuery.toLowerCase();
    return products.filter((product) => {
      // Exclude the selected product A
      if (product.id === selectedProductA.id) return false;
      
      const supplierName = suppliers.find((s) => s.id === product.supplier_id)?.name?.toLowerCase() || '';
      const categoryMatch = product.category?.toLowerCase() || '';
      
      return (
        product.name.toLowerCase().includes(query) ||
        supplierName.includes(query) ||
        categoryMatch.includes(query)
      );
    });
  }, [products, suppliers, compareSearchQuery, selectedProductA]);

  const handleExportExcel = useCallback(() => {
    try {
      exportProductsToExcel(products, suppliers);
      toast.success(t('exportSuccess') || '✅ Products exported to Excel successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('exportError') || 'Error exporting to Excel');
    }
  }, [products, suppliers, t]);

  const handleExportPDF = useCallback(() => {
    try {
      exportProductsToPDF(products, suppliers);
      toast.success(t('exportSuccess') || '✅ Products exported to PDF successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('exportError') || 'Error exporting to PDF');
    }
  }, [products, suppliers, t]);

  const handleAddProduct = useCallback(async () => {
    if (!newProduct.name || !newProduct.price) {
      toast.error(`${t('productName') || 'Product Name'} ${t('price') || 'Price'} ${t('areRequired') || 'are required'}`);
      return;
    }

    try {
      // ✅ CHECK PRODUCT LIMIT before adding
      const limitCheck = await checkProductLimitDetailed();
      if (!limitCheck.allowed) {
        toast.error(
          `⚠️ ${t('limitReached') || 'Limit reached'}! ` +
          `${t('currentProducts') || 'Current products'}: ${limitCheck.currentCount}/${limitCheck.limit}. ` +
          `${t('upgradePlanForMore') || 'Upgrade your plan to add more products.'}`,
          { duration: 8000 }
        );
        return;
      }

      const productVATRate = getVATRateForProduct(settings.country, newProduct.category);
      
      const productData = {
        name: newProduct.name,
        price: newProduct.price,
        unit_price: newProduct.price,
        discounted_price: newProduct.price,
        discount_amount: 0,
        discount_percent: 0,
        category: newProduct.category || '',  // ✅ FIX: Use empty string instead of 'general'
        unit: newProduct.unit || 'kg',
        supplier_id: newProduct.supplier_id,
        vatRate: productVATRate,
        vat_rate: productVATRate,
        notes: newProduct.notes,
        code_description: newProduct.code_description || '',
        priceHistory: [{
          price: newProduct.price,
          date: new Date().toISOString(),
          reason: t('productCreated') || 'Product created'
        }],
        price_history: [{
          price: newProduct.price,
          date: new Date().toISOString(),
        }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const savedProduct = await addProduct(productData);
      
      if (!savedProduct) {
        toast.error(t('productLimitReached') || 'Product limit reached. Upgrade your plan to add more products.', { duration: 5000 });
        return;
      }
      
      setProducts([...products, savedProduct]);
      setNewProduct({ name: '', price: 0, unit: 'kg', notes: '' });
      setIsAdding(false);
      
      toast.success(t('productAdded') || 'Product added successfully', { duration: 3000 });
    } catch (error) {
      console.error('❌ Error adding product:', error);
      toast.error(t('errorSavingProduct') || 'Error saving product');
    }
  }, [newProduct, products, settings.country, t, setProducts]);

  const handleStartEdit = useCallback((product: Product) => {
    setEditingId(product.id);
    setEditingProduct({ ...product });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingProduct.name || !editingProduct.price) {
      toast.error(`${t('productName') || 'Product Name'} ${t('price') || 'Price'} ${t('areRequired') || 'are required'}`);
      return;
    }

    try {
      const currentProduct = products.find(p => p.id === editingId);
      const updates: Partial<Product> = {
        name: editingProduct.name,
        price: editingProduct.price,
        unit_price: editingProduct.price,
        discounted_price: editingProduct.price,
        discount_amount: 0,
        discount_percent: 0,
        unit: editingProduct.unit,
        supplier_id: editingProduct.supplier_id,
        notes: editingProduct.notes,
        code_description: editingProduct.code_description,
        updated_at: new Date().toISOString(),
      };

      if (currentProduct && currentProduct.price !== editingProduct.price) {
        // ✅ FIX: Read from both camelCase and snake_case history fields
        const existingHistory = getProductPriceHistory(currentProduct);
        
        // ✅ FIX: If history is empty, seed it with the OLD price first so PriceChangeIndicator
        // has at least 2 entries (old price + new price) to calculate the change percentage
        let newHistory: Array<{ price: number; date: string; reason?: string }>;
        if (existingHistory.length === 0) {
          // No history at all — insert old price as the first entry
          newHistory = [
            {
              price: currentProduct.price,
              date: currentProduct.created_at || new Date().toISOString(),
              reason: t('originalPrice') || 'Original price'
            },
            {
              price: editingProduct.price!,
              date: new Date().toISOString(),
              reason: t('manualEdit') || 'Manual edit'
            }
          ];
        } else {
          // History exists — just append the new price
          newHistory = [
            ...existingHistory,
            {
              price: editingProduct.price!,
              date: new Date().toISOString(),
              reason: t('manualEdit') || 'Manual edit'
            }
          ];
        }
        
        // ✅ Write to both camelCase (runtime) and snake_case (DB type) for consistency
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (updates as any).priceHistory = newHistory;
        updates.price_history = newHistory.map(h => ({ price: h.price, date: h.date }));
        
        updates.original_price = currentProduct.price;
        updates.last_price_change = new Date().toISOString();
        
        const changePercent = ((editingProduct.price! - currentProduct.price) / currentProduct.price) * 100;
        const direction = changePercent > 0 ? (t('priceIncreased') || 'Price increased') : (t('priceDecreased') || 'Price decreased');
        toast.info(
          `${t('price') || 'Price'} ${direction} ${Math.abs(changePercent).toFixed(1)}%`,
          { duration: 4000 }
        );
      }

      await updateProduct(editingId!, updates);

      const updatedProducts = products.map((p) => 
        p.id === editingId ? { ...p, ...updates } : p
      );
      setProducts(updatedProducts);
      
      setEditingId(null);
      setEditingProduct({});
      toast.success(t('productUpdated') || 'Product updated successfully');
    } catch (error) {
      console.error('❌ Error updating product:', error);
      toast.error(t('errorUpdatingProduct') || 'Error updating product');
    }
  }, [editingProduct, editingId, products, t, setProducts]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingProduct({});
  }, []);

  const handleDeleteProduct = useCallback(async (id: string) => {
    try {
      console.log(`🗑️ [UI] Attempting to delete product ${id}...`);
      const success = await deleteProduct(id);
      
      if (!success) {
        console.error(`❌ [UI] deleteProduct returned false for ${id} - NOT removing from local state`);
        toast.error(t('errorDeletingProduct') || 'Error deleting product from database');
        return;
      }
      
      console.log(`✅ [UI] Product ${id} deleted from DB, updating local state...`);
      const updatedProducts = products.filter((p) => p.id !== id);
      setProducts(updatedProducts);
      
      toast.success(t('productDeleted') || 'Product deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting product:', error);
      toast.error(t('errorDeletingProduct') || 'Error deleting product');
    }
  }, [products, t, setProducts]);

  const handleOpenCompareDialog = useCallback((product: Product) => {
    console.log('🔗 [COMPARE] Dialog opened for product:', product.name, product.id);
    setSelectedProductA(product);
    setCompareSearchQuery('');
    setCompareDialogOpen(true);
  }, []);

  const handleSelectProductB = useCallback(async (productB: Product) => {
    console.log('🔗 [COMPARE] ========== PRODUCT SELECTION START ==========');
    console.log('🔗 [COMPARE] handleSelectProductB called');
    console.log('🔗 [COMPARE] Product A:', selectedProductA?.name, selectedProductA?.id);
    console.log('🔗 [COMPARE] Product B:', productB.name, productB.id);
    
    if (!selectedProductA) {
      console.error('❌ [COMPARE] selectedProductA is null!');
      toast.error('❌ Errore: Prodotto A non selezionato');
      return;
    }

    try {
      // Save to Supabase
      console.log('💾 [COMPARE] Saving comparison to Supabase...');
      const savedComparison = await saveProductComparison(
        selectedProductA.id,
        selectedProductA.name,
        productB.id,
        productB.name
      );
      
      if (!savedComparison) {
        console.error('❌ [COMPARE] Failed to save comparison to Supabase');
        toast.error('❌ Errore nel salvataggio della comparazione');
        return;
      }
      
      console.log('✅ [COMPARE] Comparison saved to Supabase:', savedComparison);

      // Close dialog
      console.log('🔗 [COMPARE] Closing dialog...');
      setCompareDialogOpen(false);
      setSelectedProductA(null);
      console.log('✅ [COMPARE] Dialog closed, selectedProductA reset');

      // Show success toast
      const toastMessage = `✅ ${t('comparisonCreated') || 'Comparazione creata con successo'}! ${selectedProductA.name} ↔ ${productB.name}`;
      console.log('🔗 [COMPARE] Showing toast:', toastMessage);
      toast.success(toastMessage, { duration: 4000 });
      console.log('✅ [COMPARE] Toast displayed');

      // Navigate to comparison section if callback provided
      if (onNavigateToComparison) {
        console.log('🔗 [COMPARE] Navigation callback exists, navigating in 500ms...');
        setTimeout(() => {
          console.log('🔗 [COMPARE] Calling onNavigateToComparison with:', selectedProductA.id);
          onNavigateToComparison(selectedProductA.id);
          console.log('✅ [COMPARE] Navigation callback executed');
        }, 500);
      } else {
        console.log('⚠️ [COMPARE] No navigation callback provided');
      }
      
      console.log('🔗 [COMPARE] ========== PRODUCT SELECTION SUCCESS ==========');
    } catch (error) {
      console.error('❌ [COMPARE] Error in handleSelectProductB:', error);
      console.error('❌ [COMPARE] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      toast.error('❌ Errore nel salvataggio della comparazione');
    }
  }, [selectedProductA, t, onNavigateToComparison]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🚀 [UPLOAD] ========== START UPLOAD ==========');
    console.log('🚀 [UPLOAD] handleFileUpload called');
    
    // ✅ CONTROLLO LIMITI - PRIMA DI TUTTO
    try {
      console.log('🔒 [UPLOAD] Checking scan limit...');
      const canScan = await checkScanLimit();
      console.log('🔒 [UPLOAD] Can scan:', canScan);
      
      if (!canScan) {
        console.warn('⚠️ [UPLOAD] Scan limit reached!');
        toast.error(
          '❌ Limite scansioni raggiunto! Aggiorna il piano o attendi il rinnovo mensile.',
          { duration: 5000 }
        );
        event.target.value = '';
        return;
      }
      console.log('✅ [UPLOAD] Scan limit check passed');
    } catch (error) {
      console.error('❌ [UPLOAD] Error checking scan limit:', error);
      toast.error('Errore nel controllo dei limiti. Riprova.');
      event.target.value = '';
      return;
    }
    
    // ✅ FIX: Use sessionStorage for global lock that persists across component remounts
    const isProcessing = sessionStorage.getItem('isProcessingUpload') === 'true';
    if (isProcessing) {
      console.warn('⚠️ [UPLOAD] Already processing (global lock), ignoring duplicate call');
      event.target.value = '';
      return;
    }

    const files = Array.from(event.target.files || []);
    // ✅ DEBUG: Log file deduplication
    console.log(`🔍 [DEDUP DEBUG] Original files: ${files.length}`);
    
    // ✅ FIX: Remove duplicate files by name and size to prevent duplicate products
    const uniqueFiles = files.filter((file, index, self) => 
      index === self.findIndex(f => f.name === file.name && f.size === file.size)
    );
    
    console.log(`🔍 [DEDUP DEBUG] Unique files: ${uniqueFiles.length}`);
    
    if (uniqueFiles.length < files.length) {
      console.log(`🔍 [UPLOAD] Removed ${files.length - uniqueFiles.length} duplicate files`);
    }
    
    if (uniqueFiles.length === 0) return;

    const invalidFiles = uniqueFiles.filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      toast.error(t('pleaseUploadImage') || 'Please upload images only (JPG, PNG, WebP)');
      return;
    }

    // ✅ FIX: Set global lock EARLY using sessionStorage
    console.log('🔒 [UPLOAD] Setting global lock: isProcessingUpload = true');
    sessionStorage.setItem('isProcessingUpload', 'true');
    setUploading(true);
    setTotalPages(uniqueFiles.length);
    setCurrentPage(0);
    setProcessingProductCount(0);
    setProcessingSupplier('');

    try {
      let invoiceData: InvoiceDataExtracted | undefined;
      const allExtractedProducts: ExtractedProduct[] = [];
      let supplierId: string | undefined;
      let supplierName = '';
      let supplierPhone = '';
      let supplierMobile = '';
      let supplierEmail = '';
      let supplierAddress = '';

      for (let i = 0; i < uniqueFiles.length; i++) {
        const file = uniqueFiles[i];
        const isLastFile = i === uniqueFiles.length - 1;
        
        console.log(`📄 [UPLOAD] Processing file ${i + 1}/${uniqueFiles.length}: ${file.name}`);
        setCurrentPage(i + 1);

        // ✅ SINGLE API CALL - extractDataFromImage returns everything we need
        console.log(`🔍 [UPLOAD] Calling extractDataFromImage for file ${i + 1}`);
        const result = await extractDataFromImage(file);
        
        // ✅ NEW: Log COMPLETE RAW response from Klippa for debugging
        console.log('🔍🔍🔍 [KLIPPA RAW RESPONSE] ========== FULL RESPONSE FROM KLIPPA ==========');
        console.log('🔍 [KLIPPA RAW] Complete result object:', JSON.stringify(result, null, 2));
        if (result.data) {
          console.log('🔍 [KLIPPA RAW] result.data:', JSON.stringify(result.data, null, 2));
          if (result.data.supplier) {
            console.log('🔍 [KLIPPA RAW] result.data.supplier FULL OBJECT:');
            console.log(JSON.stringify(result.data.supplier, null, 2));
            console.log('🔍 [KLIPPA RAW] Supplier fields:');
            console.log('  - name:', result.data.supplier.name);
            console.log('  - phone:', result.data.supplier.phone);
            console.log('  - mobile:', result.data.supplier.mobile);
            console.log('  - email:', result.data.supplier.email);
            console.log('  - address:', result.data.supplier.address);
            console.log('  - All keys in supplier object:', Object.keys(result.data.supplier));
          }
        }
        console.log('🔍🔍🔍 [KLIPPA RAW RESPONSE] ========================================');
        
        interface ExtractedProductData {
          name: string;
          vatRate?: number;
          category?: string;
          code_description?: string;
        }
        
        console.log(`✅ [UPLOAD] extractDataFromImage returned for file ${i + 1}:`, {
          success: result.success,
          productsCount: result.data?.products?.length || 0,
          productNames: result.data?.products?.map((p: ExtractedProductData) => p.name) || [],
          // 🔍 DEBUG: Log VAT rates, categories, and code_description from Klippa
          productDetails: result.data?.products?.map((p: ExtractedProductData) => ({ 
            name: p.name, 
            vatRate: p.vatRate,
            category: p.category,
            code_description: p.code_description
          })) || []
        });
        
        if (result.success && result.data?.products && result.data.products.length > 0) {
          console.log(`➕ [UPLOAD] Adding ${result.data.products.length} products to allExtractedProducts`);
          allExtractedProducts.push(...result.data.products);
          console.log(`📊 [UPLOAD] allExtractedProducts now has ${allExtractedProducts.length} products`);
          setProcessingProductCount(allExtractedProducts.length);
        }

        if (!supplierId && result.data?.supplier?.name) {
          supplierName = result.data.supplier.name;
          setProcessingSupplier(supplierName);
          // ✅ FIX: Extract ALL supplier contact fields separately with detailed logging
          supplierPhone = result.data.supplier.phone || '';
          supplierMobile = result.data.supplier.mobile || '';
          supplierEmail = result.data.supplier.email || '';
          supplierAddress = result.data.supplier.address || '';
          
          // ✅ IMPROVED LOGGING: Show actual values instead of [object Object]
          console.log('📞 [SUPPLIER CONTACT] ===== EXTRACTED SUPPLIER CONTACT INFO =====');
          console.log('📞 [SUPPLIER CONTACT] Name:', supplierName);
          console.log('📞 [SUPPLIER CONTACT] Phone:', supplierPhone || '(empty)');
          console.log('📞 [SUPPLIER CONTACT] Mobile:', supplierMobile || '(empty)');
          console.log('📞 [SUPPLIER CONTACT] Email:', supplierEmail || '(empty)');
          console.log('📞 [SUPPLIER CONTACT] Address:', supplierAddress || '(empty)');
          console.log('📞 [SUPPLIER CONTACT] ==========================================');
          
          const similarSupplier = findSimilarSupplier(
            result.data.supplier.name,
            suppliers,
            80,
            result.data.supplier.email,
            result.data.supplier.phone
          );
          
          if (similarSupplier) {
            supplierId = similarSupplier.id;
            
            console.log('🔍 [SUPPLIER UPDATE] Existing supplier found:', similarSupplier.name);
            console.log('🔍 [SUPPLIER UPDATE] Current supplier data:', {
              phone: similarSupplier.phone || '(empty)',
              mobile: similarSupplier.mobile || '(empty)',
              email: similarSupplier.email || '(empty)',
              address: similarSupplier.address || '(empty)'
            });
            
            // ✅ UPDATE SUPPLIER: Update contact fields if they're missing
            const needsUpdate = 
              (!similarSupplier.phone && supplierPhone) || 
              (!similarSupplier.mobile && supplierMobile) ||
              (!similarSupplier.email && supplierEmail) ||
              (!similarSupplier.address && supplierAddress);
            
            if (needsUpdate) {
              console.log('📝 [SUPPLIER UPDATE] Updating supplier with missing contact info');
              const supplierUpdates: Partial<Supplier> = {};
              if (!similarSupplier.phone && supplierPhone) {
                supplierUpdates.phone = supplierPhone;
                console.log('  ➕ Adding phone:', supplierPhone);
              }
              if (!similarSupplier.mobile && supplierMobile) {
                supplierUpdates.mobile = supplierMobile;
                console.log('  ➕ Adding mobile:', supplierMobile);
              }
              if (!similarSupplier.email && supplierEmail) {
                supplierUpdates.email = supplierEmail;
                console.log('  ➕ Adding email:', supplierEmail);
              }
              if (!similarSupplier.address && supplierAddress) {
                supplierUpdates.address = supplierAddress;
                console.log('  ➕ Adding address:', supplierAddress);
              }
              
              console.log('💾 [SUPPLIER UPDATE] Calling updateSupplier with:', supplierUpdates);
              await updateSupplier(similarSupplier.id, supplierUpdates);
              console.log('✅ [SUPPLIER UPDATE] Supplier updated in database');
              
              // Update local state
              setSuppliers(suppliers.map(s => 
                s.id === similarSupplier.id 
                  ? { ...s, ...supplierUpdates } 
                  : s
              ));
              console.log('✅ [SUPPLIER UPDATE] Local state updated');
            } else {
              console.log('ℹ️ [SUPPLIER UPDATE] No updates needed - all fields already populated');
            }
            
            toast.info(`${t('supplierRecognized') || 'Supplier recognized'}: ${similarSupplier.name}`, { duration: 3000 });
          } else {
            // ✅ FIX: Pass ALL extracted contact fields when creating new supplier
            const newSupplierData = {
              name: result.data.supplier.name,
              phone: supplierPhone,
              mobile: supplierMobile,
              email: supplierEmail,
              address: supplierAddress,
              products: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            
            console.log('➕ [NEW SUPPLIER] Creating new supplier with data:');
            console.log('  Name:', newSupplierData.name);
            console.log('  Phone:', newSupplierData.phone || '(empty)');
            console.log('  Mobile:', newSupplierData.mobile || '(empty)');
            console.log('  Email:', newSupplierData.email || '(empty)');
            console.log('  Address:', newSupplierData.address || '(empty)');
            
            const newSupplier = await addSupplier(newSupplierData);
            console.log('✅ [NEW SUPPLIER] Supplier created in database with ID:', newSupplier.id);
            
            setSuppliers([...suppliers, newSupplier]);
            supplierId = newSupplier.id;
            toast.success(`${t('supplierAdded') || 'Supplier added'}: ${result.data.supplier.name}`);
          }
        }

        // ✅ CRITICAL FIX: Extract invoice data with FLAT structure (total_amount at root level)
        if (isLastFile && result.data?.invoice) {
          console.log('💰 [INVOICE DATA] Raw invoice from OCR:', result.data.invoice);
          console.log('💰 [INVOICE DATA] total_amount from OCR:', result.data.invoice.total_amount);
          
          invoiceData = {
            // ✅ CRITICAL: Put total_amount at ROOT level, not nested
            total_amount: result.data.invoice.total_amount,
            invoice_number: result.data.invoice.invoice_number,
            date: result.data.invoice.date,
            currency: result.data.invoice.currency,
            supplier: result.data.supplier,
            // ✅ CRITICAL: Include items for invoice saving
            items: allExtractedProducts.map(p => ({
              name: p.name,
              price: p.discounted_price,
              quantity: p.quantity || 1,
              originalPrice: p.unit_price,
              discountPercent: p.discount_percent,
              vatRate: p.vatRate
            }))
          };
          console.log('✅ [INVOICE DATA] Flattened invoice data structure:', invoiceData);
          console.log('💰 [INVOICE DATA] total_amount at root:', invoiceData.total_amount);
          console.log('📋 [INVOICE DATA] Invoice items count:', invoiceData.items?.length || 0);
        }
      }

      console.log('📊 [UPLOAD] Total products extracted:', allExtractedProducts.length);
      console.log('📋 [UPLOAD] Product names:', allExtractedProducts.map(p => p.name));
      // 🔍 DEBUG: Log all extracted products with VAT rates, categories, and code_description
      console.log('🔍 [DEBUG] All extracted products with details:', 
        allExtractedProducts.map(p => ({ 
          name: p.name, 
          vatRate: p.vatRate, 
          category: p.category,
          code_description: p.code_description
        }))
      );

      if (allExtractedProducts.length === 0) {
        toast.error(t('noProductsFoundInInvoice') || 'No products found in invoice');
        return;
      }

      // OPTIMIZED: Batch database operations
      const productsToInsert: Omit<Product, 'id'>[] = [];
      const productsToUpdate: { id: string; updates: Partial<Product> }[] = [];
      let successCount = 0;
      let updatedCount = 0;
      const skippedCount = 0;

      for (const extracted of allExtractedProducts) {
        // DEDUPLICATION FIX: Match by product code first (most reliable), then fall back to name+supplier
        const existingProduct = products.find(p => {
          const extractedCode = extracted.code_description?.trim();
          const productCode = p.code_description?.trim();
          if (extractedCode && productCode && extractedCode === productCode && p.supplier_id === supplierId) {
            return true;
          }
          if (extractedCode && productCode && extractedCode === productCode) {
            return true;
          }
          return p.name.toLowerCase() === extracted.name.toLowerCase() && p.supplier_id === supplierId;
        });

        // ✅ TRUST KLIPPA'S VAT RATE, CATEGORY, AND CODE_DESCRIPTION - No recalculation, no default override!
        const productVATRate = extracted.vatRate || 0;
        const productCategory = extracted.category || '';  // ✅ FIX: Use empty string, not 'general'
        const productCodeDescription = extracted.code_description || '';
        
        // 🔍 DEBUG: Log VAT, category, and code_description assignment
        console.log(`🔍 [VAT+CATEGORY+CODE DEBUG] Product "${extracted.name}": extracted.vatRate = ${extracted.vatRate}, productVATRate = ${productVATRate}, extracted.category = "${extracted.category}", productCategory = "${productCategory}", extracted.code_description = "${extracted.code_description}", productCodeDescription = "${productCodeDescription}"`);

        if (existingProduct) {
          {
            // ✅ FIX: Always update product from invoice — including 0 price (100% discount)
            const existingHistory = getProductPriceHistory(existingProduct);
            
            // ✅ FIX: If history is empty, seed with old price first
            let newHistory: Array<{ price: number; date: string; reason?: string }>;
            if (existingHistory.length === 0) {
              newHistory = [
                {
                  price: existingProduct.price,
                  date: existingProduct.created_at || new Date().toISOString(),
                  reason: t('originalPrice') || 'Original price'
                },
                {
                  price: extracted.discounted_price,
                  date: new Date().toISOString(),
                  reason: t('updatedFromInvoice') || 'Updated from invoice'
                }
              ];
            } else {
              newHistory = [
                ...existingHistory,
                {
                  price: extracted.discounted_price,
                  date: new Date().toISOString(),
                  reason: t('updatedFromInvoice') || 'Updated from invoice'
                }
              ];
            }
            
            const updates: Partial<Product> = {
              price: extracted.discounted_price,
              unit_price: extracted.unit_price,
              discounted_price: extracted.discounted_price,
              discount_amount: extracted.discount_amount,
              discount_percent: extracted.discount_percent,
              vat_rate: productVATRate,
              vatRate: productVATRate,
              category: productCategory,
              code_description: productCodeDescription,
              notes: extracted.discount_percent > 0 ? `${t('discount') || 'Discount'} ${extracted.discount_percent}%` : existingProduct.notes,
              price_history: newHistory.map(h => ({ price: h.price, date: h.date })),
              updated_at: new Date().toISOString(),
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (updates as any).priceHistory = newHistory;

            productsToUpdate.push({ id: existingProduct.id, updates });
            updatedCount++;
          }
        } else {
          const initialHistory = [{
            price: extracted.discounted_price,
            date: new Date().toISOString(),
            reason: t('importedFromInvoice') || 'Imported from invoice'
          }];
          
          const productData: Omit<Product, 'id'> = {
            name: extracted.name,
            price: extracted.discounted_price,
            unit_price: extracted.unit_price,
            discounted_price: extracted.discounted_price,
            discount_amount: extracted.discount_amount,
            discount_percent: extracted.discount_percent,
            category: productCategory,  // ✅ FIX: Use empty string, not 'general'
            unit: 'kg',
            supplier_id: supplierId,
            vat_rate: productVATRate,
            vatRate: productVATRate,
            code_description: productCodeDescription,  // ✅ NEW: Include code_description
            notes: extracted.discount_percent > 0 ? `${t('discount') || 'Discount'} ${extracted.discount_percent}%` : '',
            priceHistory: initialHistory,
            price_history: initialHistory.map(h => ({ price: h.price, date: h.date })),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          // 🔍 DEBUG: Log productData before insert
          console.log(`🔍 [VAT+CATEGORY+CODE DEBUG] productData for "${productData.name}": vat_rate = ${productData.vat_rate}, vatRate = ${productData.vatRate}, category = "${productData.category}", code_description = "${productData.code_description}"`);

          productsToInsert.push(productData);
          successCount++;
        }
      }

      console.log('💾 [UPLOAD] Products to insert:', productsToInsert.length);
      console.log('🔄 [UPLOAD] Products to update:', productsToUpdate.length);
      console.log('📋 [UPLOAD] Products to insert names:', productsToInsert.map(p => p.name));
      // 🔍 DEBUG: Log products before batchAddProducts with VAT rates, categories, and code_description
      console.log('🔍 [DEBUG] Products before batchAddProducts:', 
        productsToInsert.map(p => ({ 
          name: p.name, 
          vatRate: p.vatRate, 
          vat_rate: p.vat_rate, 
          category: p.category,
          code_description: p.code_description
        }))
      );

      // BATCH INSERT: All new products at once (with limit enforcement)
      const savedProducts: Product[] = [];
      if (productsToInsert.length > 0) {
        console.log(`💾 [UPLOAD] Calling batchAddProducts with ${productsToInsert.length} products`);
        const batchInserted = await batchAddProducts(productsToInsert);
        console.log(`✅ [UPLOAD] batchAddProducts returned ${batchInserted.length} products`);
        // 🔍 DEBUG: Log products after batchAddProducts with VAT rates, categories, and code_description
        console.log('🔍 [DEBUG] Products after batchAddProducts:', 
          batchInserted.map(p => ({ 
            name: p.name, 
            vatRate: p.vatRate, 
            vat_rate: p.vat_rate, 
            category: p.category,
            code_description: p.code_description
          }))
        );
        savedProducts.push(...batchInserted);
        
        // ✅ WARN if some products were truncated due to limit
        if (batchInserted.length < productsToInsert.length) {
          const skippedByLimit = productsToInsert.length - batchInserted.length;
          console.warn(`⚠️ [LIMIT] ${skippedByLimit} products were NOT saved due to subscription limit`);
          toast.error(
            `⚠️ ${t('limitReached') || 'Limit reached'}! ` +
            `${t('productsExtracted') || 'Extracted'}: ${productsToInsert.length} | ` +
            `${t('productsSaved') || 'Saved'}: ${batchInserted.length} | ` +
            `${t('productsNotSaved') || 'NOT saved'}: ${skippedByLimit}. ` +
            `${t('upgradePlanForMore') || 'Upgrade your plan to save more products.'}`,
            { duration: 10000 }
          );
        }
      }

      // BATCH UPDATE: All updates at once
      if (productsToUpdate.length > 0) {
        console.log(`🔄 [UPLOAD] Calling batchUpdateProducts with ${productsToUpdate.length} products`);
        const batchUpdated = await batchUpdateProducts(productsToUpdate);
        console.log(`✅ [UPLOAD] batchUpdateProducts returned ${batchUpdated.length} products`);
        for (const updated of batchUpdated) {
          savedProducts.push(updated);
        }
      }

      console.log(`📊 [UPLOAD] Total savedProducts: ${savedProducts.length}`);

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
      
      console.log(`📊 [UPLOAD] Updating local state with ${updatedProductsList.length} products`);
      setProducts(updatedProductsList);

      // ✅ Incrementa contatore scansioni dopo successo
      try {
        console.log('📈 [UPLOAD] Incrementing scan count...');
        await incrementScanCount();
        console.log('✅ [UPLOAD] Scan count incremented successfully');
      } catch (error) {
        console.error('❌ [UPLOAD] Error incrementing scan count:', error);
      }

      // ✅ AUTOMATIC INVOICE SAVING: Save invoice automatically after products are saved
      console.log('💾 [INVOICE] ========== INVOICE SAVING START ==========');
      console.log('💾 [INVOICE] Checking if invoice should be saved...');
      console.log('💾 [INVOICE] supplierId:', supplierId);
      console.log('💾 [INVOICE] supplierName:', supplierName);
      console.log('💾 [INVOICE] invoiceData:', invoiceData);
      console.log('💾 [INVOICE] invoiceData.total_amount:', invoiceData?.total_amount);
      console.log('💾 [INVOICE] onSaveInvoiceRequest type:', typeof onSaveInvoiceRequest);
      console.log('💾 [INVOICE] onSaveInvoiceRequest defined:', onSaveInvoiceRequest ? 'YES' : 'NO');
      
      if (supplierId && supplierName && invoiceData && onSaveInvoiceRequest) {
        console.log('💾 [INVOICE] All conditions met, calling onSaveInvoiceRequest...');
        console.log('💾 [INVOICE] Parameters:');
        console.log('  - file:', uniqueFiles[0].name, uniqueFiles[0].size, 'bytes');
        console.log('  - supplierId:', supplierId);
        console.log('  - supplierName:', supplierName);
        console.log('  - invoiceData.invoice_number:', invoiceData.invoice_number);
        console.log('  - invoiceData.date:', invoiceData.date);
        console.log('  - invoiceData.total_amount:', invoiceData.total_amount);
        console.log('  - invoiceData.items count:', invoiceData.items?.length || 0);
        
        try {
          await onSaveInvoiceRequest(
            uniqueFiles[0],
            supplierId,
            supplierName,
            invoiceData
          );
          console.log('✅ [INVOICE] onSaveInvoiceRequest completed successfully');
          toast.success('✅ Fattura salvata automaticamente!', { duration: 3000 });
        } catch (error) {
          console.error('❌ [INVOICE] Error calling onSaveInvoiceRequest:', error);
          console.error('❌ [INVOICE] Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          });
          toast.error('❌ Errore nel salvataggio automatico della fattura');
        }
      } else {
        console.warn('⚠️ [INVOICE] Invoice NOT saved - missing required data:');
        console.warn('  - supplierId:', supplierId ? 'OK' : 'MISSING');
        console.warn('  - supplierName:', supplierName ? 'OK' : 'MISSING');
        console.warn('  - invoiceData:', invoiceData ? 'OK' : 'MISSING');
        console.warn('  - invoiceData.total_amount:', invoiceData?.total_amount ? 'OK' : 'MISSING');
        console.warn('  - onSaveInvoiceRequest:', onSaveInvoiceRequest ? 'OK' : 'MISSING');
        
        if (!invoiceData) {
          console.warn('⚠️ [INVOICE] invoiceData is missing - this usually means OCR did not extract invoice metadata');
        }
        if (!onSaveInvoiceRequest) {
          console.error('❌ [INVOICE] CRITICAL: onSaveInvoiceRequest function is not defined!');
        }
      }
      console.log('💾 [INVOICE] ========== INVOICE SAVING END ==========');

      if (successCount > 0 || updatedCount > 0 || skippedCount > 0) {
        const messages = [];
        if (successCount > 0) messages.push(`${successCount} ${t('newProducts') || 'new'}`);
        if (updatedCount > 0) messages.push(`${updatedCount} ${t('updated') || 'updated'}`);
        if (skippedCount > 0) messages.push(`${skippedCount} unchanged`);
        
        const productsText = t('products') ? t('products')?.toLowerCase() : 'products';
        const pagesText = uniqueFiles.length > 1 ? ` from ${uniqueFiles.length} pages` : '';
        toast.success(
          `✅ ${messages.join(', ')} ${productsText}${pagesText}!${supplierName ? ` ${t('supplier') || 'Supplier'}: ${supplierName}` : ''}`,
          { duration: 4000 }
        );
      } else {
        toast.error(t('noProductsSaved') || 'No products saved. Check logs for details.');
      }

    } catch (error) {
      console.error('❌ [UPLOAD] Upload error:', error);
      const errorMsg = t('errorUploadingInvoice') || 'Error uploading invoice';
      const verifyMsg = t('verifyImageClear') || 'Verify that the image is clear and readable';
      toast.error(
        error instanceof Error ? error.message : `${errorMsg}. ${verifyMsg}`
      );
    } finally {
      console.log('🔓 [UPLOAD] Releasing global lock: isProcessingUpload = false');
      // ✅ FIX: Release global lock using sessionStorage
      sessionStorage.removeItem('isProcessingUpload');
      setUploading(false);
      setCurrentPage(0);
      setTotalPages(0);
      setProcessingSupplier('');
      setProcessingProductCount(0);
      event.target.value = '';
      console.log('🚀 [UPLOAD] ========== END UPLOAD ==========');
    }
  }, [products, suppliers, settings.country, t, setProducts, setSuppliers, onSaveInvoiceRequest]);

  const safeToLower = (str: string | undefined) => str ? str.toLowerCase() : '';

  return (
    <Card className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-white/20 dark:border-slate-700/20 shadow-xl w-full max-w-full overflow-hidden">
      <CardHeader className="px-3 sm:px-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="w-full">
            <CardTitle className="text-lg sm:text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              {t('products') || 'Products'}
            </CardTitle>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              {filteredProducts.length} {safeToLower(t('products')) || 'products'} • {currency}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 w-full">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full border-2 hover:border-green-500 hover:text-green-600 transition-all min-h-[40px] sm:min-h-[44px] text-[11px] sm:text-sm dark:border-slate-700 dark:hover:border-green-500 px-2 sm:px-3"
                >
                  <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
                  <span className="truncate">{t('export') || 'Export'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 dark:bg-slate-800">
                <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                  {t('exportExcel') || 'Export Excel'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
                  <FileText className="h-4 w-4 mr-2 text-red-600" />
                  {t('exportPDF') || 'Export PDF'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              data-tour="add-product"
              onClick={() => setIsAdding(true)} 
              size="sm"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg transition-all min-h-[40px] sm:min-h-[44px] text-[11px] sm:text-sm px-2 sm:px-3"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
              <span className="truncate">{t('addProduct') || 'Add'}</span>
            </Button>
            <label htmlFor="invoice-upload" className="w-full">
              <Button 
                data-tour="upload-invoice"
                variant="outline" 
                size="sm" 
                asChild 
                disabled={uploading}
                className="w-full border-2 hover:border-blue-500 hover:text-blue-600 transition-all min-h-[40px] sm:min-h-[44px] text-[11px] sm:text-sm dark:border-slate-700 dark:hover:border-blue-500 px-2 sm:px-3"
              >
                <span>
                  <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
                  <span className="truncate">{uploading ? (t('loading') || 'Loading') + '...' : t('uploadInvoice')}</span>
                  <input 
                    id="invoice-upload"
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </span>
              </Button>
            </label>
          </div>
        </div>
        
        <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
          <div className="relative group">
            <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <Input
              type="text"
              placeholder={`${t('search') || 'Search'} ${safeToLower(t('productName')) || 'product name'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 sm:pl-12 pr-9 sm:pr-10 h-10 sm:h-12 border-2 focus:border-blue-500 rounded-xl transition-all dark:bg-slate-800 dark:border-slate-700 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            )}
          </div>

          {/* Supplier Filter */}
          <div className="relative group">
            <Filter className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-focus-within:text-purple-600 transition-colors z-10" />
            <Select value={selectedSupplierFilter} onValueChange={setSelectedSupplierFilter}>
              <SelectTrigger className="pl-9 sm:pl-12 h-10 sm:h-12 border-2 focus:border-purple-500 rounded-xl transition-all dark:bg-slate-800 dark:border-slate-700 text-sm">
                <SelectValue placeholder={t('filterBySupplier') || 'Filtra per fornitore'} />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-800">
                <SelectItem value="all">{t('allSuppliers') || 'Tutti i fornitori'}</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {isAdding && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-6 border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl sm:rounded-2xl space-y-3 sm:space-y-4 shadow-lg">
            <div>
              <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t('productName') || 'Product Name'}</Label>
              <Input
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                placeholder="Es: Pomodori, Vino Rosso, Pane..."
                className="mt-1.5 sm:mt-2 border-2 focus:border-blue-500 rounded-xl h-10 sm:h-11 text-sm dark:bg-slate-800 dark:border-slate-700"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t('price') || 'Price'} ({currency})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
                  className="mt-1.5 sm:mt-2 border-2 focus:border-blue-500 rounded-xl h-10 sm:h-11 text-sm dark:bg-slate-800 dark:border-slate-700"
                />
                {newProduct.price && newProduct.price > 0 && (
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t('withVAT') || 'With VAT'} ({countryVATRate}%): {formatPrice(calculatePriceWithVAT(newProduct.price, countryVATRate), currency)}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t('unit') || 'Unit'}</Label>
                <Select value={newProduct.unit} onValueChange={(value) => setNewProduct({ ...newProduct, unit: value })}>
                  <SelectTrigger className="mt-1.5 sm:mt-2 border-2 focus:border-blue-500 rounded-xl h-10 sm:h-11 text-sm dark:bg-slate-800 dark:border-slate-700">
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
              <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t('supplier') || 'Supplier'}</Label>
              <Select
                value={newProduct.supplier_id}
                onValueChange={(value) => setNewProduct({ ...newProduct, supplier_id: value })}
              >
                <SelectTrigger className="mt-1.5 sm:mt-2 border-2 focus:border-blue-500 rounded-xl h-10 sm:h-11 text-sm dark:bg-slate-800 dark:border-slate-700">
                  <SelectValue placeholder={t('selectSupplier') || 'Select Supplier'} />
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
              <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t('notes') || 'Notes'}</Label>
              <Textarea
                value={newProduct.notes}
                onChange={(e) => setNewProduct({ ...newProduct, notes: e.target.value })}
                placeholder={(t('notes') || 'Notes') + '...'}
                className="mt-1.5 sm:mt-2 border-2 focus:border-blue-500 rounded-xl text-sm dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
            <div className="flex gap-2 sm:gap-3 pt-1 sm:pt-2">
              <Button 
                onClick={handleAddProduct}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg transition-all min-h-[40px] sm:min-h-[44px] text-sm"
              >
                <Check className="h-4 w-4 mr-1.5 sm:mr-2" />
                {t('save') || 'Save'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsAdding(false)}
                className="flex-1 border-2 hover:border-red-500 hover:text-red-500 transition-all min-h-[40px] sm:min-h-[44px] text-sm dark:border-slate-700"
              >
                <X className="h-4 w-4 mr-1.5 sm:mr-2" />
                {t('cancel') || 'Cancel'}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2 sm:space-y-3">
          {filteredProducts.map((product) => (
            <div key={product.id}>
              {editingId === product.id ? (
                <div className="p-3 sm:p-6 border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-950 dark:to-yellow-950 rounded-xl sm:rounded-2xl space-y-3 sm:space-y-4 shadow-lg">
                  <div>
                    <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t('productName') || 'Product Name'}</Label>
                    <Input
                      value={editingProduct.name}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                      className="mt-1.5 sm:mt-2 border-2 focus:border-orange-500 rounded-xl h-10 sm:h-11 text-sm dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t('price') || 'Price'} ({currency})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingProduct.price}
                        onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })}
                        className="mt-1.5 sm:mt-2 border-2 focus:border-orange-500 rounded-xl h-10 sm:h-11 text-sm dark:bg-slate-800 dark:border-slate-700"
                      />
                      {editingProduct.price && editingProduct.price > 0 && (
                        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {t('withVAT') || 'With VAT'} ({countryVATRate}%): {formatPrice(calculatePriceWithVAT(editingProduct.price, countryVATRate), currency)}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t('unit') || 'Unit'}</Label>
                      <Select 
                        value={editingProduct.unit} 
                        onValueChange={(value) => setEditingProduct({ ...editingProduct, unit: value })}
                      >
                        <SelectTrigger className="mt-1.5 sm:mt-2 border-2 focus:border-orange-500 rounded-xl h-10 sm:h-11 text-sm dark:bg-slate-800 dark:border-slate-700">
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
                    <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t('supplier') || 'Supplier'}</Label>
                    <Select
                      value={editingProduct.supplier_id}
                      onValueChange={(value) => setEditingProduct({ ...editingProduct, supplier_id: value })}
                    >
                      <SelectTrigger className="mt-1.5 sm:mt-2 border-2 focus:border-orange-500 rounded-xl h-10 sm:h-11 text-sm dark:bg-slate-800 dark:border-slate-700">
                        <SelectValue placeholder={t('selectSupplier') || 'Select Supplier'} />
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
                    <Label className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t('notes') || 'Notes'}</Label>
                    <Textarea
                      value={editingProduct.notes}
                      onChange={(e) => setEditingProduct({ ...editingProduct, notes: e.target.value })}
                      className="mt-1.5 sm:mt-2 border-2 focus:border-orange-500 rounded-xl text-sm dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>

                  <div className="flex gap-2 sm:gap-3 pt-1 sm:pt-2">
                    <Button 
                      onClick={handleSaveEdit}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg transition-all min-h-[40px] sm:min-h-[44px] text-sm"
                    >
                      <Check className="h-4 w-4 mr-1.5 sm:mr-2" />
                      {t('save') || 'Save'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleCancelEdit}
                      className="flex-1 border-2 hover:border-red-500 hover:text-red-500 transition-all min-h-[40px] sm:min-h-[44px] text-sm dark:border-slate-700"
                    >
                      <X className="h-4 w-4 mr-1.5 sm:mr-2" />
                      {t('cancel') || 'Cancel'}
                    </Button>
                  </div>
                </div>
              ) : (
                <ProductCard
                  product={product}
                  suppliers={suppliers}
                  countryVATRate={countryVATRate}
                  currency={currency}
                  t={t}
                  onEdit={handleStartEdit}
                  onDelete={handleDeleteProduct}
                  onOpenCompareDialog={handleOpenCompareDialog}
                />
              )}
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && !isAdding && (
          <div className="text-center py-10 sm:py-16">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 mb-4">
              <Search className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-lg px-4">
              {searchQuery || selectedSupplierFilter !== 'all' ? (
                <>Nessun prodotto trovato con i filtri selezionati</>
              ) : (
                t('addFirstProduct') || 'Add your first product to get started'
              )}
            </p>
          </div>
        )}
      </CardContent>

      {/* OCR Loading Dialog - Pure Glassmorphism WITHOUT dark overlay */}
      {uploading && (
        <Dialog open={uploading} onOpenChange={() => {}}>
          <DialogOverlay className="!bg-transparent backdrop-blur-sm" />
          <DialogContent 
            className="w-[calc(100%-2rem)] max-w-md !bg-transparent !backdrop-blur-2xl !border-2 !border-white/30 dark:!border-white/10 !shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]"
            style={{
              backdropFilter: 'blur(25px) saturate(200%)',
              WebkitBackdropFilter: 'blur(25px) saturate(200%)',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            }}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg font-semibold">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-blue-500/30 blur-lg animate-pulse"></div>
                  <div className="relative animate-spin rounded-full h-6 w-6 sm:h-7 sm:w-7 border-3 border-transparent border-t-blue-500 border-r-blue-500 shadow-lg"></div>
                </div>
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent font-bold text-sm sm:text-base">
                  {language === 'it' ? 'Analisi fattura in corso...' : 'Analyzing invoice...'}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 sm:space-y-4 py-4 sm:py-6">
              {totalPages > 1 && (
                <div 
                  className="relative overflow-hidden rounded-xl p-4 sm:p-5 border border-white/20 shadow-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                  }}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="text-2xl sm:text-3xl drop-shadow-lg">📄</div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                        {language === 'it' ? 'Pagina' : 'Page'}
                      </p>
                      <p className="text-xl sm:text-2xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        {currentPage}/{totalPages}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {processingSupplier && (
                <div 
                  className="relative overflow-hidden rounded-xl p-4 sm:p-5 border border-white/20 shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-500"
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                  }}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="text-2xl sm:text-3xl drop-shadow-lg">🏢</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                        {language === 'it' ? 'Fornitore' : 'Supplier'}
                      </p>
                      <p className="text-lg sm:text-xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent truncate">
                        {processingSupplier}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {processingProductCount > 0 && (
                <div 
                  className="relative overflow-hidden rounded-xl p-4 sm:p-5 border border-white/20 shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-500"
                  style={{
                    background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                  }}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="text-2xl sm:text-3xl drop-shadow-lg">📦</div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                        {language === 'it' ? 'Prodotti estratti' : 'Products extracted'}
                      </p>
                      <p className="text-xl sm:text-2xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                        {processingProductCount}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Product Comparison Dialog */}
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{t('selectProductToCompare') || 'Seleziona prodotto da comparare'}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {t('selectProductToCompareDesc') || 'Scegli un prodotto dal catalogo per confrontare con'}
              {selectedProductA && (
                <span className="block mt-2 font-semibold text-slate-700 dark:text-slate-300 truncate">
                  {selectedProductA.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-3 sm:gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t('searchProducts') || 'Cerca prodotti...'}
                value={compareSearchQuery}
                onChange={(e) => setCompareSearchQuery(e.target.value)}
                className="pl-10 text-sm h-10"
              />
            </div>

            {/* Products List */}
            <div className="flex-1 overflow-y-auto border rounded-lg">
              {filteredCompareProducts.length === 0 ? (
                <div className="text-center p-6 sm:p-8 text-slate-500 text-sm">
                  {t('noProductsFound') || 'Nessun prodotto trovato'}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredCompareProducts.map(product => {
                    console.log('🔗 [RENDER] Rendering product in dialog:', product.name, product.id);
                    return (
                      <div
                        key={product.id}
                        className="p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs sm:text-sm truncate">{product.name}</p>
                            <div className="flex gap-2 sm:gap-3 text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 mt-1 flex-wrap">
                              <span>{formatPrice(product.price, currency)}</span>
                              {product.unit && <span>{product.unit}</span>}
                              {product.supplier_id && (
                                <span className="text-slate-500 truncate">
                                  • {suppliers.find(s => s.id === product.supplier_id)?.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 text-xs h-8 px-2 sm:px-3"
                            onClick={() => {
                              console.log('🔗 [CLICK] Select button clicked:', product.name, product.id);
                              handleSelectProductB(product);
                            }}
                          >
                            {t('select') || 'Seleziona'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
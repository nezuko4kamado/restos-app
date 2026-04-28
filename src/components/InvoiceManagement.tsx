import { generateUUID } from "@/lib/uuid";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, FileText, AlertTriangle, TrendingUp, TrendingDown, Check, X, ChevronDown, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import type { Invoice, Product, Supplier, ExtractedInvoiceItem } from '@/types';
import type { PriceAlert } from '@/lib/priceAlertService';
import { extractInvoiceData, extractInvoiceItems, type InvoiceDataExtracted } from '@/lib/ocrService';
import { ProductMatcher } from '@/lib/productMatcher';
import { calculateInvoiceStats, formatCurrency } from '@/lib/invoiceStats';
import { useTranslations, type Language } from '@/lib/i18n';
import { InvoiceUploadWithLimits } from '@/components/InvoiceUploadWithLimits';
import { InvoiceLoadingDialog } from '@/components/InvoiceLoadingDialog';
import { SupplierConfirmationDialog } from '@/components/SupplierConfirmationDialog';

// Type for pending invoice data that might have nested structure
type PendingInvoiceDataType = InvoiceDataExtracted | { invoiceData: InvoiceDataExtracted };

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
  onUpdateProduct?: (productId: string, updates: Partial<Product>) => Promise<void>;
  onAddSupplier?: (supplier: Omit<Supplier, 'id'>) => Promise<Supplier>;
  onPriceAlertsUpdate?: (alerts: PriceAlert[]) => void;
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
  onUpdateProduct,
  onAddSupplier,
  onPriceAlertsUpdate,
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual');
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  
  // Progress tracking states
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [productsFound, setProductsFound] = useState(0);
  const [currentState, setCurrentState] = useState<'extracting' | 'analyzing' | 'saving' | 'completed'>('extracting');

  // Supplier confirmation states
  const [showSupplierConfirmation, setShowSupplierConfirmation] = useState(false);
  const [detectedSupplierName, setDetectedSupplierName] = useState('');
  const [confirmedSupplierName, setConfirmedSupplierName] = useState('');
  const [pendingInvoiceDataForConfirmation, setPendingInvoiceDataForConfirmation] = useState<InvoiceDataExtracted | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);

  // Fetch current user ID from Supabase
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) {
        setCurrentUserId(data.user.id);
      }
    });
  }, []);

  // Handle pending invoice from parent
  useEffect(() => {
    if (pendingInvoiceFile && pendingInvoiceData) {
      console.log('📄 [PENDING] Processing pending invoice:', pendingInvoiceFile.name);
      console.log('🔍 [PENDING] pendingInvoiceData:', pendingInvoiceData);
      
      const typedData = pendingInvoiceData as PendingInvoiceDataType;
      console.log('🔍 [PENDING] pendingInvoiceData.invoiceData:', 'invoiceData' in typedData ? typedData.invoiceData : undefined);
      console.log('🔍 [PENDING] pendingInvoiceData.items:', pendingInvoiceData.items);
      
      setSelectedFiles([pendingInvoiceFile]);
      
      // CRITICAL FIX: Check if pendingInvoiceData has invoiceData property (from Index.tsx)
      const actualInvoiceData = 'invoiceData' in typedData ? typedData.invoiceData : pendingInvoiceData;
      console.log('🔍 [PENDING] actualInvoiceData:', actualInvoiceData);
      console.log('🔍 [PENDING] actualInvoiceData.items:', actualInvoiceData.items);
      
      setExtractedData(actualInvoiceData);
      processExtractedData(actualInvoiceData);
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

  const processExtractedData = async (data: InvoiceDataExtracted, confirmedSupName?: string) => {
    console.log('🔍 [PROCESS] ===== START PROCESSING EXTRACTED DATA =====');
    console.log('🔍 [PROCESS] Input data:', JSON.stringify(data, null, 2));
    console.log('🔍 [PROCESS] data.amount (base imponibile):', data.amount);
    console.log('🔍 [PROCESS] data.totalAmount (con IVA):', data.totalAmount);
    console.log('🔍 [PROCESS] data.supplier:', data.supplier);
    console.log('🔍 [PROCESS] data.invoiceNumber:', data.invoiceNumber);
    console.log('🔍 [PROCESS] data.items:', data.items);
    console.log('🔍 [PROCESS] data.items?.length:', data.items?.length || 0);
    
    const targetSupplierName = confirmedSupName || supplierName;
    
    // Set invoice basic info
    if (data.invoiceNumber) {
      console.log('📝 [PROCESS] Setting invoiceNumber:', data.invoiceNumber);
      setNewInvoice(prev => ({ ...prev, invoiceNumber: data.invoiceNumber || '' }));
    }
    if (data.date) {
      console.log('📝 [PROCESS] Setting date:', data.date);
      setNewInvoice(prev => ({ ...prev, date: data.date || '' }));
    }

    // 🔥 CRITICAL FIX: PRIORITIZE totalAmount (with IVA) over amount (base imponibile)
    if (data.totalAmount !== undefined && data.totalAmount !== null) {
      const amountStr = data.totalAmount.toString();
      console.log('💰 [PROCESS] ✅ USING totalAmount (with IVA):', amountStr);
      setNewInvoice(prev => ({ ...prev, amount: amountStr }));
    } else if (data.amount !== undefined && data.amount !== null) {
      const amountStr = data.amount.toString();
      console.log('💰 [PROCESS] ⚠️ FALLBACK to amount (base imponibile):', amountStr);
      setNewInvoice(prev => ({ ...prev, amount: amountStr }));
    } else {
      console.error('❌ [PROCESS] CRITICAL: No amount found in data!');
    }

    // Process items and match with existing products
    if (data.items && data.items.length > 0) {
      console.log('🔍 [PROCESS] Starting to process', data.items.length, 'items');
      const processedItems: ExtractedInvoiceItem[] = [];
      const currentTimestamp = new Date().toISOString();
      
      for (const item of data.items) {
        const matchResult = await ProductMatcher.matchProduct(
          item.name,
          item.sku,
          targetSupplierName,
          item.code_description,
          currentUserId
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
            code_description: item.code_description,
            originalPrice: item.originalPrice,
            discountPercent: item.discountPercent,
            vatRate: item.vatRate,
            matchedProductId: matchedProduct.id,
            matchScore: matchResult.confidence,
            matchStatus: matchResult.confidence >= 90 ? 'matched' : 'partial',
            priceChanged,
            oldPrice: matchedProduct.price,
            priceChangePercent,
            updated_at: currentTimestamp,
          });
        } else {
          processedItems.push({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            code_description: item.code_description,
            originalPrice: item.originalPrice,
            discountPercent: item.discountPercent,
            vatRate: item.vatRate,
            matchStatus: 'new' as const,
            updated_at: currentTimestamp,
          });
        }
      }

      console.log('✅ [PROCESS] Finished processing. Total items:', processedItems.length);
      setExtractedItems(processedItems);
      console.log('🔍 [PROCESS] ===== END PROCESSING EXTRACTED DATA =====');
    } else {
      console.warn('⚠️ [PROCESS] No items to process (data.items is empty or undefined)');
      console.log('🔍 [PROCESS] ===== END PROCESSING EXTRACTED DATA =====');
    }
  };

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
  };

  const handleConfirmUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setTotalPages(selectedFiles.length);
    setCurrentPage(0);
    setProductsFound(0);
    setCurrentState('extracting');

    try {
      console.log(`📤 Processing ${selectedFiles.length} file(s)`);
      
      const allItems: ExtractedInvoiceItem[] = [];
      let invoiceMetadata: InvoiceDataExtracted | null = null;
      const currentTimestamp = new Date().toISOString();

      // Process all pages
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const isLastPage = i === selectedFiles.length - 1;
        
        setCurrentPage(i + 1);
        setCurrentState('extracting');
        
        console.log(`📄 Processing page ${i + 1}/${selectedFiles.length}: ${file.name}`);
        
        if (isLastPage) {
          console.log('📋 Last page - extracting invoice metadata AND items');
          
          const data = await extractInvoiceData(file);
          invoiceMetadata = data;
          
          setCurrentState('analyzing');
          
          if (data.items && data.items.length > 0) {
            console.log(`  ✅ Extracted ${data.items.length} items from last page`);
            for (const item of data.items) {
              const matchResult = await ProductMatcher.matchProduct(
                item.name,
                item.sku,
                supplierName,
                item.code_description,
                currentUserId
              );
              
              if (matchResult.matched && matchResult.product && matchResult.confidence >= 70) {
                const matchedProduct = matchResult.product;
                const priceChanged = Math.abs(matchedProduct.price - item.price) > 0.01;
                const priceChangePercent = priceChanged 
                  ? ((item.price - matchedProduct.price) / matchedProduct.price) * 100 
                  : 0;

                allItems.push({
                  name: item.name,
                  quantity: item.quantity,
                  price: item.price,
                  code_description: item.code_description,
                  originalPrice: item.originalPrice,
                  discountPercent: item.discountPercent,
                  vatRate: item.vatRate,
                  matchedProductId: matchedProduct.id,
                  matchScore: matchResult.confidence,
                  matchStatus: matchResult.confidence >= 90 ? 'matched' : 'partial',
                  priceChanged,
                  oldPrice: matchedProduct.price,
                  priceChangePercent,
                  updated_at: currentTimestamp,
                });
              } else {
                allItems.push({
                  name: item.name,
                  quantity: item.quantity,
                  price: item.price,
                  code_description: item.code_description,
                  originalPrice: item.originalPrice,
                  discountPercent: item.discountPercent,
                  vatRate: item.vatRate,
                  matchStatus: 'new' as const,
                  updated_at: currentTimestamp,
                });
              }
              
              setProductsFound(allItems.length);
            }
          }
        } else {
          console.log('📦 Intermediate page - extracting items only');
          
          const itemsData = await extractInvoiceItems(file);
          
          setCurrentState('analyzing');
          
          if (itemsData && itemsData.length > 0) {
            console.log(`  ✅ Extracted ${itemsData.length} items from page ${i + 1}`);
            for (const item of itemsData) {
              const matchResult = await ProductMatcher.matchProduct(
                item.name,
                item.sku,
                supplierName,
                item.code_description,
                currentUserId
              );
              
              if (matchResult.matched && matchResult.product && matchResult.confidence >= 70) {
                const matchedProduct = matchResult.product;
                const priceChanged = Math.abs(matchedProduct.price - item.price) > 0.01;
                const priceChangePercent = priceChanged 
                  ? ((item.price - matchedProduct.price) / matchedProduct.price) * 100 
                  : 0;

                allItems.push({
                  name: item.name,
                  quantity: item.quantity,
                  price: item.price,
                  code_description: item.code_description,
                  originalPrice: item.originalPrice,
                  discountPercent: item.discountPercent,
                  vatRate: item.vatRate,
                  matchedProductId: matchedProduct.id,
                  matchScore: matchResult.confidence,
                  matchStatus: matchResult.confidence >= 90 ? 'matched' : 'partial',
                  priceChanged,
                  oldPrice: matchedProduct.price,
                  priceChangePercent,
                  updated_at: currentTimestamp,
                });
              } else {
                allItems.push({
                  name: item.name,
                  quantity: item.quantity,
                  price: item.price,
                  code_description: item.code_description,
                  originalPrice: item.originalPrice,
                  discountPercent: item.discountPercent,
                  vatRate: item.vatRate,
                  matchStatus: 'new' as const,
                  updated_at: currentTimestamp,
                });
              }
              
              setProductsFound(allItems.length);
            }
          }
        }
      }

      if (!invoiceMetadata) {
        throw new Error('Impossibile estrarre i metadati della fattura dall\'ultima pagina');
      }

      setCurrentState('saving');

      console.log(`✅ Total items extracted from ${selectedFiles.length} page(s): ${allItems.length}`);
      
      const finalData: InvoiceDataExtracted = {
        ...invoiceMetadata,
        items: allItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          originalPrice: item.originalPrice,
          discountPercent: item.discountPercent,
          vatRate: item.vatRate,
          sku: item.sku || '',
          code_description: item.code_description || '',
        }))
      };
      
      setCurrentState('completed');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsProcessing(false);

      if (finalData.supplier && finalData.supplier.name) {
        const detectedName = finalData.supplier.name.trim();
        console.log('🏢 Detected supplier name:', detectedName);
        
        setDetectedSupplierName(detectedName);
        setPendingInvoiceDataForConfirmation(finalData);
        setExtractedItems(allItems);
        setShowSupplierConfirmation(true);
      } else {
        console.log('⚠️ No supplier name detected, using current supplier');
        setExtractedData(finalData);
        setExtractedItems(allItems);
        
        if (finalData.invoiceNumber) {
          setNewInvoice(prev => ({ ...prev, invoiceNumber: finalData.invoiceNumber || '' }));
        }
        if (finalData.date) {
          setNewInvoice(prev => ({ ...prev, date: finalData.date || '' }));
        }
        if (finalData.totalAmount !== undefined && finalData.totalAmount !== null) {
          setNewInvoice(prev => ({ ...prev, amount: finalData.totalAmount!.toString() }));
        } else if (finalData.amount !== undefined && finalData.amount !== null) {
          setNewInvoice(prev => ({ ...prev, amount: finalData.amount!.toString() }));
        }
        
        toast.success(`✅ Fattura elaborata con successo! ${allItems.length} prodotti estratti da ${selectedFiles.length} pagina/e`);
      }
    } catch (error) {
      console.error('❌ Error processing invoice:', error);
      toast.error(error instanceof Error ? error.message : t('invoiceProcessingError'));
      setIsProcessing(false);
      setCurrentState('completed');
    }
  };

  const handleLoadingDialogClose = () => {
    console.log('🔵 [DIALOG] handleLoadingDialogClose called');
    setIsProcessing(false);
  };

  const handleSupplierConfirmed = async (confirmedSupId: string, confirmedSupName: string, isNewSupplier: boolean) => {
    console.log('✅ Supplier confirmed:', { confirmedSupId, confirmedSupName, isNewSupplier });
    
    if (isNewSupplier && onAddSupplier) {
      try {
        console.log('➕ Creating new supplier:', confirmedSupName);
        
        const supplierPhone = pendingInvoiceDataForConfirmation?.supplier?.phone || '';
        const supplierEmail = pendingInvoiceDataForConfirmation?.supplier?.email || '';
        const supplierAddress = pendingInvoiceDataForConfirmation?.supplier?.address || '';
        const supplierVatNumber = pendingInvoiceDataForConfirmation?.supplier?.vat_number || '';
        
        await onAddSupplier({
          name: confirmedSupName,
          phone: supplierPhone,
          email: supplierEmail,
          address: supplierAddress,
          vat_number: supplierVatNumber,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        console.log('✅ New supplier created:', confirmedSupName);
      } catch (error) {
        console.error('❌ Error creating supplier:', error);
        toast.error('Errore nella creazione del fornitore');
        setShowSupplierConfirmation(false);
        return;
      }
    }
    
    setConfirmedSupplierName(confirmedSupName);
    setShowSupplierConfirmation(false);
    
    if (pendingInvoiceDataForConfirmation) {
      // ✅ FIX: Do NOT call processExtractedData again here.
      // extractedItems was already set in handleConfirmUpload with full match data
      // (matchedProductId, priceChanged, oldPrice). Calling processExtractedData again
      // would overwrite it with stripped items (no matchedProductId) causing price updates to fail.
      setExtractedData(pendingInvoiceDataForConfirmation);

      // Only update invoice metadata fields
      if (pendingInvoiceDataForConfirmation.invoiceNumber) {
        setNewInvoice(prev => ({ ...prev, invoiceNumber: pendingInvoiceDataForConfirmation.invoiceNumber || '' }));
      }
      if (pendingInvoiceDataForConfirmation.date) {
        setNewInvoice(prev => ({ ...prev, date: pendingInvoiceDataForConfirmation.date || '' }));
      }
      if (pendingInvoiceDataForConfirmation.totalAmount !== undefined && pendingInvoiceDataForConfirmation.totalAmount !== null) {
        setNewInvoice(prev => ({ ...prev, amount: pendingInvoiceDataForConfirmation.totalAmount!.toString() }));
      } else if (pendingInvoiceDataForConfirmation.amount !== undefined && pendingInvoiceDataForConfirmation.amount !== null) {
        setNewInvoice(prev => ({ ...prev, amount: pendingInvoiceDataForConfirmation.amount!.toString() }));
      }

      console.log(`✅ [SUPPLIER CONFIRMED] Using ${extractedItems.length} pre-matched items from handleConfirmUpload`);
      console.log(`✅ [SUPPLIER CONFIRMED] Items with matchedProductId:`, extractedItems.filter(i => i.matchedProductId).length);
      console.log(`✅ [SUPPLIER CONFIRMED] Items with priceChanged:`, extractedItems.filter(i => i.priceChanged).length);

      toast.success(`✅ Fattura elaborata con successo per ${confirmedSupName}! ${extractedItems.length} prodotti estratti`);
    }
  };

  const handleSupplierConfirmationCancelled = () => {
    console.log('❌ Supplier confirmation cancelled');
    setShowSupplierConfirmation(false);
    setPendingInvoiceDataForConfirmation(null);
    setDetectedSupplierName('');
    setExtractedData(null);
    setExtractedItems([]);
    setSelectedFiles([]);
  };

  const handleAddManualInvoice = async () => {
    if (!newInvoice.invoiceNumber || !newInvoice.amount) {
      toast.error(t('fillRequiredFields'));
      return;
    }

    const parsedAmount = parseFloat(newInvoice.amount);
    
    const invoice: Invoice = {
      id: generateUUID(),
      supplier_name: supplierName,
      invoiceNumber: newInvoice.invoiceNumber,
      invoice_number: newInvoice.invoiceNumber,
      date: newInvoice.date,
      amount: parsedAmount,
      total_amount: parsedAmount,
      totalAmount: parsedAmount,
      notes: newInvoice.notes,
      items: [],
      isPaid: false,
      is_paid: false,
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    try {
      await onAddInvoice(invoice);
      setNewInvoice({
        invoiceNumber: '',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        notes: '',
      });
      toast.success(`✅ ${t('invoiceAddedSuccess')}`);
    } catch (error) {
      console.error('❌ Error adding invoice:', error);
      if (error instanceof Error) {
        toast.error(`${t('error')}: ${error.message}`);
      } else {
        toast.error(t('invoiceAddError'));
      }
    }
  };

  const handleAddExtractedInvoice = async () => {
    console.log('💾 [SAVE] ===== START SAVE PROCESS =====');
    console.log('💾 [SAVE] extractedData:', extractedData);
    console.log('💾 [SAVE] newInvoice.amount:', newInvoice.amount);
    console.log('💾 [SAVE] newInvoice.invoiceNumber:', newInvoice.invoiceNumber);
    
    if (!extractedData || !newInvoice.invoiceNumber) {
      console.error('❌ [SAVE] Missing required data!');
      toast.error(t('incompleteInvoiceData'));
      return;
    }

    if (!newInvoice.amount || newInvoice.amount === '' || newInvoice.amount === '0') {
      console.error('❌ [SAVE] Amount is missing or zero!');
      toast.error('Errore: Il totale della fattura è mancante o zero. Verifica i dati estratti.');
      return;
    }

    const targetSupplierName = confirmedSupplierName || supplierName;
    
    if (!targetSupplierName) {
      console.error('❌ [CRITICAL ERROR] No supplier name available!');
      toast.error('Errore: Nome fornitore mancante. Riprova.');
      return;
    }

    try {
      const parsedAmount = parseFloat(newInvoice.amount || '0');
      
      const invoice: Invoice = {
        id: generateUUID(),
        supplier_name: targetSupplierName,
        invoiceNumber: newInvoice.invoiceNumber,
        invoice_number: newInvoice.invoiceNumber,
        date: newInvoice.date,
        amount: parsedAmount,
        total_amount: parsedAmount,
        totalAmount: parsedAmount,
        notes: newInvoice.notes,
        items: extractedItems,
        isPaid: false,
        is_paid: false,
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      console.log('🔍 [STEP 3] Created invoice object - supplier_name:', invoice.supplier_name, 'amount:', invoice.amount);

      await onAddInvoice(invoice);
      console.log('✅ [STEP 5] Invoice saved successfully');

      // Update products
      const targetSupplier = suppliers.find(s => s.name === targetSupplierName);
      const targetSupplierId = targetSupplier?.id || supplierId;
      const currentTimestamp = new Date().toISOString();

      for (const item of extractedItems) {
        if (item.matchStatus === 'new') {
          const newProduct: Omit<Product, 'id'> = {
            name: item.name,
            price: item.price,
            supplierId: targetSupplierId,
            supplier_id: targetSupplierId,
            vatRate: item.vatRate,
            vat_rate: item.vatRate,
            discountPercent: item.discountPercent,
            originalPrice: item.originalPrice,
            created_at: currentTimestamp,
            updated_at: currentTimestamp,
          };
          await onAddProduct(newProduct);
        } else if (item.matchedProductId && onUpdateProduct) {
          console.log(`🔄 [UPDATE PRODUCT] id=${item.matchedProductId} name="${item.name}"`);
          console.log(`   oldPrice=${item.oldPrice} newPrice=${item.price}`);
          console.log(`   item.priceChanged=${item.priceChanged} item.matchStatus=${item.matchStatus}`);

          // ALWAYS update price from invoice, regardless of manual changes
          const priceUpdates: Partial<Product> = {
            updated_at: currentTimestamp,
            price: item.price,
          };

          if (item.originalPrice !== undefined) priceUpdates.originalPrice = item.originalPrice;
          if (item.discountPercent !== undefined) priceUpdates.discountPercent = item.discountPercent;
          if (item.vatRate !== undefined) {
            priceUpdates.vatRate = item.vatRate;
            priceUpdates.vat_rate = item.vatRate;
          }

          console.log(`   priceUpdates=`, JSON.stringify(priceUpdates));
          await onUpdateProduct(item.matchedProductId, priceUpdates);
          console.log(`   ✅ onUpdateProduct called for ${item.matchedProductId}`);
        }
      }

      // 🔔 PRICE CHANGE NOTIFICATIONS: fire toasts and update parent alerts
      const changedItems = extractedItems.filter(item => item.priceChanged === true);
      if (changedItems.length > 0) {
        const newAlerts: PriceAlert[] = [];
        for (const item of changedItems) {
          const oldPrice = item.oldPrice ?? 0;
          const newPrice = item.price;
          const changePercent = item.priceChangePercent ?? 0;
          const sign = changePercent >= 0 ? '+' : '';
          toast.warning(
            `⚠️ Prezzo cambiato: ${item.name}  €${oldPrice.toFixed(2)} → €${newPrice.toFixed(2)} (${sign}${changePercent.toFixed(1)}%)`,
            { duration: 6000 }
          );
          newAlerts.push({
            productName: item.name,
            supplierName: targetSupplierName,
            oldPrice,
            newPrice,
            changePercent,
            invoiceDate: newInvoice.date,
            source: 'invoice',
          });
        }
        if (onPriceAlertsUpdate && newAlerts.length > 0) {
          onPriceAlertsUpdate(newAlerts);
        }
      }

      onUpdateProducts();
      
      setNewInvoice({
        invoiceNumber: '',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        notes: '',
      });
      setExtractedData(null);
      setExtractedItems([]);
      setSelectedFiles([]);
      setConfirmedSupplierName('');
      
      console.log('💾 [SAVE] ===== END SAVE PROCESS (SUCCESS) =====');
      toast.success(`✅ ${t('invoiceAddedSuccess')}`);
    } catch (error) {
      console.error('❌ [ERROR] Errore salvataggio fattura:', error);
      console.log('💾 [SAVE] ===== END SAVE PROCESS (ERROR) =====');
      if (error instanceof Error) {
        toast.error(`${t('error')}: ${error.message}`);
      } else {
        toast.error(t('invoiceAddError'));
      }
    }
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    if (confirm(t('confirmDeleteInvoice'))) {
      onDeleteInvoice(invoiceId);
      toast.success(t('invoiceDeleted'));
    }
  };

  const handleTogglePaymentStatus = async (invoice: Invoice) => {
    console.log('🔵 [TOGGLE START] InvoiceManagement.handleTogglePaymentStatus called');
    console.log('  - Invoice ID:', invoice.id);
    console.log('  - Current isPaid status:', invoice.isPaid);
    
    if (!onUpdateInvoice) {
      console.error('❌ [TOGGLE ERROR] onUpdateInvoice is not available');
      toast.error(t('featureNotAvailable'));
      return;
    }

    const newStatus = !invoice.isPaid;

    const updatedInvoice = {
      ...invoice,
      isPaid: newStatus,
      is_paid: newStatus,
      updated_at: new Date().toISOString(),
    };

    try {
      await onUpdateInvoice(updatedInvoice);
      toast.success(updatedInvoice.isPaid ? t('invoiceMarkedPaid') : t('invoiceMarkedUnpaid'));
    } catch (error) {
      console.error('❌ [TOGGLE ERROR] Error updating invoice:', error);
      toast.error(t('invoiceUpdateError'));
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

  const paidInvoices = invoices.filter(inv => inv.isPaid);
  const unpaidInvoices = invoices.filter(inv => !inv.isPaid);
  const totalPaid = paidInvoices.reduce((sum, inv) => sum + (inv.total_amount || inv.totalAmount || inv.amount || 0), 0);
  const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + (inv.total_amount || inv.totalAmount || inv.amount || 0), 0);

  return (
    <>
      {/* Loading Dialog */}
      <InvoiceLoadingDialog
        isOpen={isProcessing}
        currentPage={currentPage}
        totalPages={totalPages}
        productsFound={productsFound}
        currentState={currentState}
        supplierName={supplierName}
        onClose={handleLoadingDialogClose}
      />

      {/* Supplier Confirmation Dialog */}
      <SupplierConfirmationDialog
        isOpen={showSupplierConfirmation}
        detectedSupplierName={detectedSupplierName}
        existingSuppliers={suppliers}
        onConfirm={handleSupplierConfirmed}
        onCancel={handleSupplierConfirmationCancelled}
      />

      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {t('invoiceManagement')} - {confirmedSupplierName || supplierName}
            </DialogTitle>
          </DialogHeader>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <Card className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
              <p className="text-xs text-slate-600 mb-1">{t('totalSpent')}</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(stats.totalSpent)}</p>
            </Card>
            <Card className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
              <p className="text-xs text-slate-600 mb-1">{t('monthlyAverage')}</p>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.averageMonthlySpent)}</p>
            </Card>
            <Card className="p-3 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
              <p className="text-xs text-slate-600 mb-1">{t('totalInvoices')}</p>
              <p className="text-lg font-bold text-purple-600">{stats.totalInvoices}</p>
            </Card>
            <Card className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200">
              <p className="text-xs text-slate-600 mb-1">{t('totalPaid')}</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
            </Card>
            <Card className="p-3 bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200">
              <p className="text-xs text-slate-600 mb-1">{t('totalUnpaid')}</p>
              <p className="text-lg font-bold text-orange-600">{formatCurrency(totalUnpaid)}</p>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'manual' | 'upload')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">{t('manualEntry')}</TabsTrigger>
              <TabsTrigger value="upload">{t('uploadInvoice')}</TabsTrigger>
            </TabsList>

            {/* Manual Entry Tab */}
            <TabsContent value="manual" className="space-y-4">
              <div className="space-y-4 p-4 border-2 border-slate-200 rounded-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('invoiceNumber')} *</Label>
                    <Input
                      value={newInvoice.invoiceNumber}
                      onChange={(e) => setNewInvoice({ ...newInvoice, invoiceNumber: e.target.value })}
                      placeholder="FT-2024-001"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>{t('date')} *</Label>
                    <Input
                      type="date"
                      value={newInvoice.date}
                      onChange={(e) => setNewInvoice({ ...newInvoice, date: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>
                <div>
                  <Label>{t('amount')} (€) *</Label>
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
                  <Label>{t('notes')}</Label>
                  <Textarea
                    value={newInvoice.notes}
                    onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                    placeholder={`${t('notes')}...`}
                    className="mt-2"
                  />
                </div>
                <Button 
                  onClick={handleAddManualInvoice}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('addInvoice')}
                </Button>
              </div>
            </TabsContent>

            {/* Upload Tab */}
            <TabsContent value="upload" className="space-y-4">
              <div className="space-y-4">
                {!extractedData ? (
                  <InvoiceUploadWithLimits
                    onFilesSelected={handleFilesSelected}
                    onConfirm={handleConfirmUpload}
                    isProcessing={isProcessing}
                    disabled={false}
                  />
                ) : (
                  <div className="space-y-4">
                    {/* Invoice Details */}
                    <div className="p-4 border-2 border-indigo-200 bg-indigo-50 rounded-xl space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-slate-800">{t('invoiceData')}</h3>
                        {selectedFiles.length > 1 && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                            📄 {selectedFiles.length} pagine
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>{t('invoiceNumber')} *</Label>
                          <Input
                            value={newInvoice.invoiceNumber}
                            onChange={(e) => setNewInvoice({ ...newInvoice, invoiceNumber: e.target.value })}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label>{t('date')} *</Label>
                          <Input
                            type="date"
                            value={newInvoice.date}
                            onChange={(e) => setNewInvoice({ ...newInvoice, date: e.target.value })}
                            className="mt-2"
                          />
                        </div>
                      </div>
                      {/* TOTALE FIELD - EDITABLE */}
                      <div>
                        <Label>Totale Fattura (€) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newInvoice.amount}
                          onChange={(e) => {
                            console.log('💰 [USER EDIT] User manually changed amount to:', e.target.value);
                            setNewInvoice({ ...newInvoice, amount: e.target.value });
                          }}
                          placeholder="0.00"
                          className="mt-2 font-bold text-lg"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          💡 Estratto dall&apos;OCR. Puoi modificarlo se necessario.
                        </p>
                      </div>
                    </div>

                    {/* Extracted Items */}
                    {extractedItems.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="font-semibold text-slate-800">{t('extractedProducts')} ({extractedItems.length})</h3>
                        <div className="max-h-96 overflow-y-auto space-y-2">
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
                                        ✓ {t('match')} {item.matchScore}%
                                      </span>
                                    )}
                                    {item.matchStatus === 'partial' && (
                                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                                        ~ {t('partial')} {item.matchScore}%
                                      </span>
                                    )}
                                    {item.matchStatus === 'new' && (
                                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                        + {t('new')}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 text-sm">
                                    <span className="text-slate-600">{t('qty')}: {item.quantity}</span>
                                    <span className="font-bold text-slate-800">€{(Number(item.price) || 0).toFixed(2)}</span>
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
                                          <span>{t('priceChanged')}: €{(Number(item.oldPrice) || 0).toFixed(2)} → €{(Number(item.price) || 0).toFixed(2)}</span>
                                          {item.priceChangePercent && (
                                            <span className={`flex items-center gap-1 ${
                                              item.priceChangePercent > 0 ? 'text-red-600' : 'text-green-600'
                                            }`}>
                                              {item.priceChangePercent > 0 ? (
                                                <TrendingUp className="h-3 w-3" />
                                              ) : (
                                                <TrendingDown className="h-3 w-3" />
                                              )}
                                              {Math.abs(Number(item.priceChangePercent) || 0).toFixed(1)}%
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
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button 
                        onClick={handleAddExtractedInvoice}
                        className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t('addInvoice')}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setExtractedData(null);
                          setExtractedItems([]);
                          setSelectedFiles([]);
                          setConfirmedSupplierName('');
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        {t('cancel')}
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
              <h3 className="font-semibold text-slate-800">{t('registeredInvoices')} ({invoices.length})</h3>
              <p className="text-xs text-slate-500 italic">💡 {t('clickToExpandYearMonth')}</p>
            </div>
            {invoices.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">{t('noInvoicesRegistered')}</p>
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
                    return sum + groupedInvoices[year][month].reduce((s, inv) => s + (inv.total_amount || inv.totalAmount || inv.amount || 0), 0);
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
                            ({months.reduce((sum, month) => sum + groupedInvoices[year][month].length, 0)} {t('invoices')?.toLowerCase()})
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
                            const monthTotal = monthInvoices.reduce((sum, inv) => sum + (inv.total_amount || inv.totalAmount || inv.amount || 0), 0);
                            
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
                                    <span className="text-sm text-slate-500">({monthInvoices.length} {t('invoices')?.toLowerCase()})</span>
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
                                                {t('paid')}
                                              </span>
                                            ) : (
                                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded flex items-center gap-1">
                                                <Circle className="h-3 w-3" />
                                                {t('unpaid')}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-3 text-sm text-slate-600">
                                            <span>{new Date(invoice.date).toLocaleDateString('it-IT')}</span>
                                            <span className="font-bold text-indigo-600">{formatCurrency(invoice.total_amount || invoice.totalAmount || invoice.amount || 0)}</span>
                                            {invoice.items && invoice.items.length > 0 && (
                                              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                                                {invoice.items.length} {t('products')?.toLowerCase()}
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
                                            title={invoice.isPaid ? t('markAsUnpaid') : t('markAsPaid')}
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
                                            title={t('deleteInvoice')}
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
    </>
  );
}

export default InvoiceManagement;
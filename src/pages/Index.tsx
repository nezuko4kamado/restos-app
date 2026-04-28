import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Dashboard from '@/components/Dashboard';
import ProductsSectionEnhanced from '@/components/ProductsSectionEnhanced';
import SuppliersSection from '@/components/SuppliersSection';
import OrdersSectionEnhanced from '@/components/OrdersSectionEnhanced';
import { SettingsSection } from '@/components/SettingsSection';
import { InvoicesSection } from '@/components/InvoicesSection';
import { PriceComparisonDashboard } from '@/components/PriceComparisonDashboard';
import PriceScannerMockup from '@/pages/PriceScannerMockup';
import { ClearDataDialog } from '@/components/ClearDataDialog';
import { Footer } from '@/components/Footer';
import ErrorBoundary from '@/components/ErrorBoundary';
import { PriceAlertsWidget } from '@/components/PriceAlertsWidget';
import { SubscriptionManager } from '@/components/SubscriptionManager';
import DemoBanner from '@/components/DemoBanner';
import { Product, Supplier, Order, Invoice, Settings } from '@/types';
import { Package, Users, ShoppingCart, Settings as SettingsIcon, LogOut, Trash2, BarChart3, Mail, Scan, FileText, TrendingDown, Pencil, Store, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import type { InvoiceDataExtracted } from '@/lib/ocrService';
import type { Language } from '@/lib/i18n';
// Import storage functions from storage.ts
import { getProducts, saveProducts, getSuppliers, saveSuppliers, getOrders, saveOrders, getInvoices, saveInvoices, getSettings, saveSettings, addInvoice } from '@/lib/storage';
// Import price alert service
import { calculatePriceAlerts, calculatePriceAlertsFromProducts, getDetailedPriceAlerts } from '@/lib/priceAlertService';
import type { PriceAlert } from '@/lib/priceAlertService';
// Import supabase for direct database operations
import { supabase } from '@/lib/supabase';
// Import demo data
import { demoProducts, demoSuppliers, demoOrders, demoInvoices, demoSettings, demoPriceAlerts } from '@/lib/demoData';

// CRITICAL FIX: Define the actual invoice table name (same as in storage.ts)
const INVOICES_TABLE = 'invoices';

interface InvoiceItem {
  name: string;
  price: number;
  quantity: number;
  originalPrice?: number;
  discountPercent?: number;
  vatRate?: number;
}

export default function Index() {
  const { user, signOut, loading: authLoading, isDemoMode } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  // CRITICAL FIX: Use refs instead of module-level globals to prevent stale state across mounts/unmounts
  const isLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const previousUserIdRef = useRef<string | null>(null);
  // Track if signOut is in progress to prevent auth listener conflicts
  const isSigningOutRef = useRef(false);
  
  // FIXED: Initialize with null to distinguish between "not loaded yet" and "loaded with defaults"
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  // ✅ FIX: Use PriceAlert[] from priceAlertService instead of custom type
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [priceAlertsCount, setPriceAlertsCount] = useState<number>(0);
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // CRITICAL FIX: Add flag to prevent auto-save during initial load
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // ✅ BUG 3 FIX: Track recent deletions to suppress auto-save race conditions
  const recentDeletionRef = useRef(false);
  
  // State for store name editing
  const [showStoreNameDialog, setShowStoreNameDialog] = useState(false);
  const [editingStoreName, setEditingStoreName] = useState('');
  const [storeNameError, setStoreNameError] = useState('');
  
  // State for pending invoice
  const [pendingInvoice, setPendingInvoice] = useState<{
    file: File;
    supplierId: string;
    supplierName: string;
    invoiceData?: InvoiceDataExtracted;
  } | null>(null);

  // ✅ NEW: Combined price alerts calculation from BOTH invoices AND product price_history
  const calculateAllPriceAlerts = useCallback(async (currentProducts: Product[], currentSuppliers: Supplier[]) => {
    // Skip for demo mode — use static demo alerts
    if (isDemoMode) return;
    try {
      console.log('🔔 [INDEX] Calculating ALL price alerts (invoices + product history)...');
      
      // 1. Get invoice-based detailed alerts
      let invoiceAlerts: PriceAlert[] = [];
      try {
        invoiceAlerts = await getDetailedPriceAlerts();
        console.log(`🔔 [INDEX] Invoice-based alerts: ${invoiceAlerts.length}`);
      } catch (err) {
        console.error('❌ [INDEX] Error getting invoice alerts:', err);
      }
      
      // 2. Get product history-based alerts
      const productAlerts = calculatePriceAlertsFromProducts(currentProducts, currentSuppliers);
      console.log(`🔔 [INDEX] Product history-based alerts: ${productAlerts.length}`);
      
      // 3. Merge and deduplicate (prefer product_history alerts over invoice alerts for same product)
      const seenProducts = new Set<string>();
      const mergedAlerts: PriceAlert[] = [];
      
      // Add product history alerts first (they are more up-to-date)
      for (const alert of productAlerts) {
        const key = alert.productName.toLowerCase().trim();
        if (!seenProducts.has(key)) {
          seenProducts.add(key);
          mergedAlerts.push(alert);
        }
      }
      
      // Add invoice alerts that aren't already covered
      for (const alert of invoiceAlerts) {
        const key = alert.productName.toLowerCase().trim();
        if (!seenProducts.has(key)) {
          seenProducts.add(key);
          mergedAlerts.push(alert);
        }
      }
      
      // Sort by absolute change percent (highest first)
      mergedAlerts.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
      
      console.log(`🔔 [INDEX] Total merged alerts: ${mergedAlerts.length}`);
      
      // Set BOTH the detailed alerts array AND the count
      setPriceAlerts(mergedAlerts);
      setPriceAlertsCount(mergedAlerts.length);
    } catch (error) {
      console.error('❌ [INDEX] Error calculating price alerts:', error);
      setPriceAlerts([]);
      setPriceAlertsCount(0);
    }
  }, [isDemoMode]);

  // DEMO MODE: Load demo data immediately when entering demo mode
  useEffect(() => {
    if (isDemoMode) {
      console.log('🎭 [INDEX] Loading demo data...');
      setProducts(demoProducts);
      setSuppliers(demoSuppliers);
      setOrders(demoOrders);
      setInvoices(demoInvoices);
      setSettings(demoSettings);
      // Convert demo alerts to PriceAlert format
      const convertedDemoAlerts: PriceAlert[] = demoPriceAlerts.map(da => ({
        productName: da.product.name,
        supplierName: '',
        oldPrice: da.oldPrice,
        newPrice: da.newPrice,
        changePercent: da.changePercent,
        invoiceDate: new Date().toISOString(),
        source: 'product_history' as const,
      }));
      setPriceAlerts(convertedDemoAlerts);
      setPriceAlertsCount(convertedDemoAlerts.length);
      setDataLoaded(true);
      setIsInitialLoad(false);
      // Reset refs so real data can load later if user registers
      isLoadingRef.current = false;
      hasLoadedRef.current = false;
      console.log('✅ [INDEX] Demo data loaded');
    }
  }, [isDemoMode]);

  // CRITICAL FIX: Load data ONCE using refs (not module-level globals)
  const loadAllData = useCallback(async () => {
    // Never load from Supabase in demo mode
    if (isDemoMode) return;
    try {
      console.log('🔄 Index.tsx: Loading all data from Supabase...');
      const [loadedProducts, loadedSuppliers, loadedOrders, loadedInvoices, loadedSettings] = await Promise.all([
        getProducts(),
        getSuppliers(),
        getOrders(),
        getInvoices(),
        getSettings()
      ]);
      
      console.log('🏠 Index.tsx: Loaded settings from Supabase:', loadedSettings);
      console.log('🌍 Index.tsx: Country from Supabase:', loadedSettings.country);
      console.log('💱 Index.tsx: Currency from Supabase:', loadedSettings.defaultCurrency);
      console.log('🏪 Index.tsx: Store name from Supabase:', loadedSettings.storeName);
      console.log('📧 Index.tsx: Message templates from Supabase:', loadedSettings.messageTemplates);
      console.log('👥 Index.tsx: Loaded suppliers count:', loadedSuppliers.length);
      console.log('👥 Index.tsx: Loaded suppliers:', loadedSuppliers.map(s => ({ id: s.id, name: s.name })));
      console.log('📄 Index.tsx: Loaded invoices count:', loadedInvoices.length);
      console.log('📄 Index.tsx: Loaded invoices:', loadedInvoices.map(inv => ({ 
        id: inv.id, 
        supplier_id: inv.supplier_id,
        supplier_name: inv.supplier_name 
      })));
      
      setProducts(loadedProducts);
      setSuppliers(loadedSuppliers);
      setOrders(loadedOrders);
      setInvoices(loadedInvoices);
      setSettings(loadedSettings);
      setDataLoaded(true);
      
      // ✅ NEW: Calculate ALL price alerts (invoices + product history) after loading
      await calculateAllPriceAlerts(loadedProducts, loadedSuppliers);
      
      // CRITICAL FIX: After initial load completes, allow auto-save after a short delay
      setTimeout(() => {
        console.log('✅ Initial load complete, enabling auto-save');
        setIsInitialLoad(false);
      }, 1000);
      
      console.log('✅ Data loaded successfully:', {
        products: loadedProducts.length,
        suppliers: loadedSuppliers.length,
        orders: loadedOrders.length,
        invoices: loadedInvoices.length,
        country: loadedSettings.country,
        currency: loadedSettings.defaultCurrency,
        storeName: loadedSettings.storeName
      });
    } catch (error) {
      console.error('❌ Error loading data:', error);
      toast.error(t('indexPage.errorLoadingData'));
      // Set dataLoaded to true even on error to prevent infinite loading
      setDataLoaded(true);
      setIsInitialLoad(false);
    }
  }, [isDemoMode, calculateAllPriceAlerts, t]);

  // CRITICAL FIX: Load data with proper dependency tracking for logout/login
  useEffect(() => {
    // Skip Supabase loading entirely in demo mode
    if (isDemoMode) return;

    const loadDataOnce = async () => {
      // Skip if auth is still loading
      if (authLoading) {
        console.log('⏸️ Auth still loading, waiting...');
        return;
      }
      
      // Skip if sign-out is in progress
      if (isSigningOutRef.current) {
        console.log('⏸️ Sign-out in progress, skipping data load');
        return;
      }
      
      // Detect user change (logout/login)
      const currentUserId = user?.id || null;
      if (currentUserId !== previousUserIdRef.current) {
        console.log('🔄 User changed, resetting load flags', {
          previous: previousUserIdRef.current,
          current: currentUserId
        });
        isLoadingRef.current = false;
        hasLoadedRef.current = false;
        setDataLoaded(false);
        setIsInitialLoad(true);
        previousUserIdRef.current = currentUserId;
      }
      
      // Skip if no user (logged out)
      if (!user) {
        console.log('👤 No user, skipping data load');
        // Reset refs on logout
        isLoadingRef.current = false;
        hasLoadedRef.current = false;
        setDataLoaded(false);
        return;
      }

      // CRITICAL: Check refs to prevent duplicate loads
      if (isLoadingRef.current || hasLoadedRef.current) {
        console.log('⏭️ Skipping load - already loaded or loading', {
          isLoading: isLoadingRef.current,
          hasLoaded: hasLoadedRef.current
        });
        return;
      }

      console.log('🚀 Starting data load for user:', user.id);
      isLoadingRef.current = true;
      try {
        await loadAllData();
        hasLoadedRef.current = true;
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadDataOnce();
  }, [authLoading, user, isDemoMode, loadAllData]);

  // ✅ NEW: Recalculate price alerts when products or suppliers change (after initial load)
  useEffect(() => {
    if (isDemoMode) return; // Demo mode uses static alerts
    if (dataLoaded && !isInitialLoad && (products.length > 0 || invoices.length > 0)) {
      console.log('🔔 [INDEX] Products/invoices changed, recalculating ALL price alerts...');
      calculateAllPriceAlerts(products, suppliers);
    }
  }, [products, suppliers, invoices, dataLoaded, isInitialLoad, isDemoMode, calculateAllPriceAlerts]);

  // CRITICAL FIX: Add browser back button listener to reload settings
  useEffect(() => {
    if (isDemoMode) return; // No need to reload settings in demo mode
    const handlePopState = async () => {
      console.log('⬅️ Browser back button pressed, reloading settings...');
      try {
        const loadedSettings = await getSettings();
        console.log('🔄 Reloaded settings after back button:', loadedSettings);
        console.log('🌍 Country after reload:', loadedSettings.country);
        console.log('💱 Currency after reload:', loadedSettings.defaultCurrency);
        console.log('🏪 Store name after reload:', loadedSettings.storeName);
        setSettings(loadedSettings);
      } catch (error) {
        console.error('❌ Error reloading settings after back button:', error);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDemoMode]);

  // Listen for navigation to comparison event
  useEffect(() => {
    const handleNavigateToComparison = (event: CustomEvent) => {
      const { productId } = event.detail;
      console.log('🔗 Navigation to comparison requested for product:', productId);
      setActiveTab('priceComparison');
    };

    window.addEventListener('navigateToComparison', handleNavigateToComparison as EventListener);
    return () => window.removeEventListener('navigateToComparison', handleNavigateToComparison as EventListener);
  }, []);

  // CRITICAL FIX: Add callback to reload invoices when InvoicesSection makes changes
  const handleInvoicesChanged = async () => {
    if (isDemoMode) return; // Demo mode doesn't persist
    try {
      console.log('🔔 [INDEX] Received notification to reload invoices');
      const reloadedInvoices = await getInvoices();
      console.log('🔄 [INDEX] Reloaded invoices from Supabase:', reloadedInvoices.length);
      setInvoices(reloadedInvoices);
      console.log('✅ [INDEX] Invoices state updated');
      
      // ✅ NEW: Recalculate ALL price alerts after invoice changes
      await calculateAllPriceAlerts(products, suppliers);
    } catch (error) {
      console.error('❌ [INDEX] Error reloading invoices:', error);
    }
  };

  // ✅ BUG 3 FIX: Removed auto-save for products.
  // Individual product operations (addProduct, updateProduct, deleteProduct, batchAddProducts, batchUpdateProducts)
  // already persist changes to Supabase directly. The auto-save was causing deleted products to reappear
  // because it would re-upsert the stale products array before the deletion state update propagated.
  // This eliminates the race condition entirely.

  // FIXED: Save suppliers to Supabase when they change (but NOT during initial load or demo mode)
  // ✅ BUG 3 FIX: Skip auto-save if a recent deletion just happened
  useEffect(() => {
    if (isDemoMode) return;
    if (recentDeletionRef.current) {
      console.log('⏸️ Skipping auto-save after recent deletion (suppliers)');
      recentDeletionRef.current = false;
      return;
    }
    if (dataLoaded && user && !isInitialLoad) {
      console.log(`💾 Index.tsx: Auto-saving ${suppliers.length} suppliers to Supabase...`);
      console.log('👥 Index.tsx: Suppliers being saved:', suppliers.map(s => ({ id: s.id, name: s.name })));
      saveSuppliers(suppliers).catch(error => {
        console.error('❌ Error saving suppliers:', error);
      });
    } else if (isInitialLoad) {
      console.log('⏸️ Skipping auto-save during initial load (suppliers)');
    }
  }, [suppliers, dataLoaded, user, isInitialLoad, isDemoMode]);

  // FIXED: Save orders to Supabase when they change (but NOT during initial load or demo mode)
  useEffect(() => {
    if (isDemoMode) return;
    if (dataLoaded && user && !isInitialLoad) {
      console.log('💾 Auto-saving orders to Supabase...');
      saveOrders(orders).catch(error => {
        console.error('❌ Error saving orders:', error);
      });
    } else if (isInitialLoad) {
      console.log('⏸️ Skipping auto-save during initial load (orders)');
    }
  }, [orders, dataLoaded, user, isInitialLoad, isDemoMode]);
  
  // FIXED: Save invoices to Supabase when they change (but NOT during initial load or demo mode)
  useEffect(() => {
    if (isDemoMode) return;
    if (dataLoaded && user && !isInitialLoad) {
      console.log('💾 Auto-saving invoices to Supabase...');
      saveInvoices(invoices).catch(error => {
        console.error('❌ Error saving invoices:', error);
      });
    } else if (isInitialLoad) {
      console.log('⏸️ Skipping auto-save during initial load (invoices)');
    }
  }, [invoices, dataLoaded, user, isInitialLoad, isDemoMode]);

  // FIXED: Save settings to Supabase when they change (but NOT during initial load or demo mode)
  useEffect(() => {
    if (isDemoMode) return;
    if (dataLoaded && user && settings && !isInitialLoad) {
      console.log('💾 Index.tsx: Auto-saving settings to Supabase:', settings);
      console.log('🌍 Index.tsx: Saving country:', settings.country);
      console.log('💱 Index.tsx: Saving currency:', settings.defaultCurrency);
      console.log('🏪 Index.tsx: Saving store name:', settings.storeName);
      console.log('📧 Index.tsx: Saving message templates:', settings.messageTemplates);
      
      saveSettings(settings).catch(error => {
        console.error('❌ Error saving settings:', error);
      });
    } else if (isInitialLoad) {
      console.log('⏸️ Skipping auto-save during initial load (settings)');
    }
  }, [settings, dataLoaded, user, isInitialLoad, isDemoMode]);

  // FIXED: Redirect to login if not authenticated (skip in demo mode)
  useEffect(() => {
    if (!authLoading && !user && !isDemoMode) {
      navigate('/login');
    }
  }, [user, authLoading, navigate, isDemoMode]);

  const handleSignOut = async () => {
    try {
      console.log('🔴 [INDEX] handleSignOut called');
      // Set signing out flag to prevent data load during sign-out
      isSigningOutRef.current = true;
      // Reset load refs immediately
      isLoadingRef.current = false;
      hasLoadedRef.current = false;
      previousUserIdRef.current = null;
      
      await signOut();
      console.log('🔴 [INDEX] signOut completed');
    } catch (err) {
      console.error('❌ [INDEX] signOut error:', err);
    } finally {
      isSigningOutRef.current = false;
    }
    // Always navigate to login, even if signOut fails
    navigate('/login');
  };

  // CRITICAL FIX: Convert extracted items to Invoice items format
  const convertToInvoiceItems = (extractedItems: InvoiceItem[], products: Product[]) => {
    return extractedItems.map(item => {
      // Try to find matching product by name
      const matchingProduct = products.find(p => 
        p.name.toLowerCase() === item.name.toLowerCase()
      );

      return {
        product_id: matchingProduct?.id || '', // Empty string if no match
        quantity: item.quantity || 1,
        price: item.price,
        custom_product_name: item.name // Always include the name from OCR
      };
    });
  };

  // ✅ CRITICAL FIX: Use OCR total_amount directly, do NOT recalculate from items!
  const handleSaveInvoiceRequest = async (file: File, supplierId: string, supplierName: string, invoiceData?: InvoiceDataExtracted) => {
    // In demo mode, show a prompt to register
    if (isDemoMode) {
      toast.info(t('demoActionBlocked'), {
        description: t('demoRegisterPrompt'),
        duration: 4000,
      });
      return;
    }

    console.log('📄 [SAVE INVOICE] ========== START ==========');
    console.log('📄 [SAVE INVOICE] Invoice save request received');
    console.log('📄 [SAVE INVOICE] Supplier ID:', supplierId);
    console.log('📄 [SAVE INVOICE] Supplier Name:', supplierName);
    console.log('📄 [SAVE INVOICE] Invoice Data:', invoiceData);
    console.log('📄 [SAVE INVOICE] Invoice Data Items:', invoiceData?.items);
    console.log('📄 [SAVE INVOICE] Invoice Data Items Count:', invoiceData?.items?.length || 0);
    
    try {
      // ✅ CRITICAL FIX: ALWAYS use total_amount from OCR, NEVER recalculate!
      const totalAmount = invoiceData?.total_amount || invoiceData?.totalAmount || invoiceData?.amount || 0;
      
      console.log('💰 [SAVE INVOICE] ✅ Using OCR total_amount directly:', totalAmount);
      console.log('💰 [SAVE INVOICE] ⚠️ NOT recalculating from items to avoid discrepancies');
      
      // Validate that we have a valid total
      if (!totalAmount || totalAmount === 0) {
        console.error('❌ [SAVE INVOICE] CRITICAL: Total amount is 0 or missing from OCR!');
        console.error('❌ [SAVE INVOICE] invoiceData.total_amount:', invoiceData?.total_amount);
        console.error('❌ [SAVE INVOICE] invoiceData.totalAmount:', invoiceData?.totalAmount);
        console.error('❌ [SAVE INVOICE] invoiceData.amount:', invoiceData?.amount);
        toast.error(t('indexPage.errorLoadingData'));
        return;
      }
      
      // Convert File to base64 for storage
      console.log('📤 [SAVE INVOICE] Converting file to base64...');
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      console.log('✅ [SAVE INVOICE] File converted to base64');
      
      // CRITICAL FIX: Convert extracted items to proper Invoice items format
      const invoiceItems = invoiceData?.items 
        ? convertToInvoiceItems(invoiceData.items as InvoiceItem[], products)
        : [];
      
      console.log('🔧 [SAVE INVOICE] Converted items to Invoice format:', invoiceItems);
      
      // CRITICAL FIX: Create invoice object with supplier_name field
      const newInvoice: Omit<Invoice, 'id'> = {
        supplier_id: supplierId,
        supplier_name: supplierName, // CRITICAL FIX: Add supplier_name for filtering
        invoice_number: invoiceData?.invoice_number || invoiceData?.invoiceNumber || `INV-${Date.now()}`,
        date: invoiceData?.date || invoiceData?.invoiceDate || new Date().toISOString().split('T')[0],
        amount: totalAmount, // ✅ Use OCR total directly
        items: invoiceItems, // Use converted items
        paid: false, // Match Invoice type field name
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      console.log('💾 [SAVE INVOICE] Invoice object created:');
      console.log('  - supplier_id:', newInvoice.supplier_id);
      console.log('  - supplier_name:', newInvoice.supplier_name);
      console.log('  - invoice_number:', newInvoice.invoice_number);
      console.log('  - date:', newInvoice.date);
      console.log('  - amount (from OCR):', newInvoice.amount);
      console.log('  - items count:', newInvoice.items?.length || 0);
      console.log('  - items:', newInvoice.items);
      console.log('  - paid:', newInvoice.paid);
      
      // Save to database
      console.log('💾 [SAVE INVOICE] Calling addInvoice...');
      const savedInvoice = await addInvoice(newInvoice);
      
      if (!savedInvoice) {
        throw new Error('Failed to save invoice to database - addInvoice returned null');
      }
      
      console.log('✅ [SAVE INVOICE] Invoice saved to database successfully!');
      console.log('✅ [SAVE INVOICE] Saved invoice ID:', savedInvoice.id);
      console.log('✅ [SAVE INVOICE] Saved invoice amount:', savedInvoice.amount);
      console.log('✅ [SAVE INVOICE] Saved invoice supplier_name:', savedInvoice.supplier_name);
      
      // Update local state
      console.log('🔄 [SAVE INVOICE] Updating local state...');
      setInvoices(prevInvoices => {
        const updated = [...prevInvoices, savedInvoice];
        console.log('✅ [SAVE INVOICE] Local state updated. Total invoices:', updated.length);
        return updated;
      });
      
      // Clear pending invoice
      setPendingInvoice(null);
      console.log('✅ [SAVE INVOICE] Pending invoice cleared');
      
      // Show success message
      toast.success(`✅ ${t('invoiceAddedSuccess')} ${supplierName}! ${t('totalAmount')}: €${totalAmount.toFixed(2)}`, { duration: 4000 });
      console.log('✅ [SAVE INVOICE] Success toast shown');
      
      // Switch to invoices tab to show the saved invoice
      setActiveTab('invoices');
      console.log('✅ [SAVE INVOICE] Switched to invoices tab');
      
      console.log('📄 [SAVE INVOICE] ========== SUCCESS ==========');
      
    } catch (error) {
      console.error('❌ [SAVE INVOICE] ========== ERROR ==========');
      console.error('❌ [SAVE INVOICE] Error saving invoice:', error);
      console.error('❌ [SAVE INVOICE] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      });
      
      toast.error(`❌ ${t('invoiceAddError')}: ${error instanceof Error ? error.message : t('error')}`);
      
      // Store pending invoice data for retry
      setPendingInvoice({
        file,
        supplierId,
        supplierName,
        invoiceData
      });
      
      console.log('📄 [SAVE INVOICE] ========== END (ERROR) ==========');
    }
  };

  const handleInvoiceProcessed = () => {
    console.log('✅ Invoice processed, clearing pending invoice');
    setPendingInvoice(null);
  };

  const handleSettingsUpdate = async (updatedSettings: Settings) => {
    if (isDemoMode) {
      // Allow local settings changes in demo mode (e.g. language) but don't persist
      setSettings(updatedSettings);
      return;
    }
    console.log('🔄 [INDEX] Settings updated from SettingsSection:', updatedSettings);
    console.log('📧 [INDEX] Updated message templates:', updatedSettings.messageTemplates);
    setSettings(updatedSettings);
    
    // CRITICAL: Force immediate save to Supabase
    try {
      await saveSettings(updatedSettings);
      console.log('✅ [INDEX] Settings saved to Supabase immediately');
    } catch (error) {
      console.error('❌ [INDEX] Error saving settings:', error);
    }
  };
  
  const handleClearDataClick = () => {
    if (isDemoMode) {
      toast.info(t('demoActionBlocked'), {
        description: t('demoRegisterPrompt'),
        duration: 4000,
      });
      return;
    }
    setShowClearDataDialog(true);
  };

  const handleClearDataConfirm = async () => {
    if (isDemoMode) return; // Safety guard
    try {
      console.log('🗑️ ========== STARTING DATA DELETION ==========');
      console.log('🗑️ User ID:', user?.id);
      console.log('🗑️ Current state before deletion:', {
        products: products.length,
        suppliers: suppliers.length,
        orders: orders.length,
        invoices: invoices.length
      });
      
      // CRITICAL FIX: Set isInitialLoad to true to prevent auto-save during deletion
      console.log('🔒 Setting isInitialLoad = true to disable auto-save');
      setIsInitialLoad(true);
      
      // ✅ BUG 3 FIX: Set recent deletion flag
      recentDeletionRef.current = true;
      
      // FIXED: Delete all records from Supabase tables directly
      // CRITICAL FIX: Delete in correct order to respect foreign key constraints
      // Must delete invoices BEFORE suppliers because invoices reference suppliers
      if (user && supabase) {
        console.log('🗑️ Deleting from Supabase for user:', user.id);
        
        // STEP 1: Delete invoices from CORRECT table name
        console.log('🗑️ Step 1: Deleting invoices from', INVOICES_TABLE, 'table...');
        const invoicesResult = await supabase.from(INVOICES_TABLE).delete().eq('user_id', user.id);
        console.log('🗑️ DELETE RESULT for invoices:', {
          error: invoicesResult.error,
          status: invoicesResult.status,
          count: invoicesResult.count
        });
        if (invoicesResult.error) {
          console.error('❌ DELETION FAILED for invoices:', invoicesResult.error);
          console.error('❌ Error details:', JSON.stringify(invoicesResult.error, null, 2));
        } else {
          console.log('✅ Successfully deleted from', INVOICES_TABLE);
        }
        
        // STEP 2: Delete draft_orders table
        console.log('🗑️ Step 2: Deleting draft_orders...');
        const draftOrdersResult = await supabase.from('draft_orders').delete().eq('user_id', user.id);
        console.log('🗑️ DELETE RESULT for draft_orders:', {
          error: draftOrdersResult.error,
          status: draftOrdersResult.status,
          count: draftOrdersResult.count
        });
        if (draftOrdersResult.error) {
          console.error('❌ DELETION FAILED for draft_orders:', draftOrdersResult.error);
        } else {
          console.log('✅ Successfully deleted from draft_orders');
        }
        
        // STEP 3: Delete cancelled_draft_orders table
        console.log('🗑️ Step 3: Deleting cancelled_draft_orders...');
        const cancelledDraftOrdersResult = await supabase.from('cancelled_draft_orders').delete().eq('user_id', user.id);
        console.log('🗑️ DELETE RESULT for cancelled_draft_orders:', {
          error: cancelledDraftOrdersResult.error,
          status: cancelledDraftOrdersResult.status,
          count: cancelledDraftOrdersResult.count
        });
        if (cancelledDraftOrdersResult.error) {
          console.error('❌ DELETION FAILED for cancelled_draft_orders:', cancelledDraftOrdersResult.error);
        } else {
          console.log('✅ Successfully deleted from cancelled_draft_orders');
        }
        
        // STEP 4: Delete products (no dependencies)
        console.log('🗑️ Step 4: Deleting products...');
        const productsResult = await supabase.from('products').delete().eq('user_id', user.id);
        console.log('🗑️ DELETE RESULT for products:', {
          error: productsResult.error,
          status: productsResult.status,
          count: productsResult.count
        });
        if (productsResult.error) {
          console.error('❌ DELETION FAILED for products:', productsResult.error);
        } else {
          console.log('✅ Successfully deleted from products');
        }
        
        // STEP 5: Delete orders (no dependencies)
        console.log('🗑️ Step 5: Deleting orders...');
        const ordersResult = await supabase.from('orders').delete().eq('user_id', user.id);
        console.log('🗑️ DELETE RESULT for orders:', {
          error: ordersResult.error,
          status: ordersResult.status,
          count: ordersResult.count
        });
        if (ordersResult.error) {
          console.error('❌ DELETION FAILED for orders:', ordersResult.error);
        } else {
          console.log('✅ Successfully deleted from orders');
        }
        
        // STEP 6: Delete suppliers LAST (after invoices that reference them)
        console.log('🗑️ Step 6: Deleting suppliers...');
        const suppliersResult = await supabase.from('suppliers').delete().eq('user_id', user.id);
        console.log('🗑️ DELETE RESULT for suppliers:', {
          error: suppliersResult.error,
          status: suppliersResult.status,
          count: suppliersResult.count
        });
        if (suppliersResult.error) {
          console.error('❌ DELETION FAILED for suppliers:', suppliersResult.error);
          console.error('❌ Error details:', JSON.stringify(suppliersResult.error, null, 2));
        } else {
          console.log('✅ Successfully deleted from suppliers');
        }
        
        // VERIFICATION: Check if data was actually deleted
        console.log('🔍 ========== VERIFYING DELETION ==========');
        const [verifyInvoices, verifyProducts, verifySuppliers, verifyOrders] = await Promise.all([
          supabase.from(INVOICES_TABLE).select('*').eq('user_id', user.id),
          supabase.from('products').select('*').eq('user_id', user.id),
          supabase.from('suppliers').select('*').eq('user_id', user.id),
          supabase.from('orders').select('*').eq('user_id', user.id)
        ]);
        
        console.log('🔍 VERIFICATION: Remaining records in DB:', {
          invoices: verifyInvoices.data?.length || 0,
          products: verifyProducts.data?.length || 0,
          suppliers: verifySuppliers.data?.length || 0,
          orders: verifyOrders.data?.length || 0
        });
        
        if (verifyInvoices.data && verifyInvoices.data.length > 0) {
          console.error('❌ WARNING: Invoices were NOT deleted! Still found:', verifyInvoices.data.length);
        }
        if (verifySuppliers.data && verifySuppliers.data.length > 0) {
          console.error('❌ WARNING: Suppliers were NOT deleted! Still found:', verifySuppliers.data.length);
        }
        if (verifyProducts.data && verifyProducts.data.length > 0) {
          console.error('❌ WARNING: Products were NOT deleted! Still found:', verifyProducts.data.length);
        }
        if (verifyOrders.data && verifyOrders.data.length > 0) {
          console.error('❌ WARNING: Orders were NOT deleted! Still found:', verifyOrders.data.length);
        }
        
        if (!verifyInvoices.data?.length && !verifySuppliers.data?.length && !verifyProducts.data?.length && !verifyOrders.data?.length) {
          console.log('✅ VERIFICATION PASSED: All data deleted successfully');
        }
      }
      
      // Clear local state
      console.log('🗑️ Clearing local state...');
      setProducts([]);
      setSuppliers([]);
      setOrders([]);
      setInvoices([]);
      setPriceAlerts([]);
      setPriceAlertsCount(0);
      
      console.log('✅ All data cleared successfully');
      console.log('🗑️ ========== DATA DELETION COMPLETE ==========');
      toast.success(t('dataCleared'));
      setShowClearDataDialog(false);
      
      // CRITICAL FIX: Keep isInitialLoad true to prevent auto-save after deletion
      console.log('🔒 Auto-save disabled after data deletion (isInitialLoad = true)');
    } catch (error) {
      console.error('❌ Error clearing data:', error);
      toast.error(t('indexPage.errorClearingData'));
      setIsInitialLoad(false);
    }
  };

  const handleEditStoreName = () => {
    if (isDemoMode) {
      toast.info(t('demoActionBlocked'), {
        description: t('demoRegisterPrompt'),
        duration: 4000,
      });
      return;
    }
    setEditingStoreName(settings?.storeName || '');
    setStoreNameError('');
    setShowStoreNameDialog(true);
  };

  const handleSaveStoreName = () => {
    // Validation
    const trimmedName = editingStoreName.trim();
    
    if (!trimmedName) {
      setStoreNameError(t('indexPage.storeNameCannotBeEmpty'));
      return;
    }
    
    if (trimmedName.length > 50) {
      setStoreNameError(t('indexPage.storeNameTooLong'));
      return;
    }
    
    // Save the store name
    if (settings) {
      setSettings({
        ...settings,
        storeName: trimmedName
      });
      toast.success(t('indexPage.storeNameUpdated'));
      setShowStoreNameDialog(false);
    }
  };

  const handleCancelStoreName = () => {
    setShowStoreNameDialog(false);
    setEditingStoreName('');
    setStoreNameError('');
  };

  const handleSectionChange = (section: string) => {
    setActiveTab(section);
  };

  const handleClearAlerts = () => {
    setPriceAlerts([]);
    setPriceAlertsCount(0);
  };

  const handleNavigateToComparison = (productId: string) => {
    console.log('🔗 Navigating to comparison for product:', productId);
    setActiveTab('priceComparison');
  };

  // FIXED: Show loading only when auth is loading AND user exists but data is not loaded
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="text-muted-foreground dark:text-slate-400">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // If not authenticated and not in demo mode, return null (will redirect to login)
  if (!user && !isDemoMode) {
    return null;
  }

  // If authenticated but data not loaded yet, show loading
  if (!dataLoaded || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="text-muted-foreground dark:text-slate-400">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col">
      {/* Demo Mode Banner */}
      <DemoBanner />

      <div className="container mx-auto p-3 sm:p-6 max-w-7xl flex-1">
        {/* Header - MOBILE OPTIMIZED */}
        <Card className="mb-4 sm:mb-6 bg-white dark:bg-slate-900 border-none shadow-lg">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <img src="/FullLogo_Transparent_NoBuffer.png" alt="RESTOS Logo" className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-widest bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate">
                    RESTOS
                  </h1>
                  {/* Store Name - MOBILE OPTIMIZED */}
                  <div className="flex items-center gap-1.5 sm:gap-2 mt-1">
                    <Store className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 truncate">
                      {settings.storeName || t('settingsSection.storeNamePlaceholder')}
                    </p>
                    {isDemoMode && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                        {t('demoMode')}
                      </span>
                    )}
                    {!isDemoMode && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={handleEditStoreName}
                              className="p-1.5 sm:p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center flex-shrink-0"
                            >
                              <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('indexPage.editStoreName')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="flex-1 sm:flex-none gap-2 border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200 min-h-[44px] text-xs sm:text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">{isDemoMode ? t('exitDemo') : t('logout')}</span>
                  <span className="sm:hidden">{isDemoMode ? t('exitDemo') : t('logout')}</span>
                </Button>
                {!isDemoMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearDataClick}
                    className="flex-1 sm:flex-none gap-2 border-gray-300 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 dark:text-slate-200 min-h-[44px] text-xs sm:text-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('clearData')}</span>
                    <span className="sm:hidden">{t('clearData')}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Navigation Tabs - MOBILE OPTIMIZED with horizontal scroll */}
        <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          <Button
            variant={activeTab === 'dashboard' ? 'default' : 'outline'}
            onClick={() => setActiveTab('dashboard')}
            className={`gap-2 rounded-full px-4 sm:px-6 whitespace-nowrap min-h-[44px] flex-shrink-0 text-xs sm:text-sm ${
              activeTab === 'dashboard'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden xs:inline">{t('dashboard')}</span>
          </Button>
          <Button
            variant={activeTab === 'products' ? 'default' : 'outline'}
            onClick={() => setActiveTab('products')}
            className={`gap-2 rounded-full px-4 sm:px-6 whitespace-nowrap min-h-[44px] flex-shrink-0 text-xs sm:text-sm ${
              activeTab === 'products'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <Package className="h-4 w-4" />
            <span className="hidden xs:inline">{t('products')}</span>
          </Button>
          <Button
            variant={activeTab === 'suppliers' ? 'default' : 'outline'}
            onClick={() => setActiveTab('suppliers')}
            className={`gap-2 rounded-full px-4 sm:px-6 whitespace-nowrap min-h-[44px] flex-shrink-0 text-xs sm:text-sm ${
              activeTab === 'suppliers'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <Users className="h-4 w-4" />
            <span className="hidden xs:inline">{t('suppliers')}</span>
          </Button>
          <Button
            variant={activeTab === 'orders' ? 'default' : 'outline'}
            onClick={() => setActiveTab('orders')}
            className={`gap-2 rounded-full px-4 sm:px-6 whitespace-nowrap min-h-[44px] flex-shrink-0 text-xs sm:text-sm ${
              activeTab === 'orders'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden xs:inline">{t('orders')}</span>
          </Button>
          <Button
            variant={activeTab === 'invoices' ? 'default' : 'outline'}
            onClick={() => setActiveTab('invoices')}
            className={`gap-2 rounded-full px-4 sm:px-6 whitespace-nowrap min-h-[44px] flex-shrink-0 text-xs sm:text-sm ${
              activeTab === 'invoices'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span className="hidden xs:inline">{t('invoices')}</span>
          </Button>
          <Button
            variant={activeTab === 'priceComparison' ? 'default' : 'outline'}
            onClick={() => setActiveTab('priceComparison')}
            className={`gap-2 rounded-full px-4 sm:px-6 whitespace-nowrap min-h-[44px] flex-shrink-0 text-xs sm:text-sm ${
              activeTab === 'priceComparison'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <TrendingDown className="h-4 w-4" />
            <span className="hidden sm:inline">{t('indexPage.comparison')}</span>
          </Button>
          <Button
            variant={activeTab === 'subscriptions' ? 'default' : 'outline'}
            onClick={() => setActiveTab('subscriptions')}
            className={`gap-2 rounded-full px-4 sm:px-6 whitespace-nowrap min-h-[44px] flex-shrink-0 text-xs sm:text-sm ${
              activeTab === 'subscriptions'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span className="hidden xs:inline">{t('subscriptions.title')}</span>
          </Button>
          <Button
            variant={activeTab === 'settings' ? 'default' : 'outline'}
            onClick={() => setActiveTab('settings')}
            className={`gap-2 rounded-full px-4 sm:px-6 whitespace-nowrap min-h-[44px] flex-shrink-0 text-xs sm:text-sm ${
              activeTab === 'settings'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <SettingsIcon className="h-4 w-4" />
            <span className="hidden xs:inline">{t('settings')}</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/contact')}
            className="gap-2 rounded-full px-4 sm:px-6 border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200 whitespace-nowrap min-h-[44px] flex-shrink-0 text-xs sm:text-sm"
          >
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">{t('contactUs')}</span>
          </Button>
        </div>

        {/* Price Alerts Widget */}
        <PriceAlertsWidget products={products} />

        {/* Content Area */}
        <div>
          {activeTab === 'dashboard' && (
            <Dashboard
              products={products}
              suppliers={suppliers}
              orders={orders}
              invoices={invoices}
              priceAlerts={priceAlerts}
              priceAlertsCount={priceAlertsCount}
              settings={settings}
              onSectionChange={handleSectionChange}
              onClearAlerts={handleClearAlerts}
            />
          )}

          {activeTab === 'products' && (
            <ErrorBoundary>
              <ProductsSectionEnhanced
                products={products}
                setProducts={setProducts}
                suppliers={suppliers}
                setSuppliers={setSuppliers}
                settings={settings}
                onSaveInvoiceRequest={handleSaveInvoiceRequest}
                onNavigateToComparison={handleNavigateToComparison}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'suppliers' && (
            <SuppliersSection
              suppliers={suppliers}
              setSuppliers={setSuppliers}
              products={products}
              setProducts={setProducts}
              invoices={invoices}
              setInvoices={setInvoices}
              language={settings.language as Language}
              settings={settings}
              pendingInvoice={pendingInvoice}
              onInvoiceProcessed={handleInvoiceProcessed}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersSectionEnhanced
              orders={orders}
              setOrders={setOrders}
              products={products}
              setProducts={setProducts}
              suppliers={suppliers}
              setSuppliers={setSuppliers}
              settings={settings}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesSection 
              settings={settings}
              onInvoicesChanged={handleInvoicesChanged}
            />
          )}

          {activeTab === 'priceComparison' && (
            <PriceComparisonDashboard 
              products={products}
              suppliers={suppliers}
            />
          )}

          {activeTab === 'subscriptions' && (
            <SubscriptionManager />
          )}

          {activeTab === 'priceScanner' && (
            <PriceScannerMockup settings={settings} />
          )}

          {activeTab === 'settings' && (
            <SettingsSection 
              settings={settings}
              onSettingsUpdate={handleSettingsUpdate} 
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Store Name Edit Dialog - MOBILE OPTIMIZED */}
      <Dialog open={showStoreNameDialog} onOpenChange={setShowStoreNameDialog}>
        <DialogContent className="w-[95vw] max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('indexPage.editStoreNameTitle')}</DialogTitle>
            <DialogDescription>
              {t('indexPage.editStoreNameDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="storeName">{t('indexPage.storeNameLabel')}</Label>
              <Input
                id="storeName"
                value={editingStoreName}
                onChange={(e) => {
                  setEditingStoreName(e.target.value);
                  setStoreNameError('');
                }}
                placeholder={t('settingsSection.storeNamePlaceholder')}
                maxLength={50}
                className={`min-h-[44px] ${storeNameError ? 'border-red-500' : ''}`}
              />
              {storeNameError && (
                <p className="text-sm text-red-500">{storeNameError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t('indexPage.charactersCount', { count: editingStoreName.length })}
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCancelStoreName} className="w-full sm:w-auto min-h-[44px]">
              {t('indexPage.cancelEdit')}
            </Button>
            <Button onClick={handleSaveStoreName} className="w-full sm:w-auto min-h-[44px]">
              {t('indexPage.saveEdit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Data Confirmation Dialog */}
      <ClearDataDialog
        open={showClearDataDialog}
        onOpenChange={setShowClearDataDialog}
        onConfirm={handleClearDataConfirm}
      />
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Dashboard from '@/components/Dashboard';
import ProductsSection from '@/components/ProductsSection';
import SuppliersSection from '@/components/SuppliersSection';
import OrdersSection from '@/components/OrdersSection';
import SettingsSection from '@/components/SettingsSection';
import { InvoicesSection } from '@/components/InvoicesSection';
import { PriceComparisonDashboard } from '@/components/PriceComparisonDashboard';
import PriceScannerMockup from '@/pages/PriceScannerMockup';
import { ClearDataDialog } from '@/components/ClearDataDialog';
import { Footer } from '@/components/Footer';
import { PriceAlertsWidget } from '@/components/PriceAlertsWidget';
import { Product, Supplier, Order, Invoice, Settings } from '@/types';
import { Package, Users, ShoppingCart, Settings as SettingsIcon, LogOut, Trash2, BarChart3, Mail, Scan, FileText, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import type { InvoiceDataExtracted } from '@/lib/ocrService';
import type { Language } from '@/lib/i18n';
// Import storage functions from storage.ts
import { getProducts, saveProducts, getSuppliers, saveSuppliers, getOrders, saveOrders, getInvoices, saveInvoices, getSettings, saveSettings } from '@/lib/storage';
// Import supabase for direct database operations
import { supabase } from '@/lib/supabase';

export default function Index() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  
  // FIXED: Initialize with null to distinguish between "not loaded yet" and "loaded with defaults"
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [priceAlerts, setPriceAlerts] = useState<Array<{ product: Product; oldPrice: number; newPrice: number; changePercent: number }>>([]);
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // State for pending invoice
  const [pendingInvoice, setPendingInvoice] = useState<{
    file: File;
    supplierId: string;
    supplierName: string;
    invoiceData?: InvoiceDataExtracted;
  } | null>(null);

  // FIXED: Load all data from Supabase on mount
  useEffect(() => {
    if (!authLoading && user) {
      loadAllData();
    }
  }, [user, authLoading]);

  // CRITICAL FIX: Add browser back button listener to reload settings
  useEffect(() => {
    const handlePopState = async () => {
      console.log('⬅️ Browser back button pressed, reloading settings...');
      try {
        const loadedSettings = await getSettings();
        console.log('🔄 Reloaded settings after back button:', loadedSettings);
        console.log('🌍 Country after reload:', loadedSettings.country);
        console.log('💱 Currency after reload:', loadedSettings.defaultCurrency);
        setSettings(loadedSettings);
      } catch (error) {
        console.error('❌ Error reloading settings after back button:', error);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const loadAllData = async () => {
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
      
      setProducts(loadedProducts);
      setSuppliers(loadedSuppliers);
      setOrders(loadedOrders);
      setInvoices(loadedInvoices);
      setSettings(loadedSettings);
      setDataLoaded(true);
      
      console.log('✅ Data loaded successfully:', {
        products: loadedProducts.length,
        suppliers: loadedSuppliers.length,
        orders: loadedOrders.length,
        invoices: loadedInvoices.length,
        country: loadedSettings.country,
        currency: loadedSettings.defaultCurrency
      });
    } catch (error) {
      console.error('❌ Error loading data:', error);
      toast.error('Error loading data');
      // Set dataLoaded to true even on error to prevent infinite loading
      setDataLoaded(true);
    }
  };

  // FIXED: Save products to Supabase when they change
  useEffect(() => {
    if (dataLoaded && user) {
      saveProducts(products).catch(error => {
        console.error('❌ Error saving products:', error);
      });
    }
  }, [products, dataLoaded, user]);

  // FIXED: Save suppliers to Supabase when they change
  useEffect(() => {
    if (dataLoaded && user) {
      saveSuppliers(suppliers).catch(error => {
        console.error('❌ Error saving suppliers:', error);
      });
    }
  }, [suppliers, dataLoaded, user]);

  // FIXED: Save orders to Supabase when they change
  useEffect(() => {
    if (dataLoaded && user) {
      saveOrders(orders).catch(error => {
        console.error('❌ Error saving orders:', error);
      });
    }
  }, [orders, dataLoaded, user]);
  
  // FIXED: Save invoices to Supabase when they change
  useEffect(() => {
    if (dataLoaded && user) {
      saveInvoices(invoices).catch(error => {
        console.error('❌ Error saving invoices:', error);
      });
    }
  }, [invoices, dataLoaded, user]);

  // FIXED: Save settings to Supabase when they change
  useEffect(() => {
    if (dataLoaded && user && settings) {
      console.log('💾 Index.tsx: Saving settings to Supabase:', settings);
      console.log('🌍 Index.tsx: Saving country:', settings.country);
      console.log('💱 Index.tsx: Saving currency:', settings.defaultCurrency);
      
      saveSettings(settings).catch(error => {
        console.error('❌ Error saving settings:', error);
      });
    }
  }, [settings, dataLoaded, user]);

  // FIXED: Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    toast.success(t.success);
    navigate('/login');
  };

  const handleSaveInvoiceRequest = (file: File, supplierId: string, supplierName: string, invoiceData?: InvoiceDataExtracted) => {
    console.log('📄 Invoice save request received:', { supplierId, supplierName, invoiceData });
    
    // Store pending invoice data
    setPendingInvoice({
      file,
      supplierId,
      supplierName,
      invoiceData
    });
    
    // Switch to suppliers tab to show the invoice dialog
    setActiveTab('suppliers');
    
    toast.info(`📂 Apertura gestione fatture per ${supplierName}`, { duration: 3000 });
  };

  const handleInvoiceProcessed = () => {
    console.log('✅ Invoice processed, clearing pending invoice');
    setPendingInvoice(null);
  };

  const handleClearDataClick = () => {
    setShowClearDataDialog(true);
  };

  const handleClearDataConfirm = async () => {
    try {
      console.log('🗑️ Starting data deletion...');
      
      // FIXED: Delete all records from Supabase tables directly
      if (user && supabase) {
        console.log('🗑️ Deleting from Supabase for user:', user.id);
        
        // Delete all records for this user from each table
        const deletePromises = [
          supabase.from('products').delete().eq('user_id', user.id),
          supabase.from('invoices').delete().eq('user_id', user.id),
          supabase.from('orders').delete().eq('user_id', user.id),
          supabase.from('suppliers').delete().eq('user_id', user.id)
        ];
        
        const results = await Promise.all(deletePromises);
        
        // Check for errors
        results.forEach((result, index) => {
          const tables = ['products', 'invoices', 'orders', 'suppliers'];
          if (result.error) {
            console.error(`❌ Error deleting ${tables[index]}:`, result.error);
          } else {
            console.log(`✅ Deleted all ${tables[index]} from Supabase`);
          }
        });
      }
      
      // Clear local state
      setProducts([]);
      setSuppliers([]);
      setOrders([]);
      setInvoices([]);
      
      console.log('✅ All data cleared successfully');
      toast.success(t.dataCleared);
      setShowClearDataDialog(false);
    } catch (error) {
      console.error('❌ Error clearing data:', error);
      toast.error('Error clearing data');
    }
  };

  // FIXED: Show loading only when auth is loading AND user exists but data is not loaded
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="text-muted-foreground dark:text-slate-400">{t.loading}</p>
        </div>
      </div>
    );
  }

  // If not authenticated, return null (will redirect to login)
  if (!user) {
    return null;
  }

  // If authenticated but data not loaded yet, show loading
  if (!dataLoaded || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="text-muted-foreground dark:text-slate-400">{t.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col">
      <div className="container mx-auto p-6 max-w-7xl flex-1">
        {/* Header */}
        <Card className="mb-6 bg-white dark:bg-slate-900 border-none shadow-lg">
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg">
                  <img src="/FullLogo_Transparent_NoBuffer.png" alt="RESTO Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h1 className="text-4xl font-extrabold tracking-widest bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                    RESTO
                  </h1>
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full"></span>
                    {t.connectedAs}: {user.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="gap-2 border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200"
                >
                  <LogOut className="h-4 w-4" />
                  {t.logout}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearDataClick}
                  className="gap-2 border-gray-300 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 dark:text-slate-200"
                >
                  <Trash2 className="h-4 w-4" />
                  {t.clearData}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Navigation Tabs - ALWAYS visible */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <Button
            variant={activeTab === 'dashboard' ? 'default' : 'outline'}
            onClick={() => setActiveTab('dashboard')}
            className={`gap-2 rounded-full px-6 ${
              activeTab === 'dashboard'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            {t.dashboard}
          </Button>
          <Button
            variant={activeTab === 'products' ? 'default' : 'outline'}
            onClick={() => setActiveTab('products')}
            className={`gap-2 rounded-full px-6 ${
              activeTab === 'products'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <Package className="h-4 w-4" />
            {t.products}
          </Button>
          <Button
            variant={activeTab === 'suppliers' ? 'default' : 'outline'}
            onClick={() => setActiveTab('suppliers')}
            className={`gap-2 rounded-full px-6 ${
              activeTab === 'suppliers'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <Users className="h-4 w-4" />
            {t.suppliers}
          </Button>
          <Button
            variant={activeTab === 'orders' ? 'default' : 'outline'}
            onClick={() => setActiveTab('orders')}
            className={`gap-2 rounded-full px-6 ${
              activeTab === 'orders'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            {t.orders}
          </Button>
          <Button
            variant={activeTab === 'invoices' ? 'default' : 'outline'}
            onClick={() => setActiveTab('invoices')}
            className={`gap-2 rounded-full px-6 ${
              activeTab === 'invoices'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <FileText className="h-4 w-4" />
            Fatture
          </Button>
          <Button
            variant={activeTab === 'priceComparison' ? 'default' : 'outline'}
            onClick={() => setActiveTab('priceComparison')}
            className={`gap-2 rounded-full px-6 ${
              activeTab === 'priceComparison'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <TrendingDown className="h-4 w-4" />
            Confronto Prezzi
          </Button>
          <Button
            variant={activeTab === 'priceScanner' ? 'default' : 'outline'}
            onClick={() => setActiveTab('priceScanner')}
            className={`gap-2 rounded-full px-6 ${
              activeTab === 'priceScanner'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <Scan className="h-4 w-4" />
            {t.priceScanner}
          </Button>
          <Button
            variant={activeTab === 'settings' ? 'default' : 'outline'}
            onClick={() => setActiveTab('settings')}
            className={`gap-2 rounded-full px-6 ${
              activeTab === 'settings'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <SettingsIcon className="h-4 w-4" />
            {t.settings}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/contact')}
            className="gap-2 rounded-full px-6 border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200"
          >
            <Mail className="h-4 w-4" />
            {t.contactUs}
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
              language={language}
            />
          )}

          {activeTab === 'products' && (
            <ProductsSection
              products={products}
              setProducts={setProducts}
              suppliers={suppliers}
              setSuppliers={setSuppliers}
              settings={settings}
              onSaveInvoiceRequest={handleSaveInvoiceRequest}
            />
          )}

          {activeTab === 'suppliers' && (
            <SuppliersSection
              suppliers={suppliers}
              setSuppliers={setSuppliers}
              products={products}
              setProducts={setProducts}
              invoices={invoices}
              setInvoices={setInvoices}
              language={language}
              pendingInvoice={pendingInvoice}
              onInvoiceProcessed={handleInvoiceProcessed}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersSection
              orders={orders}
              setOrders={setOrders}
              products={products}
              setProducts={setProducts}
              suppliers={suppliers}
              setSuppliers={setSuppliers}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesSection />
          )}

          {activeTab === 'priceComparison' && (
            <PriceComparisonDashboard />
          )}

          {activeTab === 'priceScanner' && (
            <PriceScannerMockup settings={settings} />
          )}

          {activeTab === 'settings' && (
            <SettingsSection
              settings={settings}
              setSettings={setSettings}
              onClearData={handleClearDataClick}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Clear Data Confirmation Dialog */}
      <ClearDataDialog
        open={showClearDataDialog}
        onOpenChange={setShowClearDataDialog}
        onConfirm={handleClearDataConfirm}
        language={language}
      />
    </div>
  );
}
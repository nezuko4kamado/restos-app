import { generateUUID } from "@/lib/uuid";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Trash2, Edit, Phone, Mail, MapPin, X, Check, Search, FileText, Package, TrendingUp, Eye, Receipt, AlertTriangle, Download, FileSpreadsheet, QrCode, Smartphone, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { Supplier, Product, Invoice, Settings } from '@/types';
import { useTranslations, type Language } from '@/lib/i18n';
import InvoiceManagement from './InvoiceManagement';
import { calculateInvoiceStats, formatCurrency } from '@/lib/invoiceStats';
import { addProduct, deleteSupplier, deleteProduct, getInvoices, saveInvoices, updateProduct } from '@/lib/storage';
import { SupplierMatcher } from '@/lib/supplierMatcher';
import DeleteSupplierDialog from './DeleteSupplierDialog';
import { ModernDeleteDialog } from './ModernDeleteDialog';
import { exportSuppliersToExcel, exportSuppliersToPDF } from '@/lib/exportUtils';
import type { InvoiceDataExtracted } from '@/lib/ocrService';
import { InvoiceService } from '@/lib/invoiceService';
import { formatPrice } from '@/lib/currency';

import type { PriceAlert } from '@/lib/priceAlertService';

interface SuppliersSectionProps {
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  language: Language;
  settings: Settings;
  pendingInvoice?: { supplierId: string; file: File; invoiceData?: InvoiceDataExtracted } | null;
  onInvoiceProcessed?: () => void;
  onPriceAlertsUpdate?: (alerts: PriceAlert[]) => void;
}

interface SupplierWithVat extends Supplier {
  vat_number?: string;
}

export default function SuppliersSection({ 
  suppliers, 
  setSuppliers, 
  products,
  setProducts,
  invoices,
  setInvoices,
  language,
  settings,
  pendingInvoice,
  onInvoiceProcessed,
  onPriceAlertsUpdate,
}: SuppliersSectionProps) {
  const t = useTranslations(language);
  const currency = settings.defaultCurrency || 'EUR';
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [invoiceDialogSupplierId, setInvoiceDialogSupplierId] = useState<string | null>(null);
  const [deleteDialogSupplier, setDeleteDialogSupplier] = useState<Supplier | null>(null);
  const [modernDeleteDialog, setModernDeleteDialog] = useState<{
    isOpen: boolean;
    supplier: Supplier | null;
    message: string;
  }>({ isOpen: false, supplier: null, message: '' });
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({
    name: '',
    contact: '',
    email: '',
    phone: '',
    mobile: '',
    address: '',
    notes: '',
  });

  // Handle pending invoice - automatically open invoice dialog when pendingInvoice is set
  useEffect(() => {
    if (pendingInvoice?.supplierId) {
      console.log('📄 Opening invoice dialog for supplier:', pendingInvoice.supplierId);
      console.log('📄 Pending invoice data:', pendingInvoice.invoiceData);
      setInvoiceDialogSupplierId(pendingInvoice.supplierId);
      
      // Show notification
      const supplier = suppliers.find(s => s.id === pendingInvoice.supplierId);
      if (supplier) {
        toast.info(`${t('openingInvoiceManagement')} ${supplier.name}`, { duration: 3000 });
      }
    }
  }, [pendingInvoice, suppliers, t]);

  const handleExportExcel = () => {
    try {
      exportSuppliersToExcel(suppliers, products, invoices);
      toast.success(`✅ ${t('suppliers')} ${t('export')?.toLowerCase()} Excel ${t('success')?.toLowerCase()}!`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`${t('error')} ${t('export')?.toLowerCase()} Excel`);
    }
  };

  const handleExportPDF = () => {
    try {
      exportSuppliersToPDF(suppliers, products, invoices);
      toast.success(`✅ ${t('suppliers')} ${t('export')?.toLowerCase()} PDF ${t('success')?.toLowerCase()}!`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`${t('error')} ${t('export')?.toLowerCase()} PDF`);
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupplier.name) {
      toast.error(t('supplierName') + ' ' + t('error')?.toLowerCase());
      return;
    }

    console.log('🔍 Tentativo aggiunta fornitore:', newSupplier.name);
    console.log('📋 Dati fornitore da aggiungere:', newSupplier);

    // Check for duplicate using intelligent matching
    const matchResult = await SupplierMatcher.matchSupplier(newSupplier.name || '', 80);

    if (matchResult.matched && matchResult.supplier && matchResult.confidence >= 80) {
      console.log('⚠️ Fornitore duplicato rilevato!');
      console.log('   Match trovato:', matchResult.supplier.name);
      console.log('   Confidenza:', matchResult.confidence + '%');
      
      toast.warning(
        `⚠️ Fornitore già esistente: "${matchResult.supplier.name}" (${matchResult.confidence}% similarità)`,
        { duration: 6000 }
      );
      return;
    }

    console.log('✅ Nessun duplicato trovato, creazione nuovo fornitore...');

    const supplierData: Supplier = {
      ...newSupplier,
      id: generateUUID(),
      products: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Supplier;

    setSuppliers([...suppliers, supplierData]);
    setNewSupplier({ name: '', contact: '', email: '', phone: '', mobile: '', address: '', notes: '' });
    setIsAdding(false);
    toast.success(t('supplierAdded'));
  };

  const handleStartEdit = (supplier: Supplier) => {
    console.log('🔧 [EDIT] Starting edit for supplier:', supplier.name);
    console.log('🔧 [EDIT] Supplier data from database:', {
      phone: supplier.phone,
      mobile: supplier.mobile,
      email: supplier.email,
      address: supplier.address
    });
    
    setEditingId(supplier.id);
    
    // CRITICAL FIX: Ensure all fields are strings (never undefined or null)
    const editData = {
      name: supplier.name || '',
      contact: supplier.contact || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      mobile: supplier.mobile || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    };
    
    console.log('🔧 [EDIT] Setting editingSupplier with:', editData);
    setEditingSupplier(editData);
  };

  const handleUpdateSupplier = () => {
    if (!editingSupplier.name) {
      toast.error(t('supplierName') + ' ' + t('error')?.toLowerCase());
      return;
    }

    // Check for duplicate supplier name (case-insensitive), excluding current supplier
    const isDuplicate = suppliers.some(
      (s) => s.id !== editingId && s.name.toLowerCase().trim() === editingSupplier.name!.toLowerCase().trim()
    );

    if (isDuplicate) {
      toast.error(t('supplierAlreadyExists'));
      return;
    }

    console.log('💾 [UPDATE] Updating supplier with data:', editingSupplier);

    setSuppliers(suppliers.map((s) => 
      s.id === editingId 
        ? { ...s, ...editingSupplier, updated_at: new Date().toISOString() } 
        : s
    ));
    setEditingId(null);
    setEditingSupplier({});
    toast.success(t('supplierUpdated'));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingSupplier({});
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    const supplierProducts = getSupplierProducts(supplier.id);
    const supplierInvoices = getSupplierInvoices(supplier.id);
    
    // Build confirmation message
    let message = `${t('deleteSupplierConfirm')}`;
    const details: string[] = [];
    
    if (supplierInvoices.length > 0) {
      details.push(`${supplierInvoices.length} ${t('invoicesCount')}`);
    }
    if (supplierProducts.length > 0) {
      details.push(`${supplierProducts.length} ${t('products')?.toLowerCase()}`);
    }
    
    if (details.length > 0) {
      message += `\n\n${details.join(' e ')}.`;
    }
    
    // Show modern delete dialog
    setModernDeleteDialog({
      isOpen: true,
      supplier: supplier,
      message: message
    });
  };

  const handleConfirmModernDelete = async () => {
    const supplier = modernDeleteDialog.supplier;
    if (!supplier) return;

    const supplierProducts = getSupplierProducts(supplier.id);
    const supplierInvoices = getSupplierInvoices(supplier.id);

    try {
      // Delete supplier from Supabase (this will also delete invoices via cascade)
      const success = await deleteSupplier(supplier.id);
      if (!success) {
        console.error(`❌ [UI] deleteSupplier returned false for ${supplier.id} - NOT removing from local state`);
        toast.error(`${t('error')} ${t('deleteSupplier')?.toLowerCase()}`);
        return;
      }
      console.log('✅ Fornitore e fatture eliminate da Supabase:', supplier.id);
      
      // Update local state - remove supplier
      setSuppliers(suppliers.filter((s) => s.id !== supplier.id));
      
      // CRITICAL FIX: Reload invoices from Supabase to sync state
      const updatedInvoices = await getInvoices();
      setInvoices(updatedInvoices);
      
      // Handle products based on whether there are any
      if (supplierProducts.length > 0) {
        setDeleteDialogSupplier(supplier);
      } else {
        toast.success(`${t('supplierDeletedWithInvoices')}${supplierInvoices.length > 0 ? ` ${t('together')} ${supplierInvoices.length} ${t('invoicesCount')}` : ''}!`);
      }
    } catch (error) {
      console.error('❌ Errore eliminazione fornitore:', error);
      toast.error(`${t('error')} ${t('deleteSupplier')?.toLowerCase()}`);
    }
  };

  const handleConfirmDelete = async (supplierId: string, newSupplierId: string | null, deleteProducts: boolean) => {
    console.log('🗑️ Eliminazione fornitore:', supplierId);
    console.log('   Nuovo fornitore:', newSupplierId);
    console.log('   Elimina prodotti:', deleteProducts);

    try {
      if (deleteProducts) {
        // Delete all products associated with this supplier from Supabase
        const productsToDelete = products.filter(p => p.supplierId === supplierId || p.supplier_id === supplierId);
        console.log('   Prodotti da eliminare:', productsToDelete.length);
        
        // Delete each product from Supabase
        for (const product of productsToDelete) {
          await deleteProduct(product.id);
        }
        
        // Update local state
        setProducts(products.filter(p => p.supplierId !== supplierId && p.supplier_id !== supplierId));
      } else if (newSupplierId) {
        // Reassign products to new supplier
        const productsToReassign = products.filter(p => p.supplierId === supplierId || p.supplier_id === supplierId);
        console.log('   Prodotti da riassegnare:', productsToReassign.length);
        setProducts(products.map(p => {
          if (p.supplierId === supplierId || p.supplier_id === supplierId) {
            return {
              ...p,
              supplierId: newSupplierId,
              supplier_id: newSupplierId,
              updated_at: new Date().toISOString()
            };
          }
          return p;
        }));
      }

      setDeleteDialogSupplier(null);
      
      const supplierInvoices = getSupplierInvoices(supplierId);
      toast.success(`${t('supplierDeletedWithInvoices')}${supplierInvoices.length > 0 ? ` ${t('together')} ${supplierInvoices.length} ${t('invoicesCount')}` : ''}!`);
    } catch (error) {
      console.error('❌ Errore durante l\'eliminazione:', error);
      toast.error(`${t('error')} ${t('deleteSupplier')?.toLowerCase()}`);
    }
  };

  const handleAddInvoice = async (invoice: Invoice) => {
    try {
      console.log('🔴 [CRITICAL] ===== SUPPLIERSSECTION.HANDLEADDINVOICE =====');
      console.log('🔴 [CRITICAL] Received invoice object:', JSON.stringify(invoice, null, 2));
      console.log('🔴 [CRITICAL] invoice.supplier_id:', invoice.supplier_id);
      console.log('🔴 [CRITICAL] invoice.supplier_name:', invoice.supplier_name);
      
      console.log('💾 Saving invoice to storage...', invoice.id);
      
      // Get current invoices from Supabase
      const currentInvoices = await getInvoices();
      console.log('📥 Current invoices count:', currentInvoices.length);
      
      // Add new invoice to the array
      const updatedInvoices = [...currentInvoices, invoice];
      
      // Save ALL invoices to Supabase
      await saveInvoices(updatedInvoices);
      console.log('✅ Fattura salvata su Supabase:', invoice.id);
      
      // CRITICAL FIX: Reload invoices from Supabase to sync state
      const reloadedInvoices = await getInvoices();
      console.log('🔄 Reloaded invoices from Supabase:', reloadedInvoices.length);
      
      setInvoices(reloadedInvoices);
      console.log('🔴 [CRITICAL] ===== END HANDLEADDINVOICE =====');
      
      toast.success(`✅ ${t('invoices')} ${t('save')?.toLowerCase()} ${t('success')?.toLowerCase()}!`);
    } catch (error) {
      console.error('❌ Errore salvataggio fattura:', error);
      toast.error(`${t('error')} ${t('save')?.toLowerCase()} ${t('invoices')?.toLowerCase()}`);
      throw error;
    }
  };

  const handleUpdateInvoice = async (invoice: Invoice) => {
    try {
      console.log('💾 Updating invoice...', invoice.id);
      
      // Get current invoices from Supabase
      const currentInvoices = await getInvoices();
      
      // Update the invoice in the array
      const updatedInvoices = currentInvoices.map(inv => 
        inv.id === invoice.id ? invoice : inv
      );
      
      // Save ALL invoices to Supabase
      await saveInvoices(updatedInvoices);
      console.log('✅ Fattura aggiornata su Supabase:', invoice.id);
      
      // CRITICAL FIX: Reload invoices from Supabase to sync state
      const reloadedInvoices = await getInvoices();
      setInvoices(reloadedInvoices);
    } catch (error) {
      console.error('❌ Errore aggiornamento fattura:', error);
      toast.error(`${t('error')} aggiornamento ${t('invoices')?.toLowerCase()}`);
      throw error;
    }
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    if (confirm(`${t('deleteSupplierConfirm')}`)) {
      setInvoices(invoices.filter(inv => inv.id !== invoiceId));
      toast.success(`${t('invoices')} ${t('deleteSupplier')?.toLowerCase()}`);
    }
  };

  // CRITICAL FIX: Reload invoices from Supabase after toggle
  const handleTogglePaymentStatus = async (invoice: Invoice) => {
    try {
      console.log('💳 Toggling payment status for invoice:', invoice.id);
      
      const newStatus = !invoice.is_paid;
      
      if (newStatus) {
        await InvoiceService.markAsPaid(invoice.id);
        toast.success('✅ Fattura segnata come pagata');
      } else {
        await InvoiceService.markAsUnpaid(invoice.id);
        toast.success('✅ Fattura segnata come non pagata');
      }
      
      // CRITICAL FIX: Reload invoices from Supabase to get updated data
      const updatedInvoices = await getInvoices();
      setInvoices(updatedInvoices);
      
      console.log('✅ Payment status updated and state reloaded');
    } catch (error) {
      console.error('❌ Error toggling payment status:', error);
      toast.error('Errore nell\'aggiornamento dello stato pagamento');
    }
  };

  const handleAddProductFromInvoice = async (product: Omit<Product, 'id'>) => {
    try {
      console.log('➕ Adding product from invoice:', product.name);
      
      // addProduct already saves to Supabase and returns the new product
      const newProduct = await addProduct(product);
      console.log('✅ Product saved to Supabase:', newProduct?.id);
      
      console.log('ℹ️ Product will be loaded from Supabase by parent component');
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  };

  // ✅ NEW: Handle product update when price changes
  const handleUpdateProduct = async (productId: string, updates: Partial<Product>) => {
    try {
      console.log('🔄 Updating product:', productId);
      console.log('   Updates:', updates);
      
      // Update product in Supabase with updated_at timestamp
      const updatedProduct = await updateProduct(productId, {
        ...updates,
        updated_at: new Date().toISOString()
      });
      
      if (updatedProduct) {
        console.log('✅ Product updated in Supabase:', updatedProduct.id);
        
        // Update local state
        setProducts(products.map(p => p.id === productId ? updatedProduct : p));
      }
    } catch (error) {
      console.error('❌ Error updating product:', error);
      throw error;
    }
  };

  const handleUpdateProducts = () => {
    // Trigger a refresh by updating the products state
    setProducts([...products]);
  };

  const handleCloseInvoiceDialog = () => {
    setInvoiceDialogSupplierId(null);
    
    // Call onInvoiceProcessed to clear pendingInvoice in parent
    if (onInvoiceProcessed) {
      onInvoiceProcessed();
    }
  };

  // Get supplier products
  const getSupplierProducts = (supplierId: string): Product[] => {
    const supplierProducts = products.filter(p => p.supplierId === supplierId || p.supplier_id === supplierId);
    return supplierProducts;
  };

  // CRITICAL FIX: Use supplier_id instead of supplier_name for reliable filtering
  const getSupplierInvoices = (supplierId: string): Invoice[] => {
    console.log('🔍 [GET SUPPLIER INVOICES] ===== START =====');
    console.log('🔍 [GET SUPPLIER INVOICES] Chiamato con supplier ID:', supplierId);
    console.log('🔍 [GET SUPPLIER INVOICES] Totale fatture in memoria:', invoices.length);
    
    // Log all invoices to see their structure
    console.log('🔍 [GET SUPPLIER INVOICES] Tutte le fatture:');
    invoices.forEach((inv, index) => {
      console.log(`  [${index}]:`, {
        id: inv.id,
        invoice_number: inv.invoice_number,
        supplier_id: inv.supplier_id,
        supplier_name: inv.supplier_name,
        amount: inv.amount,
        total_amount: inv.total_amount
      });
    });
    
    // Filter by supplier_id (more reliable than supplier_name)
    const filtered = invoices.filter(inv => {
      const matches = inv.supplier_id === supplierId;
      console.log('🔍 [GET SUPPLIER INVOICES] Controllando fattura:', {
        invoice_number: inv.invoice_number,
        supplier_id: inv.supplier_id,
        expected_supplier_id: supplierId,
        matches: matches
      });
      return matches;
    });
    
    console.log('🔍 [GET SUPPLIER INVOICES] Conteggio filtrato:', filtered.length);
    console.log('🔍 [GET SUPPLIER INVOICES] Fatture filtrate:', filtered.map(inv => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      supplier_id: inv.supplier_id
    })));
    console.log('🔍 [GET SUPPLIER INVOICES] ===== END =====');
    
    return filtered;
  };

  // Calculate supplier statistics
  const getSupplierStats = (supplier: Supplier) => {
    const supplierInvoices = getSupplierInvoices(supplier.id);
    const supplierProducts = getSupplierProducts(supplier.id);
    
    console.log('📊 [GET SUPPLIER STATS] Fornitore:', supplier.name);
    console.log('📊 [GET SUPPLIER STATS] Fatture trovate:', supplierInvoices.length);
    console.log('📊 [GET SUPPLIER STATS] Prodotti trovati:', supplierProducts.length);
    
    const totalSpent = supplierInvoices.reduce((sum, inv) => sum + (inv.total_amount || inv.amount || inv.total || 0), 0);
    const totalInvoices = supplierInvoices.length;
    const totalProducts = supplierProducts.length;
    
    const avgInvoiceAmount = totalInvoices > 0 ? totalSpent / totalInvoices : 0;
    
    const mostExpensiveProduct = supplierProducts.length > 0 
      ? supplierProducts.reduce((max, p) => p.price > max.price ? p : max, supplierProducts[0])
      : null;
    
    return {
      totalSpent,
      totalInvoices,
      totalProducts,
      avgInvoiceAmount,
      mostExpensiveProduct
    };
  };

  // Filter suppliers based on search query
  const filteredSuppliers = suppliers.filter((supplier) => {
    const query = searchQuery.toLowerCase();
    return (
      (supplier.name || '').toLowerCase().includes(query) ||
      (supplier.contact || '').toLowerCase().includes(query) ||
      (supplier.email || '').toLowerCase().includes(query) ||
      (supplier.phone || '').toLowerCase().includes(query) ||
      (supplier.mobile || '').toLowerCase().includes(query) ||
      (supplier.address || '').toLowerCase().includes(query) ||
      (supplier.notes || '').toLowerCase().includes(query)
    );
  });

  return (
    <>
      <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-xl w-full max-w-full overflow-hidden">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="w-full">
              <CardTitle className="text-xl sm:text-2xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {t('suppliers')}
              </CardTitle>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                {filteredSuppliers.length} {t('suppliers')?.toLowerCase()} / {suppliers.length}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full sm:w-auto border-2 hover:border-green-500 hover:text-green-600 transition-all hover:scale-105 min-h-[48px] sm:min-h-[44px] text-sm sm:text-base"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t('export')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                    {t('exportExcel')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
                    <FileText className="h-4 w-4 mr-2 text-red-600" />
                    {t('exportPDF')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                onClick={() => setIsAdding(true)} 
                size="sm"
                className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all hover:scale-105 min-h-[48px] sm:min-h-[44px] text-sm sm:text-base"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('addSupplier')}
              </Button>
            </div>
          </div>
          
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              type="text"
              placeholder={`${t('search')}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-2 focus:border-indigo-500 rounded-xl bg-white/50 backdrop-blur-sm h-12 text-base"
            />
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {isAdding && (
            <div className="mb-6 p-4 sm:p-6 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl space-y-4 shadow-lg">
              <div>
                <Label className="text-slate-700 font-medium text-sm">{t('supplierName')}</Label>
                <Input
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  placeholder="Metro Cash & Carry"
                  className="mt-2 border-2 focus:border-indigo-500 rounded-xl h-12 text-base"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-700 font-medium text-sm">{t('contact')}</Label>
                  <Input
                    value={newSupplier.contact}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contact: e.target.value })}
                    placeholder={t('contact')}
                    className="mt-2 border-2 focus:border-indigo-500 rounded-xl h-12 text-base"
                  />
                </div>
                <div>
                  <Label className="text-slate-700 font-medium text-sm">{t('phone')}</Label>
                  <Input
                    value={newSupplier.phone || ''}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    placeholder=""
                    className="mt-2 border-2 focus:border-indigo-500 rounded-xl h-12 text-base"
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-700 font-medium text-sm">{t('mobile')}</Label>
                <Input
                  value={newSupplier.mobile || ''}
                  onChange={(e) => setNewSupplier({ ...newSupplier, mobile: e.target.value })}
                  placeholder=""
                  className="mt-2 border-2 focus:border-indigo-500 rounded-xl h-12 text-base"
                  />
              </div>
              <div>
                <Label className="text-slate-700 font-medium text-sm">{t('email')}</Label>
                <Input
                  type="email"
                  value={newSupplier.email || ''}
                  onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                  placeholder=""
                  className="mt-2 border-2 focus:border-indigo-500 rounded-xl h-12 text-base"
                />
              </div>
              <div>
                <Label className="text-slate-700 font-medium text-sm">{t('address')}</Label>
                <Input
                  value={newSupplier.address || ''}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  placeholder={t('address')}
                  className="mt-2 border-2 focus:border-indigo-500 rounded-xl h-12 text-base"
                />
              </div>
              <div>
                <Label className="text-slate-700 font-medium text-sm">{t('notes')}</Label>
                <Textarea
                  value={newSupplier.notes || ''}
                  onChange={(e) => setNewSupplier({ ...newSupplier, notes: e.target.value })}
                  placeholder={t('notes')}
                  className="mt-2 border-2 focus:border-indigo-500 rounded-xl text-base"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button 
                  onClick={handleAddSupplier}
                  className="w-full sm:flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:scale-105 transition-all min-h-[48px] text-base"
                >
                  <Check className="h-4 w-4 mr-2" />
                  {t('save')}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsAdding(false)}
                  className="w-full sm:flex-1 border-2 hover:border-red-500 hover:text-red-500 hover:scale-105 transition-all min-h-[48px] text-base"
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('cancel')}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {filteredSuppliers.map((supplier) => {
              const stats = getSupplierStats(supplier);
              const isEditing = editingId === supplier.id;
              
              console.log('🎨 [RENDER SUPPLIER CARD]:', {
                supplier_name: supplier.name,
                supplier_id: supplier.id,
                invoice_count: stats.totalInvoices,
                product_count: stats.totalProducts
              });
              
              return (
                <div 
                  key={supplier.id} 
                  className={`group p-4 sm:p-6 border-2 rounded-2xl bg-white transition-all ${
                    isEditing 
                      ? 'border-indigo-400 shadow-xl' 
                      : 'border-slate-200 hover:border-indigo-300 hover:shadow-xl cursor-pointer'
                  }`}
                  onClick={() => !isEditing && setSelectedSupplier(supplier)}
                >
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-slate-700 font-medium text-sm">{t('supplierName')}</Label>
                        <Input
                          value={editingSupplier.name || ''}
                          onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                          placeholder="Metro Cash & Carry"
                          className="mt-2 border-2 focus:border-indigo-500 rounded-xl h-12 text-base"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-slate-700 font-medium text-sm">{t('contact')}</Label>
                          <Input
                            value={editingSupplier.contact || ''}
                            onChange={(e) => setEditingSupplier({ ...editingSupplier, contact: e.target.value })}
                            placeholder={t('contact')}
                            className="mt-2 border-2 focus:border-indigo-500 rounded-xl h-12 text-base"
                          />
                        </div>
                        <div>
                          <Label className="text-slate-700 font-medium text-sm">{t('phone')}</Label>
                          <Input
                            value={editingSupplier.phone || ''}
                            onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                            placeholder=""
                            className="mt-2 border-2 focus:border-indigo-500 rounded-xl h-12 text-base"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-slate-700 font-medium text-sm">{t('mobile')}</Label>
                        <Input
                          value={editingSupplier.mobile || ''}
                          onChange={(e) => setEditingSupplier({ ...editingSupplier, mobile: e.target.value })}
                          placeholder=""
                          className="mt-2 border-2 focus:border-indigo-500 rounded-xl h-12 text-base"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-700 font-medium text-sm">{t('email')}</Label>
                        <Input
                          type="email"
                          value={editingSupplier.email || ''}
                          onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                          placeholder=""
                          className="mt-2 border-2 focus:border-indigo-500 rounded-xl h-12 text-base"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-700 font-medium text-sm">{t('address')}</Label>
                        <Input
                          value={editingSupplier.address || ''}
                          onChange={(e) => setEditingSupplier({ ...editingSupplier, address: e.target.value })}
                          placeholder={t('address')}
                          className="mt-2 border-2 focus:border-indigo-500 rounded-xl h-12 text-base"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-700 font-medium text-sm">{t('notes')}</Label>
                        <Textarea
                          value={editingSupplier.notes || ''}
                          onChange={(e) => setEditingSupplier({ ...editingSupplier, notes: e.target.value })}
                          placeholder={t('notes')}
                          className="mt-2 border-2 focus:border-indigo-500 rounded-xl text-base"
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button 
                          onClick={handleUpdateSupplier}
                          className="w-full sm:flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:scale-105 transition-all min-h-[48px] text-base"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          {t('save')}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={handleCancelEdit}
                          className="w-full sm:flex-1 border-2 hover:border-red-500 hover:text-red-500 hover:scale-105 transition-all min-h-[48px] text-base"
                        >
                          <X className="h-4 w-4 mr-2" />
                          {t('cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                        <h3 className="font-bold text-lg sm:text-xl text-slate-800 flex-1 min-w-0 break-words pr-2">{supplier.name}</h3>
                        
                        <div className="grid grid-cols-4 sm:flex gap-2 w-full sm:w-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-10 px-2 sm:px-3 text-xs hover:bg-blue-100 hover:text-blue-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSupplier(supplier);
                            }}
                          >
                            <Eye className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline text-sm">{t('details')}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-10 px-2 sm:px-3 hover:bg-purple-100 hover:text-purple-600"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(supplier);
                            }}
                            className="h-10 px-2 sm:px-3 hover:bg-indigo-100 hover:text-indigo-600 transition-all"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSupplier(supplier);
                            }}
                            className="h-10 px-2 sm:px-3 hover:bg-red-100 hover:text-red-600 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50">
                          <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-sm">
                            <strong>{stats.totalInvoices}</strong> {t('invoicesCount')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50">
                          <Package className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span className="text-sm">
                            <strong>{stats.totalProducts}</strong> {t('products')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50">
                          <TrendingUp className="h-4 w-4 text-purple-600 flex-shrink-0" />
                          <span className="text-sm break-all">
                            <strong>{formatPrice(stats.totalSpent, currency)}</strong> {t('totalAmount')}
                          </span>
                        </div>
                      </div>

                      {supplier.contact && (
                        <p className="text-sm text-slate-600 break-words">
                          <span className="font-medium">{t('contact')}:</span> {supplier.contact}
                        </p>
                      )}
                      <div className="space-y-2">
                        {supplier.phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="h-4 w-4 flex-shrink-0" />
                            <span className="break-all">{supplier.phone}</span>
                          </div>
                        )}
                        {supplier.mobile && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Smartphone className="h-4 w-4 flex-shrink-0" />
                            <span className="break-all">{supplier.mobile}</span>
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail className="h-4 w-4 flex-shrink-0" />
                            <span className="break-all">{supplier.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredSuppliers.length === 0 && !isAdding && (
            <div className="text-center py-12 sm:py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 mb-4">
                {searchQuery ? <Search className="h-8 w-8 text-indigo-600" /> : <Plus className="h-8 w-8 text-indigo-600" />}
              </div>
              <p className="text-slate-600 text-base sm:text-lg">
                {searchQuery ? t('noSuppliers') : t('addFirstSupplier')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supplier Details Sheet - MOBILE OPTIMIZED */}
      <Sheet open={!!selectedSupplier} onOpenChange={(open) => !open && setSelectedSupplier(null)}>
        <SheetContent side="right" className="w-full sm:w-[540px] md:w-[640px] overflow-y-auto p-0">
          {selectedSupplier && (() => {
            const supplierInvoices = getSupplierInvoices(selectedSupplier.id);
            const supplierProducts = getSupplierProducts(selectedSupplier.id);
            const stats = getSupplierStats(selectedSupplier);
            
            console.log('📊 Rendering supplier details for:', selectedSupplier.name);
            console.log('   Invoices:', supplierInvoices.length);
            console.log('   Products:', supplierProducts.length);
            
            return (
              <div className="h-full flex flex-col">
                <SheetHeader className="px-4 sm:px-6 py-4 border-b">
                  <SheetTitle className="text-lg sm:text-xl md:text-2xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent break-words pr-8">
                    {selectedSupplier.name}
                  </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto">
                  <Tabs defaultValue="details" className="w-full">
                    <div className="sticky top-0 bg-white z-10 border-b px-4 sm:px-6">
                      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
                        <TabsTrigger value="details" className="text-xs sm:text-sm py-3">{t('details')}</TabsTrigger>
                        <TabsTrigger value="invoices" className="text-xs sm:text-sm py-3 flex items-center justify-center gap-1">
                          <span>{t('invoices')}</span>
                          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs bg-indigo-100 text-indigo-600 rounded-full">
                            {supplierInvoices.length}
                          </span>
                        </TabsTrigger>
                        <TabsTrigger value="products" className="text-xs sm:text-sm py-3 flex items-center justify-center gap-1">
                          <span>{t('products')}</span>
                          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs bg-blue-100 text-blue-600 rounded-full">
                            {supplierProducts.length}
                          </span>
                        </TabsTrigger>
                        <TabsTrigger value="stats" className="text-xs sm:text-sm py-3">{t('statistics')}</TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="details" className="space-y-4 mt-4 px-4 sm:px-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base sm:text-lg">{t("contactInfo")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {selectedSupplier.contact && (
                            <div>
                              <p className="text-sm font-medium text-slate-600">{t('contact')}</p>
                              <p className="text-sm sm:text-base break-words">{selectedSupplier.contact}</p>
                            </div>
                          )}
                          {selectedSupplier.phone && (
                            <div>
                              <p className="text-sm font-medium text-slate-600">{t('phone')}</p>
                              <p className="text-sm sm:text-base break-all">{selectedSupplier.phone}</p>
                            </div>
                          )}
                          {selectedSupplier.mobile && (
                            <div>
                              <p className="text-sm font-medium text-slate-600">{t('mobile')}</p>
                              <p className="text-sm sm:text-base break-all">{selectedSupplier.mobile}</p>
                            </div>
                          )}
                          {selectedSupplier.email && (
                            <div>
                              <p className="text-sm font-medium text-slate-600">{t('email')}</p>
                              <p className="text-sm sm:text-base break-all">{selectedSupplier.email}</p>
                            </div>
                          )}
                          {selectedSupplier.address && (
                            <div>
                              <p className="text-sm font-medium text-slate-600">{t('address')}</p>
                              <p className="text-sm sm:text-base break-words">{selectedSupplier.address}</p>
                            </div>
                          )}
                          {selectedSupplier.notes && (
                            <div>
                              <p className="text-sm font-medium text-slate-600">{t('notes')}</p>
                              <p className="text-sm sm:text-base break-words">{selectedSupplier.notes}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="invoices" className="space-y-4 mt-4 px-4 sm:px-6 pb-6">
                      {supplierInvoices.length > 0 ? (
                        supplierInvoices.map(invoice => (
                          <Card key={invoice.id} className="relative">
                            <CardHeader>
                              <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-sm sm:text-base break-words">{invoice.invoice_number || invoice.invoiceNumber}</CardTitle>
                                  <p className="text-xs sm:text-sm text-slate-600">{invoice.date || invoice.invoice_date}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant={invoice.is_paid ? "default" : "outline"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTogglePaymentStatus(invoice);
                                  }}
                                  className={`w-full sm:w-auto text-xs sm:text-sm min-h-[44px] sm:min-h-[36px] ${
                                    invoice.is_paid 
                                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                                      : 'border-orange-500 text-orange-600 hover:bg-orange-50'
                                  }`}
                                >
                                  {invoice.is_paid ? (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 mr-1" />
                                      Pagato
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Non Pagato
                                    </>
                                  )}
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                <p className="text-xs sm:text-sm break-all">
                                  <span className="font-medium">Totale:</span> {formatPrice(invoice.total_amount || invoice.total || invoice.amount || 0, currency)}
                                </p>
                                {invoice.payment_date && (
                                  <p className="text-xs sm:text-sm">
                                    <span className="font-medium">Data Pagamento:</span> {invoice.payment_date}
                                  </p>
                                )}
                                {invoice.notes && (
                                  <p className="text-xs sm:text-sm break-words">
                                    <span className="font-medium">Note:</span> {invoice.notes}
                                  </p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                          <p className="text-sm sm:text-base text-slate-500">Nessuna fattura trovata per questo fornitore</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="products" className="space-y-4 mt-4 px-4 sm:px-6 pb-6">
                      {supplierProducts.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3">
                          {supplierProducts.map(product => (
                            <Card key={product.id}>
                              <CardHeader>
                                <CardTitle className="text-sm sm:text-base break-words">{product.name}</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  <p className="text-xs sm:text-sm break-all">
                                    <span className="font-medium">Prezzo:</span> {formatPrice(product.price, currency)}
                                  </p>
                                  {product.category && (
                                    <p className="text-xs sm:text-sm">
                                      <span className="font-medium">Categoria:</span> {product.category}
                                    </p>
                                  )}
                                  {product.unit && (
                                    <p className="text-xs sm:text-sm">
                                      <span className="font-medium">Unità:</span> {product.unit}
                                    </p>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                          <p className="text-sm sm:text-base text-slate-500">Nessun prodotto trovato per questo fornitore</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="stats" className="space-y-4 mt-4 px-4 sm:px-6 pb-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-xs sm:text-sm">{t("totalInvoices")}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl sm:text-3xl font-bold text-indigo-600">{stats.totalInvoices}</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-xs sm:text-sm">{t("totalProducts")}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.totalProducts}</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-xs sm:text-sm">{t("totalSpent")}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xl sm:text-2xl font-bold text-green-600 break-all">{formatPrice(stats.totalSpent, currency)}</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-xs sm:text-sm">{t("avgInvoiceAmount")}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xl sm:text-2xl font-bold text-purple-600 break-all">{formatPrice(stats.avgInvoiceAmount, currency)}</p>
                          </CardContent>
                        </Card>
                      </div>
                      
                      {stats.mostExpensiveProduct && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-xs sm:text-sm">{t("mostExpensiveProduct")}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm sm:text-base font-medium break-words">{stats.mostExpensiveProduct.name}</p>
                            <p className="text-lg sm:text-xl font-bold text-orange-600 break-all">{formatPrice(stats.mostExpensiveProduct.price, currency)}</p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Invoice Management Dialog */}
      {invoiceDialogSupplierId && (() => {
        const supplier = suppliers.find(s => s.id === invoiceDialogSupplierId);
        if (!supplier) return null;
        
        return (
          <InvoiceManagement
            supplierId={invoiceDialogSupplierId}
            supplierName={supplier.name}
            invoices={getSupplierInvoices(supplier.id)}
            products={products}
            suppliers={suppliers}
            onAddInvoice={handleAddInvoice}
            onUpdateInvoice={handleUpdateInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            onUpdateProducts={handleUpdateProducts}
            onUpdateProduct={handleUpdateProduct}
            onAddProduct={handleAddProductFromInvoice}
            onAddSupplier={async (supplierData) => {
              const newSupplier: Supplier = {
                ...supplierData,
                id: generateUUID(),
                products: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as Supplier;
              setSuppliers([...suppliers, newSupplier]);
              return newSupplier;
            }}
            onPriceAlertsUpdate={onPriceAlertsUpdate}
            isOpen={true}
            onClose={handleCloseInvoiceDialog}
            pendingInvoiceFile={pendingInvoice?.supplierId === invoiceDialogSupplierId ? pendingInvoice.file : undefined}
            pendingInvoiceData={pendingInvoice?.supplierId === invoiceDialogSupplierId ? pendingInvoice.invoiceData : undefined}
            language={language}
          />
        );
      })()}

      {/* Modern Delete Confirmation Dialog - NO hardcoded text, let ModernDeleteDialog use translations */}
      <ModernDeleteDialog
        isOpen={modernDeleteDialog.isOpen}
        onClose={() => setModernDeleteDialog({ isOpen: false, supplier: null, message: '' })}
        onConfirm={handleConfirmModernDelete}
        description={modernDeleteDialog.message}
      />

      {/* Delete Supplier Dialog */}
      {deleteDialogSupplier && (
        <DeleteSupplierDialog
          supplier={deleteDialogSupplier}
          products={getSupplierProducts(deleteDialogSupplier.id)}
          suppliers={suppliers.filter(s => s.id !== deleteDialogSupplier.id)}
          isOpen={true}
          onClose={() => setDeleteDialogSupplier(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
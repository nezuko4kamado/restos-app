import { generateUUID } from "@/lib/uuid";
import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Trash2, Mail, Calendar, Upload, Search, Check, X, MessageCircle, Minus, Edit2, FileDown, Copy, AlertCircle, Save, Clock, CheckCircle, XCircle, Image as ImageIcon, ZoomIn, Send, FileText, FileSpreadsheet, Phone, Pencil, Download, RotateCcw, MoveRight, Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Order, Product, Supplier, OrderImage } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { useLoading } from '@/contexts/LoadingContext';
import { generateOrderPDF } from '@/lib/pdf-generator';
import { extractOrderFromImage } from '@/lib/ocrServiceOrders';
import { saveCancelledDraft, getCancelledDraft, clearCancelledDraft, clearDraftOrder, saveDraftOrder, getDraftOrder, updateOrder, deleteOrder as deleteOrderFromDB, saveSuppliers, getOrders, saveOrders } from '@/lib/storage';
import { getOrderImages, uploadOrderImage, deleteOrderImage, deleteAllOrderImages } from '@/lib/storageExtensions';
import { PriceHistoryService } from '@/lib/priceHistoryService';
import { ProductMatchingService } from '@/services/productMatchingService';
import { SupplierMatchingService } from '@/services/supplierWhitelistService';
import { generateEmailMessage, generateWhatsAppMessage } from '@/lib/email-templates';
import { postProcessOCRProducts, getPostProcessingStats } from '@/lib/productNameCleaner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OrdersSectionEnhancedProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  settings?: { storeName?: string };
}

interface OrderItem {
  product_id: string;
  quantity: number;
  price: number;
  custom_product_name?: string;
  custom_unit?: string;
}

interface GroupedItems {
  [supplier_id: string]: OrderItem[];
}

// Extended OrderItem with editable name and unit for form
interface EditableOrderItem extends OrderItem {
  editable_name: string;
  editable_unit: string;
  quantity_display: string; // Store original format: "1/2", "1.5", "2", etc.
}

// Helper functions for fraction parsing and formatting
const parseFraction = (input: string): number => {
  input = input.trim();
  
  // Handle mixed numbers like "1 1/2" or "1-1/2"
  const mixedMatch = input.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const numerator = parseInt(mixedMatch[2]);
    const denominator = parseInt(mixedMatch[3]);
    return whole + (numerator / denominator);
  }
  
  // Handle simple fractions like "1/2"
  const fractionMatch = input.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1]);
    const denominator = parseInt(fractionMatch[2]);
    return numerator / denominator;
  }
  
  // Handle decimals and integers
  const num = parseFloat(input);
  return isNaN(num) ? 0 : num;
};

const formatQuantityDisplay = (quantity: number, originalFormat?: string): string => {
  // If we have original format and it matches the quantity, preserve it
  if (originalFormat) {
    const parsed = parseFraction(originalFormat);
    if (Math.abs(parsed - quantity) < 0.001) {
      return originalFormat;
    }
  }
  
  // Check if it's a common fraction
  const fractions = [
    { value: 0.125, display: '1/8' },
    { value: 0.25, display: '1/4' },
    { value: 0.333, display: '1/3' },
    { value: 0.5, display: '1/2' },
    { value: 0.666, display: '2/3' },
    { value: 0.75, display: '3/4' },
    { value: 0.875, display: '7/8' },
  ];
  
  const wholePart = Math.floor(quantity);
  const fractionalPart = quantity - wholePart;
  
  // Check if fractional part matches a common fraction
  for (const frac of fractions) {
    if (Math.abs(fractionalPart - frac.value) < 0.01) {
      if (wholePart > 0) {
        return `${wholePart} ${frac.display}`;
      }
      return frac.display;
    }
  }
  
  // If it's a whole number
  if (fractionalPart < 0.001) {
    return wholePart.toString();
  }
  
  // Otherwise return as decimal
  return quantity.toFixed(2).replace(/\.?0+$/, '');
};


/**
 * Helper: Resolve the phone number for WhatsApp.
 * WhatsApp ONLY works with mobile numbers — NEVER use landline.
 * Priority: supplier.mobile ONLY. If no mobile, returns undefined.
 */
const resolveWhatsAppPhone = (
  supplier: Supplier | undefined,
  _order?: Order
): string | undefined => {
  const mobile = supplier?.mobile;

  console.warn('🔍 WHATSAPP DEBUG: resolveWhatsAppPhone called');
  console.warn('🔍 WHATSAPP DEBUG: supplier?.phone (fisso):', supplier?.phone || '(empty)');
  console.warn('🔍 WHATSAPP DEBUG: supplier?.mobile (cellulare):', mobile || '(empty)');

  if (mobile && mobile.trim().length > 0) {
    console.warn('🔍 WHATSAPP DEBUG: ✅ Using supplier.mobile:', mobile);
    return mobile;
  }

  console.warn('🔍 WHATSAPP DEBUG: ❌ Nessun numero cellulare disponibile — WhatsApp richiede un cellulare');
  return undefined;
};

/**
 * Helper: Resolve the best phone number for Email.
 * Emails can include any phone number (mobile preferred, landline as fallback).
 */
const resolveEmailPhone = (
  supplier: Supplier | undefined,
  order?: Order
): string | undefined => {
  const mobile = supplier?.mobile;
  const phone = supplier?.phone;
  const customPhone = order?.custom_supplier_phone;

  // Prefer mobile
  if (mobile && mobile.trim().length > 0) return mobile;
  // Then custom phone from order
  if (customPhone && customPhone.trim().length > 0) return customPhone;
  // Fallback to landline
  if (phone && phone.trim().length > 0) return phone;

  return undefined;
};

// Helper: open external URL reliably on mobile — NEVER navigate away from the current page
const openExternalUrl = (url: string) => {
  // Always open in a new tab/window so the user stays on the current page.
  // On mobile browsers/PWA, window.open with '_blank' triggers the OS intent
  // system which opens the native WhatsApp app without leaving the page.
  // Using window.location.href would navigate away and lose the order form.
  const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (!newWindow) {
    // Pop-up blocked fallback: create a temporary <a> and click it
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};

// Helper: build the best WhatsApp URL for the current platform.
// On mobile, the native deep-link "whatsapp://" opens the app directly
// without showing any "download WhatsApp" landing page.
const buildWhatsAppUrl = (cleanPhone: string, encodedText: string): string => {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    // Native deep link — opens WhatsApp app directly, no browser redirect
    return `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;
  }
  // Desktop: use web.whatsapp.com (avoids the wa.me marketing page)
  return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
};

export default function OrdersSectionEnhanced({ orders, setOrders, products, setProducts, suppliers, setSuppliers, settings }: OrdersSectionEnhancedProps) {
  const { language, t } = useLanguage();
  const { loadingState, setOCRProcessing, updateOCRProgress, resetOCRState } = useLoading();
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderItems, setOrderItems] = useState<EditableOrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [temporaryOcrProducts, setTemporaryOcrProducts] = useState<Product[]>([]);

  // Editable supplier info for current order being created
  const [currentOrderSupplierName, setCurrentOrderSupplierName] = useState('');
  const [currentOrderSupplierPhone, setCurrentOrderSupplierPhone] = useState('');
  const [currentOrderSupplierMobile, setCurrentOrderSupplierMobile] = useState('');
  const [currentOrderSupplierEmail, setCurrentOrderSupplierEmail] = useState('');
  const [currentOrderSupplierId, setCurrentOrderSupplierId] = useState('');

  // Inline editing states for supplier fields
  const [editingSupplierField, setEditingSupplierField] = useState<string | null>(null);
  const [tempSupplierFieldValue, setTempSupplierFieldValue] = useState('');
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  // Dialog states for editing product name in form
  const [editingProductInForm, setEditingProductInForm] = useState<number | null>(null);
  const [tempProductName, setTempProductName] = useState('');

  // Dialog states for editing quantity
  const [editingQuantityIndex, setEditingQuantityIndex] = useState<number | null>(null);
  const [tempQuantityValue, setTempQuantityValue] = useState('');

  // Dialog states for editing unit
  const [editingUnitIndex, setEditingUnitIndex] = useState<number | null>(null);
  const [tempUnitValue, setTempUnitValue] = useState('');

  // Product delete/move dialog states
  const [showProductActionDialog, setShowProductActionDialog] = useState(false);
  const [productToAction, setProductToAction] = useState<{ index: number; item: EditableOrderItem } | null>(null);
  const [selectedTargetSupplier, setSelectedTargetSupplier] = useState<string>('');

  // Supplier delete/move dialog states
  const [showSupplierActionDialog, setShowSupplierActionDialog] = useState(false);
  const [supplierToAction, setSupplierToAction] = useState<string | null>(null);
  const [selectedSupplierTarget, setSelectedSupplierTarget] = useState<string>('');

  const [isCreatingNewProduct, setIsCreatingNewProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductSupplier, setNewProductSupplier] = useState('');

  const [hasDraft, setHasDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<string>('');

  // Order editing state
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderItems, setEditingOrderItems] = useState<EditableOrderItem[]>([]);
  const [editingOrderSupplier, setEditingOrderSupplier] = useState<string>('');
  
  // Order deletion confirmation
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Order images state
  const [orderImagesMap, setOrderImagesMap] = useState<Record<string, OrderImage[]>>({});
  const [uploadingImages, setUploadingImages] = useState<Record<string, boolean>>({});
  const [selectedImageForView, setSelectedImageForView] = useState<string | null>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);

  // Temporary product dialog states
  const [showTempProductDialog, setShowTempProductDialog] = useState(false);
  const [tempProductDialogName, setTempProductDialogName] = useState('');
  const [tempProductQuantity, setTempProductQuantity] = useState(1);
  const [tempProductUnit, setTempProductUnit] = useState('');
  const [tempProductPrice, setTempProductPrice] = useState('');
  const [tempProductSupplierId, setTempProductSupplierId] = useState('');

  const allProductsForDisplay = [...products, ...temporaryOcrProducts];
  const hasOrders = orders.length > 0;

  // Load images for all orders
  useEffect(() => {
    loadAllOrderImages();
  }, [orders]);

  const loadAllOrderImages = async () => {
    const imagesMap: Record<string, OrderImage[]> = {};
    for (const order of orders) {
      try {
        const images = await getOrderImages(order.id);
        imagesMap[order.id] = images;
      } catch (error) {
        console.error(`Error loading images for order ${order.id}:`, error);
      }
    }
    setOrderImagesMap(imagesMap);
  };

  // Check for draft on mount and load it
  useEffect(() => {
    const checkDraft = async () => {
      try {
        const draft = await getDraftOrder();
        
        if (draft && draft.orderItems && Array.isArray(draft.orderItems) && draft.orderItems.length > 0) {
          setHasDraft(true);
          setDraftTimestamp(draft.timestamp || '');
        } else {
          setHasDraft(false);
          setDraftTimestamp('');
        }
      } catch (error) {
        console.error('Error checking draft order:', error);
        setHasDraft(false);
        setDraftTimestamp('');
      }
    };
    
    checkDraft();
  }, []);

  // Auto-save draft every 30 seconds if there are items
  useEffect(() => {
    if (!isCreatingOrder || orderItems.length === 0) return;

    const autoSaveInterval = setInterval(async () => {
      try {
        await saveDraftOrder(orderItems, temporaryOcrProducts);
        console.log('✅ Auto-saved draft order');
      } catch (error) {
        console.error('Error auto-saving draft:', error);
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [isCreatingOrder, orderItems, temporaryOcrProducts]);

  // Auto-save on page navigation/close
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (isCreatingOrder && orderItems.length > 0) {
        try {
          await saveDraftOrder(orderItems, temporaryOcrProducts);
          console.log('✅ Auto-saved draft on page unload');
        } catch (error) {
          console.error('Error saving draft on unload:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isCreatingOrder, orderItems, temporaryOcrProducts]);

  const handleStartNewOrder = () => {
    setIsCreatingOrder(true);
    setOrderItems([]);
    setSearchTerm('');
    setSelectedProduct(null);
    setQuantity(1);
    setTemporaryOcrProducts([]);
    setIsCreatingNewProduct(false);
    setEditingOrderId(null);
    setCurrentOrderSupplierName('');
    setCurrentOrderSupplierPhone('');
    setCurrentOrderSupplierMobile('');
    setCurrentOrderSupplierEmail('');
    setCurrentOrderSupplierId('');
  };

  // Recover last order (draft or completed)
  const handleRecoverLastOrder = async () => {
    const draft = await getDraftOrder();
    console.log("📦 RECOVERED DRAFT:", JSON.stringify(draft, null, 2));
    
    if (draft && draft.orderItems && Array.isArray(draft.orderItems) && draft.orderItems.length > 0) {
      const validItems = draft.orderItems.filter(item => 
        item && 
        typeof item === 'object' && 
        'product_id' in item && 
        'quantity' in item && 
        'price' in item
      );
      
      if (validItems.length > 0) {
        const editableItems: EditableOrderItem[] = validItems.map(item => {
          const product = allProductsForDisplay.find(p => p.id === item.product_id);
          return {
            ...item,
            editable_name: (item as EditableOrderItem).editable_name || item.custom_product_name || product?.name || t('productName'),
            editable_unit: (item as EditableOrderItem).editable_unit || item.custom_unit || product?.unit || '',
            quantity_display: (item as EditableOrderItem).quantity_display || formatQuantityDisplay(item.quantity)
          };
        });
        
        setOrderItems(editableItems);
        setIsCreatingOrder(true);
        
        if (draft.temporaryOcrProducts && draft.temporaryOcrProducts.length > 0) {
          setTemporaryOcrProducts(draft.temporaryOcrProducts);
        }
        
        const draftDate = draft.timestamp ? new Date(draft.timestamp).toLocaleString() : t('recent');
        toast.success(t('draftAvailable'), {
          description: `${validItems.length} ${t('products')} • ${t('orderSavedAsDraft')}: ${draftDate}`,
        });
        
        return;
      }
    }
    
    if (!hasOrders) {
      toast.error(t('noOrderOrDraftAvailable'));
      return;
    }

    const lastOrder = orders[0];
    
    if (!lastOrder.items || lastOrder.items.length === 0) {
      toast.error(t('emptyOrder'));
      return;
    }
    
    const copiedItems: EditableOrderItem[] = lastOrder.items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price || 0,
        custom_product_name: item.custom_product_name,
        editable_name: item.custom_product_name || product?.name || t('productName'),
        custom_unit: item.custom_unit,
        editable_unit: item.custom_unit || product?.unit || '',
        quantity_display: formatQuantityDisplay(item.quantity)
      };
    });

    setOrderItems(copiedItems);
    setIsCreatingOrder(true);
    setSearchTerm('');
    setSelectedProduct(null);
    setQuantity(1);
    setTemporaryOcrProducts([]);
    setIsCreatingNewProduct(false);
    
    const supplier = suppliers.find(s => s.id === lastOrder.supplier_id);
    const orderDate = new Date(lastOrder.order_date || lastOrder.created_at).toLocaleDateString();
    toast.success(t('recoverLastOrder'), {
      description: `${copiedItems.length} ${t('products')} • ${supplier?.name || t('supplier')} • ${orderDate}`,
    });
  };

  const handleSaveDraft = async () => {
    if (orderItems.length === 0) {
      toast.error(t('emptyOrder'));
      return;
    }

    try {
      console.log("💾 SAVING DRAFT:", JSON.stringify(orderItems, null, 2));
      await saveDraftOrder(orderItems, temporaryOcrProducts);
      setHasDraft(true);
      setDraftTimestamp(new Date().toISOString());
      
      toast.success(t('orderSavedAsDraft'), {
        description: `${orderItems.length} ${t('products')}`,
      });
    } catch (error) {
      console.error('Error saving draft order:', error);
      toast.error(t('errorSaving'));
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm('');
    setIsCreatingNewProduct(false);
  };

  const handleAddProduct = async () => {
    if (isCreatingNewProduct) {
      if (!newProductName.trim() || !newProductSupplier || quantity <= 0) {
        toast.error(t('productName') + ' ' + t('required'));
        return;
      }

      const newProduct: Product = {
        id: generateUUID(),
        name: newProductName.trim(),
        category: 'other',
        supplier_id: newProductSupplier,
        price: 0,
        unit: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setTemporaryOcrProducts((prev) => [...prev, newProduct]);

      const newItem: EditableOrderItem = {
        product_id: newProduct.id,
        quantity,
        price: 0,
        editable_name: newProduct.name,
        editable_unit: '',
        quantity_display: formatQuantityDisplay(quantity)
      };

      if (editingOrderId) {
        setEditingOrderItems([...editingOrderItems, newItem]);
      } else {
        setOrderItems([...orderItems, newItem]);
      }
      
      const supplier = suppliers.find((s) => s.id === newProductSupplier);
      toast.success(`${newProduct.name} ${t('add') + ' ' + t('toOrder')} (${supplier?.name || t('supplier')})`);
      
      setNewProductName('');
      setQuantity(1);
      searchInputRef.current?.focus();
      return;
    }

    if (!selectedProduct || quantity < 0) {
      toast.error(t('error'));
      return;
    }

    // ✅ MODIFICA: Campo unità lasciato vuoto invece di usare selectedProduct('unit')
    const newItem: EditableOrderItem = {
      product_id: selectedProduct.id,
      quantity,
      price: selectedProduct.price,
      editable_name: selectedProduct.name,
      editable_unit: '', // ✅ Sempre vuoto - l'utente lo aggiungerà manualmente
      quantity_display: formatQuantityDisplay(quantity)
    };

    if (editingOrderId) {
      setEditingOrderItems([...editingOrderItems, newItem]);
    } else {
      setOrderItems([...orderItems, newItem]);
      
      if (orderItems.length === 0 && selectedProduct.supplier_id) {
        const supplier = suppliers.find(s => s.id === selectedProduct.supplier_id);
        if (supplier) {
          setCurrentOrderSupplierId(supplier.id);
          setCurrentOrderSupplierName(supplier.name);
          setCurrentOrderSupplierPhone(supplier.mobile || supplier.phone || '');
          setCurrentOrderSupplierMobile(supplier.mobile || '');
          setCurrentOrderSupplierEmail(supplier.email || '');
        }
      }
    }
    
    try {
      const supplierName = suppliers.find(s => s.id === selectedProduct.supplier_id)?.name || 'Unknown';
      await PriceHistoryService.trackPriceChange(
        selectedProduct.id,
        selectedProduct.name,
        supplierName,
        selectedProduct.price,
        selectedProduct.price,
        'order_creation'
      );
    } catch (error) {
      console.error('Error tracking price for order:', error);
    }
    
    setSelectedProduct(null);
    setQuantity(1);
    
    const supplier = suppliers.find((s) => s.id === selectedProduct.supplier_id);
    toast.success(`${selectedProduct.name} ${t('add') + ' ' + t('toOrder')} (${supplier?.name || t('supplier')})`);
    searchInputRef.current?.focus();
  };

  // Handle temporary product addition
  const handleAddTemporaryProduct = () => {
    if (!tempProductDialogName.trim() || !tempProductSupplierId) {
      toast.error('Nome prodotto e fornitore sono obbligatori');
      return;
    }

    const tempProduct: Product = {
      id: `temp_${Date.now()}`,
      name: tempProductDialogName.trim(),
      category: 'other',
      supplier_id: tempProductSupplierId,
      price: parseFloat(tempProductPrice) || 0,
      unit: tempProductUnit.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTemporaryOcrProducts((prev) => [...prev, tempProduct]);

    const newItem: EditableOrderItem = {
      product_id: tempProduct.id,
      quantity: tempProductQuantity,
      price: parseFloat(tempProductPrice) || 0,
      editable_name: tempProduct.name,
      editable_unit: tempProductUnit.trim(),
      quantity_display: formatQuantityDisplay(tempProductQuantity)
    };

    if (editingOrderId) {
      setEditingOrderItems([...editingOrderItems, newItem]);
    } else {
      setOrderItems([...orderItems, newItem]);
    }

    setShowTempProductDialog(false);
    setTempProductDialogName('');
    setTempProductQuantity(1);
    setTempProductUnit('');
    setTempProductPrice('');
    setTempProductSupplierId('');
    setSearchTerm('');
    toast.success('Prodotto temporaneo aggiunto all\'ordine');
  };

  // Start inline editing for supplier field
  const handleStartEditSupplierField = (supplierId: string, field: 'name' | 'phone' | 'mobile' | 'email') => {
    setEditingSupplierId(supplierId);
    setEditingSupplierField(field);
    
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    switch (field) {
      case 'name':
        setTempSupplierFieldValue(supplier.name);
        break;
      case 'phone':
        setTempSupplierFieldValue(supplier.phone || '');
        break;
      case 'mobile':
        setTempSupplierFieldValue(supplier.mobile || '');
        break;
      case 'email':
        setTempSupplierFieldValue(supplier.email || '');
        break;
    }
  };

  // Save inline edited supplier field
  const handleSaveSupplierField = async () => {
    if (!editingSupplierField || !editingSupplierId) return;

    const trimmedValue = tempSupplierFieldValue.trim();

    if (editingSupplierField === 'name' && !trimmedValue) {
      toast.error(t('supplier') + ' ' + t('name') + ' ' + t('required'));
      return;
    }

    if (editingSupplierField === 'email' && trimmedValue && !trimmedValue.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast.error(t('invalidEmail'));
      return;
    }

    try {
      const supplier = suppliers.find(s => s.id === editingSupplierId);
      if (supplier) {
        const updatedSupplier = { ...supplier };
        
        switch (editingSupplierField) {
          case 'name':
            updatedSupplier.name = trimmedValue;
            break;
          case 'phone':
            updatedSupplier.phone = trimmedValue;
            break;
          case 'mobile':
            updatedSupplier.mobile = trimmedValue;
            break;
          case 'email':
            updatedSupplier.email = trimmedValue;
            break;
        }

        const updatedSuppliers = suppliers.map(s => s.id === editingSupplierId ? updatedSupplier : s);
        await saveSuppliers(updatedSuppliers);
        setSuppliers(updatedSuppliers);
        
        if (editingSupplierId === currentOrderSupplierId) {
          switch (editingSupplierField) {
            case 'name':
              setCurrentOrderSupplierName(trimmedValue);
              break;
            case 'phone':
              setCurrentOrderSupplierPhone(trimmedValue);
              break;
            case 'mobile':
              setCurrentOrderSupplierMobile(trimmedValue);
              break;
            case 'email':
              setCurrentOrderSupplierEmail(trimmedValue);
              break;
          }
        }
      }
    } catch (error) {
      console.error('Error updating supplier:', error);
    }

    setEditingSupplierField(null);
    setEditingSupplierId(null);
    setTempSupplierFieldValue('');
    toast.success(t('supplier') + ' ' + t('updated'));
  };

  // Cancel inline editing
  const handleCancelEditSupplierField = () => {
    setEditingSupplierField(null);
    setEditingSupplierId(null);
    setTempSupplierFieldValue('');
  };

  // Open product name edit dialog in form
  const handleOpenProductEditInForm = (index: number) => {
    const item = editingOrderId ? editingOrderItems[index] : orderItems[index];
    setTempProductName(item.editable_name);
    setEditingProductInForm(index);
  };

  // Save product name edit in form
  const handleSaveProductNameInForm = () => {
    if (editingProductInForm === null) return;
    
    if (editingOrderId) {
      const updatedItems = [...editingOrderItems];
      updatedItems[editingProductInForm] = { 
        ...updatedItems[editingProductInForm], 
        editable_name: tempProductName.trim() 
      };
      setEditingOrderItems(updatedItems);
    } else {
      const updatedItems = [...orderItems];
      updatedItems[editingProductInForm] = { 
        ...updatedItems[editingProductInForm], 
        editable_name: tempProductName.trim() 
      };
      setOrderItems(updatedItems);
    }
    
    setEditingProductInForm(null);
    setTempProductName('');
    toast.success(t('productUpdated'));
  };

  // Open quantity edit dialog
  const handleOpenQuantityEdit = (index: number) => {
    const item = editingOrderId ? editingOrderItems[index] : orderItems[index];
    setTempQuantityValue(item.quantity_display);
    setEditingQuantityIndex(index);
  };

  // Save quantity edit
  const handleSaveQuantityEdit = () => {
    if (editingQuantityIndex === null) return;
    
    const parsed = parseFraction(tempQuantityValue);
    if (parsed <= 0) {
      toast.error(t('error'));
      return;
    }
    
    if (editingOrderId) {
      const updatedItems = [...editingOrderItems];
      updatedItems[editingQuantityIndex] = {
        ...updatedItems[editingQuantityIndex],
        quantity: parsed,
        quantity_display: tempQuantityValue.trim()
      };
      setEditingOrderItems(updatedItems);
    } else {
      const updatedItems = [...orderItems];
      updatedItems[editingQuantityIndex] = {
        ...updatedItems[editingQuantityIndex],
        quantity: parsed,
        quantity_display: tempQuantityValue.trim()
      };
      setOrderItems(updatedItems);
    }
    
    setEditingQuantityIndex(null);
    setTempQuantityValue('');
    toast.success(t('order') + ' ' + t('updated'));
  };

  // Quick set quantity from dialog
  const handleQuickSetQuantity = (value: string) => {
    setTempQuantityValue(value);
  };

  // Open unit edit dialog
  const handleOpenUnitEdit = (index: number) => {
    const item = editingOrderId ? editingOrderItems[index] : orderItems[index];
    setTempUnitValue(item.editable_unit);
    setEditingUnitIndex(index);
  };

  // Save unit edit
  const handleSaveUnitEdit = () => {
    if (editingUnitIndex === null) return;
    
    if (editingOrderId) {
      const updatedItems = [...editingOrderItems];
      updatedItems[editingUnitIndex] = {
        ...updatedItems[editingUnitIndex],
        editable_unit: tempUnitValue.trim(),
        custom_unit: tempUnitValue.trim()
      };
      setEditingOrderItems(updatedItems);
    } else {
      const updatedItems = [...orderItems];
      updatedItems[editingUnitIndex] = {
        ...updatedItems[editingUnitIndex],
        editable_unit: tempUnitValue.trim(),
        custom_unit: tempUnitValue.trim()
      };
      setOrderItems(updatedItems);
    }
    
    setEditingUnitIndex(null);
    setTempUnitValue('');
    toast.success(t('order') + ' ' + t('updated'));
  };

  const handleUpdateQuantity = (index: number, delta: number, isEditing: boolean = false) => {
    const currentItems = isEditing ? editingOrderItems : orderItems;
    const item = currentItems[index];
    const currentQty = item.quantity;
    
    const newQuantity = currentQty + delta;
    
    if (newQuantity <= 0) {
      handleRemoveItem(index, isEditing);
      return;
    }

    const newDisplay = formatQuantityDisplay(newQuantity, item.quantity_display);
    
    if (isEditing) {
      const updatedItems = [...editingOrderItems];
      updatedItems[index] = { 
        ...updatedItems[index], 
        quantity: newQuantity,
        quantity_display: newDisplay
      };
      setEditingOrderItems(updatedItems);
    } else {
      const updatedItems = [...orderItems];
      updatedItems[index] = { 
        ...updatedItems[index], 
        quantity: newQuantity,
        quantity_display: newDisplay
      };
      setOrderItems(updatedItems);
    }
  };

  // Show product action dialog (delete or move)
  const handleRemoveItem = (index: number, isEditing: boolean = false) => {
    const currentItems = isEditing ? editingOrderItems : orderItems;
    const item = currentItems[index];
    
    setProductToAction({ index, item });
    setSelectedTargetSupplier('');
    setShowProductActionDialog(true);
  };

  // Confirm delete product
  const handleConfirmDeleteProduct = () => {
    if (!productToAction) return;
    
    if (editingOrderId) {
      const updatedItems = editingOrderItems.filter((_, i) => i !== productToAction.index);
      setEditingOrderItems(updatedItems);
    } else {
      const updatedItems = orderItems.filter((_, i) => i !== productToAction.index);
      setOrderItems(updatedItems);
    }
    
    setShowProductActionDialog(false);
    setProductToAction(null);
    toast.success(t('productDeleted'));
  };

  // Move product to another supplier — updates live draft UI immediately
  const handleMoveProduct = () => {
    if (!productToAction || !selectedTargetSupplier) {
      toast.error(t('selectSupplier'));
      return;
    }

    const productId = productToAction.item.product_id;
    const targetSupplier = suppliers.find(s => s.id === selectedTargetSupplier);

    // 1. Update supplier_id in temporaryOcrProducts (OCR-created products)
    const isOcrProduct = temporaryOcrProducts.some(p => p.id === productId);
    if (isOcrProduct) {
      setTemporaryOcrProducts(prev =>
        prev.map(p => p.id === productId ? { ...p, supplier_id: selectedTargetSupplier } : p)
      );
    } else {
      // 2. Update supplier_id in the permanent products list (live re-group in UI)
      setProducts(prev =>
        prev.map(p => p.id === productId ? { ...p, supplier_id: selectedTargetSupplier } : p)
      );
    }

    // 3. Close dialog and notify user — groupedItems will recompute instantly
    setShowProductActionDialog(false);
    setProductToAction(null);
    setSelectedTargetSupplier('');
    toast.success(`✅ ${t('transferProduct')} → ${targetSupplier?.name || t('supplier')}`);
  };

  // Show supplier action dialog (delete all or move all)
  const handleSupplierAction = (supplierId: string) => {
    setSupplierToAction(supplierId);
    setSelectedSupplierTarget('');
    setShowSupplierActionDialog(true);
  };

  // Confirm delete all products from supplier
  const handleConfirmDeleteSupplier = () => {
    if (!supplierToAction) return;

    if (editingOrderId) {
      const updatedItems = editingOrderItems.filter(item => {
        const product = allProductsForDisplay.find(p => p.id === item.product_id);
        return product?.supplier_id !== supplierToAction;
      });
      setEditingOrderItems(updatedItems);
    } else {
      const updatedItems = orderItems.filter(item => {
        const product = allProductsForDisplay.find(p => p.id === item.product_id);
        return product?.supplier_id !== supplierToAction;
      });
      setOrderItems(updatedItems);
    }

    setShowSupplierActionDialog(false);
    setSupplierToAction(null);
    toast.success(t('supplier') + ' ' + t('deleted'));
  };

  // Move all products from supplier to another supplier
  const handleMoveAllProducts = () => {
    if (!supplierToAction || !selectedSupplierTarget) {
      toast.error(t('selectSupplier'));
      return;
    }

    const updatedTempProducts = temporaryOcrProducts.map(p =>
      p.supplier_id === supplierToAction
        ? { ...p, supplier_id: selectedSupplierTarget }
        : p
    );
    setTemporaryOcrProducts(updatedTempProducts);

    const targetSupplier = suppliers.find(s => s.id === selectedSupplierTarget);
    
    setShowSupplierActionDialog(false);
    setSupplierToAction(null);
    setSelectedSupplierTarget('');
    toast.success(`${t('order') + ' ' + t('updated')} → ${targetSupplier?.name || t('supplier')}`);
  };

  // Save as draft on cancel
  const handleCancelOrder = async () => {
    if (orderItems.length > 0) {
      try {
        await saveDraftOrder(orderItems, temporaryOcrProducts);
        setHasDraft(true);
        setDraftTimestamp(new Date().toISOString());
        
        toast.success(t('orderSavedAsDraft'), {
          description: t('canRecoverWithButton'),
        });
      } catch (error) {
        console.error('Error saving draft on cancel:', error);
      }
    }
    
    setIsCreatingOrder(false);
    setOrderItems([]);
    setSearchTerm('');
    setSelectedProduct(null);
    setQuantity(1);
    setTemporaryOcrProducts([]);
    setIsCreatingNewProduct(false);
    setNewProductName('');
    setNewProductSupplier('');
    setEditingOrderId(null);
    setCurrentOrderSupplierName('');
    setCurrentOrderSupplierPhone('');
    setCurrentOrderSupplierMobile('');
    setCurrentOrderSupplierEmail('');
    setCurrentOrderSupplierId('');
  };

  const handleSavePDF = async () => {
    if (orderItems.length === 0) {
      toast.error(t('noProductsInOrder'));
      return;
    }

    try {
      const finalItems = orderItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        custom_product_name: item.editable_name,
        custom_unit: item.editable_unit || undefined
      }));

      const allOrders = await getOrders();
      const ordersToSave = Object.entries(
        finalItems.reduce((acc, item) => {
          const product = allProductsForDisplay.find(p => p.id === item.product_id);
          const supplierId = product?.supplier_id || 'unknown';
          if (!acc[supplierId]) {
            acc[supplierId] = [];
          }
          acc[supplierId].push(item);
          return acc;
        }, {} as GroupedItems)
      ).map(([supplierId, items]) => ({
        id: generateUUID(),
        supplier_id: supplierId,
        items,
        order_date: new Date().toISOString(),
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const updatedOrders = [...allOrders, ...ordersToSave];
      await saveOrders(updatedOrders);

      await generateOrderPDF({
        orderItems: finalItems,
        products: allProductsForDisplay,
        suppliers
      }, language);
      
      toast.success(t('success'));
      
      await clearDraftOrder();
      setHasDraft(false);
      setDraftTimestamp('');
      
      setIsCreatingOrder(false);
      setOrderItems([]);
      setTemporaryOcrProducts([]);
      setCurrentOrderSupplierName('');
      setCurrentOrderSupplierPhone('');
      setCurrentOrderSupplierMobile('');
      setCurrentOrderSupplierEmail('');
      setCurrentOrderSupplierId('');
      
      setOrders(updatedOrders);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(t('error'));
    }
  };

  // Send WhatsApp for specific supplier
  const handleSendWhatsAppForSupplier = (supplierId: string) => {
    const currentItems = editingOrderId ? editingOrderItems : orderItems;
    
    const supplierItems = currentItems.filter(item => {
      const product = allProductsForDisplay.find(p => p.id === item.product_id);
      return product?.supplier_id === supplierId;
    });

    if (supplierItems.length === 0) {
      toast.error(t('noProductsInOrder'));
      return;
    }

    const supplier = suppliers.find(s => s.id === supplierId);
    const phoneNumber = resolveWhatsAppPhone(supplier);

    if (!phoneNumber) {
      toast.error('📱 Numero cellulare non disponibile per questo fornitore');
      return;
    }

    const items = supplierItems.map(item => ({
      name: item.editable_name,
      quantity: item.quantity,
      unit: item.editable_unit
    }));

    const supplierName = supplier?.name || t('supplier');

    const message = generateWhatsAppMessage(
      supplierName,
      items,
      phoneNumber,
      settings?.storeName,
      language
    );

    const cleanPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhoneNumber}?text=${encodeURIComponent(message)}`;
    
    openExternalUrl(whatsappUrl);
  };

  // Send Email for specific supplier
  const handleSendEmailForSupplier = (supplierId: string) => {
    const currentItems = editingOrderId ? editingOrderItems : orderItems;
    
    const supplierItems = currentItems.filter(item => {
      const product = allProductsForDisplay.find(p => p.id === item.product_id);
      return product?.supplier_id === supplierId;
    });

    if (supplierItems.length === 0) {
      toast.error(t('noProductsInOrder'));
      return;
    }

    const supplier = suppliers.find(s => s.id === supplierId);
    const email = supplier?.email;

    if (!email) {
      toast.error(t('email') + ' ' + t('required'));
      return;
    }

    const items = supplierItems.map(item => ({
      name: item.editable_name,
      quantity: item.quantity,
      unit: item.editable_unit,
      price: item.price
    }));

    const supplierName = supplier?.name || t('supplier');
    const phoneNumber = resolveEmailPhone(supplier);

    const { subject, body } = generateEmailMessage(
      supplierName,
      items,
      phoneNumber,
      settings?.storeName,
      language
    );

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.open(mailtoUrl, '_blank');
    toast.success(t('success'));
  };

  // Send all draft items via WhatsApp
  const handleSendAllWhatsAppDraft = () => {
    const currentItems = editingOrderId ? editingOrderItems : orderItems;
    
    if (currentItems.length === 0) {
      toast.error(t('noProductsInOrder'));
      return;
    }

    const itemsBySupplier = new Map<string, typeof currentItems>();
    currentItems.forEach(item => {
      const product = allProductsForDisplay.find(p => p.id === item.product_id);
      const supplierId = product?.supplier_id || 'unknown';
      if (!itemsBySupplier.has(supplierId)) {
        itemsBySupplier.set(supplierId, []);
      }
      itemsBySupplier.get(supplierId)!.push(item);
    });

    let sentCount = 0;
    let skippedCount = 0;

    itemsBySupplier.forEach((supplierItems, supplierId) => {
      const supplier = suppliers.find(s => s.id === supplierId);
      const phoneNumber = resolveWhatsAppPhone(supplier);
      
      if (!phoneNumber) {
        skippedCount++;
        return;
      }

      const items = supplierItems.map(item => ({
        name: item.editable_name,
        quantity: item.quantity,
        unit: item.editable_unit
      }));

      const supplierName = supplier?.name || t('supplier');
      const message = generateWhatsAppMessage(
        supplierName,
        items,
        phoneNumber,
        settings?.storeName,
        language
      );

      const cleanPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');
      const whatsappUrl = `https://wa.me/${cleanPhoneNumber}?text=${encodeURIComponent(message)}`;
      
      setTimeout(() => {
        openExternalUrl(whatsappUrl);
      
      }, sentCount * 1000);
      sentCount++;
    });

    if (sentCount > 0) {
      toast.success(t('success'), {
        description: skippedCount > 0 ? `${skippedCount} ${t('suppliers')} ${t('phone')}` : undefined
      });
    } else {
      toast.error(t('error'));
    }
  };

  // Send all draft items via Email
  const handleSendAllEmailDraft = () => {
    const currentItems = editingOrderId ? editingOrderItems : orderItems;
    
    if (currentItems.length === 0) {
      toast.error(t('noProductsInOrder'));
      return;
    }

    const itemsBySupplier = new Map<string, typeof currentItems>();
    currentItems.forEach(item => {
      const product = allProductsForDisplay.find(p => p.id === item.product_id);
      const supplierId = product?.supplier_id || 'unknown';
      if (!itemsBySupplier.has(supplierId)) {
        itemsBySupplier.set(supplierId, []);
      }
      itemsBySupplier.get(supplierId)!.push(item);
    });

    let sentCount = 0;
    let skippedCount = 0;

    itemsBySupplier.forEach((supplierItems, supplierId) => {
      const supplier = suppliers.find(s => s.id === supplierId);
      const email = supplier?.email;
      
      if (!email) {
        skippedCount++;
        return;
      }

      const items = supplierItems.map(item => ({
        name: item.editable_name,
        quantity: item.quantity,
        unit: item.editable_unit,
        price: item.price
      }));

      const supplierName = supplier?.name || t('supplier');
      const phoneNumber = resolveEmailPhone(supplier);

      const { subject, body } = generateEmailMessage(
        supplierName,
        items,
        phoneNumber,
        settings?.storeName,
        language
      );

      const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      setTimeout(() => {
        window.open(mailtoUrl, '_blank');
      }, sentCount * 1000);
      
      sentCount++;
    });

    if (sentCount > 0) {
      toast.success(t('success'), {
        description: skippedCount > 0 ? `${skippedCount} ${t('suppliers')} ${t('email')}` : undefined
      });
    } else {
      toast.error(t('error'));
    }
  };

  // Start editing an order
  const handleStartEditOrder = (order: Order) => {
    setEditingOrderId(order.id);
    setEditingOrderSupplier(order.supplier_id);
    
    const editableItems: EditableOrderItem[] = order.items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price || 0,
        custom_product_name: item.custom_product_name,
        editable_name: item.custom_product_name || product?.name || t('productName'),
        custom_unit: item.custom_unit,
        editable_unit: item.custom_unit || product?.unit || '',
        quantity_display: formatQuantityDisplay(item.quantity)
      };
    });
    
    setEditingOrderItems(editableItems);
    setIsCreatingOrder(true);
    
    const supplier = suppliers.find(s => s.id === order.supplier_id);
    if (supplier) {
      setCurrentOrderSupplierId(supplier.id);
      setCurrentOrderSupplierName(order.custom_supplier_name || supplier.name);
      setCurrentOrderSupplierPhone(supplier.mobile || order.custom_supplier_phone || supplier.phone || '');
      setCurrentOrderSupplierMobile(supplier.mobile || '');
      setCurrentOrderSupplierEmail(order.custom_supplier_email || supplier.email || '');
    }
  };

  // Save edited order
  const handleSaveEditedOrder = async () => {
    if (!editingOrderId || editingOrderItems.length === 0) {
      toast.error(t('emptyOrder'));
      return;
    }

    try {
      const finalItems = editingOrderItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        custom_product_name: item.editable_name,
        custom_unit: item.editable_unit || undefined
      }));

      const updates: Partial<Order> = {
        supplier_id: editingOrderSupplier,
        items: finalItems,
        custom_supplier_name: currentOrderSupplierName,
        custom_supplier_phone: currentOrderSupplierPhone,
        custom_supplier_email: currentOrderSupplierEmail,
        updated_at: new Date().toISOString(),
      };

      await updateOrder(editingOrderId, updates);

      const updatedOrders = orders.map(o => 
        o.id === editingOrderId ? { ...o, ...updates } : o
      );
      setOrders(updatedOrders);

      setEditingOrderId(null);
      setEditingOrderItems([]);
      setEditingOrderSupplier('');
      setIsCreatingOrder(false);
      setOrderItems([]);
      setCurrentOrderSupplierName('');
      setCurrentOrderSupplierPhone('');
      setCurrentOrderSupplierMobile('');
      setCurrentOrderSupplierEmail('');
      setCurrentOrderSupplierId('');
      
      toast.success(t('order') + ' ' + t('updated'));
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error(t('errorUpdatingOrder'));
    }
  };

  // Delete order with confirmation
  const handleDeleteOrderConfirm = (orderId: string) => {
    setDeletingOrderId(orderId);
    setShowDeleteDialog(true);
  };

  const handleDeleteOrder = async () => {
    if (!deletingOrderId) return;

    try {
      await deleteAllOrderImages(deletingOrderId);
      const success = await deleteOrderFromDB(deletingOrderId);
      
      if (!success) {
        console.error(`❌ [UI] deleteOrder returned false for ${deletingOrderId} - NOT removing from local state`);
        toast.error(t('errorDeletingOrder') || 'Error deleting order from database');
        return;
      }
      
      setOrders(orders.filter(o => o.id !== deletingOrderId));
      
      const newImagesMap = { ...orderImagesMap };
      delete newImagesMap[deletingOrderId];
      setOrderImagesMap(newImagesMap);
      
      toast.success(t('order') + ' ' + t('deleted'));
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error(t('errorDeletingOrder'));
    } finally {
      setShowDeleteDialog(false);
      setDeletingOrderId(null);
    }
  };

  // Change order status
  const handleStatusChange = async (orderId: string, newStatus: 'delivered' | 'cancelled') => {
    try {
      const updates: Partial<Order> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      await updateOrder(orderId, updates);

      const updatedOrders = orders.map(o => 
        o.id === orderId ? { ...o, ...updates } : o
      );
      setOrders(updatedOrders);

      const statusLabel = newStatus === 'delivered' ? t('completed') : t('cancelled');
      toast.success(`${t('order')} ${statusLabel}`);
    } catch (error) {
      console.error('Error changing order status:', error);
      toast.error(t('error'));
    }
  };

  // Upload images for order
  const handleImageUpload = async (orderId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadingImages({ ...uploadingImages, [orderId]: true });

    try {
      const uploadPromises = Array.from(files).map(file => 
        uploadOrderImage(orderId, file)
      );

      await Promise.all(uploadPromises);

      const images = await getOrderImages(orderId);
      setOrderImagesMap({ ...orderImagesMap, [orderId]: images });

      toast.success(`${files.length} ${t('images') + ' ' + t('uploaded')}`);
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error(t('errorUploadingImages'));
    } finally {
      setUploadingImages({ ...uploadingImages, [orderId]: false });
    }
  };

  // Delete single image
  const handleDeleteImage = async (orderId: string, imageId: string, imageUrl: string) => {
    try {
      await deleteOrderImage(imageId, imageUrl);

      const updatedImages = orderImagesMap[orderId]?.filter(img => img.id !== imageId) || [];
      setOrderImagesMap({ ...orderImagesMap, [orderId]: updatedImages });

      toast.success(t('imageDeleted'));
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error(t('errorDeletingImage'));
    }
  };

  // Export single order to PDF
  const handleExportOrderPDF = async (order: Order) => {
    try {
      await generateOrderPDF({
        orderItems: order.items,
        products: products,
        suppliers: suppliers
      }, language);
      toast.success(t('success'));
    } catch (error) {
      console.error('Error exporting order PDF:', error);
      toast.error(t('error'));
    }
  };

  // Export all orders to PDF
  const handleExportAllOrdersPDF = async () => {
    if (orders.length === 0) {
      toast.error(t('noOrders'));
      return;
    }

    try {
      const allOrderItems = orders.flatMap(order => order.items);
      
      await generateOrderPDF({
        orderItems: allOrderItems,
        products: products,
        suppliers: suppliers
      }, language);
      
      toast.success(`${orders.length} ${t('orders')} ${t('exportPDF')}`);
    } catch (error) {
      console.error('Error exporting all orders:', error);
      toast.error(t('error'));
    }
  };

  // Send WhatsApp message for saved order
  const handleSendWhatsAppSavedOrder = (order: Order) => {
    const supplier = suppliers.find((s) => s.id === order.supplier_id);
    const phoneNumber = resolveWhatsAppPhone(supplier, order);
    
    if (!phoneNumber) {
      toast.error('📱 Numero cellulare non disponibile per questo fornitore');
      return;
    }

    const items = order.items.map(item => {
      const product = products.find((p) => p.id === item.product_id);
      return {
        name: item.custom_product_name || product?.name || t('productName'),
        quantity: item.quantity,
        unit: item.custom_unit || product?.unit
      };
    });

    const supplierName = order.custom_supplier_name || supplier?.name || t('supplier');

    const message = generateWhatsAppMessage(
      supplierName,
      items,
      phoneNumber,
      settings?.storeName,
      language
    );

    const cleanPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhoneNumber}?text=${encodeURIComponent(message)}`;
    
    openExternalUrl(whatsappUrl);
  };

  // Send email for saved order
  const handleSendEmailSavedOrder = (order: Order) => {
    const supplier = suppliers.find((s) => s.id === order.supplier_id);
    const email = order.custom_supplier_email || supplier?.email;
    
    if (!email) {
      toast.error(t('email') + ' ' + t('required'));
      return;
    }

    const items = order.items.map(item => {
      const product = products.find((p) => p.id === item.product_id);
      return {
        name: item.custom_product_name || product?.name || t('productName'),
        quantity: item.quantity,
        unit: item.custom_unit || product?.unit,
        price: item.price
      };
    });

    const supplierName = order.custom_supplier_name || supplier?.name || t('supplier');
    const phone = resolveEmailPhone(supplier, order);

    const { subject, body } = generateEmailMessage(
      supplierName,
      items,
      phone,
      settings?.storeName,
      language
    );

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.open(mailtoUrl, '_blank');
    toast.success(t('success'));
  };

  // Send all orders via WhatsApp with proper grouping by supplier
  const handleSendAllWhatsApp = () => {
    if (orders.length === 0) {
      toast.error(t('noOrders'));
      return;
    }

    const ordersBySupplier = new Map<string, Order[]>();
    orders.forEach(order => {
      const supplierId = order.supplier_id || 'unknown';
      if (!ordersBySupplier.has(supplierId)) {
        ordersBySupplier.set(supplierId, []);
      }
      ordersBySupplier.get(supplierId)!.push(order);
    });

    let sentCount = 0;
    let skippedCount = 0;

    ordersBySupplier.forEach((supplierOrders, supplierId) => {
      const supplier = suppliers.find(s => s.id === supplierId);
      const firstOrder = supplierOrders[0];
      const phoneNumber = resolveWhatsAppPhone(supplier, firstOrder);
      
      if (!phoneNumber) {
        skippedCount++;
        console.warn(`Skipping supplier ${supplier?.name || supplierId}: no mobile number (cellulare)`);
        return;
      }

      const allItems = supplierOrders.flatMap(order => 
        order.items.map(item => {
          const product = products.find(p => p.id === item.product_id);
          return {
            name: item.custom_product_name || product?.name || t('productName'),
            quantity: item.quantity,
            unit: item.custom_unit || product?.unit
          };
        })
      );

      const supplierName = firstOrder.custom_supplier_name || supplier?.name || t('supplier');
      const message = generateWhatsAppMessage(
        supplierName,
        allItems,
        phoneNumber,
        settings?.storeName,
        language
      );

      const cleanPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');
      const whatsappUrl = `https://wa.me/${cleanPhoneNumber}?text=${encodeURIComponent(message)}`;
      
      setTimeout(() => {
        openExternalUrl(whatsappUrl);
      
      }, sentCount * 1000);
      sentCount++;
    });

    if (sentCount > 0) {
      toast.success(t('success'), {
        description: skippedCount > 0 ? `${skippedCount} ${t('suppliers')}` : undefined
      });
    } else {
      toast.error(t('error'));
    }
  };

  // Send all orders via Email with proper grouping by supplier
  const handleSendAllEmail = () => {
    if (orders.length === 0) {
      toast.error(t('noOrders'));
      return;
    }

    const ordersBySupplier = new Map<string, Order[]>();
    orders.forEach(order => {
      const supplierId = order.supplier_id || 'unknown';
      if (!ordersBySupplier.has(supplierId)) {
        ordersBySupplier.set(supplierId, []);
      }
      ordersBySupplier.get(supplierId)!.push(order);
    });

    let sentCount = 0;
    let skippedCount = 0;

    ordersBySupplier.forEach((supplierOrders, supplierId) => {
      const supplier = suppliers.find(s => s.id === supplierId);
      const firstOrder = supplierOrders[0];
      const email = firstOrder.custom_supplier_email || supplier?.email;
      
      if (!email) {
        skippedCount++;
        console.warn(`Skipping supplier ${supplier?.name || supplierId}: no email`);
        return;
      }

      const allItems = supplierOrders.flatMap(order => 
        order.items.map(item => {
          const product = products.find(p => p.id === item.product_id);
          return {
            name: item.custom_product_name || product?.name || t('productName'),
            quantity: item.quantity,
            unit: item.custom_unit || product?.unit,
            price: item.price
          };
        })
      );

      const supplierName = firstOrder.custom_supplier_name || supplier?.name || t('supplier');
      const phoneNumber = resolveEmailPhone(supplier, firstOrder);

      const { subject, body } = generateEmailMessage(
        supplierName,
        allItems,
        phoneNumber,
        settings?.storeName,
        language
      );

      const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      setTimeout(() => {
        window.open(mailtoUrl, '_blank');
      }, sentCount * 1000);
      
      sentCount++
    });

    if (sentCount > 0) {
      toast.success(t('success'), {
        description: skippedCount > 0 ? `${skippedCount} ${t('suppliers')}` : undefined
      });
    } else {
      toast.error(t('error'));
    }
  };

  // Handle multiple image upload for OCR with multi-supplier support and POST-PROCESSING
  const handleImageUploadOCR = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const invalidFiles = Array.from(files).filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      toast.error(t('error'));
      event.target.value = '';
      return;
    }

    // Use unified loading system
    setOCRProcessing(true);
    updateOCRProgress({
      currentState: 'extracting',
      productsFound: 0,
      supplierName: ''
    });

    toast.info(`${t('processing')} ${files.length} ${t('images')}...`);

    const allNewItems: EditableOrderItem[] = [];
    const allNewProducts: Product[] = [];
    const allNewSuppliers: Supplier[] = [];
    let totalProductsFound = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        try {
          console.log(`📸 [Google Vision OCR] Processing image ${i + 1}/${files.length}: ${file.name}`);
          
          // Call new Google Vision + GPT-4 OCR service
          const extractedData = await extractOrderFromImage(file);
          
          console.log(`📦 [ORDERS] Image ${i + 1} Google Vision OCR result:`, JSON.stringify(extractedData, null, 2));

          if (!extractedData.success || !extractedData.orderItems || extractedData.orderItems.length === 0) {
            console.warn(`⚠️ [ORDERS] No valid items extracted from image ${i + 1}`);
            continue;
          }

          const validItems = extractedData.orderItems.filter(item => 
            item && item.name && item.name.trim().length > 0
          );

          if (validItems.length === 0) {
            console.warn(`⚠️ [ORDERS] No valid items after filtering for image ${i + 1}`);
            continue;
          }

          console.log(`📦 [ORDERS] Processing ${validItems.length} valid items from image ${i + 1}`);
          
          // ========== POST-PROCESSING: CLEAN AND MATCH PRODUCT NAMES ==========
          console.log(`\n🔄 [POST-PROCESSING] Starting for image ${i + 1}...`);
          const processedItems = postProcessOCRProducts(
            validItems,
            [...products, ...temporaryOcrProducts, ...allNewProducts]
          );
          
          const stats = getPostProcessingStats(processedItems);
          console.log(`\n📊 [POST-PROCESSING STATS] Image ${i + 1}:`);
          console.log(`   Total: ${stats.total}`);
          console.log(`   Matched with DB: ${stats.matched}`);
          console.log(`   Cleaned: ${stats.cleaned}`);
          console.log(`   Unchanged: ${stats.unchanged}`);
          // ====================================================================

          totalProductsFound += processedItems.length;
          
          let imageSupplier: Supplier | null = null;
          
          // Handle supplier from Google Vision + GPT-4
          if (extractedData.supplier && extractedData.supplier.name) {
            const supplierName = extractedData.supplier.name;
            const supplierPhone = extractedData.supplier.phone;
            
            const matchResult = SupplierMatchingService.findMatchingSupplier(
              supplierName,
              [...suppliers, ...allNewSuppliers],
              supplierPhone
            );
            
            if (matchResult.supplier) {
              imageSupplier = matchResult.supplier;
              console.log(`✅ Image ${i + 1} (${file.name}): "${supplierName}" → "${matchResult.supplier.name}" (${matchResult.similarity.toFixed(1)}% - ${matchResult.matchType})`);
            } else {
              const newSupplier: Supplier = {
                id: generateUUID(),
                name: supplierName,
                phone: supplierPhone || '',
                email: '',
                address: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              
              allNewSuppliers.push(newSupplier);
              imageSupplier = newSupplier;
              
              console.log(`🆕 Image ${i + 1} (${file.name}): Created new supplier "${supplierName}"`);
            }
            
            // Update progress with supplier name
            updateOCRProgress({
              currentState: 'extracting',
              productsFound: totalProductsFound,
              supplierName: imageSupplier.name
            });
          }

          const defaultSupplierId = imageSupplier?.id || suppliers[0]?.id || 'unknown';

          // Process each order item (now using POST-PROCESSED names)
          for (const processedItem of processedItems) {
            let existingProduct = processedItem.matchedProduct;

            if (!existingProduct) {
              // Check if we already created this product in current batch
              existingProduct = allNewProducts.find(p => p.name === processedItem.name);
            }

            if (!existingProduct) {
              const productUnit = processedItem.unit || '';
              
              const newProduct: Product = {
                id: generateUUID(),
                name: processedItem.name, // Use POST-PROCESSED name
                category: 'other',
                supplier_id: defaultSupplierId,
                price: processedItem.price || 0,
                unit: productUnit,
                vatRate: processedItem.vatRate,
                price_history: [{ price: processedItem.price || 0, date: new Date().toISOString() }],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              
              allNewProducts.push(newProduct);
              existingProduct = newProduct;
            }

            // Parse quantity - support fractions
            const quantityValue = processedItem.quantity || 1;
            const quantityDisplay = typeof processedItem.quantity === 'string' 
              ? processedItem.quantity 
              : formatQuantityDisplay(quantityValue);

            allNewItems.push({
              product_id: existingProduct.id,
              quantity: typeof quantityValue === 'string' ? parseFraction(quantityValue) : quantityValue,
              price: processedItem.price || 0,
              editable_name: processedItem.name, // Use POST-PROCESSED name
              editable_unit: processedItem.unit || '',
              quantity_display: quantityDisplay
            });

            try {
              const supplierName = imageSupplier?.name || 'Unknown';
              await PriceHistoryService.trackPriceChange(
                existingProduct.id,
                existingProduct.name,
                supplierName,
                existingProduct.price,
                processedItem.price || 0,
                'ocr_upload'
              );
            } catch (error) {
              console.error('Error tracking price for OCR product:', error);
            }
          }
        } catch (error) {
          console.error(`❌ Error processing image ${i + 1}:`, error);
          toast.error(`${t('error')} ${i + 1}`);
        }
      }

      if (allNewSuppliers.length > 0) {
        setSuppliers((prev) => [...prev, ...allNewSuppliers]);
        await saveSuppliers([...suppliers, ...allNewSuppliers]);
      }

      if (allNewProducts.length > 0) {
        setTemporaryOcrProducts((prev) => [...prev, ...allNewProducts]);
      }

      if (allNewItems.length > 0) {
        // Update orderItems state
        const updatedItems = editingOrderId 
          ? [...editingOrderItems, ...allNewItems]
          : [...orderItems, ...allNewItems];
        
        if (editingOrderId) {
          setEditingOrderItems(updatedItems);
        } else {
          setOrderItems(updatedItems);
          
          // Open order creation dialog if not already open
          if (!isCreatingOrder) {
            setIsCreatingOrder(true);
          }
          
          // Auto-save draft after OCR extraction
          try {
            await saveDraftOrder(updatedItems, [...temporaryOcrProducts, ...allNewProducts]);
            setHasDraft(true);
            setDraftTimestamp(new Date().toISOString());
            console.log('✅ Auto-saved draft after OCR extraction');
          } catch (error) {
            console.error('Error auto-saving draft after OCR:', error);
          }
        }
      }

      // Update final loading state
      updateOCRProgress({
        currentState: 'completed',
        productsFound: totalProductsFound,
        supplierName: allNewSuppliers.length > 0 ? allNewSuppliers[0].name : ''
      });

      let message = `${t('success')} ${files.length} ${t('images')}\n`;
      message += `📦 ${totalProductsFound} ${t('products')}\n`;
      message += `➕ ${allNewItems.length} ${t('products')}`;
      
      if (allNewProducts.length > 0) {
        message += `\n🆕 ${allNewProducts.length} ${t('products')}`;
      }
      
      if (allNewSuppliers.length > 0) {
        message += `\n🏢 ${allNewSuppliers.length} ${t('suppliers')}`;
      }
      
      toast.success(message, { duration: 8000 });
    } catch (error) {
      console.error('❌ Error processing images:', error);
      toast.error(t('error'));
    } finally {
      // Reset loading state after a delay to show completion
      setTimeout(() => {
        resetOCRState();
      }, 2000);
      event.target.value = '';
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!searchTerm) return false;
    return p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
           (p.ean_code && p.ean_code.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const currentItems = editingOrderId ? editingOrderItems : orderItems;
  const groupedItems: GroupedItems = currentItems.reduce((acc, item) => {
    const product = allProductsForDisplay.find((p) => p.id === item.product_id);
    if (product) {
      const supplierId = product.supplier_id;
      if (!acc[supplierId]) {
        acc[supplierId] = [];
      }
      acc[supplierId].push(item);
    }
    return acc;
  }, {} as GroupedItems);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { 
        label: t('pending'), 
        className: 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white border-0 shadow-md',
        icon: Clock
      },
      confirmed: { 
        label: t('pending'), 
        className: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-md',
        icon: Clock
      },
      delivered: { 
        label: t('completed'), 
        className: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md',
        icon: CheckCircle
      },
      cancelled: { 
        label: t('cancelled'), 
        className: 'bg-gradient-to-r from-red-500 to-red-600 text-white border-0 shadow-md',
        icon: XCircle
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const canRecoverOrder = hasOrders || hasDraft;

  const getAvailableSuppliers = (currentSupplierId?: string) => {
    return suppliers.filter(s => s.id !== currentSupplierId);
  };

  return (
    <>
      {/* OCR Loading Dialog */}
      <Dialog open={loadingState.isOCRProcessing} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
              🔄 Analisi fattura in corso...
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {loadingState.supplierName && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  🏢
                </div>
                <div className="flex-1">
                  <p className="text-xs text-blue-600 font-medium">Fornitore rilevato</p>
                  <p className="text-sm font-bold text-blue-900">{loadingState.supplierName}</p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                📦
              </div>
              <div className="flex-1">
                <p className="text-xs text-green-600 font-medium">Prodotti estratti</p>
                <p className="text-2xl font-bold text-green-900">{loadingState.productsFound}</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Elaborazione in corso...</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-xl w-full max-w-full overflow-hidden">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-xl sm:text-2xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            {t('orders')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {!isCreatingOrder ? (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button 
                  onClick={handleStartNewOrder}
                  className="flex-1 sm:flex-none bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg h-12 sm:h-14 text-base sm:text-lg font-semibold min-h-[44px]"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  {t('createNewOrder')}
                </Button>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="relative flex-1 sm:flex-none">
                        <Button 
                          onClick={handleRecoverLastOrder}
                          disabled={!canRecoverOrder}
                          variant="outline"
                          className={`w-full border-2 h-12 sm:h-14 px-3 sm:px-4 text-base sm:text-lg font-semibold min-h-[44px] ${
                            canRecoverOrder
                              ? 'border-blue-600 text-blue-600 hover:bg-blue-50' 
                              : 'border-gray-300 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {hasDraft && (
                            <span className="absolute -top-1 -right-1 h-3 w-3 bg-blue-500 rounded-full animate-pulse" />
                          )}
                          <RotateCcw className="h-5 w-5 sm:mr-2" />
                          <span className="hidden sm:inline">📋 {t('recoverLastOrder')}</span>
                          <span className="sm:hidden">{t('recover')}</span>
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!canRecoverOrder && (
                      <TooltipContent>
                        <p className="text-sm">{t('noOrderOrDraftAvailable')}</p>
                      </TooltipContent>
                    )}
                    {hasDraft && (
                      <TooltipContent>
                        <p className="text-sm">{t('draftAvailable')} • {draftTimestamp ? new Date(draftTimestamp).toLocaleString() : t('recent')}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>

              {orders.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200">
                  <Button
                    onClick={handleSendAllWhatsApp}
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg min-h-[44px] text-sm sm:text-base"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    📱 {t('send')} WhatsApp
                  </Button>
                  <Button
                    onClick={handleSendAllEmail}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg min-h-[44px] text-sm sm:text-base"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    ✉️ {t('send')} {t('email')}
                  </Button>
                  <Button
                    onClick={handleExportAllOrdersPDF}
                    variant="outline"
                    className="flex-1 sm:flex-none border-2 border-purple-500 text-purple-600 hover:bg-purple-50 min-h-[44px] text-sm sm:text-base"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">{t('exportPDF')}</span>
                    <span className="sm:hidden">PDF</span>
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders.map((order) => {
                  const supplier = suppliers.find((s) => s.id === order.supplier_id);
                  const orderImages = orderImagesMap[order.id] || [];
                  const canChangeStatus = order.status === 'pending' || order.status === 'confirmed';
                  const displaySupplierName = order.custom_supplier_name || supplier?.name || t('supplier');
                  
                  return (
                    <div 
                      key={order.id} 
                      className="group relative p-5 border-2 border-slate-200 rounded-2xl hover:border-purple-400 bg-white hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg text-slate-800 truncate mb-2">
                            {displaySupplierName}
                          </h3>
                          {getStatusBadge(order.status)}
                        </div>
                      
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canChangeStatus && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStatusChange(order.id, 'delivered')}
                                className="hover:bg-green-100 hover:text-green-600 h-8 w-8 p-0"
                                title={t('completed')}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStatusChange(order.id, 'cancelled')}
                                className="hover:bg-red-100 hover:text-red-600 h-8 w-8 p-0"
                                title={t('cancelled')}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEditOrder(order)}
                            className="hover:bg-blue-100 hover:text-blue-600 h-8 w-8 p-0"
                            title={t('edit')}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteOrderConfirm(order.id)}
                            className="hover:bg-red-100 hover:text-red-600 h-8 w-8 p-0"
                            title={t('delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(order.order_date).toLocaleDateString()}</span>
                      </div>

                      <Separator className="my-4" />

                      <div className="space-y-2 mb-4">
                        {order.items.slice(0, 3).map((item, index) => {
                          const product = products.find((p) => p.id === item.product_id);
                          const unit = item.custom_unit || product?.unit;
                          const unitDisplay = unit ? ` ${unit}` : '';
                          const displayName = item.custom_product_name || product?.name || t('productName');
                          
                          return (
                            <div key={index} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-lg">
                              <span className="text-slate-700 truncate pr-2 flex-1">
                                {formatQuantityDisplay(item.quantity)}{unitDisplay} - {displayName}
                              </span>
                            </div>
                          );
                        })}
                        {order.items.length > 3 && (
                          <p className="text-xs text-slate-500 text-center">
                            +{order.items.length - 3} {t('moreProducts')}
                          </p>
                        )}
                      </div>

                      {orderImages.length > 0 && (
                        <div className="mb-4">
                          <Label className="text-xs text-slate-600 mb-2 block">
                            <ImageIcon className="h-3 w-3 inline mr-1" />
                            {orderImages.length} {t('images')}
                          </Label>
                          <div className="grid grid-cols-4 gap-2">
                            {orderImages.slice(0, 4).map((img) => (
                              <div 
                                key={img.id}
                                className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all group/img"
                                onClick={() => {
                                  setSelectedImageForView(img.image_url);
                                  setShowImageDialog(true);
                                }}
                              >
                                <img 
                                  src={img.image_url} 
                                  alt={img.image_name}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                  <ZoomIn className="h-5 w-5 text-white" />
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteImage(order.id, img.id, img.image_url);
                                  }}
                                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-red-600"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mb-4">
                        <label htmlFor={`upload-${order.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            disabled={uploadingImages[order.id]}
                            className="w-full border-dashed border-2 hover:border-purple-400 hover:bg-purple-50 min-h-[44px]"
                          >
                            <span>
                              <Upload className="h-4 w-4 mr-2" />
                              {uploadingImages[order.id] ? t('loading') : t('uploadImages')}
                              <input
                                id={`upload-${order.id}`}
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleImageUpload(order.id, e.target.files)}
                                disabled={uploadingImages[order.id]}
                              />
                            </span>
                          </Button>
                        </label>
                      </div>

                      <Separator className="my-4" />

                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendWhatsAppSavedOrder(order)}
                            className="flex-1 border-green-500 text-green-600 hover:bg-green-50 min-h-[44px]"
                          >
                            <MessageCircle className="h-4 w-4 mr-1" />
                            <span className="text-xs">WhatsApp</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendEmailSavedOrder(order)}
                            className="flex-1 border-blue-500 text-blue-600 hover:bg-blue-50 min-h-[44px]"
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            <span className="text-xs">{t('email')}</span>
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportOrderPDF(order)}
                          className="w-full border-purple-500 text-purple-600 hover:bg-purple-50 min-h-[44px]"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {t('exportPDF')}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {orders.length === 0 && (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 mb-4">
                    <FileDown className="h-10 w-10 text-purple-600" />
                  </div>
                  <p className="text-slate-600 text-lg mb-2">{t('addFirstOrder')}</p>
                  <p className="text-slate-500 text-sm">{t('savePDF')}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {currentItems.length > 0 && (
                <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 rounded-xl shadow-sm">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-yellow-900">
                      {editingOrderId ? t('editingOrder') : t('orderSavedAsDraft')}
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      {currentItems.length} {t('products')} • {Object.keys(groupedItems).length} {t('suppliers')}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3 p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200 shadow-lg">
                <h3 className="text-lg font-bold text-purple-900 mb-4">🔍 {t('addProduct')}</h3>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-purple-400" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder={t('searchProducts')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-12 border-2 border-purple-300 focus:border-purple-500 rounded-xl bg-white shadow-sm"
                  />
                </div>

                {filteredProducts.length === 0 && searchTerm.trim() !== '' && (
                  <Button
                    variant="outline"
                    className="w-full justify-start mb-2 border-dashed border-2 border-blue-400 hover:bg-blue-50 h-12 text-left min-h-[44px]"
                    onClick={() => {
                      setTempProductDialogName(searchTerm);
                      setTempProductQuantity(1);
                      setTempProductUnit('');
                      setTempProductPrice('');
                      setTempProductSupplierId('');
                      setShowTempProductDialog(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Aggiungi "{searchTerm}" come prodotto temporaneo
                  </Button>
                )}
                {filteredProducts.length > 0 && (
                  <ScrollArea className="h-48 border-2 border-purple-200 rounded-xl p-2 bg-white shadow-inner">
                    {filteredProducts.map((product) => (
                      <Button
                        key={product.id}
                        variant="ghost"
                        className="w-full justify-start mb-1 hover:bg-purple-100 rounded-lg transition-all"
                        onClick={() => handleSelectProduct(product)}
                      >
                        {product.name}
                      </Button>
                    ))}
                  </ScrollArea>
                )}

                {selectedProduct && (
                  <div className="p-4 bg-white border-2 border-blue-300 rounded-xl shadow-md">
                    <p className="font-semibold text-blue-900 mb-3">{selectedProduct.name}</p>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value))}
                        className="w-24 border-2 border-blue-300"
                      />
                      <Button onClick={handleAddProduct} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md">
                        <Plus className="h-4 w-4 mr-2" />
                        {t('add')}
                      </Button>
                    </div>
                  </div>
                )}

                {/* OCR UPLOAD BUTTON — TEMPORARILY HIDDEN. To re-enable, uncomment this block.
                <label htmlFor="ocr-upload">
                  <Button variant="outline" size="sm" asChild disabled={isProcessing}
                    className="w-full border-2 border-dashed border-purple-400 hover:border-purple-600 hover:bg-purple-100 h-12 shadow-sm">
                    <span>
                      <Upload className="h-5 w-5 mr-2" />
                      {isProcessing ? t('processingInProgress') : '📄 ' + t('uploadOrder')}
                      <input id="ocr-upload" type="file" className="hidden" accept="image/*" multiple
                        onChange={handleImageUploadOCR} disabled={isProcessing} />
                    </span>
                  </Button>
                </label>
                END OCR UPLOAD BUTTON */}

              </div>

              {currentItems.length > 0 && Object.keys(groupedItems).length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200 shadow-lg">
                  <Button
                    onClick={handleSendAllWhatsAppDraft}
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg min-h-[44px] text-sm sm:text-base"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    📱 {t('send')} WhatsApp
                  </Button>
                  <Button
                    onClick={handleSendAllEmailDraft}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg min-h-[44px] text-sm sm:text-base"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    ✉️ {t('send')} {t('email')}
                  </Button>
                </div>
              )}

              <div className="space-y-4">
                {Object.entries(groupedItems).map(([supplierId, items]) => {
                  const supplier = suppliers.find((s) => s.id === supplierId);
                  const supplierName = supplier?.name || t('supplier');
                  const supplierPhone = supplier?.phone || '';
                  const supplierMobile = supplier?.mobile || '';
                  const supplierEmail = supplier?.email || '';
                  
                  return (
                    <div 
                      key={supplierId} 
                      className="p-6 bg-gradient-to-br from-white to-slate-50 border-2 border-slate-300 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-slate-200">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            {editingSupplierField === 'name' && editingSupplierId === supplierId ? (
                              <div className="flex items-center gap-2 flex-1">
                                <Input
                                  value={tempSupplierFieldValue}
                                  onChange={(e) => setTempSupplierFieldValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveSupplierField();
                                    if (e.key === 'Escape') handleCancelEditSupplierField();
                                  }}
                                  className="h-8 text-base font-bold"
                                  autoFocus
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleSaveSupplierField}
                                  className="h-7 w-7 p-0 hover:bg-green-100 hover:text-green-600"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleCancelEditSupplierField}
                                  className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-600"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <h3 className="font-bold text-xl text-slate-900">{supplierName}</h3>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStartEditSupplierField(supplierId, 'name')}
                                  className="h-7 w-7 p-0 hover:bg-blue-100 hover:text-blue-600 rounded-full"
                                  title={t('edit')}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Phone className="h-3 w-3 flex-shrink-0" />
                              {editingSupplierField === 'phone' && editingSupplierId === supplierId ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <Input
                                    value={tempSupplierFieldValue}
                                    onChange={(e) => setTempSupplierFieldValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveSupplierField();
                                      if (e.key === 'Escape') handleCancelEditSupplierField();
                                    }}
                                    placeholder={t('phone')}
                                    className="h-7 text-sm"
                                    autoFocus
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSaveSupplierField}
                                    className="h-6 w-6 p-0 hover:bg-green-100 hover:text-green-600"
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEditSupplierField}
                                    className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <span className="flex-1">{supplierPhone || t('unavailable')}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleStartEditSupplierField(supplierId, 'phone')}
                                    className="h-6 w-6 p-0 hover:bg-blue-100 hover:text-blue-600 rounded-full"
                                    title={t('edit')}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Phone className="h-3 w-3 flex-shrink-0" />
                              {editingSupplierField === 'mobile' && editingSupplierId === supplierId ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <Input
                                    value={tempSupplierFieldValue}
                                    onChange={(e) => setTempSupplierFieldValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveSupplierField();
                                      if (e.key === 'Escape') handleCancelEditSupplierField();
                                    }}
                                    placeholder={t('mobile')}
                                    className="h-7 text-sm"
                                    autoFocus
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSaveSupplierField}
                                    className="h-6 w-6 p-0 hover:bg-green-100 hover:text-green-600"
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEditSupplierField}
                                    className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <span className="flex-1">{supplierMobile || t('unavailable')}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleStartEditSupplierField(supplierId, 'mobile')}
                                    className="h-6 w-6 p-0 hover:bg-blue-100 hover:text-blue-600 rounded-full"
                                    title={t('edit')}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Mail className="h-3 w-3 flex-shrink-0" />
                              {editingSupplierField === 'email' && editingSupplierId === supplierId ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <Input
                                    type="email"
                                    value={tempSupplierFieldValue}
                                    onChange={(e) => setTempSupplierFieldValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveSupplierField();
                                      if (e.key === 'Escape') handleCancelEditSupplierField();
                                    }}
                                    placeholder={t('email')}
                                    className="h-7 text-sm"
                                    autoFocus
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSaveSupplierField}
                                    className="h-6 w-6 p-0 hover:bg-green-100 hover:text-green-600"
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEditSupplierField}
                                    className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <span className="flex-1">{supplierEmail || t('unavailable')}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleStartEditSupplierField(supplierId, 'email')}
                                    className="h-6 w-6 p-0 hover:bg-blue-100 hover:text-blue-600 rounded-full"
                                    title={t('edit')}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 ml-4 flex-col">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendWhatsAppForSupplier(supplierId)}
                              disabled={!supplierMobile}
                              title={!supplierMobile ? 'Numero cellulare non disponibile' : 'Invia via WhatsApp'}
                              className="border-2 border-green-500 text-green-600 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm min-h-[44px]"
                            >
                              <MessageCircle className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">WhatsApp</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendEmailForSupplier(supplierId)}
                              disabled={!supplierEmail}
                              className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm min-h-[44px]"
                            >
                              <Mail className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">{t('email')}</span>
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSupplierAction(supplierId)}
                            className="border-2 border-red-500 text-red-600 hover:bg-red-50 shadow-sm min-h-[44px]"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            <span className="text-xs">{t('deleteOrder')}</span>
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {items.map((item, index) => {
                          const product = allProductsForDisplay.find((p) => p.id === item.product_id);
                          const globalIndex = currentItems.findIndex(i => i.product_id === item.product_id);
                          
                          return (
                            <div key={index} className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 hover:border-purple-300 transition-all shadow-sm">
                              <div className="flex-1 flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-800">{item.editable_name}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenProductEditInForm(globalIndex)}
                                    className="h-6 w-6 p-0 hover:bg-blue-100 hover:text-blue-600 rounded-full"
                                    title={t('edit')}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                  <button
                                    onClick={() => handleOpenQuantityEdit(globalIndex)}
                                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                                  >
                                    <span className="font-semibold">{item.quantity_display}</span>
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  {item.editable_unit && (
                                    <>
                                      <span>•</span>
                                      <button
                                        onClick={() => handleOpenUnitEdit(globalIndex)}
                                        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                                      >
                                        <Package className="h-3 w-3" />
                                        <span>{item.editable_unit}</span>
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                    </>
                                  )}
                                  {!item.editable_unit && (
                                    <button
                                      onClick={() => handleOpenUnitEdit(globalIndex)}
                                      className="flex items-center gap-1 text-slate-400 hover:text-blue-600 transition-colors"
                                    >
                                      <Package className="h-3 w-3" />
                                      <span className="italic">{t('add')} {t('unit')}</span>
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateQuantity(globalIndex, -1, !!editingOrderId)}
                                  className="h-8 w-8 p-0 hover:bg-slate-100 rounded-full"
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateQuantity(globalIndex, 1, !!editingOrderId)}
                                  className="h-8 w-8 p-0 hover:bg-slate-100 rounded-full"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveItem(globalIndex, !!editingOrderId)}
                                  className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 rounded-full ml-2"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 flex-wrap p-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border-2 border-slate-300 shadow-lg sticky bottom-4">
                <Button
                  onClick={editingOrderId ? handleSaveEditedOrder : handleSavePDF}
                  disabled={currentItems.length === 0}
                  className="flex-1 sm:flex-none bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md h-12 font-semibold min-h-[44px]"
                >
                  <Check className="h-5 w-5 mr-2" />
                  {editingOrderId ? t('saveChanges') : '💾 ' + t('savePDF')}
                </Button>
                
                {!editingOrderId && (
                  <Button
                    onClick={handleSaveDraft}
                    disabled={currentItems.length === 0}
                    variant="outline"
                    className="flex-1 sm:flex-none border-2 border-blue-500 text-blue-600 hover:bg-blue-50 shadow-md h-12 font-semibold min-h-[44px]"
                  >
                    <Save className="h-5 w-5 mr-2" />
                    📝 {t('orderSavedAsDraft')}
                  </Button>
                )}
                
                <Button
                  onClick={handleCancelOrder}
                  variant="outline"
                  className="flex-1 sm:flex-none border-2 border-red-500 text-red-600 hover:bg-red-50 shadow-md h-12 font-semibold min-h-[44px]"
                >
                  <X className="h-5 w-5 mr-2" />
                  ❌ {t('cancel')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmDelete')}</DialogTitle>
            <DialogDescription>
              {t('deleteOrder') + ' ' + t('confirmation')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteOrder}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Action Dialog (Delete or Move) */}
      <Dialog open={showProductActionDialog} onOpenChange={setShowProductActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete')} / {t('transferProduct')}?</DialogTitle>
            <DialogDescription>
              {t('selectSupplier')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button 
              variant="destructive" 
              onClick={handleConfirmDeleteProduct}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              🗑️ {t('delete') + ' ' + t('product')}
            </Button>
            
            <div className="space-y-2">
              <Label>{t('selectSupplier')}:</Label>
              <Select value={selectedTargetSupplier} onValueChange={setSelectedTargetSupplier}>
                <SelectTrigger>
                  <SelectValue placeholder={`↔️ ${t('selectSupplier')}`} />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableSuppliers(productToAction?.item.product_id ? allProductsForDisplay.find(p => p.id === productToAction.item.product_id)?.supplier_id : undefined).map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleMoveProduct}
                disabled={!selectedTargetSupplier}
                className="w-full"
              >
                <MoveRight className="h-4 w-4 mr-2" />
                {t('transferProduct')}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProductActionDialog(false)}>
              ✗ {t('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Action Dialog (Delete All or Move All) */}
      <Dialog open={showSupplierActionDialog} onOpenChange={setShowSupplierActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete')} / {t('edit')} {t('order')} {t('supplier')}?</DialogTitle>
            <DialogDescription>
              {t('selectSupplier')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button 
              variant="destructive" 
              onClick={handleConfirmDeleteSupplier}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              🗑️ {t('delete')} {t('order')}
            </Button>
            
            <div className="space-y-2">
              <Label>{t('selectSupplier')}:</Label>
              <Select value={selectedSupplierTarget} onValueChange={setSelectedSupplierTarget}>
                <SelectTrigger>
                  <SelectValue placeholder={`↔️ ${t('selectSupplier')}`} />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableSuppliers(supplierToAction || undefined).map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleMoveAllProducts}
                disabled={!selectedSupplierTarget}
                className="w-full"
              >
                <MoveRight className="h-4 w-4 mr-2" />
                {t('edit')} {t('products')}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSupplierActionDialog(false)}>
              ✗ {t('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Name Edit Dialog */}
      <Dialog open={editingProductInForm !== null} onOpenChange={(open) => !open && setEditingProductInForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('edit')} {t('productName')}</DialogTitle>
            <DialogDescription>
              {t('edit')} {t('productName')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product-name-edit">{t('productName')}</Label>
              <Input
                id="product-name-edit"
                value={tempProductName}
                onChange={(e) => setTempProductName(e.target.value)}
                placeholder={t('productName')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveProductNameInForm();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProductInForm(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveProductNameInForm}>
              <Save className="h-4 w-4 mr-2" />
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quantity Edit Dialog */}
      <Dialog open={editingQuantityIndex !== null} onOpenChange={(open) => !open && setEditingQuantityIndex(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('edit')} {t('quantity')}</DialogTitle>
            <DialogDescription>
              {t('quantity')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quantity-edit">{t('quantity')}</Label>
              <Input
                id="quantity-edit"
                value={tempQuantityValue}
                onChange={(e) => setTempQuantityValue(e.target.value)}
                placeholder="1/2, 1.5, 2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveQuantityEdit();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>{t('quantity')}:</Label>
              <div className="grid grid-cols-4 gap-2">
                {['1/8', '1/4', '1/3', '1/2', '2/3', '3/4', '7/8', '1'].map(frac => (
                  <Button
                    key={frac}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickSetQuantity(frac)}
                    className="text-xs"
                  >
                    {frac}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingQuantityIndex(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveQuantityEdit}>
              <Save className="h-4 w-4 mr-2" />
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unit Edit Dialog */}
      <Dialog open={editingUnitIndex !== null} onOpenChange={(open) => !open && setEditingUnitIndex(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('edit')} {t('unit')}</DialogTitle>
            <DialogDescription>
              {t('unit')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="unit-edit">{t('unit')}</Label>
              <Input
                id="unit-edit"
                value={tempUnitValue}
                onChange={(e) => setTempUnitValue(e.target.value)}
                placeholder="kg, pz, l"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveUnitEdit();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>{t('unit')}:</Label>
              <div className="grid grid-cols-3 gap-2">
                {['pz', 'kg', 'g', 'l', 'ml', 'box'].map(unit => (
                  <Button
                    key={unit}
                    variant="outline"
                    size="sm"
                    onClick={() => setTempUnitValue(unit)}
                    className="text-xs"
                  >
                    {unit}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUnitIndex(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveUnitEdit}>
              <Save className="h-4 w-4 mr-2" />
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image View Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('imagePreview')}</DialogTitle>
          </DialogHeader>
          {selectedImageForView && (
            <div className="relative w-full">
              <img 
                src={selectedImageForView} 
                alt="Preview"
                className="w-full h-auto rounded-lg"
              />
            </div>
          )}
        </DialogContent>

      {/* Temporary Product Dialog */}
      <Dialog open={showTempProductDialog} onOpenChange={setShowTempProductDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Aggiungi Prodotto Temporaneo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome Prodotto *</label>
              <Input
                value={tempProductDialogName}
                onChange={(e) => setTempProductDialogName(e.target.value)}
                placeholder="Nome del prodotto"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Fornitore *</label>
              <select
                value={tempProductSupplierId}
                onChange={(e) => setTempProductSupplierId(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Seleziona fornitore</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantità</label>
                <Input
                  type="number"
                  min="1"
                  value={tempProductQuantity}
                  onChange={(e) => setTempProductQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Unità</label>
                <Input
                  value={tempProductUnit}
                  onChange={(e) => setTempProductUnit(e.target.value)}
                  placeholder="es. kg, pz, lt"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Prezzo (€)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={tempProductPrice}
                onChange={(e) => setTempProductPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowTempProductDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleAddTemporaryProduct}>
              Aggiungi all'Ordine
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      </Dialog>
    </>
  );
}
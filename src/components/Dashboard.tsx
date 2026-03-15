import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Users, ShoppingCart, Bell, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { Product, Supplier, Order, Invoice, Settings } from '@/types';
import type { PriceAlert } from '@/lib/priceAlertService';
import { useLanguage } from '@/lib/i18n';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/currency';

interface DashboardProps {
  products: Product[];
  suppliers: Supplier[];
  orders: Order[];
  invoices: Invoice[];
  priceAlerts: PriceAlert[];
  priceAlertsCount?: number;
  settings: Settings;
  onSectionChange?: (section: string) => void;
  onClearAlerts?: () => void;
}

export default function Dashboard({ products, suppliers, orders, priceAlerts, priceAlertsCount = 0, settings, onSectionChange, onClearAlerts }: DashboardProps) {
  const { t } = useLanguage();
  const currency = settings.defaultCurrency || 'EUR';
  
  // Calculate totals with null/undefined checks
  const totalProductsValue = products.reduce((sum, p) => sum + (p.price || 0), 0);
  const totalOrdersValue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  // Get top suppliers by product count
  const topSuppliers = suppliers
    .map(supplier => ({
      ...supplier,
      productCount: products.filter(p => p.supplierId === supplier.id || p.supplier_id === supplier.id).length
    }))
    .filter(s => s.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 5);

  // Price comparison logic - group products by name and compare prices across suppliers
  const priceComparisons = (() => {
    const productsByName: { [key: string]: Array<{ product: Product; supplier: Supplier }> } = {};
    
    products.forEach(product => {
      // Skip products without valid prices or names
      if (!product.price || product.price <= 0 || !product.name) return;
      
      const supplier = suppliers.find(s => s.id === product.supplierId || s.id === product.supplier_id);
      if (supplier) {
        const normalizedName = product.name.toLowerCase().trim();
        if (!productsByName[normalizedName]) {
          productsByName[normalizedName] = [];
        }
        productsByName[normalizedName].push({ product, supplier });
      }
    });

    // Filter products that have multiple suppliers
    return Object.entries(productsByName)
      .filter(([_, items]) => items.length > 1)
      .map(([name, items]) => {
        const prices = items.map(item => item.product.price).filter(p => p && p > 0);
        const minPrice = Math.min(...prices);
        
        return {
          name: items[0].product.name,
          suppliers: items.map(item => ({
            name: item.supplier.name,
            price: item.product.price || 0,
            isLowest: item.product.price === minPrice,
            diff: minPrice > 0 ? Math.round(((item.product.price - minPrice) / minPrice) * 100) : 0
          }))
        };
      })
      .slice(0, 5); // Show top 5 products with multiple suppliers
  })();

  const handleNotificationClick = () => {
    // Clear notifications
    if (onClearAlerts) {
      onClearAlerts();
      toast.success('✅ ' + t('priceAlerts'), {
        description: t('noAlerts')
      });
    }
  };

  // Derive the effective count from the alerts array if priceAlertsCount is 0 but alerts exist
  const effectiveAlertsCount = priceAlertsCount > 0 ? priceAlertsCount : priceAlerts.length;

  return (
    <div className="space-y-6">
      {/* Stats Grid - EXTRA SMALL on mobile, normal on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Prodotti Card - BLUE - CLICKABLE */}
        <div 
          onClick={() => onSectionChange?.('products')}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-3 md:p-6 shadow-2xl hover:shadow-3xl transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="flex items-start justify-between">
            <div className="text-white">
              <p className="text-xs md:text-base font-medium opacity-90 mb-1">{t('products')}</p>
              <p className="text-3xl md:text-5xl font-bold mb-1">{products.length}</p>
              <p className="text-xs opacity-80">{formatPrice(totalProductsValue, currency)}</p>
            </div>
            <div className="w-12 h-12 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
              <Package className="h-6 w-6 md:h-10 md:w-10 text-white" />
            </div>
          </div>
        </div>

        {/* Fornitori Card - PURPLE - CLICKABLE */}
        <div 
          onClick={() => onSectionChange?.('suppliers')}
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-3 md:p-6 shadow-2xl hover:shadow-3xl transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="flex items-start justify-between">
            <div className="text-white">
              <p className="text-xs md:text-base font-medium opacity-90 mb-1">{t('suppliers')}</p>
              <p className="text-3xl md:text-5xl font-bold mb-1">{suppliers.length}</p>
              <p className="text-xs opacity-80">{t('suppliers')}</p>
            </div>
            <div className="w-12 h-12 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
              <Users className="h-6 w-6 md:h-10 md:w-10 text-white" />
            </div>
          </div>
        </div>

        {/* Ordini Card - PINK - CLICKABLE */}
        <div 
          onClick={() => onSectionChange?.('orders')}
          className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl p-3 md:p-6 shadow-2xl hover:shadow-3xl transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="flex items-start justify-between">
            <div className="text-white">
              <p className="text-xs md:text-base font-medium opacity-90 mb-1">{t('orders')}</p>
              <p className="text-3xl md:text-5xl font-bold mb-1">{orders.length}</p>
              <p className="text-xs opacity-80">{t('totalAmount')}: {formatPrice(totalOrdersValue, currency)}</p>
            </div>
            <div className="w-12 h-12 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
              <ShoppingCart className="h-6 w-6 md:h-10 md:w-10 text-white" />
            </div>
          </div>
        </div>

        {/* Notifiche Card - ORANGE - CLICKABLE - Clear on click */}
        <div 
          onClick={handleNotificationClick}
          className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-3 md:p-6 shadow-2xl hover:shadow-3xl transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="flex items-start justify-between">
            <div className="text-white">
              <p className="text-xs md:text-base font-medium opacity-90 mb-1">{t('notifications')}</p>
              <p className="text-3xl md:text-5xl font-bold mb-1">{effectiveAlertsCount}</p>
              <p className="text-xs opacity-80">{t('priceAlerts')}</p>
            </div>
            <div className="w-12 h-12 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
              <Bell className="h-6 w-6 md:h-10 md:w-10 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Additional Sections Grid - 2 columns on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fornitori Principali */}
        <Card className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-lg">
          <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-600" />
            {t('mainSuppliers')}
          </h3>
          <div className="space-y-3">
            {topSuppliers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">{t('noSuppliers')}</p>
              </div>
            ) : (
              topSuppliers.map((supplier, index) => (
                <div key={supplier.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <span className="font-semibold text-gray-800">{supplier.name}</span>
                  </div>
                  <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">
                    {supplier.productCount} {t('products').toLowerCase()}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Avvisi Prezzi Dettagliati */}
        <Card className="bg-white rounded-xl border-2 border-orange-200 p-6 shadow-lg">
          <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Bell className="h-6 w-6 text-orange-600" />
            {t('priceAlerts')}
          </h3>
          <div className="space-y-3">
            {priceAlerts.length === 0 && effectiveAlertsCount === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">{t('noAlerts')}</p>
              </div>
            ) : priceAlerts.length > 0 ? (
              /* Show detailed alerts when we have them */
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {priceAlerts.map((alert, index) => {
                  const isIncrease = alert.changePercent > 0;
                  return (
                    <div
                      key={`${alert.productName}-${index}`}
                      className={`p-3 rounded-lg border transition-colors ${
                        isIncrease
                          ? 'bg-red-50 border-red-200 hover:bg-red-100'
                          : 'bg-green-50 border-green-200 hover:bg-green-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-800 truncate">
                            {alert.productName}
                          </p>
                          {alert.supplierName && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {alert.supplierName}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isIncrease ? (
                            <ArrowUp className="h-4 w-4 text-red-600" />
                          ) : (
                            <ArrowDown className="h-4 w-4 text-green-600" />
                          )}
                          <span
                            className={`text-sm font-bold ${
                              isIncrease ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {isIncrease ? '+' : ''}
                            {(Number(alert.changePercent) || 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-xs">
                        <span className="text-gray-500 line-through">
                          {formatPrice(alert.oldPrice, currency)}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span
                          className={`font-semibold ${
                            isIncrease ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {formatPrice(alert.newPrice, currency)}
                        </span>
                        {alert.source === 'product_history' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-auto border-orange-300 text-orange-600">
                            Manual
                          </Badge>
                        )}
                        {alert.source === 'invoice' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-auto border-blue-300 text-blue-600">
                            Invoice
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Fallback: we have a count but no detailed alerts (invoice-only count) */
              <div className="text-center py-8">
                <Bell className="h-12 w-12 text-orange-500 mx-auto mb-3" />
                <p className="text-2xl font-bold text-orange-600 mb-2">{effectiveAlertsCount}</p>
                <p className="text-gray-600">{t('priceAlerts')}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {t('priceAlertsDescription') || 'Prodotti con variazioni di prezzo rispetto all\'ultima fattura'}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Comparazione Prezzi tra Fornitori - FULL WIDTH BELOW */}
      {priceComparisons.length > 0 && (
        <Card className="bg-white rounded-xl border-2 border-blue-200 p-6 shadow-lg">
          <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            {t('priceComparison.priceComparison')}
          </h3>
          <div className="space-y-6">
            {priceComparisons.map((comparison, idx) => (
              <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-bold text-lg text-gray-800 mb-3">{comparison.name}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left p-2 font-semibold text-gray-700">{t('supplier')}</th>
                        <th className="text-right p-2 font-semibold text-gray-700">{t('price')}</th>
                        <th className="text-right p-2 font-semibold text-gray-700">{t('priceComparison.minDifference')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.suppliers.map((s, sidx) => (
                        <tr key={sidx} className={`border-b border-gray-200 ${s.isLowest ? 'bg-green-100' : ''}`}>
                          <td className="p-2 text-gray-800">
                            {s.name}
                            {s.isLowest && <Badge className="ml-2 bg-green-600 text-white text-xs">{t('priceComparison.bestPrice')}</Badge>}
                          </td>
                          <td className="text-right p-2 font-semibold text-gray-800">{formatPrice(s.price || 0, currency)}</td>
                          <td className="text-right p-2">
                            {s.diff === 0 ? (
                              <span className="text-green-600 font-semibold">-</span>
                            ) : (
                              <span className="text-red-600 font-semibold">+{s.diff}%</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
import { Card } from '@/components/ui/card';
import { Package, Users, ShoppingCart, TrendingUp, Bell } from 'lucide-react';
import type { Product, Supplier, Order, Invoice } from '@/types';
import { calculateInvoiceStats } from '@/lib/invoiceStats';
import { useTranslations, type Language } from '@/lib/i18n';

interface DashboardProps {
  products: Product[];
  suppliers: Supplier[];
  orders: Order[];
  invoices: Invoice[];
  priceAlerts: Array<{ product: Product; oldPrice: number; newPrice: number; changePercent: number }>;
  language?: Language;
}

export default function Dashboard({ products, suppliers, orders, invoices, priceAlerts, language = 'it' }: DashboardProps) {
  const stats = calculateInvoiceStats(invoices);
  const t = useTranslations(language);
  
  // Get top suppliers by product count
  const topSuppliers = suppliers
    .map(supplier => ({
      ...supplier,
      productCount: products.filter(p => p.supplierId === supplier.id || p.supplier_id === supplier.id).length
    }))
    .filter(s => s.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Prodotti Card */}
        <Card className="p-6 bg-white border-none shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t.products}</p>
              <p className="text-4xl font-bold text-blue-600">{products.length}</p>
              <p className="text-xs text-gray-500 mt-1">{t.price}: €{products.reduce((sum, p) => sum + p.price, 0).toFixed(2)}</p>
            </div>
            <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Package className="h-8 w-8 text-white" />
            </div>
          </div>
        </Card>

        {/* Fornitori Card */}
        <Card className="p-6 bg-white border-none shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t.suppliers}</p>
              <p className="text-4xl font-bold text-purple-600">{suppliers.length}</p>
              <p className="text-xs text-gray-500 mt-1">{t.suppliers}</p>
            </div>
            <div className="w-16 h-16 bg-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Users className="h-8 w-8 text-white" />
            </div>
          </div>
        </Card>

        {/* Ordini Card */}
        <Card className="p-6 bg-white border-none shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t.orders}</p>
              <p className="text-4xl font-bold text-pink-600">{orders.length}</p>
              <p className="text-xs text-gray-500 mt-1">{t.totalAmount}: €{orders.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2)}</p>
            </div>
            <div className="w-16 h-16 bg-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
              <ShoppingCart className="h-8 w-8 text-white" />
            </div>
          </div>
        </Card>

        {/* Avvisi Prezzi Card */}
        <Card className="p-6 bg-white border-none shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t.priceAlerts}</p>
              <p className="text-4xl font-bold text-orange-600">{priceAlerts.length}</p>
              <p className="text-xs text-gray-500 mt-1">{t.days} 30</p>
            </div>
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <TrendingUp className="h-8 w-8 text-white" />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fornitori Principali */}
        <Card className="p-6 bg-white border-none shadow-lg">
          <h3 className="text-xl font-bold text-purple-600 mb-4">{t.mainSuppliers}</h3>
          <div className="space-y-3">
            {topSuppliers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">{t.noSuppliers}</p>
              </div>
            ) : (
              topSuppliers.map((supplier, index) => (
                <div key={supplier.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{supplier.name}</p>
                    <p className="text-sm text-gray-600">{supplier.productCount} {(t.products || 'products').toLowerCase()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Avvisi Prezzi */}
        <Card className="p-6 bg-white border-none shadow-lg">
          <h3 className="text-xl font-bold text-orange-600 mb-4">{t.priceAlerts30Days}</h3>
          <div className="space-y-3">
            {priceAlerts.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">{t.noAlerts}</p>
              </div>
            ) : (
              priceAlerts.map((alert, index) => (
                <div key={index} className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 mb-1">{t.priceIncreased}</p>
                      <p className="text-sm text-gray-700 mb-2">{alert.product.name}</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">€{alert.oldPrice.toFixed(2)}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-bold text-red-600">€{alert.newPrice.toFixed(2)}</span>
                        <span className="text-red-600 font-semibold">
                          ({alert.changePercent > 0 ? '+' : ''}{alert.changePercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-red-600">{priceAlerts.length - index}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
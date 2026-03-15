import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Package, Users, ShoppingCart, AlertCircle } from 'lucide-react';
import type { Product, Supplier, Order, PriceAlert } from '@/types';
import { useMemo } from 'react';
import { useTranslations, type Language } from '@/lib/i18n';

interface DashboardSectionProps {
  products: Product[];
  suppliers: Supplier[];
  orders: Order[];
  priceAlerts: PriceAlert[];
  language: Language;
}

export default function DashboardSection({ products, suppliers, orders, priceAlerts, language }: DashboardSectionProps) {
  const t = useTranslations(language);
  
  const stats = useMemo(() => {
    // Calculate total value of products
    const totalProductValue = products.reduce((sum, p) => sum + (p.price * (p.stock_quantity || 0)), 0);
    
    // Calculate average product price
    const avgProductPrice = products.length > 0 ? products.reduce((sum, p) => sum + p.price, 0) / products.length : 0;
    
    // Calculate total orders value
    const totalOrdersValue = orders.reduce((sum, o) => sum + o.total, 0);
    
    // Calculate price changes in last 30 days
    const recentPriceChanges = products.filter(p => {
      if (!p.last_price_change) return false;
      const daysSince = Math.floor((Date.now() - new Date(p.last_price_change).getTime()) / (1000 * 60 * 60 * 24));
      return daysSince <= 30;
    });
    
    const priceIncreases = recentPriceChanges.filter(p => p.price > (p.original_price || p.price)).length;
    const priceDecreases = recentPriceChanges.filter(p => p.price < (p.original_price || p.price)).length;
    
    // Top suppliers by product count
    const supplierProductCount = suppliers.map(s => ({
      name: s.name,
      count: products.filter(p => p.supplier_id === s.id).length
    })).sort((a, b) => b.count - a.count).slice(0, 5);
    
    return {
      totalProductValue,
      avgProductPrice,
      totalOrdersValue,
      priceIncreases,
      priceDecreases,
      supplierProductCount,
      recentPriceChanges: recentPriceChanges.length
    };
  }, [products, suppliers, orders]);

  const unacknowledgedAlerts = priceAlerts.filter(a => !a.acknowledged);

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      {unacknowledgedAlerts.length > 0 && (
        <Card className="backdrop-blur-xl bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <AlertCircle className="h-5 w-5" />
              {t.priceAlerts} ({unacknowledgedAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unacknowledgedAlerts.slice(0, 5).map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                  <div className="flex items-center gap-3">
                    {alert.change_percent > 0 ? (
                      <TrendingUp className="h-5 w-5 text-red-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-green-500" />
                    )}
                    <div>
                      <p className="font-semibold text-slate-800">{alert.product_name}</p>
                      <p className="text-sm text-slate-600">
                        €{alert.old_price.toFixed(2)} → €{alert.new_price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <Badge className={alert.change_percent > 0 ? 'bg-red-500' : 'bg-green-500'}>
                    {alert.change_percent > 0 ? '+' : ''}{alert.change_percent.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">{t.products}</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{products.length}</p>
                <p className="text-xs text-slate-500 mt-1">{t.price}: €{stats.avgProductPrice.toFixed(2)}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl">
                <Package className="h-8 w-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">{t.suppliers}</p>
                <p className="text-3xl font-bold text-indigo-600 mt-2">{suppliers.length}</p>
                <p className="text-xs text-slate-500 mt-1">{t.suppliers}</p>
              </div>
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-3 rounded-xl">
                <Users className="h-8 w-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">{t.orders}</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{orders.length}</p>
                <p className="text-xs text-slate-500 mt-1">{t.totalAmount}: €{stats.totalOrdersValue.toFixed(2)}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-3 rounded-xl">
                <ShoppingCart className="h-8 w-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">{t.priceAlerts}</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{stats.recentPriceChanges}</p>
                <p className="text-xs text-slate-500 mt-1">{t.days} 30</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-xl">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Suppliers */}
        <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {t.topSuppliers}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.supplierProductCount.map((supplier, index) => (
                <div key={supplier.name} className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{supplier.name}</p>
                    <p className="text-sm text-slate-600">{supplier.count} {t.products.toLowerCase()}</p>
                  </div>
                </div>
              ))}
            </div>
            {stats.supplierProductCount.length === 0 && (
              <p className="text-center text-slate-500 py-8">{t.noSuppliers}</p>
            )}
          </CardContent>
        </Card>

        {/* Price Changes Summary */}
        <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              {t.priceAlerts} ({t.days} 30)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-6 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border-2 border-red-200">
                <div className="bg-red-500 p-4 rounded-xl">
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">{t.priceIncreased}</p>
                  <p className="text-4xl font-bold text-red-600 mt-1">{stats.priceIncreases}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                <div className="bg-green-500 p-4 rounded-xl">
                  <TrendingDown className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">{t.priceDecreased}</p>
                  <p className="text-4xl font-bold text-green-600 mt-1">{stats.priceDecreases}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
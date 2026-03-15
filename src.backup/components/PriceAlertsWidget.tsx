import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Bell, 
  X,
  AlertCircle,
  Settings
} from 'lucide-react';
import { PriceHistoryService, type PriceAlert } from '@/lib/priceHistoryService';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Product } from '@/types';

interface PriceAlertsWidgetProps {
  products: Product[];
  minChangePercent?: number;
  daysToCheck?: number;
}

export function PriceAlertsWidget({ 
  products, 
  minChangePercent = 5,
  daysToCheck = 7 
}: PriceAlertsWidgetProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadAlerts();
    
    // Reload alerts every 5 minutes
    const interval = setInterval(loadAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [minChangePercent, daysToCheck]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const priceAlerts = await PriceHistoryService.getRecentPriceChanges(daysToCheck, minChangePercent);
      setAlerts(priceAlerts);

      // Show toast notifications for new alerts
      const newAlerts = priceAlerts.filter(alert => !dismissed.has(alert.product_id));
      if (newAlerts.length > 0) {
        newAlerts.forEach(alert => {
          const isIncrease = alert.change_percent > 0;
          toast(
            <div className="flex items-center gap-3">
              {isIncrease ? (
                <TrendingUp className="h-5 w-5 text-red-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-green-600" />
              )}
              <div>
                <p className="font-semibold">{alert.product_name}</p>
                <p className="text-sm text-slate-600">
                  {isIncrease ? 'Aumento' : 'Riduzione'} prezzo: {Math.abs(alert.change_percent).toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500">
                  {formatCurrency(alert.old_price)} → {formatCurrency(alert.new_price)}
                </p>
              </div>
            </div>,
            {
              duration: 5000,
              className: isIncrease ? 'border-l-4 border-red-500' : 'border-l-4 border-green-500'
            }
          );
        });
      }
    } catch (error) {
      console.error('Error loading price alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (productId: string) => {
    setDismissed(prev => new Set(prev).add(productId));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy', { locale: it });
    } catch {
      return dateString;
    }
  };

  const visibleAlerts = alerts.filter(alert => !dismissed.has(alert.product_id));

  if (loading && alerts.length === 0) {
    return null;
  }

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-600 animate-pulse" />
            Avvisi Cambio Prezzo
            <Badge className="bg-orange-600 hover:bg-orange-700">
              {visibleAlerts.length}
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Nascondi' : 'Mostra tutto'}
          </Button>
        </div>
        <p className="text-sm text-slate-600">
          Ultimi {daysToCheck} giorni • Variazioni ≥{minChangePercent}%
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {(showHistory ? visibleAlerts : visibleAlerts.slice(0, 3)).map((alert) => {
            const isIncrease = alert.change_percent > 0;
            const changeAmount = alert.new_price - alert.old_price;

            return (
              <div
                key={`${alert.product_id}-${alert.date}`}
                className={`p-4 rounded-lg border-2 ${
                  isIncrease 
                    ? 'bg-red-50 border-red-200' 
                    : 'bg-green-50 border-green-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {isIncrease ? (
                        <TrendingUp className="h-5 w-5 text-red-600" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-green-600" />
                      )}
                      <h4 className="font-semibold text-slate-800">
                        {alert.product_name}
                      </h4>
                    </div>

                    <div className="space-y-1 text-sm">
                      <p className="text-slate-600">
                        <span className="font-medium">Fornitore:</span> {alert.supplier_name}
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-600">
                          {formatCurrency(alert.old_price)}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className={`font-bold ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(alert.new_price)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={isIncrease 
                            ? 'bg-red-600 hover:bg-red-700' 
                            : 'bg-green-600 hover:bg-green-700'
                          }
                        >
                          {isIncrease ? '+' : ''}{alert.change_percent.toFixed(1)}%
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {isIncrease ? '+' : ''}{formatCurrency(changeAmount)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatDate(alert.date)}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismiss(alert.product_id)}
                    className="hover:bg-white/50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          {!showHistory && visibleAlerts.length > 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(true)}
              className="w-full"
            >
              Mostra altri {visibleAlerts.length - 3} avvisi
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Badge component for products in ProductsSection
export function PriceChangeBadge({ productId }: { productId: string }) {
  const [priceChange, setPriceChange] = useState<{ percent: number; isIncrease: boolean } | null>(null);

  useEffect(() => {
    loadPriceChange();
  }, [productId]);

  const loadPriceChange = async () => {
    try {
      const history = await PriceHistoryService.getProductPriceHistory(productId, 2);
      if (history.length >= 2) {
        const latest = history[0];
        if (latest.price_change_percent !== null) {
          setPriceChange({
            percent: Math.abs(latest.price_change_percent),
            isIncrease: latest.price_change_percent > 0
          });
        }
      }
    } catch (error) {
      console.error('Error loading price change:', error);
    }
  };

  if (!priceChange || priceChange.percent < 5) {
    return null;
  }

  return (
    <Badge
      className={`${
        priceChange.isIncrease 
          ? 'bg-red-600 hover:bg-red-700' 
          : 'bg-green-600 hover:bg-green-700'
      } animate-pulse`}
    >
      {priceChange.isIncrease ? (
        <TrendingUp className="h-3 w-3 mr-1" />
      ) : (
        <TrendingDown className="h-3 w-3 mr-1" />
      )}
      {priceChange.isIncrease ? '+' : '-'}{priceChange.percent.toFixed(1)}%
    </Badge>
  );
}
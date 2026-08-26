import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Bell, 
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { PriceAlert } from '@/lib/priceAlertService';

interface PriceAlertsWidgetProps {
  /** Alert già calcolati da Index.tsx (priceAlertService) */
  priceAlerts: PriceAlert[];
  onClearAlerts?: () => void;
}

export function PriceAlertsWidget({ priceAlerts, onClearAlerts }: PriceAlertsWidgetProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const handleDismiss = (key: string) => {
    setDismissed(prev => new Set(prev).add(key));
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

  // Chiave univoca per ogni alert (nome prodotto + data)
  const alertKey = (alert: PriceAlert) =>
    `${alert.productName.toLowerCase().trim()}-${alert.invoiceDate}`;

  const visibleAlerts = priceAlerts.filter(a => !dismissed.has(alertKey(a)));

  if (visibleAlerts.length === 0) {
    return null;
  }

  const displayed = showAll ? visibleAlerts : visibleAlerts.slice(0, 3);

  return (
    <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-600 animate-pulse" />
            Avvisi Cambio Prezzo
            <Badge className="bg-orange-600 hover:bg-orange-700">
              {visibleAlerts.length}
            </Badge>
          </CardTitle>
          <div className="flex gap-2">
            {visibleAlerts.length > 3 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll(v => !v)}>
                {showAll ? 'Mostra meno' : `Mostra tutti (${visibleAlerts.length})`}
              </Button>
            )}
            {onClearAlerts && (
              <Button variant="ghost" size="sm" onClick={onClearAlerts} className="text-slate-500 hover:text-slate-700">
                Chiudi tutti
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayed.map((alert) => {
            const isIncrease = alert.changePercent > 0;
            const changeAmount = alert.newPrice - alert.oldPrice;
            const key = alertKey(alert);

            return (
              <div
                key={key}
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
                      <h4 className="font-semibold text-slate-800">{alert.productName}</h4>
                    </div>
                    <div className="space-y-1 text-sm">
                      {alert.supplierName && (
                        <p className="text-slate-600">
                          <span className="font-medium">Fornitore:</span> {alert.supplierName}
                        </p>
                      )}
                      <div className="flex items-center gap-3">
                        <span className="text-slate-600">{formatCurrency(alert.oldPrice)}</span>
                        <span className="text-slate-400">→</span>
                        <span className={`font-bold ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(alert.newPrice)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={isIncrease
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-green-600 hover:bg-green-700'
                          }
                        >
                          {isIncrease ? '+' : ''}{(Number(alert.changePercent) || 0).toFixed(1)}%
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {isIncrease ? '+' : ''}{formatCurrency(changeAmount)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{formatDate(alert.invoiceDate)}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismiss(key)}
                    className="hover:bg-white/50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
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
      {priceChange.isIncrease ? '+' : '-'}{(Number(priceChange.percent) || 0).toFixed(1)}%
    </Badge>
  );
}
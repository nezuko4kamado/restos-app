import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Product } from '@/types';

interface PriceChangeIndicatorProps {
  product: Product;
}

export default function PriceChangeIndicator({ product }: PriceChangeIndicatorProps) {
  // ✅ Use previous_price and price from product directly (stored in DB)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = product as any;
  const currentPrice: number = p.price || 0;
  const previousPrice: number = p.previous_price || 0;

  // Fallback: try priceHistory / price_history_data if previous_price not available
  if (!previousPrice || previousPrice === 0 || currentPrice === previousPrice) {
    const history: { price: number; date: string }[] = p.priceHistory || p.price_history_data || [];
    if (history.length < 2) return null;
    const sorted = [...history].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const cur = sorted[0].price;
    const prev = sorted[1].price;
    if (cur === prev || prev === 0) return null;
    const pct = ((cur - prev) / prev) * 100;
    const isInc = pct > 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-full ${
          isInc
            ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
        }`}
      >
        {isInc ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isInc ? '+' : ''}{(Number(pct) || 0).toFixed(1)}%
      </span>
    );
  }

  const changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
  const isIncrease = changePercent > 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-full ${
        isIncrease
          ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
          : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
      }`}
    >
      {isIncrease ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isIncrease ? '+' : ''}
      {(Number(changePercent) || 0).toFixed(1)}%
    </span>
  );
}

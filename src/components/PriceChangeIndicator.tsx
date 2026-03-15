import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Product } from '@/types';

interface PriceHistoryEntry {
  price: number;
  date: string;
  reason?: string;
}

interface PriceChangeIndicatorProps {
  product: Product;
}

export default function PriceChangeIndicator({ product }: PriceChangeIndicatorProps) {
  // ✅ Support both camelCase (runtime) and snake_case (DB type) history fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = product as any;
  const history: PriceHistoryEntry[] = p.priceHistory || p.price_history || [];

  // Need at least 2 entries to show a change
  if (history.length < 2) return null;

  // Sort by date descending to get the two most recent entries
  const sorted = [...history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const currentPrice = sorted[0].price;
  const previousPrice = sorted[1].price;

  // No change
  if (currentPrice === previousPrice || previousPrice === 0) return null;

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
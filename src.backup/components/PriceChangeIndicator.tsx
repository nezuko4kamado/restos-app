import { Product } from '@/types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PriceChangeIndicatorProps {
  product: Product;
}

export default function PriceChangeIndicator({ product }: PriceChangeIndicatorProps) {
  // Return null if no price history or less than 2 entries
  if (!product.priceHistory || product.priceHistory.length < 2) {
    return null;
  }

  try {
    // Filter out invalid date entries and sort
    const validHistory = product.priceHistory.filter(entry => {
      if (!entry.date) return false;
      const date = new Date(entry.date);
      return !isNaN(date.getTime());
    });

    // Need at least 2 valid entries to show comparison
    if (validHistory.length < 2) {
      return null;
    }

    const sortedHistory = [...validHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const currentPrice = sortedHistory[0].price;
    const previousPrice = sortedHistory[1].price;
    const priceDiff = currentPrice - previousPrice;
    const percentChange = ((priceDiff / previousPrice) * 100).toFixed(1);

    if (priceDiff === 0) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Minus className="h-3 w-3" />
          Prezzo stabile
        </Badge>
      );
    }

    const isIncrease = priceDiff > 0;

    return (
      <Badge
        variant="secondary"
        className={`flex items-center gap-1 ${
          isIncrease
            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
        }`}
      >
        {isIncrease ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        {isIncrease ? '+' : ''}€{Math.abs(priceDiff).toFixed(2)} ({isIncrease ? '+' : ''}{percentChange}%)
      </Badge>
    );
  } catch (error) {
    console.error('Error rendering price change indicator:', error);
    return null;
  }
}
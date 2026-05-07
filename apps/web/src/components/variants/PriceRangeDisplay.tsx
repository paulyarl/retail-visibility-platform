'use client';

import { PriceRange } from '@/types/variants';

interface PriceRangeDisplayProps {
  priceRange: PriceRange;
  currency?: string;
  size?: 'sm' | 'default' | 'lg';
  showCurrency?: boolean;
  className?: string;
}

/**
 * PriceRangeDisplay - Shows price range for products with variants
 * 
 * Usage:
 * <PriceRangeDisplay priceRange={{ min_cents: 1999, max_cents: 2999 }} />
 * <PriceRangeDisplay priceRange={priceRange} size="lg" />
 */
export function PriceRangeDisplay({ 
  priceRange, 
  currency = 'USD',
  size = 'default',
  showCurrency = true,
  className = ''
}: PriceRangeDisplayProps) {
  const formatPrice = (cents: number): string => {
    const dollars = cents / 100;
    return dollars.toFixed(2);
  };

  const getCurrencySymbol = (curr: string): string => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      CAD: '$',
      AUD: '$',
    };
    return symbols[curr] || '$';
  };

  const sizeClasses = {
    sm: 'text-sm',
    default: 'text-base',
    lg: 'text-lg'
  };

  const currencyToUse = priceRange.currency || currency;
  const symbol = getCurrencySymbol(currencyToUse);
  
  // If min and max are the same, show single price
  if (priceRange.min_cents === priceRange.max_cents) {
    return (
      <span className={`font-semibold ${sizeClasses[size]} ${className}`}>
        {symbol}{formatPrice(priceRange.min_cents)}
        {showCurrency && currencyToUse !== 'USD' && (
          <span className="text-xs ml-1 text-muted-foreground">{currencyToUse}</span>
        )}
      </span>
    );
  }

  return (
    <span className={`font-semibold ${sizeClasses[size]} ${className}`}>
      {symbol}{formatPrice(priceRange.min_cents)} - {symbol}{formatPrice(priceRange.max_cents)}
      {showCurrency && currencyToUse !== 'USD' && (
        <span className="text-xs ml-1 text-muted-foreground">{currencyToUse}</span>
      )}
    </span>
  );
}

import { calculatePricing, formatPrice, formatSavings } from '@/lib/pricing';
import { Badge } from '@/components/ui/Badge';
import { Tag } from 'lucide-react';

interface PriceDisplayProps {
  priceCents: number;
  salePriceCents?: number | null;
  variant?: 'default' | 'large' | 'compact';
  showSavingsBadge?: boolean;
  className?: string;
}

export function PriceDisplay({
  priceCents,
  salePriceCents,
  variant = 'default',
  showSavingsBadge = true,
  className = '',
}: PriceDisplayProps) {
  const pricing = calculatePricing(priceCents, salePriceCents);

  const sizeClasses = {
    large: 'text-3xl',
    default: 'text-xl',
    compact: 'text-base',
  };

  const strikeClasses = {
    large: 'text-xl',
    default: 'text-base',
    compact: 'text-sm',
  };

  if (!pricing.isOnSale) {
    return (
      <div className={`font-bold text-gray-900 ${sizeClasses[variant]} ${className}`}>
        {formatPrice(pricing.effectivePrice)}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {/* Strikethrough List Price */}
      <span className={`text-gray-500 line-through ${strikeClasses[variant]}`}>
        {formatPrice(pricing.listPrice)}
      </span>

      {/* Sale Price with Icon */}
      <span className={`flex items-center gap-1.5 font-bold text-red-600 ${sizeClasses[variant]}`}>
        <Tag className="w-5 h-5" />
        {formatPrice(pricing.effectivePrice)}
      </span>

      {/* Savings Badge */}
      {showSavingsBadge && (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          {formatSavings(pricing.savingsAmount, pricing.savingsPercent)}
        </Badge>
      )}
    </div>
  );
}

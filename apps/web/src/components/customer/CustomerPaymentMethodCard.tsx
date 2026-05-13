'use client';

import { CreditCard, Star, Trash2, AlertTriangle, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CustomerPaymentMethod } from '@/services/CustomerPaymentMethodsService';

interface CustomerPaymentMethodCardProps {
  method: CustomerPaymentMethod;
  onSetDefault?: (id: string) => void;
  onRemove?: (id: string) => void;
  isRemoving?: boolean;
}

const CARD_BRAND_COLORS: Record<string, string> = {
  visa: 'bg-blue-600',
  mastercard: 'bg-orange-500',
  amex: 'bg-blue-800',
  discover: 'bg-orange-600',
  jcb: 'bg-green-600',
  diners: 'bg-gray-700',
  unionpay: 'bg-red-600',
};

const CARD_BRAND_ICONS: Record<string, string> = {
  visa: 'VISA',
  mastercard: 'MC',
  amex: 'AMEX',
  discover: 'DISC',
};

function isExpired(expiryMonth: number | null, expiryYear: number | null): boolean {
  if (!expiryMonth || !expiryYear) return false;
  const now = new Date();
  return new Date(expiryYear, expiryMonth, 1) <= new Date(now.getFullYear(), now.getMonth(), 1);
}

function isExpiringSoon(expiryMonth: number | null, expiryYear: number | null): boolean {
  if (!expiryMonth || !expiryYear) return false;
  const now = new Date();
  const threshold = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const expiresAt = new Date(expiryYear, expiryMonth, 1);
  return expiresAt <= threshold && expiresAt > new Date(now.getFullYear(), now.getMonth(), 1);
}

export function CustomerPaymentMethodCard({
  method,
  onSetDefault,
  onRemove,
  isRemoving,
}: CustomerPaymentMethodCardProps) {
  const expired = isExpired(method.expiryMonth, method.expiryYear);
  const expiringSoon = !expired && isExpiringSoon(method.expiryMonth, method.expiryYear);

  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 rounded-lg border-2 transition-all',
        method.isDefault
          ? 'border-blue-500 bg-blue-50'
          : 'border-neutral-200 hover:border-neutral-300',
        expired && 'opacity-60 border-red-200 bg-red-50'
      )}
    >
      <div className="flex items-center gap-3">
        {method.type === 'card' ? (
          <div
            className={cn(
              'w-12 h-8 rounded flex items-center justify-center text-white text-xs font-bold',
              CARD_BRAND_COLORS[method.cardBrand?.toLowerCase() || ''] || 'bg-purple-600'
            )}
          >
            {CARD_BRAND_ICONS[method.cardBrand?.toLowerCase() || ''] || method.cardBrand?.toUpperCase()?.slice(0, 4) || 'CARD'}
          </div>
        ) : method.type === 'paypal' ? (
          <div className="w-12 h-8 bg-blue-600 rounded flex items-center justify-center text-white">
            <Wallet className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-12 h-8 bg-purple-600 rounded flex items-center justify-center text-white">
            <CreditCard className="w-4 h-4" />
          </div>
        )}

        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900">
              {method.type === 'card'
                ? `${method.cardBrand || 'Card'} ending in ${method.cardLast4}`
                : method.type === 'paypal'
                  ? 'PayPal'
                  : method.walletType || method.type}
            </p>
            {method.isDefault && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <Star className="w-3 h-3" />
                Default
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {method.expiryMonth && method.expiryYear && (
              <p className={cn(
                'text-xs',
                expired ? 'text-red-600 font-medium' : expiringSoon ? 'text-amber-600' : 'text-gray-500'
              )}>
                Expires {method.expiryMonth}/{method.expiryYear}
              </p>
            )}
            {expired && (
              <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                <AlertTriangle className="w-3 h-3" />
                Expired
              </span>
            )}
            {expiringSoon && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="w-3 h-3" />
                Expiring soon
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!method.isDefault && onSetDefault && (
          <button
            onClick={() => onSetDefault(method.id)}
            className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Set Default
          </button>
        )}
        {onRemove && (
          <button
            onClick={() => onRemove(method.id)}
            disabled={isRemoving}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            title="Remove payment method"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

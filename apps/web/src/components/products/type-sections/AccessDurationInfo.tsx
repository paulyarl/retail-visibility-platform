'use client';

import { Clock } from 'lucide-react';

interface AccessDurationInfoProps {
  product: any;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}

export function AccessDurationInfo({
  product,
  layoutVariant = 'classic',
}: AccessDurationInfoProps) {
  const hasDuration = product.accessDurationDays != null && product.accessDurationDays > 0;
  const hasDownloadLimit = product.downloadLimit != null && product.downloadLimit > 0;
  const isCompact = layoutVariant === 'quick-commerce';

  if (!hasDuration && !hasDownloadLimit) return null;

  return (
    <div className={`flex items-start gap-2 ${isCompact ? 'text-xs' : 'text-sm'} text-neutral-600 dark:text-neutral-400`}>
      <Clock size={isCompact ? 14 : 16} className="mt-0.5 flex-shrink-0" />
      <div>
        {hasDuration && (
          <p className="font-medium">
            {product.accessDurationDays === 9999 || product.accessDurationDays === -1
              ? 'Lifetime Access'
              : `${product.accessDurationDays} day${product.accessDurationDays === 1 ? '' : 's'} access`}
          </p>
        )}
        {hasDownloadLimit && (
          <p className={isCompact ? 'text-xs' : 'text-xs'}>
            {product.downloadLimit} download{product.downloadLimit === 1 ? '' : 's'} allowed
          </p>
        )}
      </div>
    </div>
  );
}

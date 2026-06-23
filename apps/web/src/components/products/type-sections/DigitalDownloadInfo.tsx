'use client';

import { Download } from 'lucide-react';

interface DigitalDownloadInfoProps {
  product: any;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}

export function DigitalDownloadInfo({
  product,
  layoutVariant = 'classic',
}: DigitalDownloadInfoProps) {
  const isCompact = layoutVariant === 'quick-commerce';
  const deliveryMethod = product.digitalDeliveryMethod;

  return (
    <div className={`flex items-start gap-2 ${isCompact ? 'text-xs' : 'text-sm'} text-neutral-600 dark:text-neutral-400`}>
      <Download size={isCompact ? 14 : 16} className="mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-medium">Digital Download</p>
        {deliveryMethod && (
          <p className={isCompact ? 'text-xs' : 'text-xs'}>Delivery: {deliveryMethod.replace(/_/g, ' ')}</p>
        )}
        <p className={isCompact ? 'text-xs' : 'text-xs'}>Download link available after checkout.</p>
      </div>
    </div>
  );
}

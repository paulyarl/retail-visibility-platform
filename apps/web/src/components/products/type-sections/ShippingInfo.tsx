'use client';

import { Package } from 'lucide-react';

interface ShippingInfoProps {
  product: any;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}

export function ShippingInfo({
  product,
  layoutVariant = 'classic',
}: ShippingInfoProps) {
  const isCompact = layoutVariant === 'quick-commerce';

  return (
    <div className={`flex items-start gap-2 ${isCompact ? 'text-xs' : 'text-sm'} text-neutral-600 dark:text-neutral-400`}>
      <Package size={isCompact ? 14 : 16} className="mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-medium">Shipping Available</p>
        <p className={isCompact ? 'text-xs' : 'text-xs'}>Ships from merchant. Calculated at checkout.</p>
      </div>
    </div>
  );
}

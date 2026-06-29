'use client';

import { Download, Calendar, Globe, Package, Layers } from 'lucide-react';

export type ProductType = 'physical' | 'digital' | 'service' | 'hybrid';

interface ProductTypeBadgeProps {
  productType?: string;
  size?: 'xs' | 'sm';
  showPhysical?: boolean;
}

const badgeConfig: Record<string, { icon: typeof Download; label: string; className: string }> = {
  physical: { icon: Package, label: 'Physical', className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400' },
  digital: { icon: Download, label: 'Digital', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  service: { icon: Calendar, label: 'Service', className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  hybrid: { icon: Layers, label: 'Hybrid', className: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
};

export function ProductTypeBadge({ productType, size = 'sm', showPhysical = false }: ProductTypeBadgeProps) {
  const type = productType || 'physical';
  if (type === 'physical' && !showPhysical) return null;

  const config = badgeConfig[type];
  if (!config) return null;

  const Icon = config.icon;
  const sizeClasses = size === 'xs' ? 'px-1.5 py-0.5 text-[0.625rem]' : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses} ${config.className}`}>
      <Icon className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {config.label}
    </span>
  );
}

export default ProductTypeBadge;

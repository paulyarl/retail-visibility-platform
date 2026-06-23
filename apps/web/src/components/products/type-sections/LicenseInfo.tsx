'use client';

import { FileText } from 'lucide-react';

interface LicenseInfoProps {
  product: any;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}

export function LicenseInfo({
  product,
  layoutVariant = 'classic',
}: LicenseInfoProps) {
  if (!product.licenseType) return null;

  const isCompact = layoutVariant === 'quick-commerce';
  const licenseLabels: Record<string, string> = {
    personal: 'Personal License',
    commercial: 'Commercial License',
    enterprise: 'Enterprise License',
    single_user: 'Single User License',
    multi_user: 'Multi-User License',
  };

  const label = licenseLabels[product.licenseType] || product.licenseType.charAt(0).toUpperCase() + product.licenseType.slice(1);

  return (
    <div className={`flex items-start gap-2 ${isCompact ? 'text-xs' : 'text-sm'} text-neutral-600 dark:text-neutral-400`}>
      <FileText size={isCompact ? 14 : 16} className="mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-medium">{label}</p>
      </div>
    </div>
  );
}

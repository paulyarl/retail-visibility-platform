'use client';

import { shouldShowStatusPanel } from '@/components/storefront/StorefrontStatusPanel';

interface ProductPageStatusWrapperProps {
  tenantInfo: any;
  children: React.ReactNode;
}

export function ProductPageStatusWrapper({ tenantInfo, children }: ProductPageStatusWrapperProps) {
  const showStatusPanel = shouldShowStatusPanel(tenantInfo);
  
  // Show children only if status panel should NOT be shown
  if (showStatusPanel) {
    return null;
  }
  
  return <>{children}</>;
}

'use client';

import { useEffect, useState } from 'react';
import StorefrontActions from '@/components/storefront/StorefrontActions';

interface StorefrontActionsWrapperProps {
  tenantId: string;
  businessName: string;
  initialUrl?: string;
  showBackButton?: boolean;
}

export default function StorefrontActionsWrapper({ 
  tenantId, 
  businessName, 
  initialUrl = '', 
  showBackButton = false 
}: StorefrontActionsWrapperProps) {
  const [currentUrl, setCurrentUrl] = useState(initialUrl);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
    }
  }, []);

  return (
    <StorefrontActions 
      tenantId={tenantId}
      businessName={businessName}
      currentUrl={currentUrl}
      showBackButton={showBackButton}
    />
  );
}

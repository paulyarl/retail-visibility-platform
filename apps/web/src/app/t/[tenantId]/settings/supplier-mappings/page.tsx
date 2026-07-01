"use client";

/**
 * Supplier Mappings Management Page
 * Route: /t/[tenantId]/settings/supplier-mappings
 */

import { useState, useEffect } from 'react';
import SupplierMappings from '@/components/supplier/SupplierMappings';

export default function SupplierMappingsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const [tenantId, setTenantId] = useState<string>('');

  useEffect(() => {
    params.then(p => setTenantId(p.tenantId));
  }, [params]);

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return <SupplierMappings tenantId={tenantId} />;
}

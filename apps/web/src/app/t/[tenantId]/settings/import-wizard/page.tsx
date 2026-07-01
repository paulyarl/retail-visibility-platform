/**
 * Standalone Import Wizard Page
 * Route: /t/[tenantId]/settings/import-wizard
 */

'use client';

import { useState, useEffect } from 'react';
import ImportWizard from '@/components/supplier/ImportWizard';

export default function ImportWizardPage({ params }: { params: Promise<{ tenantId: string }> }) {
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

  return <ImportWizard tenantId={tenantId} />;
}

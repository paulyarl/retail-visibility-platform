'use client';

import { useParams } from 'next/navigation';
import CrmOptionsPage from '@/components/crm/CrmOptionsPage';

export default function CrmOptionsRoute() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  if (!tenantId) return <div>Missing tenant ID</div>;

  return <CrmOptionsPage tenantId={tenantId} />;
}

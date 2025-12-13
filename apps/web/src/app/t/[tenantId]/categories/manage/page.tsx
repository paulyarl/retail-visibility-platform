'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function TenantCategoriesManagePage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.tenantId as string;

  useEffect(() => {
    // Redirect to the main categories page
    router.replace(`/t/${tenantId}/categories`);
  }, [router, tenantId]);

  return (
    <div className="p-8">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to Categories page...</p>
      </div>
    </div>
  );
} 

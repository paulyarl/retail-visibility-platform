"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import TenantsClient from '@/components/tenants/TenantsClient';

export default function TenantsPage() {
  return (
    <ProtectedRoute>
      <TenantsClient />
    </ProtectedRoute>
  );
}

import React, { use } from "react";
import AdminTenantFlags from "@/components/admin/AdminTenantFlags";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function AdminTenantFlagsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-xl font-semibold">Tenant Feature Flags</h1>
          <p className="text-sm text-neutral-600 mb-4">
            Manage feature flags for this location. Store owners/admins and platform admins can modify flags.
          </p>
          <AdminTenantFlags tenantId={tenantId} />
        </div>
      </div>
    </ProtectedRoute>
  );
}

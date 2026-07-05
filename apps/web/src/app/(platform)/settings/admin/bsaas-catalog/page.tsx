/**
 * Settings Admin BSaaS Catalog Management Page
 *
 * Admin interface for managing purchasable features and bundles.
 */

import Link from 'next/link';
import BsaasCatalogManagement from '@/admin/components/BsaasCatalogManagement';

export default function SettingsAdminBsaasCatalogPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">BSaaS Catalog</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage purchasable features and bundles — pricing, availability, and composition.
          </p>
        </div>
        <Link
          href="/settings/admin"
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          ← Back to Admin
        </Link>
      </div>
      <BsaasCatalogManagement />
    </div>
  );
}

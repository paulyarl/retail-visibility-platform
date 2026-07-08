/**
 * Settings Admin Policy Templates Page
 *
 * Admin interface for managing the policy template catalog.
 */

import Link from 'next/link';
import PolicyTemplateAdminClient from './PolicyTemplateAdminClient';

export default function SettingsAdminPolicyTemplatesPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Policy Templates</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage the storefront policy template catalog — create, edit, and deactivate templates grouped by storefront type.
          </p>
        </div>
        <Link
          href="/settings/admin"
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          ← Back to Admin
        </Link>
      </div>
      <PolicyTemplateAdminClient />
    </div>
  );
}

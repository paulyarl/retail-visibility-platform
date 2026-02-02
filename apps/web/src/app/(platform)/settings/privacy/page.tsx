/**
 * Privacy & GDPR Settings Page
 * GDPR compliance tools including consent management and data export
 */

import { ConsentManager } from '@/components/security/gdpr/ConsentManager';
import { DataExportWidget } from '@/components/security/gdpr/DataExportWidget';
import { DangerZone } from '@/components/security/gdpr/DangerZone';
import { Card } from '@mantine/core';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Privacy & Data Settings',
  description: 'Manage your privacy preferences, data exports, and GDPR compliance',
};

export default function PrivacySettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Privacy & Data Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your privacy preferences, export your data, and control how your information is used
        </p>
      </div>

      {/* Consent Management */}
      <ConsentManager />

      {/* Data Export */}
      <Card withBorder padding="lg" radius="md">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Export Your Data</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Download a copy of your personal data in compliance with GDPR</p>
            </div>
          </div>
          <DataExportWidget />
        </div>
      </Card>

      {/* Danger Zone - Collapsible Account Deletion */}
      <DangerZone />
    </div>
  );
}

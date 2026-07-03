/**
 * Privacy & GDPR Settings Page
 * GDPR compliance tools including consent management and data export
 */

import { ConsentManager } from '@/components/security/gdpr/ConsentManager';
import { DataExportWidget } from '@/components/security/gdpr/DataExportWidget';
import { DangerZone } from '@/components/security/gdpr/DangerZone';
import { Card, Title, Text, Stack } from '@mantine/core';


export const metadata = {
  title: 'Privacy & Data Settings',
  description: 'Manage your privacy preferences, data exports, and GDPR compliance',
};

export default function PrivacySettingsPage() {
  return (
    <Stack gap="lg">
      <div>
        <Title order={1}>Privacy &amp; Data Settings</Title>
        <Text c="dimmed" mt="sm">
          Manage your privacy preferences, export your data, and control how your information is used
        </Text>
      </div>

      {/* Consent Management */}
      <ConsentManager />

      {/* Data Export */}
      <Card withBorder padding="lg" radius="md">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
            <div className="flex-1">
              <Title order={3}>Export Your Data</Title>
              <Text size="sm" c="dimmed">Download a copy of your personal data in compliance with GDPR</Text>
            </div>
          </div>
          <DataExportWidget />
        </div>
      </Card>

      {/* Danger Zone - Collapsible Account Deletion */}
      <DangerZone />
    </Stack>
  );
}

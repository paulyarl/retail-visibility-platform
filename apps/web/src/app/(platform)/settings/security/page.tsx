/**
 * Security Settings Page
 * User-facing security settings including sessions, alerts, and MFA
 */

import { Title, Text, Stack } from '@mantine/core';
import { SecuritySettings } from '@/components/security/SecuritySettings';


// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Security Settings',
  description: 'Manage your security settings, active sessions, and security alerts',
};

export default function SecuritySettingsPage() {
  return (
    <Stack gap="lg">
      <div>
        <Title order={1}>Security Settings</Title>
        <Text c="dimmed" mt="sm">
          Manage your account security, active sessions, and security preferences
        </Text>
      </div>
      
      <SecuritySettings />
    </Stack>
  );
}

/**
 * MFA Settings Page
 * Multi-factor authentication management (Auth0-powered)
 */

import { Title, Text, Stack } from '@mantine/core';
import { Auth0MFASettings } from '@/components/security/auth0-mfa/Auth0MFASettings';


// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Two-Factor Authentication (Auth0)',
  description: 'Manage your Auth0-powered two-factor authentication settings and backup codes',
};

export default function MFASettingsPage() {
  return (
    <Stack gap="lg">
      <div>
        <Title order={1}>Two-Factor Authentication</Title>
        <Text c="dimmed" mt="sm">
          Add an extra layer of security to your account with Auth0-powered 2FA
        </Text>
      </div>
      
      <Auth0MFASettings />
    </Stack>
  );
}

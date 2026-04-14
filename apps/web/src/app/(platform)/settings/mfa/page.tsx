/**
 * MFA Settings Page
 * Multi-factor authentication management (Auth0-powered)
 */

import { Auth0MFASettings } from '@/components/security/auth0-mfa/Auth0MFASettings';


// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Two-Factor Authentication (Auth0)',
  description: 'Manage your Auth0-powered two-factor authentication settings and backup codes',
};

export default function MFASettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Two-Factor Authentication</h1>
        <p className="text-muted-foreground mt-2">
          Add an extra layer of security to your account with Auth0-powered 2FA
        </p>
      </div>
      
      <Auth0MFASettings />
    </div>
  );
}

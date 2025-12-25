/**
 * MFA Settings Page
 * Multi-factor authentication management
 */

import { MFASettings } from '@/components/security/mfa/MFASettings';

export const metadata = {
  title: 'Two-Factor Authentication',
  description: 'Manage your two-factor authentication settings and backup codes',
};

export default function MFASettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Two-Factor Authentication</h1>
        <p className="text-muted-foreground mt-2">
          Add an extra layer of security to your account with 2FA
        </p>
      </div>
      
      <MFASettings />
    </div>
  );
}

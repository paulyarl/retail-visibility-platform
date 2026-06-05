/**
 * Security Settings Page
 * User-facing security settings including sessions, alerts, and MFA
 */

import { SecuritySettings } from '@/components/security/SecuritySettings';


// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Security Settings',
  description: 'Manage your security settings, active sessions, and security alerts',
};

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Security Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account security, active sessions, and security preferences
        </p>
      </div>
      
      <SecuritySettings />
    </div>
  );
}

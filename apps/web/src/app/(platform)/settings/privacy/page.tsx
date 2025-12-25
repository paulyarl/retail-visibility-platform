/**
 * Privacy & GDPR Settings Page
 * GDPR compliance tools including consent management and data export
 */

import { ConsentManager } from '@/components/security/gdpr/ConsentManager';
import { DataExportWidget } from '@/components/security/gdpr/DataExportWidget';
import { AccountDeletionModal } from '@/components/security/gdpr/AccountDeletionModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';


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
      <Card>
        <CardHeader>
          <CardTitle>Export Your Data</CardTitle>
          <CardDescription>
            Download a copy of your personal data in compliance with GDPR
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataExportWidget />
        </CardContent>
      </Card>

      {/* Account Deletion */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Account</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            If you delete your account, all your data will be permanently removed after a 30-day grace period.
          </p>
          {/* AccountDeletionModal component handles its own trigger button */}
        </CardContent>
      </Card>
    </div>
  );
}

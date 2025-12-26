/**
 * Admin Deletion Requests Page
 * Manage account deletion requests during grace periods
 */

import { DeletionRequestsManager } from '@/components/admin/DeletionRequestsManager';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Account Deletion Requests | Admin Settings',
  description: 'Manage user account deletion requests and grace periods',
};

export default function DeletionRequestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Account Deletion Requests</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and manage user account deletion requests during the 30-day grace period
        </p>
      </div>
      
      <DeletionRequestsManager />
    </div>
  );
}

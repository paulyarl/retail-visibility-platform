/**
 * Admin Security Dashboard Page
 * Provides security monitoring and threat management for platform administrators
 */

import { SecurityDashboard } from '@/components/security/monitoring/SecurityDashboard';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Security Dashboard | Admin Settings',
  description: 'Monitor security threats, blocked IPs, and system health',
};

export default function AdminSecurityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Security Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitor security threats, manage blocked IPs, and track security metrics
        </p>
      </div>
      
      <SecurityDashboard />
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';
import { tenantInfoService } from '@/services/TenantInfoService';

/**
 * Example component showing user-friendly organization error handling
 */
export default function OrganizationStatusExample({ organizationId }: { organizationId: string }) {
  const [organization, setOrganization] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadOrganization = async () => {
      try {
        const result = await tenantInfoService.getOrganization(organizationId);
        
        if (result.success && result.data) {
          setOrganization(result.data);
          setError('');
        } else {
          setOrganization(null);
          // Use the user-friendly message from the service
          setError(result.userMessage || 'Unable to load organization');
          
          // Optional: Show different messages based on error type
          if (result.error?.status === 404) {
            setError('Organization not found. Please check the organization ID and try again.');
          } else if (result.error?.status === 401) {
            setError('You don\'t have permission to view this organization.');
          } else if (result.error?.code === 'organization_not_found') {
            setError('This organization doesn\'t exist or has been removed.');
          }
        }
      } catch (err) {
        setError('An unexpected error occurred while loading the organization.');
      } finally {
        setLoading(false);
      }
    };

    loadOrganization();
  }, [organizationId]);

  if (loading) {
    return <div className="p-4">Loading organization...</div>;
  }

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="font-semibold">Organization Status</h3>
      
      {organization ? (
        <div className="space-y-2">
          <div className="text-green-600 font-medium">
            ✓ Organization Found
          </div>
          <div className="text-sm">
            <strong>Name:</strong> {organization.name || 'N/A'}
          </div>
          <div className="text-sm">
            <strong>ID:</strong> {organization.id}
          </div>
          {organization.tenants && (
            <div className="text-sm">
              <strong>Tenants:</strong> {organization.tenants.length}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-red-600 font-medium">
            ⚠️ Organization Not Available
          </div>
          {error && (
            <div className="text-sm text-gray-600 bg-gray-100 p-3 rounded border-l-4 border-red-400">
              {error}
            </div>
          )}
          <div className="text-xs text-gray-500">
            Error code: {organization?.error?.code || 'UNKNOWN'}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import ChangeLocationStatusModal from '@/components/tenant/ChangeLocationStatusModal';


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';


interface StatusInfo {
  status: 'pending' | 'active' | 'inactive' | 'closed' | 'archived';
  label: string;
  description: string;
  color: string;
  icon: string;
}

interface StatusHistoryEntry {
  id: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  reason?: string;
  reopeningDate?: string;
  createdAt: string;
  oldStatusInfo: StatusInfo;
  newStatusInfo: StatusInfo;
}

export default function LocationStatusPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;

  const [tenant, setTenant] = useState<any>(null);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchData();
    }
  }, [tenantId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch tenant info
      const tenantRes = await api.get(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenants/${tenantId}`
      );
      if (tenantRes.ok) {
        const tenantData = await tenantRes.json();
        setTenant(tenantData);
      }

      // Fetch status history
      const historyRes = await api.get(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenants/${tenantId}/status-history?limit=50`
      );
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch location status data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChanged = () => {
    setShowModal(false);
    fetchData(); // Refresh data
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3"></div>
            <div className="h-64 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-neutral-600 dark:text-neutral-400">
                Failed to load location information
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentStatus = tenant.locationStatus || tenant.statusInfo?.status || 'active';
  const statusInfo = tenant.statusInfo || {
    status: currentStatus,
    label: currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1),
    description: '',
    color: 'green',
    icon: '✅',
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'yellow',
      active: 'green',
      inactive: 'orange',
      closed: 'red',
      archived: 'gray',
    };
    return colors[status] || 'gray';
  };

  const getStatusBgClass = (color: string) => {
    const classes: Record<string, string> = {
      yellow: 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100',
      green: 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100',
      orange: 'bg-orange-100 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-100',
      red: 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100',
      gray: 'bg-gray-100 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100',
    };
    return classes[color] || classes.gray;
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <PageHeader
          title="Location Status"
          description="Manage your location's operational status and view change history"
        />

        {/* Current Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`flex items-center justify-between p-4 rounded-lg border ${getStatusBgClass(statusInfo.color)}`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{statusInfo.icon}</span>
                <div>
                  <p className="font-semibold text-lg">{statusInfo.label}</p>
                  <p className="text-sm opacity-90">{statusInfo.description}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Change Status
              </button>
            </div>

            {/* Additional Info */}
            {tenant.reopeningDate && currentStatus === 'inactive' && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Expected Reopening:</strong>{' '}
                  {new Date(tenant.reopeningDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}

            {tenant.closureReason && (currentStatus === 'closed' || currentStatus === 'archived') && (
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  <strong>Reason:</strong> {tenant.closureReason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Change History */}
        <Card>
          <CardHeader>
            <CardTitle>Status Change History</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-center text-neutral-600 dark:text-neutral-400 py-8">
                No status changes recorded yet
              </p>
            ) : (
              <div className="space-y-4">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{entry.oldStatusInfo.icon}</span>
                        <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-2xl">{entry.newStatusInfo.icon}</span>
                        <div>
                          <p className="font-medium text-neutral-900 dark:text-white">
                            {entry.oldStatusInfo.label} → {entry.newStatusInfo.label}
                          </p>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            {new Date(entry.createdAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {entry.reason && (
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-2 pl-12">
                        <strong>Reason:</strong> {entry.reason}
                      </p>
                    )}

                    {entry.reopeningDate && (
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1 pl-12">
                        <strong>Reopening Date:</strong>{' '}
                        {new Date(entry.reopeningDate).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle>About Location Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
            <p>
              Location status controls how your store appears to customers and affects various platform features:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Active:</strong> Fully operational, visible in all channels</li>
              <li><strong>Inactive:</strong> Temporarily closed (seasonal, renovations) - shows reopening date</li>
              <li><strong>Closed:</strong> Permanently closed - data retained for 30 days</li>
              <li><strong>Pending:</strong> New location being set up</li>
              <li><strong>Archived:</strong> Historical record only - no longer operational</li>
            </ul>
            <p className="pt-2">
              Status changes are logged for audit purposes and affect storefront visibility, directory listings, and Google sync.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Change Modal */}
      {showModal && (
        <ChangeLocationStatusModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          tenantId={tenantId}
          tenantName={tenant.name}
          initialStatus={currentStatus}
          onStatusChanged={handleStatusChanged}
        />
      )}
    </div>
  );
}

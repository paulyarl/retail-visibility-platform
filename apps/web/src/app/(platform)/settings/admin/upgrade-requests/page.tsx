'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Spinner } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { TIER_LIMITS } from '@/lib/tiers';
import { CHAIN_TIERS } from '@/lib/chain-tiers';
import { api } from '@/lib/api';

interface UpgradeRequest {
  id: string;
  tenant_id: string;
  business_name: string;
  current_tier: string;
  requested_tier: string;
  status: 'new' | 'pending' | 'waiting' | 'complete' | 'denied';
  notes?: string;
  admin_notes?: string;
  processed_by?: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function UpgradeRequestsPage() {
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [selectedRequest, setSelectedRequest] = useState<UpgradeRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  const loadRequests = async (page = 1, status = selectedStatus) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      
      if (status !== 'all') {
        params.append('status', status);
      }

      const res = await api.get(`/api/upgrade-requests?${params}`);
      const data = await res.json();
      
      // Backend returns data.data, not data.requests
      setRequests(data.data || data.requests || []);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to load upgrade requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    loadRequests(1, status);
  };

  const handleUpdateStatus = async (newStatus: string, adminNotes?: string) => {
    if (!selectedRequest) return;

    try {
      setProcessing(true);
      const res = await api.patch(`/api/upgrade-requests/${selectedRequest.id}`, {
        status: newStatus,
        adminNotes,
        processedBy: 'admin', // TODO: Get from auth context
      });

      if (res.ok) {
        setShowModal(false);
        setSelectedRequest(null);
        loadRequests(pagination?.page || 1, selectedStatus);
      }
    } catch (error) {
      console.error('Failed to update request:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getTierInfo = (tier: string) => {
    if (tier.startsWith('chain_')) {
      return CHAIN_TIERS[tier as keyof typeof CHAIN_TIERS] || { name: tier, color: 'bg-neutral-100' };
    }
    return TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || { name: tier, color: 'bg-neutral-100' };
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      new: { variant: 'info', label: 'New' },
      pending: { variant: 'warning', label: 'Pending' },
      waiting: { variant: 'default', label: 'Waiting' },
      complete: { variant: 'success', label: 'Complete' },
      denied: { variant: 'error', label: 'Denied' },
    };
    const config = variants[status] || { variant: 'default', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const statuses = [
    { value: 'all', label: 'All Requests', count: pagination?.total || 0 },
    { value: 'new', label: 'New' },
    { value: 'pending', label: 'Pending' },
    { value: 'waiting', label: 'Waiting' },
    { value: 'complete', label: 'Complete' },
    { value: 'denied', label: 'Denied' },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      <PageHeader
        title="Upgrade Requests"
        description="Manage subscription upgrade requests from tenants"
        icon={Icons.Settings}
        backLink={{
          href: '/settings/admin',
          label: 'Back to Admin'
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Filter */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              {statuses.map((status) => (
                <button
                  key={status.value}
                  onClick={() => handleStatusChange(status.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedStatus === status.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  {status.label}
                  {status.count !== undefined && ` (${status.count})`}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Requests List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-neutral-600">No upgrade requests found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const currentTierInfo = getTierInfo(request.current_tier);
              const requestedTierInfo = getTierInfo(request.requested_tier);

              return (
                <Card key={request.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-neutral-900">
                            {request.business_name}
                          </h3>
                          {getStatusBadge(request.status)}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-neutral-600 mb-3">
                          <span>Tenant ID: {request.tenant_id}</span>
                          <span>•</span>
                          <span>
                            {new Date(request.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-neutral-600">From:</span>
                            <Badge className={currentTierInfo.color}>
                              {currentTierInfo.name}
                            </Badge>
                          </div>
                          <span className="text-neutral-400">→</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-neutral-600">To:</span>
                            <Badge className={requestedTierInfo.color}>
                              {requestedTierInfo.name}
                            </Badge>
                          </div>
                        </div>

                        {request.notes && (
                          <div className="bg-neutral-50 p-3 rounded-lg mb-3">
                            <p className="text-sm text-neutral-700">
                              <span className="font-medium">Tenant Notes:</span> {request.notes}
                            </p>
                          </div>
                        )}

                        {request.admin_notes && (
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-sm text-blue-900">
                              <span className="font-medium">Admin Notes:</span> {request.admin_notes}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="ml-4">
                        <Button
                          variant={request.status === 'complete' || request.status === 'denied' ? 'ghost' : 'secondary'}
                          size="sm"
                          disabled={request.status === 'complete' || request.status === 'denied'}
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowModal(true);
                          }}
                        >
                          {request.status === 'complete' || request.status === 'denied' ? 'Processed' : 'Process'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {(pagination?.totalPages || 0) > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="secondary"
              disabled={(pagination?.page || 1) === 1}
              onClick={() => loadRequests((pagination?.page || 1) - 1, selectedStatus)}
            >
              Previous
            </Button>
            <span className="text-sm text-neutral-600">
              Page {pagination?.page || 1} of {pagination?.totalPages || 1}
            </span>
            <Button
              variant="secondary"
              disabled={(pagination?.page || 1) === (pagination?.totalPages || 1)}
              onClick={() => loadRequests((pagination?.page || 1) + 1, selectedStatus)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Process Modal */}
      {showModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <CardTitle>Process Upgrade Request</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-neutral-700 mb-2">Business:</p>
                  <p className="text-neutral-900">{selectedRequest.business_name}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-neutral-700 mb-2">Upgrade:</p>
                  <div className="flex items-center gap-2">
                    <Badge className={getTierInfo(selectedRequest.current_tier).color}>
                      {getTierInfo(selectedRequest.current_tier).name}
                    </Badge>
                    <span>→</span>
                    <Badge className={getTierInfo(selectedRequest.requested_tier).color}>
                      {getTierInfo(selectedRequest.requested_tier).name}
                    </Badge>
                  </div>
                </div>

                {selectedRequest.notes && (
                  <div>
                    <p className="text-sm font-medium text-neutral-700 mb-2">Tenant Notes:</p>
                    <p className="text-sm text-neutral-600">{selectedRequest.notes}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Admin Notes (Optional)
                  </label>
                  <textarea
                    id="adminNotes"
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Add notes about this request..."
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    onClick={() => {
                      const notes = (document.getElementById('adminNotes') as HTMLTextAreaElement)?.value;
                      handleUpdateStatus('complete', notes);
                    }}
                    disabled={processing}
                  >
                    Approve & Complete
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const notes = (document.getElementById('adminNotes') as HTMLTextAreaElement)?.value;
                      handleUpdateStatus('pending', notes);
                    }}
                    disabled={processing}
                  >
                    Mark Pending
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const notes = (document.getElementById('adminNotes') as HTMLTextAreaElement)?.value;
                      handleUpdateStatus('waiting', notes);
                    }}
                    disabled={processing}
                  >
                    Mark Waiting
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const notes = (document.getElementById('adminNotes') as HTMLTextAreaElement)?.value;
                      handleUpdateStatus('denied', notes);
                    }}
                    disabled={processing}
                    className="text-red-600 hover:text-red-700"
                  >
                    Deny
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedRequest(null);
                  }}
                  disabled={processing}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
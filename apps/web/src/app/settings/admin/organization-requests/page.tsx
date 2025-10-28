"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Modal, ModalFooter, Alert, Spinner } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import ProtectedRoute from '@/components/ProtectedRoute';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type OrganizationRequest = {
  id: string;
  tenantId: string;
  organizationId: string;
  requestedBy: string;
  status: string;
  requestType: string;
  estimatedCost?: number;
  costCurrency?: string;
  notes?: string;
  adminNotes?: string;
  costAgreed: boolean;
  costAgreedAt?: string;
  processedBy?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
  tenant: {
    id: string;
    name: string;
  };
  organization: {
    id: string;
    name: string;
  };
};

export default function OrganizationRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<OrganizationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  
  // Modal state
  const [selectedRequest, setSelectedRequest] = useState<OrganizationRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await api.get(`/api/organization-requests${params}`);
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDetailModal = (request: OrganizationRequest) => {
    setSelectedRequest(request);
    setEstimatedCost(request.estimatedCost?.toString() || '');
    setAdminNotes(request.adminNotes || '');
    setShowDetailModal(true);
  };

  const handleSetCost = async () => {
    if (!selectedRequest || !estimatedCost) return;
    
    setProcessing(true);
    try {
      const res = await api.patch(`/api/organization-requests/${selectedRequest.id}`, {
        estimatedCost: parseFloat(estimatedCost),
        adminNotes,
      });
      
      if (res.ok) {
        await loadRequests();
        setShowDetailModal(false);
      }
    } catch (error) {
      console.error('Failed to set cost:', error);
      alert('Failed to set cost. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!confirm('Are you sure you want to approve this request? The tenant will be assigned to the organization.')) {
      return;
    }
    
    setProcessing(true);
    try {
      const res = await api.patch(`/api/organization-requests/${requestId}`, {
        status: 'approved',
        processedBy: user?.id,
      });
      
      if (res.ok) {
        await loadRequests();
        setShowDetailModal(false);
      }
    } catch (error) {
      console.error('Failed to approve request:', error);
      alert('Failed to approve request. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (requestId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;
    
    setProcessing(true);
    try {
      const res = await api.patch(`/api/organization-requests/${requestId}`, {
        status: 'rejected',
        processedBy: user?.id,
        adminNotes: reason,
      });
      
      if (res.ok) {
        await loadRequests();
        setShowDetailModal(false);
      }
    } catch (error) {
      console.error('Failed to reject request:', error);
      alert('Failed to reject request. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'rejected':
        return <Badge variant="error">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole="ADMIN">
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        <PageHeader
          title="Organization Requests"
          description="Review and approve tenant requests to join organizations"
          icon={Icons.Admin}
          backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-yellow-600">
                    {requests.filter(r => r.status === 'pending').length}
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Pending</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {requests.filter(r => r.status === 'approved').length}
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Approved</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-600">
                    {requests.filter(r => r.status === 'rejected').length}
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Rejected</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    {requests.filter(r => r.costAgreed).length}
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Cost Agreed</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === 'pending' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('pending')}
                >
                  Pending
                </Button>
                <Button
                  variant={statusFilter === 'approved' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('approved')}
                >
                  Approved
                </Button>
                <Button
                  variant={statusFilter === 'rejected' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('rejected')}
                >
                  Rejected
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Requests List */}
          <Card>
            <CardHeader>
              <CardTitle>Requests</CardTitle>
              <CardDescription>
                {requests.length} request{requests.length !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">No requests</h3>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    No organization requests match the current filter.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {requests.map((request, index) => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="py-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {request.tenant.name}
                            </h3>
                            <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-sm text-neutral-600 dark:text-neutral-400">
                              {request.organization.name}
                            </span>
                            {getStatusBadge(request.status)}
                            {request.costAgreed && (
                              <Badge variant="success" className="text-xs">Cost Agreed</Badge>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Requested {new Date(request.createdAt).toLocaleDateString()}
                          </p>
                          {request.estimatedCost && (
                            <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1">
                              Estimated Cost: <strong>${request.estimatedCost.toFixed(2)} {request.costCurrency}/month</strong>
                            </p>
                          )}
                          {request.notes && (
                            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 italic">
                              "{request.notes}"
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openDetailModal(request)}
                          >
                            View Details
                          </Button>
                          {request.status === 'pending' && request.costAgreed && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(request.id)}
                                disabled={processing}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleReject(request.id)}
                                disabled={processing}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedRequest && (
          <Modal
            isOpen={showDetailModal}
            onClose={() => setShowDetailModal(false)}
            title="Request Details"
          >
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">Request Information</h4>
                <div className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">Tenant:</span>
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{selectedRequest.tenant.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">Organization:</span>
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{selectedRequest.organization.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">Status:</span>
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">Requested:</span>
                    <span className="text-sm text-neutral-900 dark:text-neutral-100">
                      {new Date(selectedRequest.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {selectedRequest.notes && (
                <div>
                  <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">Business Justification</h4>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 p-3 rounded-lg">
                    {selectedRequest.notes}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                  Estimated Cost (per month)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                    disabled={selectedRequest.status !== 'pending'}
                  />
                  <span className="px-3 py-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg text-sm text-neutral-700 dark:text-neutral-300">
                    USD
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                  Admin Notes
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  placeholder="Add notes about this request..."
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  disabled={selectedRequest.status !== 'pending'}
                />
              </div>

              {selectedRequest.costAgreed && (
                <Alert variant="success" title="Cost Agreed">
                  <p className="text-sm">
                    The tenant owner has agreed to the estimated cost of ${selectedRequest.estimatedCost?.toFixed(2)} {selectedRequest.costCurrency}/month.
                  </p>
                </Alert>
              )}

              {selectedRequest.status === 'pending' && !selectedRequest.costAgreed && selectedRequest.estimatedCost && (
                <Alert variant="info" title="Waiting for Cost Agreement">
                  <p className="text-sm">
                    The tenant owner needs to review and agree to the estimated cost before you can approve this request.
                  </p>
                </Alert>
              )}
            </div>

            <ModalFooter>
              <Button
                variant="secondary"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </Button>
              {selectedRequest.status === 'pending' && !selectedRequest.estimatedCost && (
                <Button
                  onClick={handleSetCost}
                  disabled={!estimatedCost || processing}
                >
                  {processing ? 'Setting...' : 'Set Cost'}
                </Button>
              )}
              {selectedRequest.status === 'pending' && selectedRequest.costAgreed && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => handleReject(selectedRequest.id)}
                    disabled={processing}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleApprove(selectedRequest.id)}
                    disabled={processing}
                  >
                    {processing ? 'Approving...' : 'Approve'}
                  </Button>
                </>
              )}
            </ModalFooter>
          </Modal>
        )}
      </div>
    </ProtectedRoute>
  );
}

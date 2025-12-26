/**
 * Deletion Requests Manager
 * Admin interface for managing account deletion requests
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { AlertTriangle, Calendar, User, XCircle, FileText, TrendingDown } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { api } from '@/lib/api';

interface DeletionRequest {
  id: string;
  userId: string;
  userEmail: string;
  userFirstName: string | null;
  userLastName: string | null;
  userCreatedAt: string;
  reason: string | null;
  status: 'pending' | 'cancelled' | 'completed';
  requestedAt: string;
  scheduledDeletionDate: string;
  cancelledAt?: string;
  completedAt?: string;
  ipAddress?: string;
  adminNotes?: string;
  cancelledByAdmin?: boolean;
}

interface DeletionStats {
  pendingCount: number;
  cancelledCount: number;
  completedCount: number;
  last7Days: number;
  last30Days: number;
  expiringIn7Days: number;
  topReasons: Array<{ reason: string; count: number }>;
}

export function DeletionRequestsManager() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [stats, setStats] = useState<DeletionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<DeletionRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  const fetchRequests = async (status: string = 'pending') => {
    try {
      const response = await api.get(`/api/admin/deletion-requests?status=${status}`);
      if (!response.ok) throw new Error('Failed to fetch requests');
      const data = await response.json();
      setRequests(data.data || []);
    } catch (error) {
      console.error('Failed to fetch deletion requests:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/admin/deletion-requests/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      console.error('Failed to fetch deletion stats:', error);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      const response = await api.put(`/api/admin/deletion-requests/${requestId}`, {
        action: 'cancel',
        adminNotes: adminNotes || 'Cancelled by admin'
      });
      
      if (!response.ok) throw new Error('Failed to cancel request');
      
      setShowDetailsModal(false);
      setAdminNotes('');
      await fetchRequests(activeTab);
      await fetchStats();
    } catch (error) {
      console.error('Failed to cancel deletion request:', error);
    }
  };

  const handleUpdateNotes = async (requestId: string) => {
    try {
      const response = await api.put(`/api/admin/deletion-requests/${requestId}`, {
        adminNotes
      });
      
      if (!response.ok) throw new Error('Failed to update notes');
      
      setShowDetailsModal(false);
      setAdminNotes('');
      await fetchRequests(activeTab);
    } catch (error) {
      console.error('Failed to update notes:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchRequests(activeTab), fetchStats()]);
      setLoading(false);
    };
    loadData();
  }, [activeTab]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
      pending: 'warning',
      cancelled: 'default',
      completed: 'error',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getDaysRemaining = (scheduledDate: string) => {
    const days = Math.ceil((new Date(scheduledDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getUserDisplay = (request: DeletionRequest) => {
    const name = [request.userFirstName, request.userLastName].filter(Boolean).join(' ');
    return name || request.userEmail;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending Requests</CardDescription>
                <CardTitle className="text-3xl text-yellow-600">{stats.pendingCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Expiring in 7 Days</CardDescription>
                <CardTitle className="text-3xl text-destructive">{stats.expiringIn7Days}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Last 30 Days</CardDescription>
                <CardTitle className="text-3xl">{stats.last30Days}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Completed</CardDescription>
                <CardTitle className="text-3xl">{stats.completedCount}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Top Reasons */}
        {stats && stats.topReasons.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Top Deletion Reasons
              </CardTitle>
              <CardDescription>Most common reasons users are leaving</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.topReasons.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                    <span className="text-sm">{item.reason}</span>
                    <Badge variant="default">{item.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deletion Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle>Deletion Requests</CardTitle>
            <CardDescription>Manage user account deletion requests</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="pending">
                  Pending {stats && `(${stats.pendingCount})`}
                </TabsTrigger>
                <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                {requests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No {activeTab} deletion requests</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Requested</TableHead>
                          <TableHead>Scheduled Deletion</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requests.map((request) => {
                          const daysRemaining = getDaysRemaining(request.scheduledDeletionDate);
                          return (
                            <TableRow key={request.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="font-medium">{getUserDisplay(request)}</div>
                                    <div className="text-xs text-muted-foreground">{request.userEmail}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-xs truncate text-sm">
                                  {request.reason || <span className="text-muted-foreground italic">No reason provided</span>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="text-sm font-medium">
                                      {format(new Date(request.scheduledDeletionDate), 'MMM dd, yyyy')}
                                    </div>
                                    {request.status === 'pending' && (
                                      <div className={`text-xs ${daysRemaining <= 7 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                        {daysRemaining} days remaining
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(request.status)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setAdminNotes(request.adminNotes || '');
                                    setShowDetailsModal(true);
                                  }}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Details Modal */}
      {selectedRequest && (
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Deletion Request Details</DialogTitle>
              <DialogDescription>
                Review and manage this account deletion request
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">User</p>
                  <p className="font-medium">{getUserDisplay(selectedRequest)}</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.userEmail}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  {getStatusBadge(selectedRequest.status)}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Account Age</p>
                <p className="text-sm">
                  Created {formatDistanceToNow(new Date(selectedRequest.userCreatedAt), { addSuffix: true })}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Deletion Reason</p>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm">
                    {selectedRequest.reason || <span className="italic text-muted-foreground">No reason provided</span>}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Requested</p>
                  <p className="text-sm">{format(new Date(selectedRequest.requestedAt), 'PPpp')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Scheduled Deletion</p>
                  <p className="text-sm">{format(new Date(selectedRequest.scheduledDeletionDate), 'PPpp')}</p>
                  {selectedRequest.status === 'pending' && (
                    <p className="text-xs text-destructive mt-1">
                      {getDaysRemaining(selectedRequest.scheduledDeletionDate)} days remaining
                    </p>
                  )}
                </div>
              </div>

              {selectedRequest.ipAddress && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">IP Address</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{selectedRequest.ipAddress}</code>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Admin Notes</p>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this deletion request..."
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowDetailsModal(false)}>
                Close
              </Button>
              <Button
                variant="default"
                onClick={() => handleUpdateNotes(selectedRequest.id)}
              >
                Save Notes
              </Button>
              {selectedRequest.status === 'pending' && (
                <Button
                  variant="danger"
                  onClick={() => handleCancelRequest(selectedRequest.id)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Request
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

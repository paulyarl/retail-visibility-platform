'use client';

import { useState, useEffect } from 'react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Button } from '@/components/ui';
import { Badge } from '@/components/ui';
import { Search, Filter, CheckCircle, XCircle, Clock, Building2, Users, Mail, MapPin, Calendar } from 'lucide-react';

export default function OrganizationRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    // Mock data - replace with actual API call
    const mockRequests = [
      {
        id: '1',
        tenantId: 'tid-abc123',
        tenantName: 'Downtown Cafe',
        tenantEmail: 'owner@downtowncafe.com',
        organizationId: 'org-456',
        organizationName: 'City Coffee Chain',
        organizationEmail: 'admin@citycoffee.com',
        requestType: 'join',
        status: 'pending',
        requestedAt: '2024-01-18T10:30:00Z',
        reviewedAt: null,
        reviewedBy: null,
        tenantLocation: 'New York, NY',
        organizationType: 'restaurant_chain',
        currentMembers: 12,
        maxMembers: 50,
        reason: 'Want to join the city coffee chain for better supply chain management'
      },
      {
        id: '2',
        tenantId: 'tid-def456',
        tenantName: 'Uptown Books',
        tenantEmail: 'manager@uptownbooks.com',
        organizationId: 'org-789',
        organizationName: 'Literary District Alliance',
        organizationEmail: 'contact@literaryalliance.com',
        requestType: 'join',
        status: 'approved',
        requestedAt: '2024-01-15T14:20:00Z',
        reviewedAt: '2024-01-16T09:15:00Z',
        reviewedBy: 'admin@platform.com',
        tenantLocation: 'Boston, MA',
        organizationType: 'retail_alliance',
        currentMembers: 8,
        maxMembers: 25,
        reason: 'Looking to collaborate with other independent bookstores'
      },
      {
        id: '3',
        tenantId: 'tid-ghi789',
        tenantName: 'Subway Sandwich Shop',
        tenantEmail: 'franchise@subway.com',
        organizationId: 'org-012',
        organizationName: 'Quick Service Network',
        organizationEmail: 'network@quickserve.com',
        requestType: 'join',
        status: 'rejected',
        requestedAt: '2024-01-12T16:45:00Z',
        reviewedAt: '2024-01-13T11:30:00Z',
        reviewedBy: 'admin@platform.com',
        tenantLocation: 'Chicago, IL',
        organizationType: 'franchise_network',
        currentMembers: 25,
        maxMembers: 100,
        rejectionReason: 'Organization at maximum capacity'
      },
      {
        id: '4',
        tenantId: 'tid-jkl012',
        tenantName: 'Tech Startup Inc',
        tenantEmail: 'it@techstartup.com',
        organizationId: 'org-345',
        organizationName: 'Innovation Hub',
        organizationEmail: 'hub@innovation.com',
        requestType: 'create',
        status: 'pending',
        requestedAt: '2024-01-19T08:15:00Z',
        reviewedAt: null,
        reviewedBy: null,
        tenantLocation: 'San Francisco, CA',
        organizationType: 'tech_incubator',
        currentMembers: 1,
        maxMembers: 20,
        reason: 'Creating new organization for tech startups in the area'
      }
    ];

    setTimeout(() => {
      setRequests(mockRequests);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredRequests = requests.filter(request => {
    const matchesSearch = 
      request.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.organizationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.requestType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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

  const getRequestTypeBadge = (type: string) => {
    switch (type) {
      case 'join':
        return <Badge variant="info">Join Organization</Badge>;
      case 'create':
        return <Badge variant="default">Create Organization</Badge>;
      case 'leave':
        return <Badge variant="warning">Leave Organization</Badge>;
      default:
        return <Badge variant="info">{type}</Badge>;
    }
  };

  const handleApprove = async (requestId: string) => {
    // Mock API call
    setRequests(requests.map(req => 
      req.id === requestId 
        ? { ...req, status: 'approved', reviewedAt: new Date().toISOString(), reviewedBy: 'admin@platform.com' }
        : req
    ));
  };

  const handleReject = async (requestId: string, reason: string) => {
    // Mock API call
    setRequests(requests.map(req => 
      req.id === requestId 
        ? { ...req, status: 'rejected', reviewedAt: new Date().toISOString(), reviewedBy: 'admin@platform.com', rejectionReason: reason }
        : req
    ));
  };

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Organization Requests"
          description="Review and approve tenant requests to join organizations"
          icon={Icons.Users}
        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Requests"
        description="Review and approve tenant requests to join organizations"
        icon={Icons.Users}
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <XCircle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-gray-900">{stats.rejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by tenant, organization, or request type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Requests</CardTitle>
          <CardDescription>
            Review tenant requests to join or create organizations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <div
                key={request.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{request.tenantName}</h3>
                      {getStatusBadge(request.status)}
                      {getRequestTypeBadge(request.requestType)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div className="space-y-1">
                        <p>
                          <span className="font-medium">Tenant Email:</span> {request.tenantEmail}
                        </p>
                        <p>
                          <span className="font-medium">Location:</span> {request.tenantLocation}
                        </p>
                        <p>
                          <span className="font-medium">Organization:</span> {request.organizationName}
                        </p>
                        <p>
                          <span className="font-medium">Organization Type:</span> {request.organizationType.replace('_', ' ')}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p>
                          <span className="font-medium">Organization Email:</span> {request.organizationEmail}
                        </p>
                        <p>
                          <span className="font-medium">Members:</span> {request.currentMembers}/{request.maxMembers}
                        </p>
                        <p>
                          <span className="font-medium">Reason:</span> {request.reason}
                        </p>
                        <p>
                          <span className="font-medium">Requested:</span> {new Date(request.requestedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {request.status === 'rejected' && request.rejectionReason && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">
                          <span className="font-medium">Rejection Reason:</span> {request.rejectionReason}
                        </p>
                      </div>
                    )}

                    {request.reviewedAt && (
                      <div className="mt-3 text-xs text-gray-500">
                        Reviewed by {request.reviewedBy} on {new Date(request.reviewedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {request.status === 'pending' && (
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        onClick={() => handleApprove(request.id)}
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleReject(request.id, 'Request does not meet organization requirements')}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredRequests.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No organization requests found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

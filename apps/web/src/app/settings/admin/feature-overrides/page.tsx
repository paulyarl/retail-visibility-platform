'use client';

import { useState, useEffect } from 'react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Badge } from '@/components/ui';
import { Search, Filter, Plus, Edit, Trash2, Shield, Settings, Zap } from 'lucide-react';

export default function FeatureOverridesPage() {
  const [overrides, setOverrides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Mock data for now - replace with actual API call
    const mockOverrides = [
      {
        id: '1',
        tenantId: 'tid-abc123',
        tenantName: 'Premium Store',
        feature: 'advanced_analytics',
        featureName: 'Advanced Analytics',
        status: 'granted',
        reason: 'Premium tier customer requested early access',
        grantedBy: 'admin@platform.com',
        grantedAt: '2024-01-15T10:30:00Z',
        expiresAt: '2024-04-15T10:30:00Z'
      },
      {
        id: '2',
        tenantId: 'tid-def456',
        tenantName: 'Test Store',
        feature: 'bulk_import',
        featureName: 'Bulk Import',
        status: 'revoked',
        reason: 'Testing period completed',
        revokedBy: 'admin@platform.com',
        revokedAt: '2024-01-10T15:45:00Z'
      },
      {
        id: '3',
        tenantId: 'tid-ghi789',
        tenantName: 'Beta Partner',
        feature: 'custom_themes',
        featureName: 'Custom Themes',
        status: 'granted',
        reason: 'Beta partnership program',
        grantedBy: 'admin@platform.com',
        grantedAt: '2024-01-01T09:00:00Z',
        expiresAt: null
      },
      {
        id: '4',
        tenantId: 'tid-jkl012',
        tenantName: 'Enterprise Client',
        feature: 'api_access',
        featureName: 'API Access',
        status: 'granted',
        reason: 'Enterprise tier includes API access',
        grantedBy: 'system',
        grantedAt: '2024-01-05T14:20:00Z',
        expiresAt: null
      }
    ];

    setTimeout(() => {
      setOverrides(mockOverrides);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredOverrides = overrides.filter(override =>
    override.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    override.featureName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    override.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'granted':
        return <Badge variant="success">Granted</Badge>;
      case 'revoked':
        return <Badge variant="error">Revoked</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Feature Overrides"
          description="Grant or revoke tier features for specific tenants"
          icon={Icons.Settings}
        />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Overrides"
        description="Grant or revoke tier features for specific tenants"
        icon={Icons.Settings}
      />

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by tenant, feature, or status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              New Override
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Overrides</p>
                <p className="text-2xl font-bold text-gray-900">
                  {overrides.filter(o => o.status === 'granted').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Revoked Overrides</p>
                <p className="text-2xl font-bold text-gray-900">
                  {overrides.filter(o => o.status === 'revoked').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Zap className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Overrides</p>
                <p className="text-2xl font-bold text-gray-900">{overrides.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overrides List */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Overrides</CardTitle>
          <CardDescription>
            Manage feature access overrides for specific tenants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredOverrides.map((override) => (
              <div
                key={override.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{override.tenantName}</h3>
                      {getStatusBadge(override.status)}
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>
                        <span className="font-medium">Feature:</span> {override.featureName}
                      </p>
                      <p>
                        <span className="font-medium">Reason:</span> {override.reason}
                      </p>
                      <div className="flex items-center gap-4 text-xs">
                        <span>
                          {override.status === 'granted' ? 'Granted' : 'Revoked'} by {override.grantedBy || override.revokedBy}
                        </span>
                        <span>
                          {override.status === 'granted' 
                            ? `on ${new Date(override.grantedAt).toLocaleDateString()}`
                            : `on ${new Date(override.revokedAt).toLocaleDateString()}`
                          }
                        </span>
                        {override.expiresAt && (
                          <span className="text-orange-600">
                            Expires {new Date(override.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredOverrides.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No feature overrides found matching your search.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

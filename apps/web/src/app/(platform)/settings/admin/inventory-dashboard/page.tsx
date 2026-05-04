"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button, Badge, Table, Progress } from '@mantine/core';
import { Spinner } from '@/components/ui';
import PageHeader from '@/components/PageHeader';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { adminInventoryService, PlatformInventoryStats, TenantInventoryBreakdown } from '@/services/AdminInventorySingletonService';

export default function InventoryDashboardAdminPage() {
  const { hasAccess, loading: accessLoading } = useAccessControl(
    null,
    AccessPresets.PLATFORM_ADMIN_ONLY
  );

  const [stats, setStats] = useState<PlatformInventoryStats | null>(null);
  const [tenants, setTenants] = useState<TenantInventoryBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResult, tenantsResult] = await Promise.all([
        adminInventoryService.getPlatformStats(),
        adminInventoryService.getTenantBreakdown(page, 10)
      ]);

      if (statsResult) {
        setStats(statsResult);
      }
      if (tenantsResult) {
        setTenants(tenantsResult.tenants);
      }
    } catch (error) {
      console.error('Failed to load inventory stats:', error);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (hasAccess) {
      loadData();
    }
  }, [hasAccess, loadData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Inventory Dashboard"
        description="Cross-tenant inventory visibility and analytics"
        icon={
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
      />

      {loading ? (
        <div className="flex justify-center p-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-amber-600">
                  {stats?.totalTenants || 0}
                </div>
                <div className="text-sm text-gray-500">Tenants</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {formatNumber(stats?.totalLocations || 0)}
                </div>
                <div className="text-sm text-gray-500">Locations</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-green-600">
                  {formatNumber(stats?.totalSKUs || 0)}
                </div>
                <div className="text-sm text-gray-500">Active SKUs</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {formatCurrency(stats?.totalInventoryValue || 0)}
                </div>
                <div className="text-sm text-gray-500">Inventory Value</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-orange-600">
                  {formatNumber(stats?.lowStockItems || 0)}
                </div>
                <div className="text-sm text-gray-500">Low Stock Items</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-cyan-600">
                  {formatNumber(stats?.inTransitItems || 0)}
                </div>
                <div className="text-sm text-gray-500">In Transit</div>
              </CardContent>
            </Card>
          </div>

          {/* Transfers Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Transfer Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Pending Transfers</span>
                    <Badge color="orange" size="lg">{stats?.pendingTransfers || 0}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Completed Today</span>
                    <Badge color="green" size="lg">{stats?.completedTransfersToday || 0}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">In Transit Items</span>
                    <Badge color="blue" size="lg">{formatNumber(stats?.inTransitItems || 0)}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Stock Level</span>
                      <span className="text-sm font-medium">
                        {stats?.lowStockItems && stats?.totalSKUs
                          ? `${Math.round((1 - stats.lowStockItems / stats.totalSKUs) * 100)}%`
                          : '100%'}
                      </span>
                    </div>
                    <Progress
                      value={stats?.lowStockItems && stats?.totalSKUs
                        ? (1 - stats.lowStockItems / stats.totalSKUs) * 100
                        : 100}
                      color="green"
                      size="lg"
                    />
                  </div>
                  <div className="text-sm text-gray-500">
                    {stats?.lowStockItems || 0} items below threshold
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Distribution */}
          {stats?.categoryDistribution && stats.categoryDistribution.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Category Distribution</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Products</Table.Th>
                      <Table.Th>Total Stock</Table.Th>
                      <Table.Th>Distribution</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {stats.categoryDistribution.slice(0, 10).map((cat, idx) => {
                      const maxStock = stats.categoryDistribution[0]?.total_stock || 1;
                      const percentage = (cat.total_stock / maxStock) * 100;
                      return (
                        <Table.Tr key={idx}>
                          <Table.Td className="font-medium">{cat.category}</Table.Td>
                          <Table.Td>{formatNumber(cat.product_count)}</Table.Td>
                          <Table.Td>{formatNumber(cat.total_stock)}</Table.Td>
                          <Table.Td style={{ width: '200px' }}>
                            <Progress value={percentage} color="amber" size="sm" />
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Top Products */}
          {stats?.topProductsByStock && stats.topProductsByStock.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Products by Stock</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Product</Table.Th>
                      <Table.Th>Slug</Table.Th>
                      <Table.Th>Total Stock</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {stats.topProductsByStock.map((product, idx) => (
                      <Table.Tr key={idx}>
                        <Table.Td className="font-medium">{product.name}</Table.Td>
                        <Table.Td>
                          <code className="text-xs text-gray-500">
                            {product.product_slug?.substring(0, 40)}...
                          </code>
                        </Table.Td>
                        <Table.Td>
                          <Badge color="blue">{formatNumber(product.total_stock)}</Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Tenant Breakdown */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tenant Inventory Breakdown</CardTitle>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button size="xs" variant="light" onClick={() => setPage(page - 1)}>
                    Previous
                  </Button>
                )}
                <Button size="xs" variant="light" onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tenant</Table.Th>
                    <Table.Th>Locations</Table.Th>
                    <Table.Th>SKUs</Table.Th>
                    <Table.Th>Inventory Value</Table.Th>
                    <Table.Th>Low Stock</Table.Th>
                    <Table.Th>Pending Transfers</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {tenants.map((tenant) => (
                    <Table.Tr key={tenant.tenant_id}>
                      <Table.Td className="font-medium">{tenant.tenant_name}</Table.Td>
                      <Table.Td>{tenant.total_locations}</Table.Td>
                      <Table.Td>{formatNumber(tenant.total_skus)}</Table.Td>
                      <Table.Td>{formatCurrency(tenant.total_inventory_value)}</Table.Td>
                      <Table.Td>
                        {tenant.low_stock_items > 0 ? (
                          <Badge color="orange">{tenant.low_stock_items}</Badge>
                        ) : (
                          <Badge color="green">0</Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {tenant.pending_transfers > 0 ? (
                          <Badge color="blue">{tenant.pending_transfers}</Badge>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

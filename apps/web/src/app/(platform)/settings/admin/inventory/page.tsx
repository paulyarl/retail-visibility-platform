"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button, TextInput, Select, Badge, Table, Tabs, Timeline, Text } from '@mantine/core';
import { Spinner } from '@/components/ui';
import { notifications } from '@mantine/notifications';
import PageHeader from '@/components/PageHeader';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { adminInventoryService, InventoryTransfer, TransferFilters, LowStockAlert } from '@/services/AdminInventorySingletonService';

export default function InventoryTransfersAdminPage() {
  const { hasAccess, loading: accessLoading } = useAccessControl(
    null,
    AccessPresets.PLATFORM_ADMIN_ONLY
  );

  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransfer, setSelectedTransfer] = useState<InventoryTransfer | null>(null);

  // Filters
  const [tenantId, setTenantId] = useState('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<string | null>('transfers');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [transfersResult, alertsResult] = await Promise.all([
        adminInventoryService.getTransfers({
          tenantId: tenantId || undefined,
          status: status as InventoryTransfer['status'] || undefined,
          page,
          limit: 50
        }),
        adminInventoryService.getLowStockAlerts({ limit: 50 })
      ]);

      if (transfersResult) {
        setTransfers(transfersResult.transfers);
      }
      if (alertsResult) {
        setLowStockAlerts(alertsResult.alerts);
      }
    } catch (error) {
      console.error('Failed to load inventory data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantId, status, page]);

  useEffect(() => {
    if (hasAccess) {
      loadData();
    }
  }, [hasAccess, loadData]);

  const handleApproveTransfer = async (transferId: string) => {
    try {
      const result = await adminInventoryService.approveTransfer(transferId);
      if (result) {
        notifications.show({
          title: 'Success',
          message: 'Transfer approved successfully',
          color: 'green'
        });
        loadData();
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to approve transfer',
        color: 'red'
      });
    }
  };

  const handleShipTransfer = async (transferId: string) => {
    try {
      const result = await adminInventoryService.shipTransfer(transferId, {
        notes: 'Shipped by admin'
      });
      if (result) {
        notifications.show({
          title: 'Success',
          message: 'Transfer marked as shipped',
          color: 'blue'
        });
        loadData();
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to ship transfer',
        color: 'red'
      });
    }
  };

  const handleReceiveTransfer = async (transferId: string) => {
    try {
      // In a real app, you'd prompt for actual quantity
      const result = await adminInventoryService.receiveTransfer(transferId, {
        actualQuantity: 0, // Would be from form
        notes: 'Received by admin'
      });
      if (result) {
        notifications.show({
          title: 'Success',
          message: 'Transfer received successfully',
          color: 'green'
        });
        loadData();
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to receive transfer',
        color: 'red'
      });
    }
  };

  const handleCancelTransfer = async (transferId: string) => {
    try {
      const success = await adminInventoryService.cancelTransfer(transferId, 'Cancelled by admin');
      if (success) {
        notifications.show({
          title: 'Success',
          message: 'Transfer cancelled',
          color: 'orange'
        });
        loadData();
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to cancel transfer',
        color: 'red'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'approved': return 'blue';
      case 'in_transit': return 'cyan';
      case 'completed': return 'green';
      case 'cancelled': return 'red';
      default: return 'gray';
    }
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'out_of_stock': return 'red';
      case 'critical': return 'orange';
      case 'low': return 'yellow';
      default: return 'gray';
    }
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
        title="Inventory Transfers"
        description="Manage cross-location inventory transfers"
        icon={
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        }
      />

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="transfers">Transfers</Tabs.Tab>
          <Tabs.Tab value="low-stock">Low Stock Alerts</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="transfers" pt="md">
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <TextInput
                    label="Tenant ID"
                    placeholder="Filter by tenant..."
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                  />
                </div>
                <Select
                  label="Status"
                  placeholder="All statuses"
                  value={status}
                  onChange={(value) => setStatus(value || '')}
                  data={[
                    { value: '', label: 'All' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'approved', label: 'Approved' },
                    { value: 'in_transit', label: 'In Transit' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'cancelled', label: 'Cancelled' }
                  ]}
                  clearable
                />
                <Button onClick={loadData} loading={loading}>
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Transfers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Transfer Queue</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Spinner size="lg" />
                </div>
              ) : (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>ID</Table.Th>
                      <Table.Th>Tenant</Table.Th>
                      <Table.Th>SKU</Table.Th>
                      <Table.Th>From → To</Table.Th>
                      <Table.Th>Qty</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Created</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {transfers.map((transfer) => (
                      <Table.Tr key={transfer.id}>
                        <Table.Td>
                          <code className="text-xs">{transfer.id.substring(0, 8)}...</code>
                        </Table.Td>
                        <Table.Td>{transfer.tenant?.name || transfer.tenant_id.substring(0, 8)}</Table.Td>
                        <Table.Td>
                          <code className="text-xs">{transfer.sku}</code>
                        </Table.Td>
                        <Table.Td>
                          <div className="text-xs">
                            {transfer.source_location?.name || transfer.source_location_id.substring(0, 8)} →
                            <br />
                            {transfer.target_location?.name || transfer.target_location_id.substring(0, 8)}
                          </div>
                        </Table.Td>
                        <Table.Td>{transfer.quantity}</Table.Td>
                        <Table.Td>
                          <Badge color={getStatusColor(transfer.status)}>
                            {transfer.status.replace('_', ' ')}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <span className="text-xs text-gray-500">
                            {new Date(transfer.created_at).toLocaleDateString()}
                          </span>
                        </Table.Td>
                        <Table.Td>
                          <div className="flex gap-1">
                            {transfer.status === 'pending' && (
                              <Button size="xs" color="green" onClick={() => handleApproveTransfer(transfer.id)}>
                                Approve
                              </Button>
                            )}
                            {transfer.status === 'approved' && (
                              <Button size="xs" color="blue" onClick={() => handleShipTransfer(transfer.id)}>
                                Ship
                              </Button>
                            )}
                            {transfer.status === 'in_transit' && (
                              <Button size="xs" color="green" onClick={() => handleReceiveTransfer(transfer.id)}>
                                Receive
                              </Button>
                            )}
                            {(transfer.status === 'pending' || transfer.status === 'approved') && (
                              <Button size="xs" color="red" variant="light" onClick={() => handleCancelTransfer(transfer.id)}>
                                Cancel
                              </Button>
                            )}
                          </div>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="low-stock" pt="md">
          <Card>
            <CardHeader>
              <CardTitle>Low Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Spinner size="lg" />
                </div>
              ) : (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Tenant</Table.Th>
                      <Table.Th>Location</Table.Th>
                      <Table.Th>Product</Table.Th>
                      <Table.Th>SKU</Table.Th>
                      <Table.Th>Current Stock</Table.Th>
                      <Table.Th>Threshold</Table.Th>
                      <Table.Th>Severity</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {lowStockAlerts.map((alert: any) => (
                      <Table.Tr key={alert.id}>
                        <Table.Td>{alert.tenants?.name || alert.tenant_name || '-'}</Table.Td>
                        <Table.Td>{alert.location_name || '-'}</Table.Td>
                        <Table.Td>{alert.name || alert.product_name}</Table.Td>
                        <Table.Td><code className="text-xs">{alert.sku}</code></Table.Td>
                        <Table.Td>{alert.stock ?? alert.current_stock}</Table.Td>
                        <Table.Td>{alert.threshold || 5}</Table.Td>
                        <Table.Td>
                          <Badge color={getAlertSeverityColor(alert.severity || 'low')}>
                            {(alert.severity || 'low').replace('_', ' ')}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Tabs.Panel>
      </Tabs>

      {/* Transfer Detail Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Transfer Details</CardTitle>
              <Button variant="subtle" onClick={() => setSelectedTransfer(null)}>
                ✕
              </Button>
            </CardHeader>
            <CardContent>
              <Timeline active={1} bulletSize={24} lineWidth={2}>
                <Timeline.Item title="Created" bullet={<span>📋</span>}>
                  <Text color="dimmed" size="sm">{new Date(selectedTransfer.created_at).toLocaleString()}</Text>
                  <Text size="sm">Initiated by: {selectedTransfer.initiated_by}</Text>
                </Timeline.Item>
                {selectedTransfer.approved_by && (
                  <Timeline.Item title="Approved" bullet={<span>✓</span>} color="green">
                    <Text size="sm">Approved by: {selectedTransfer.approved_by}</Text>
                  </Timeline.Item>
                )}
                {selectedTransfer.tracking_number && (
                  <Timeline.Item title="Shipped" bullet={<span>🚚</span>} color="blue">
                    <Text size="sm">Tracking: {selectedTransfer.tracking_number}</Text>
                  </Timeline.Item>
                )}
                {selectedTransfer.status === 'completed' && (
                  <Timeline.Item title="Completed" bullet={<span>✅</span>} color="green">
                    <Text size="sm">Transfer completed successfully</Text>
                  </Timeline.Item>
                )}
              </Timeline>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">SKU</label>
                  <div className="mt-1 font-mono">{selectedTransfer.sku}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Quantity</label>
                  <div className="mt-1 font-bold">{selectedTransfer.quantity}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Source</label>
                  <div className="mt-1">{selectedTransfer.source_location?.name || selectedTransfer.source_location_id}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Target</label>
                  <div className="mt-1">{selectedTransfer.target_location?.name || selectedTransfer.target_location_id}</div>
                </div>
              </div>

              {selectedTransfer.notes && (
                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-500">Notes</label>
                  <div className="mt-1 p-2 bg-gray-50 rounded">{selectedTransfer.notes}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}



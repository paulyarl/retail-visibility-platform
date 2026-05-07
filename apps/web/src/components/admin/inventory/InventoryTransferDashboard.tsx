/**
 * Admin Inventory Transfer Dashboard
 * 
 * Global catalog management and cross-location inventory operations
 * Platform admin only
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Badge,
  Input,
  Select,
  Table,
  Group,
  Text,
  Title,
  Stack,
  ActionIcon,
  Tooltip,
  Modal,
  NumberInput,
  Textarea,
  Alert,
  Pagination,
  Tabs,
  Grid,
  Progress,
  ThemeIcon,
  Box,
  Divider
} from '@mantine/core';
import {
  Package,
  ArrowRight,
  Check,
  X,
  Truck,
  AlertTriangle,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  Eye,
  Edit,
  Trash,
  Plus,
  Barcode,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  Users
} from 'lucide-react';
import { notifications } from '@mantine/notifications';

interface InventoryTransfer {
  id: string;
  tenantId: string;
  sourceLocationId: string;
  targetLocationId: string;
  sku: string;
  quantity: number;
  status: 'pending' | 'approved' | 'shipped' | 'in_transit' | 'delivered' | 'received' | 'cancelled' | 'rejected';
  initiatedBy: string;
  initiatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  shippedBy?: string;
  shippedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  trackingNumber?: string;
  estimatedArrival?: string;
  notes?: string;
}

interface LocationInventoryPool {
  id: string;
  tenantId: string;
  locationId: string;
  sku: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  inTransitQuantity: number;
  lowStockThreshold: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastUpdated: string;
}

interface LowStockAlert {
  id: string;
  tenantId: string;
  locationId: string;
  sku: string;
  availableQuantity: number;
  lowStockThreshold: number;
  reorderPoint: number;
  lastUpdated: string;
}

export function InventoryTransferDashboard() {
  const [activeTab, setActiveTab] = useState('transfers');
  const [loading, setLoading] = useState(false);
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [inventoryPools, setInventoryPools] = useState<LocationInventoryPool[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<InventoryTransfer | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);

  // Filters
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Form states
  const [transferForm, setTransferForm] = useState({
    sourceLocationId: '',
    targetLocationId: '',
    sku: '',
    quantity: 1,
    notes: ''
  });

  // Mock data for demonstration
  useEffect(() => {
    loadMockData();
  }, []);

  const loadMockData = () => {
    // Mock transfers data
    setTransfers([
      {
        id: 'transfer-001',
        tenantId: 'tenant-001',
        sourceLocationId: 'loc-001',
        targetLocationId: 'loc-002',
        sku: 'PROD-001',
        quantity: 50,
        status: 'pending',
        initiatedBy: 'admin-001',
        initiatedAt: '2026-05-02T10:00:00Z',
        notes: 'Urgent restock for weekend demand'
      },
      {
        id: 'transfer-002',
        tenantId: 'tenant-001',
        sourceLocationId: 'loc-003',
        targetLocationId: 'loc-001',
        sku: 'PROD-002',
        quantity: 25,
        status: 'shipped',
        initiatedBy: 'admin-002',
        initiatedAt: '2026-05-01T15:30:00Z',
        approvedBy: 'admin-001',
        approvedAt: '2026-05-01T16:00:00Z',
        shippedBy: 'staff-001',
        shippedAt: '2026-05-02T09:00:00Z',
        trackingNumber: 'TRK123456789',
        estimatedArrival: '2026-05-03T12:00:00Z'
      }
    ]);

    // Mock inventory pools
    setInventoryPools([
      {
        id: 'pool-001',
        tenantId: 'tenant-001',
        locationId: 'loc-001',
        sku: 'PROD-001',
        totalQuantity: 100,
        availableQuantity: 45,
        reservedQuantity: 5,
        inTransitQuantity: 50,
        lowStockThreshold: 10,
        reorderPoint: 20,
        reorderQuantity: 50,
        lastUpdated: '2026-05-02T10:30:00Z'
      },
      {
        id: 'pool-002',
        tenantId: 'tenant-001',
        locationId: 'loc-002',
        sku: 'PROD-001',
        totalQuantity: 75,
        availableQuantity: 75,
        reservedQuantity: 0,
        inTransitQuantity: 0,
        lowStockThreshold: 10,
        reorderPoint: 20,
        reorderQuantity: 50,
        lastUpdated: '2026-05-02T09:00:00Z'
      }
    ]);

    // Mock low stock alerts
    setLowStockAlerts([
      {
        id: 'alert-001',
        tenantId: 'tenant-001',
        locationId: 'loc-003',
        sku: 'PROD-003',
        availableQuantity: 3,
        lowStockThreshold: 10,
        reorderPoint: 20,
        lastUpdated: '2026-05-02T08:00:00Z'
      }
    ]);

    setTotalItems(2);
    setTotalPages(1);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'yellow';
      case 'approved': return 'blue';
      case 'shipped': return 'indigo';
      case 'in_transit': return 'purple';
      case 'delivered': return 'teal';
      case 'received': return 'green';
      case 'cancelled': return 'red';
      case 'rejected': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} />;
      case 'approved': return <Check size={16} />;
      case 'shipped': return <Truck size={16} />;
      case 'in_transit': return <Truck size={16} />;
      case 'delivered': return <Check size={16} />;
      case 'received': return <Check size={16} />;
      case 'cancelled': return <X size={16} />;
      case 'rejected': return <X size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const handleApproveTransfer = async (transferId: string) => {
    try {
      setLoading(true);
      // API call to approve transfer
      notifications.show({
        title: 'Transfer Approved',
        message: 'Transfer has been approved successfully',
        color: 'green'
      });
      loadMockData(); // Refresh data
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to approve transfer',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShipTransfer = async (transferId: string) => {
    try {
      setLoading(true);
      // API call to ship transfer
      notifications.show({
        title: 'Transfer Shipped',
        message: 'Transfer has been shipped successfully',
        color: 'blue'
      });
      loadMockData(); // Refresh data
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to ship transfer',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveTransfer = async (transferId: string) => {
    try {
      setLoading(true);
      // API call to receive transfer
      notifications.show({
        title: 'Transfer Received',
        message: 'Transfer has been received successfully',
        color: 'green'
      });
      loadMockData(); // Refresh data
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to receive transfer',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const renderTransfersTab = () => (
    <Stack gap="md">
      {/* Filters */}
      <Card p="md">
        <Group justify="space-between">
          <Group>
            <Input
              placeholder="Search transfers..."
              leftSection={<Search size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 300 }}
            />
            <Select
              placeholder="Filter by status"
              data={[
                { value: '', label: 'All Status' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'shipped', label: 'Shipped' },
                { value: 'received', label: 'Received' },
                { value: 'cancelled', label: 'Cancelled' }
              ]}
              value={selectedStatus}
              onChange={(value) => setSelectedStatus(value || '')}
              style={{ width: 150 }}
            />
            <Select
              placeholder="Select tenant"
              data={[
                { value: '', label: 'All Tenants' },
                { value: 'tenant-001', label: 'African International Market' },
                { value: 'tenant-002', label: 'Global Electronics Store' }
              ]}
              value={selectedTenant}
              onChange={(value) => setSelectedTenant(value || '')}
              style={{ width: 200 }}
            />
          </Group>
          <Group>
            <Button variant="light" leftSection={<RefreshCw size={16} />}>
              Refresh
            </Button>
            <Button leftSection={<Plus size={16} />} onClick={() => setTransferModalOpen(true)}>
              New Transfer
            </Button>
          </Group>
        </Group>
      </Card>

      {/* Transfers Table */}
      <Card p="md">
        <Title order={3} mb="md">Inventory Transfers</Title>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Transfer ID</Table.Th>
              <Table.Th>SKU</Table.Th>
              <Table.Th>From → To</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Initiated</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {transfers.map((transfer) => (
              <Table.Tr key={transfer.id}>
                <Table.Td>
                  <Text fw={500} size="sm">{transfer.id}</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Barcode size={16} />
                    <Text size="sm">{transfer.sku}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Text size="sm" c="dimmed">{transfer.sourceLocationId}</Text>
                    <ArrowRight size={14} />
                    <Text size="sm" c="dimmed">{transfer.targetLocationId}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text fw={500}>{transfer.quantity}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={getStatusColor(transfer.status)}
                    leftSection={getStatusIcon(transfer.status)}
                  >
                    {transfer.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {new Date(transfer.initiatedAt).toLocaleDateString()}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      size="sm"
                      variant="light"
                      onClick={() => setSelectedTransfer(transfer)}
                    >
                      <Eye size={14} />
                    </ActionIcon>
                    {transfer.status === 'pending' && (
                      <ActionIcon
                        size="sm"
                        color="green"
                        onClick={() => handleApproveTransfer(transfer.id)}
                      >
                        <Check size={14} />
                      </ActionIcon>
                    )}
                    {transfer.status === 'approved' && (
                      <ActionIcon
                        size="sm"
                        color="blue"
                        onClick={() => handleShipTransfer(transfer.id)}
                      >
                        <Truck size={14} />
                      </ActionIcon>
                    )}
                    {transfer.status === 'shipped' && (
                      <ActionIcon
                        size="sm"
                        color="green"
                        onClick={() => handleReceiveTransfer(transfer.id)}
                      >
                        <Check size={14} />
                      </ActionIcon>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Pagination
          total={totalPages}
          value={currentPage}
          onChange={setCurrentPage}
          mt="md"
        />
      </Card>
    </Stack>
  );

  const renderInventoryTab = () => (
    <Stack gap="md">
      <Card p="md">
        <Group justify="space-between">
          <Title order={3}>Location Inventory Pools</Title>
          <Group>
            <Select
              placeholder="Select location"
              data={[
                { value: '', label: 'All Locations' },
                { value: 'loc-001', label: 'Main Store' },
                { value: 'loc-002', label: 'Warehouse' },
                { value: 'loc-003', label: 'Branch Store' }
              ]}
              value={selectedLocation}
              onChange={(value) => setSelectedLocation(value || '')}
              style={{ width: 200 }}
            />
            <Button leftSection={<Download size={16} />} variant="light">
              Export
            </Button>
          </Group>
        </Group>
      </Card>

      <Grid>
        {inventoryPools.map((pool) => (
          <Grid.Col key={pool.id} span={4}>
            <Card p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={500}>{pool.sku}</Text>
                  <Badge color={pool.availableQuantity <= pool.lowStockThreshold ? 'red' : 'green'}>
                    {pool.availableQuantity <= pool.lowStockThreshold ? 'Low Stock' : 'In Stock'}
                  </Badge>
                </Group>
                
                <Group gap="xs">
                  <MapPin size={14} />
                  <Text size="sm" c="dimmed">{pool.locationId}</Text>
                </Group>

                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Available</Text>
                    <Text fw={500} c={pool.availableQuantity <= pool.lowStockThreshold ? 'red' : 'green'}>
                      {pool.availableQuantity}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Reserved</Text>
                    <Text size="sm">{pool.reservedQuantity}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">In Transit</Text>
                    <Text size="sm">{pool.inTransitQuantity}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Total</Text>
                    <Text fw={500}>{pool.totalQuantity}</Text>
                  </Group>
                </Stack>

                <Progress
                  value={(pool.availableQuantity / pool.totalQuantity) * 100}
                  color={pool.availableQuantity <= pool.lowStockThreshold ? 'red' : 'green'}
                  size="sm"
                />

                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Reorder at: {pool.reorderPoint}
                  </Text>
                  <Button size="xs" variant="light" onClick={() => setInventoryModalOpen(true)}>
                    Manage
                  </Button>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>
        ))}
      </Grid>
    </Stack>
  );

  const renderAlertsTab = () => (
    <Stack gap="md">
      <Card p="md">
        <Title order={3} mb="md">Low Stock Alerts</Title>
        
        {lowStockAlerts.length === 0 ? (
          <Alert color="green" icon={<Check size={16} />}>
            No low stock alerts. All inventory levels are healthy.
          </Alert>
        ) : (
          <Stack gap="sm">
            {lowStockAlerts.map((alert) => (
              <Card key={alert.id} p="md" withBorder style={{ borderLeft: '4px solid red' }}>
                <Group justify="space-between">
                  <Stack gap="xs">
                    <Group gap="xs">
                      <AlertTriangle size={16} color="red" />
                      <Text fw={500}>{alert.sku}</Text>
                    </Group>
                    <Group gap="xs">
                      <MapPin size={14} />
                      <Text size="sm" c="dimmed">{alert.locationId}</Text>
                    </Group>
                  </Stack>
                  <Stack gap="xs" align="flex-end">
                    <Text size="sm" c="red" fw={500}>
                      {alert.availableQuantity} units left
                    </Text>
                    <Text size="xs" c="dimmed">
                      Reorder at: {alert.reorderPoint}
                    </Text>
                    <Button size="xs" color="red">
                      Reorder Now
                    </Button>
                  </Stack>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Card>
    </Stack>
  );

  return (
    <Stack gap="lg">
      <Title order={2}>Inventory Transfer Management</Title>
      
      <Tabs value={activeTab} onChange={(value) => setActiveTab(value || '')}>
        <Tabs.List>
          <Tabs.Tab value="transfers" leftSection={<Truck size={16} />}>
            Transfers
          </Tabs.Tab>
          <Tabs.Tab value="inventory" leftSection={<Package size={16} />}>
            Inventory Pools
          </Tabs.Tab>
          <Tabs.Tab value="alerts" leftSection={<AlertTriangle size={16} />}>
            Alerts
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="transfers" pt="md">
          {renderTransfersTab()}
        </Tabs.Panel>

        <Tabs.Panel value="inventory" pt="md">
          {renderInventoryTab()}
        </Tabs.Panel>

        <Tabs.Panel value="alerts" pt="md">
          {renderAlertsTab()}
        </Tabs.Panel>
      </Tabs>

      {/* Transfer Details Modal */}
      <Modal
        opened={!!selectedTransfer}
        onClose={() => setSelectedTransfer(null)}
        title="Transfer Details"
        size="lg"
      >
        {selectedTransfer && (
          <Stack gap="md">
            <Group>
              <Badge
                color={getStatusColor(selectedTransfer.status)}
                leftSection={getStatusIcon(selectedTransfer.status)}
              >
                {selectedTransfer.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </Group>

            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Transfer ID</Text>
                <Text fw={500}>{selectedTransfer.id}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">SKU</Text>
                <Text fw={500}>{selectedTransfer.sku}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Source Location</Text>
                <Text>{selectedTransfer.sourceLocationId}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Target Location</Text>
                <Text>{selectedTransfer.targetLocationId}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Quantity</Text>
                <Text fw={500}>{selectedTransfer.quantity}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Initiated By</Text>
                <Text>{selectedTransfer.initiatedBy}</Text>
              </Grid.Col>
            </Grid>

            {selectedTransfer.trackingNumber && (
              <Box>
                <Text size="sm" c="dimmed">Tracking Number</Text>
                <Text>{selectedTransfer.trackingNumber}</Text>
              </Box>
            )}

            {selectedTransfer.notes && (
              <Box>
                <Text size="sm" c="dimmed">Notes</Text>
                <Text>{selectedTransfer.notes}</Text>
              </Box>
            )}

            <Group justify="flex-end">
              <Button variant="light" onClick={() => setSelectedTransfer(null)}>
                Close
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* New Transfer Modal */}
      <Modal
        opened={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Initiate New Transfer"
        size="md"
      >
        <Stack gap="md">
          <Select
            label="Source Location"
            placeholder="Select source location"
            data={[
              { value: 'loc-001', label: 'Main Store' },
              { value: 'loc-002', label: 'Warehouse' },
              { value: 'loc-003', label: 'Branch Store' }
            ]}
            value={transferForm.sourceLocationId}
            onChange={(value) => setTransferForm({ ...transferForm, sourceLocationId: value || '' })}
          />
          
          <Select
            label="Target Location"
            placeholder="Select target location"
            data={[
              { value: 'loc-001', label: 'Main Store' },
              { value: 'loc-002', label: 'Warehouse' },
              { value: 'loc-003', label: 'Branch Store' }
            ]}
            value={transferForm.targetLocationId}
            onChange={(value) => setTransferForm({ ...transferForm, targetLocationId: value || '' })}
          />
          
          <Input.Wrapper label="SKU">
            <Input
              placeholder="Enter SKU"
              value={transferForm.sku}
              onChange={(e) => setTransferForm({ ...transferForm, sku: e.target.value })}
            />
          </Input.Wrapper>
          
          <NumberInput
            label="Quantity"
            placeholder="Enter quantity"
            value={transferForm.quantity}
            onChange={(value) => setTransferForm({ ...transferForm, quantity: typeof value === 'number' ? value : 1 })}
            min={1}
          />
          
          <Textarea
            label="Notes"
            placeholder="Optional notes"
            value={transferForm.notes}
            onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
          />
          
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              // Handle transfer initiation
              notifications.show({
                title: 'Transfer Initiated',
                message: 'Transfer has been initiated successfully',
                color: 'green'
              });
              setTransferModalOpen(false);
              setTransferForm({
                sourceLocationId: '',
                targetLocationId: '',
                sku: '',
                quantity: 1,
                notes: ''
              });
            }}>
              Initiate Transfer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

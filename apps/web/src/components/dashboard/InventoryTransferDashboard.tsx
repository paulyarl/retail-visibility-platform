'use client';

/**
 * Inventory Transfer Dashboard
 * 
 * Main dashboard for managing cross-location inventory transfers
 * Provides real-time status updates and workflow management
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTenant } from '@/components/tenant/TenantContextProvider';
import {
  Container,
  Grid,
  Card,
  Title,
  Text,
  Badge,
  Button,
  Table,
  ActionIcon,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Group,
  Stack,
  Tabs,
  Progress,
  Alert,
  Loader,
  Tooltip,
  Box,
  Center
} from '@mantine/core';
import {
  IconTruck,
  IconPackage,
  IconCheck,
  IconX,
  IconClock,
  IconAlertTriangle,
  IconRefresh,
  IconEye,
  IconEdit,
  IconPlus,
  IconArrowRight,
  IconMapPin,
  IconArrowUp,
  IconArrowDown,
  IconArrowsExchange
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import InventoryTransferAnalytics from './InventoryTransferAnalytics';
import NewTransferModal from './NewTransferModal';
import { inventoryTransferService } from '@/services/InventoryTransferService';
import type { InventoryTransfer, LocationInventory } from '@/services/InventoryTransferService';

// Component-specific types
interface TransferActionData {
  trackingNumber?: string;
  estimatedArrival?: string;
  actualQuantity?: number;
  notes?: string;
}


const statusColors = {
  pending: 'orange',
  approved: 'blue',
  shipped: 'purple',
  received: 'green',
  cancelled: 'red'
} as const;

const statusIcons = {
  pending: <IconClock size={16} />,
  approved: <IconCheck size={16} />,
  shipped: <IconTruck size={16} />,
  received: <IconPackage size={16} />,
  cancelled: <IconX size={16} />
} as const;

export default function InventoryTransferDashboard() {
  const params = useParams();
  const tenant = useTenant();
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [inventory, setInventory] = useState<LocationInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('transfers');
  const [transferFilter, setTransferFilter] = useState<'all' | 'outgoing' | 'incoming'>('all');
  const [selectedTransfer, setSelectedTransfer] = useState<InventoryTransfer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'ship' | 'receive' | 'cancel'>('approve');
  const [actionData, setActionData] = useState<TransferActionData>({});
  console.log(`[InventoryTransferDashboard] Tenant context:`, tenant);
  console.log(`[InventoryTransferDashboard] URL params:`, params);

  // Filter transfers based on selected filter
  const getFilteredTransfers = () => {
    if (!tenant?.tenantId) return transfers;
    
    switch (transferFilter) {
      case 'outgoing':
        return transfers.filter(transfer => transfer.sourceLocationId === tenant.tenantId);
      case 'incoming':
        return transfers.filter(transfer => transfer.targetLocationId === tenant.tenantId);
      default:
        return transfers;
    }
  };

  // Load data using singleton service
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Use tenant context as primary source, URL params as fallback
      const tenantId = tenant?.tenantId || params.tenantId as string;
      console.log(`[InventoryTransferDashboard] Using tenant ID: ${tenantId}`);
      
      if (!tenantId) {
        console.error('[InventoryTransferDashboard] No tenant ID found in context or URL params');
        notifications.show({
          title: 'Error',
          message: 'Tenant ID is required',
          color: 'red'
        });
        return;
      }
      
      // Set tenant context for the singleton services
      inventoryTransferService.setCurrentTenant(tenantId);
      
      // Fetch outgoing transfers (where current tenant is source)
      const outgoingTransfers = await inventoryTransferService.getTransfers(tenantId);
      
      // Fetch incoming transfers (where current tenant is target)
      const incomingTransfers = await inventoryTransferService.getIncomingTransfers(tenantId);
      
      // Combine both outgoing and incoming transfers
      const allTransfers = [...outgoingTransfers, ...incomingTransfers];
      
      console.log(`[InventoryTransferDashboard] Loaded ${outgoingTransfers.length} outgoing and ${incomingTransfers.length} incoming transfers`);
      
      setTransfers(allTransfers);
      
      // Extract all unique location IDs from transfers (both source and target)
      const uniqueLocationIds = new Set<string>();
      allTransfers.forEach(transfer => {
        if (transfer.sourceLocationId) uniqueLocationIds.add(transfer.sourceLocationId);
        if (transfer.targetLocationId) uniqueLocationIds.add(transfer.targetLocationId);
      });
      
      console.log(`[InventoryTransferDashboard] Found ${uniqueLocationIds.size} unique locations:`, Array.from(uniqueLocationIds));
      
      // Fetch inventory for all unique locations
      const inventoryPromises = Array.from(uniqueLocationIds).map(locationId =>
        inventoryTransferService.getLocationInventory(tenantId, locationId)
          .catch(error => {
            console.warn(`[InventoryTransferDashboard] Failed to load inventory for location ${locationId}:`, error);
            return []; // Return empty array for failed locations
          })
      );
      
      const inventoryResults = await Promise.all(inventoryPromises);
      
      // Combine all inventory data and remove duplicates
      const allInventory = inventoryResults.flat();
      console.log(`[InventoryTransferDashboard] All inventory results:`, allInventory);
      const uniqueInventory = allInventory.filter((item, index, self) =>
        index === self.findIndex(i => i.locationId === item.locationId && i.sku === item.sku) 
      );
      
      console.log(`[InventoryTransferDashboard] Loaded ${uniqueInventory.length} total inventory items`);
      setInventory(uniqueInventory);
    } catch (error) {
      console.error('Failed to load data:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load transfer data',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle transfer actions using singleton service
  const handleTransferAction = async (transferId: string, action: string, data: any = {}) => {
    try {
      // Use tenant context as primary source, URL params as fallback
      const tenantId = tenant?.tenantId || params.tenantId as string;
      
      if (!tenantId) {
        console.error('[InventoryTransferDashboard] No tenant ID found in context or URL params');
        notifications.show({
          title: 'Error',
          message: 'Tenant ID is required',
          color: 'red'
        });
        return;
      }
      
      let result;

      switch (action) {
        case 'approve':
          result = await inventoryTransferService.approveTransfer(transferId, tenantId, data.notes);
          break;
        case 'ship':
          result = await inventoryTransferService.shipTransfer(
            transferId, 
            tenantId, 
            data.trackingNumber, 
            data.estimatedArrival, 
            data.notes
          );
          break;
        case 'receive':
          result = await inventoryTransferService.receiveTransfer(transferId, tenantId, data.actualQuantity, data.notes);
          break;
        case 'cancel':
          result = await inventoryTransferService.cancelTransfer(transferId, tenantId, data.notes);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      notifications.show({
        title: 'Success',
        message: `Transfer ${action} successfully`,
        color: 'green'
      });
      setActionModalOpen(false);
      loadData();
    } catch (error) {
      console.error(`Failed to ${action} transfer:`, error);
      notifications.show({
        title: 'Error',
        message: `Failed to ${action} transfer`,
        color: 'red'
      });
    }
  };

  // Open action modal
  const openActionModal = (transfer: InventoryTransfer, action: typeof actionType) => {
    setSelectedTransfer(transfer);
    setActionType(action);
    setActionData({});
    setActionModalOpen(true);
  };

  // Render transfer table
  const renderTransferTable = () => (
    <Card shadow="sm" p="lg" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={3}>Inventory Transfers</Title>
        <Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setModalOpen(true)}
            style={{ color: 'white' }}
          >
            New Transfer
          </Button>
          <ActionIcon onClick={loadData}>
            <IconRefresh size={16} style={{ color: 'white' }} />
          </ActionIcon>
        </Group>
      </Group>

      {loading ? (
        <Center>
          <Loader size="lg" />
        </Center>
      ) : (
        <>
          {/* Transfer Filter Tabs */}
          <Tabs value={transferFilter} onChange={(value) => value && setTransferFilter(value as any)} mb="md">
            <Tabs.List>
              <Tabs.Tab value="all" leftSection={<IconRefresh size={16} />}>
                All Transfers ({transfers.length})
              </Tabs.Tab>
              <Tabs.Tab value="outgoing" leftSection={<IconArrowUp size={16} />}>
                Outgoing ({transfers.filter(t => t.sourceLocationId === tenant?.tenantId).length})
              </Tabs.Tab>
              <Tabs.Tab value="incoming" leftSection={<IconArrowDown size={16} />}>
                Incoming ({transfers.filter(t => t.targetLocationId === tenant?.tenantId).length})
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>

          <Table striped highlightOnHover verticalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={100}>ID</Table.Th>
                <Table.Th w={120}>SKU</Table.Th>
                <Table.Th w={80}>Quantity</Table.Th>
                <Table.Th w={350}>Source → Target</Table.Th>
                <Table.Th w={100}>Status</Table.Th>
                <Table.Th w={120}>Created</Table.Th>
                <Table.Th w={150}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {getFilteredTransfers().map((transfer) => (
              <Table.Tr key={transfer.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>{transfer.id.slice(-8)}</Text>
                </Table.Td>
                <Table.Td>{transfer.sku}</Table.Td>
                <Table.Td>{transfer.quantity}</Table.Td>
                <Table.Td py="sm">
                  <Stack gap="sm" miw={280}>
                    {/* Direction indicator */}
                    <Group gap="sm">
                      {transfer.sourceLocationId === tenant?.tenantId ? (
                        <Badge 
                          color="orange" 
                          size="lg" 
                          fw={600}
                          lh={1.2}
                          variant="light"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          <IconArrowUp size={14} style={{ marginRight: 6 }} />
                          Outgoing
                        </Badge>
                      ) : transfer.targetLocationId === tenant?.tenantId ? (
                        <Badge 
                          color="cyan" 
                          size="lg" 
                          fw={600}
                          lh={1.2}
                          variant="light"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          <IconArrowDown size={14} style={{ marginRight: 6 }} />
                          Incoming
                        </Badge>
                      ) : (
                        <Badge 
                          color="gray" 
                          size="lg" 
                          variant="light"
                          style={{ padding: '6px 12px', fontSize: '0.5rem' }}
                        >
                          <IconArrowsExchange size={14} style={{ marginRight: 6 }} />
                          Other
                        </Badge>
                      )}
                    </Group>
                    
                    {/* Source to Target flow */}
                    <Group gap="lg" justify="flex-start">
                      <Badge 
                        color="blue"
                        fw={600}
                        lh={1.2}
                        size="lg" 
                        variant="outline"
                        style={{ padding: '8px 14px 6px 12px', fontSize: '0.5rem' }}
                      >
                        <IconPackage size={14} style={{ marginRight: 6 }} />
                        {transfer.sourceLocationId.slice(-8)}
                      </Badge>
                      <IconArrowRight size={18} color="gray" />
                      <Badge 
                        color="green"
                        fw={600}
                        lh={1.2} 
                        size="lg" 
                        variant="outline"
                        style={{ padding: '8px 12px 6px 12px', fontSize: '0.5rem' }}
                      >
                        <IconMapPin size={14} style={{ marginRight: 6 }} />
                        {transfer.targetLocationId.slice(-8)}
                      </Badge>
                    </Group>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={statusColors[transfer.status]}
                    fw={800}
                    lh={1.2}
                    size="lg"
                    variant="outline"
                    style={{ padding: '6px 12px', fontSize: '0.5rem' }}
                    leftSection={statusIcons[transfer.status]}
                  >
                    {transfer.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {new Date(transfer.initiatedAt).toLocaleDateString()}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip label="View Details">
                      <ActionIcon
                        size="sm"
                        variant="gradient"
                        style={{ color: 'white' }} 
                        gradient={{ from: 'orange', to: 'indigo' }}
                        onClick={() => setSelectedTransfer(transfer)}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                    </Tooltip>
                    
                    {transfer.status === 'pending' && (
                      <Tooltip label="Approve">
                        <ActionIcon
                          size="sm"
                          style={{ color: 'white' }} 
                          color="blue"
                          onClick={() => openActionModal(transfer, 'approve')}
                        >
                          <IconCheck size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    
                    {transfer.status === 'approved' && (
                      <Tooltip label="Ship">
                        <ActionIcon
                          size="sm"
                          style={{ color: 'white' }} 
                          color="purple"
                          onClick={() => openActionModal(transfer, 'ship')}
                        >
                          <IconTruck size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    
                    {transfer.status === 'shipped' && (
                      <Tooltip label="Receive">
                        <ActionIcon
                          size="sm"
                          style={{ color: 'white' }} 
                          color="green"
                          onClick={() => openActionModal(transfer, 'receive')}
                        >
                          <IconPackage size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    
                    {!['received', 'cancelled'].includes(transfer.status) && (
                      <Tooltip label="Cancel">
                        <ActionIcon
                          size="sm"
                          style={{ color: 'white' }} 
                          color="red"
                          onClick={() => openActionModal(transfer, 'cancel')}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        </>
      )}
    </Card>
  );

  // Render inventory overview
  const renderInventoryOverview = () => {
    // Determine location roles based on transfers
    const locationRoles = new Map<string, { isSource: boolean; isTarget: boolean; transferCount: number }>();
    
    transfers.forEach(transfer => {
      // Source location
      const sourceInfo = locationRoles.get(transfer.sourceLocationId) || { isSource: false, isTarget: false, transferCount: 0 };
      sourceInfo.isSource = true;
      sourceInfo.transferCount++;
      locationRoles.set(transfer.sourceLocationId, sourceInfo);
      
      // Target location
      const targetInfo = locationRoles.get(transfer.targetLocationId) || { isSource: false, isTarget: false, transferCount: 0 };
      targetInfo.isTarget = true;
      targetInfo.transferCount++;
      locationRoles.set(transfer.targetLocationId, targetInfo);
    });

    return (
      <Card shadow="sm" p="lg" withBorder>
        <Title order={3} mb="md">Location Inventory</Title>
        
        <Grid>
          {inventory.map((item) => {
            const role = locationRoles.get(item.locationId) || { isSource: false, isTarget: false, transferCount: 0 };
            const getRoleBadge = () => {
              if (role.isSource && role.isTarget) {
                return <Badge color="purple" size="sm" variant="light">Both</Badge>;
              } else if (role.isSource) {
                return <Badge color="blue" size="sm" variant="light">Source</Badge>;
              } else if (role.isTarget) {
                return <Badge color="green" size="sm" variant="light">Target</Badge>;
              }
              return <Badge color="gray" size="sm" variant="light">Other</Badge>;
            };
            
            return (
              <Grid.Col key={`${item.locationId}-${item.sku}`} span={4}>
                <Card p="md" withBorder>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>{item.sku}</Text>
                      <Group gap="xs">
                        {getRoleBadge()}
                        <Badge size="sm" variant="outline">{item.locationId.slice(-8)}</Badge>
                      </Group>
                    </Group>
                    
                    <Text size="xl" fw={700}>{item.totalQuantity}</Text>
                    <Text size="sm" c="dimmed">Total Quantity</Text>
                
                <Progress
                  value={(item.availableQuantity / item.totalQuantity) * 100}
                  color={item.availableQuantity < item.lowStockThreshold ? 'red' : 'blue'}
                  size="sm"
                />
                
                <Group justify="space-between">
                  <Text size="xs" c="blue">Available: {item.availableQuantity}</Text>
                  <Text size="xs" c="orange">Reserved: {item.reservedQuantity}</Text>
                  <Text size="xs" c="purple">In Transit: {item.inTransitQuantity}</Text>
                </Group>
                
                {item.availableQuantity < item.lowStockThreshold && (
                  <Alert color="red" variant="light">
                    <Group gap="xs">
                      <IconAlertTriangle size={14} />
                      <Text size="xs">Low Stock Alert</Text>
                    </Group>
                  </Alert>
                )}
              </Stack>
            </Card>
              </Grid.Col>
            );
          })}
        </Grid>
      </Card>
    );
  };

  return (
    <Container size="xl" py="md">
      <Title order={1} mb="lg">Inventory Transfer Dashboard</Title>
      
      <Tabs value={activeTab} onChange={(value) => value && setActiveTab(value)}>
        <Tabs.List>
          <Tabs.Tab value="transfers" leftSection={<IconTruck size={16} />}>
            Transfers
          </Tabs.Tab>
          <Tabs.Tab value="inventory" leftSection={<IconPackage size={16} />}>
            Inventory
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconEye size={16} />}>
            Analytics
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="transfers" pt="md">
          {renderTransferTable()}
        </Tabs.Panel>

        <Tabs.Panel value="inventory" pt="md">
          {renderInventoryOverview()}
        </Tabs.Panel>

        <Tabs.Panel value="analytics" pt="md">
          <InventoryTransferAnalytics />
        </Tabs.Panel>
      </Tabs>

      {/* Action Modal */}
      <Modal
        opened={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        title={`${actionType.charAt(0).toUpperCase() + actionType.slice(1)} Transfer`}
        size="md"
      >
        {selectedTransfer && (
          <Stack>
            <Text>
              {actionType === 'approve' && 'Approve this transfer for shipping?'}
              {actionType === 'ship' && 'Mark this transfer as shipped?'}
              {actionType === 'receive' && 'Mark this transfer as received?'}
              {actionType === 'cancel' && 'Cancel this transfer?'}
            </Text>
            
            {actionType === 'ship' && (
              <>
                <TextInput
                  label="Tracking Number"
                  placeholder="TRK123456789"
                  value={actionData.trackingNumber || ''}
                  onChange={(e) => setActionData({ ...actionData, trackingNumber: e.target.value })}
                />
                <TextInput
                  label="Estimated Arrival"
                  type="datetime-local"
                  value={actionData.estimatedArrival || ''}
                  onChange={(e) => setActionData({ ...actionData, estimatedArrival: e.target.value })}
                />
              </>
            )}
            
            {actionType === 'receive' && (
              <NumberInput
                label="Actual Quantity Received"
                value={actionData.actualQuantity || selectedTransfer.quantity}
                onChange={(value) => setActionData({ ...actionData, actualQuantity: typeof value === 'number' ? value : parseInt(value) || 0 })}
              />
            )}
            
            <Textarea
              label="Notes"
              placeholder="Add notes..."
              value={actionData.notes || ''}
              onChange={(e) => setActionData({ ...actionData, notes: e.target.value })}
            />
            
            <Group justify="flex-end">
              <Button variant="outline" onClick={() => setActionModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => handleTransferAction(selectedTransfer.id, actionType, actionData)}
              >
                {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* New Transfer Modal */}
      <NewTransferModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadData}
        tenantId={tenant?.tenantId || params.tenantId as string}
      />
    </Container>
  );
}

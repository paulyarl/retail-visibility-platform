/**
 * Location Orders Dashboard
 * 
 * Displays orders for a specific location with:
 * - Order statistics
 * - Orders needing attention
 * - Order list with status updates
 * - Multi-location order indicators
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
  Tooltip
} from '@mantine/core';
import { 
  Clock, 
  Package, 
  CheckCircle, 
  AlertTriangle, 
  Search,
  Filter,
  RefreshCw,
  MapPin,
  CreditCard
} from 'lucide-react';
import OrderManagementService, { 
  OrderLocationInfo, 
  LocationOrderStats, 
  OrdersNeedingAttention 
} from '@/services/OrderManagementService';

interface LocationOrdersDashboardProps {
  tenantId: string;
  tenantName: string;
}

const ORDER_STATUSES = [
  { value: '', label: 'All Orders' },
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'paid', label: 'Paid' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

export function LocationOrdersDashboard({ tenantId, tenantName }: LocationOrdersDashboardProps) {
  const orderService = OrderManagementService.getInstance();
  
  const [stats, setStats] = useState<LocationOrderStats | null>(null);
  const [attentionOrders, setAttentionOrders] = useState<OrdersNeedingAttention | null>(null);
  const [orders, setOrders] = useState<OrderLocationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const ORDERS_PER_PAGE = 20;

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, attentionData, ordersData] = await Promise.all([
        orderService.getLocationOrderStats(tenantId),
        orderService.getLocationOrdersNeedingAttention(tenantId),
        orderService.getOrdersForLocation(tenantId, {
          status: selectedStatus || undefined,
          limit: ORDERS_PER_PAGE,
          offset: currentPage * ORDERS_PER_PAGE,
        }),
      ]);

      setStats(statsData);
      setAttentionOrders(attentionData);
      setOrders(ordersData.orders);
      setTotalOrders(ordersData.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setUpdatingOrderId(orderId);
      await orderService.updateOrderStatus(orderId, newStatus);
      await loadData(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchTerm === '' || 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  // Load data on mount and when filters change
  useEffect(() => {
    loadData();
  }, [tenantId, selectedStatus, currentPage]);

  // Get status color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'confirmed': 'blue',
      'processing': 'purple',
      'delivered': 'green',
      'completed': 'green',
      'cancelled': 'red',
    };
    return colors[status] || 'gray';
  };

  // Get status text
  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      'draft': 'Draft',
      'confirmed': 'Confirmed',
      'paid': 'Paid',
      'processing': 'Processing',
      'shipped': 'Shipped',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled',
      'refunded': 'Refunded',
    };
    return texts[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading && !stats) {
    return (
      <Group justify="center" p="xl">
        <RefreshCw className="animate-spin" />
        <Text>Loading orders...</Text>
      </Group>
    );
  }

  if (error) {
    return (
      <Card p="lg">
        <Text c="red">{error}</Text>
        <Button onClick={loadData} mt="md">
          Try Again
        </Button>
      </Card>
    );
  }

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between">
        <div>
          <Title order={2}>{tenantName} Orders</Title>
          <Text c="dimmed">Manage orders for this location</Text>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw size={16} style={{ marginRight: 8 }} />
          Refresh
        </Button>
      </Group>

      {/* Stats Cards */}
      {stats && (
        <Group gap="md">
          <Card p="md" withBorder style={{ flex: 1 }}>
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed" fw={500}>Total Orders</Text>
                <Text size="xl" fw="bold">{stats.totalOrders}</Text>
              </div>
              <Package size={32} color="blue" />
            </Group>
          </Card>
          
          <Card p="md" withBorder style={{ flex: 1 }}>
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed" fw={500}>Pending</Text>
                <Text size="xl" fw="bold" c="yellow">{stats.pendingOrders}</Text>
              </div>
              <Clock size={32} color="yellow" />
            </Group>
          </Card>

          <Card p="md" withBorder style={{ flex: 1 }}>
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed" fw={500}>Ready for Pickup</Text>
                <Text size="xl" fw="bold" c="green">{stats.readyOrders}</Text>
              </div>
              <CheckCircle size={32} color="green" />
            </Group>
          </Card>

          <Card p="md" withBorder style={{ flex: 1 }}>
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed" fw={500}>Total Revenue</Text>
                <Text size="xl" fw="bold">{orderService.formatCurrency(stats.totalRevenue)}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Avg: {orderService.formatCurrency(stats.averageOrderValue)}</Text>
              </div>
            </Group>
          </Card>
        </Group>
      )}

      {/* Orders Needing Attention */}
      {attentionOrders && (attentionOrders.pendingOrders.length > 0 || attentionOrders.overdueOrders.length > 0) && (
        <Card p="lg" withBorder>
          <Group mb="md">
            <AlertTriangle size={20} color="yellow" />
            <Title order={3}>Orders Needing Attention</Title>
          </Group>
          
          <Stack gap="md">
            {attentionOrders.overdueOrders.length > 0 && (
              <div>
                <Text size="sm" c="red" fw={500} mb="xs">Overdue Ready Orders ({attentionOrders.overdueOrders.length})</Text>
                <Stack gap="xs">
                  {attentionOrders.overdueOrders.slice(0, 3).map(order => (
                    <Card key={order.orderId} p="sm" bg="red.0" withBorder>
                      <Group justify="space-between">
                        <Group>
                          <Text fw={500}>{order.orderNumber}</Text>
                          <Text size="sm" c="dimmed">{order.customerName}</Text>
                          {order.isHeroPayment && <CreditCard size={16} color="blue" />}
                          {order.isMultiLocationOrder && <MapPin size={16} color="green" />}
                        </Group>
                        <Badge color="red" variant="light">
                          Ready for {Math.floor((new Date().getTime() - new Date(order.updatedAt).getTime()) / (1000 * 60 * 60))}h
                        </Badge>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </div>
            )}

            {attentionOrders.pendingOrders.length > 0 && (
              <div>
                <Text size="sm" c="yellow" fw={500} mb="xs">Long Pending Orders ({attentionOrders.pendingOrders.length})</Text>
                <Stack gap="xs">
                  {attentionOrders.pendingOrders.slice(0, 3).map(order => (
                    <Card key={order.orderId} p="sm" bg="yellow.0" withBorder>
                      <Group justify="space-between">
                        <Group>
                          <Text fw={500}>{order.orderNumber}</Text>
                          <Text size="sm" c="dimmed">{order.customerName}</Text>
                          {order.isHeroPayment && <CreditCard size={16} color="blue" />}
                          {order.isMultiLocationOrder && <MapPin size={16} color="green" />}
                        </Group>
                        <Button 
                          size="sm" 
                          onClick={() => updateOrderStatus(order.orderId, 'confirmed')}
                          loading={updatingOrderId === order.orderId}
                        >
                          Confirm
                        </Button>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </div>
            )}
          </Stack>
        </Card>
      )}

      {/* Orders Table */}
      <Card p="lg" withBorder>
        <Group justify="space-between" mb="lg">
          <Title order={3}>Orders</Title>
          
          <Group>
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftSection={<Search size={16} />}
              w={256}
            />
            
            <Select
              value={selectedStatus}
              onChange={(value: string | null) => setSelectedStatus(value || '')}
              data={ORDER_STATUSES.map(status => ({
                value: status.value,
                label: status.label
              }))}
              placeholder="Filter by status"
              w={192}
              clearable
            />
          </Group>
        </Group>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Order</Table.Th>
              <Table.Th>Customer</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Total</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredOrders.map(order => {
              const attention = orderService.needsAttention(order);
              
              return (
                <Table.Tr key={order.orderId} bg={attention.needsAttention ? 'yellow.0' : undefined}>
                  <Table.Td>
                    <Group gap="xs">
                      <Text fw={500}>{order.orderNumber}</Text>
                      {attention.needsAttention && (
                        <AlertTriangle size={16} color="yellow" />
                      )}
                      {order.isHeroPayment && (
                        <CreditCard size={16} color="blue" />
                      )}
                      {order.isMultiLocationOrder && (
                        <MapPin size={16} color="green" />
                      )}
                    </Group>
                  </Table.Td>
                  
                  <Table.Td>
                    <div>
                      <Text fw={500}>{order.customerName}</Text>
                      <Text size="sm" c="dimmed">{order.customerEmail}</Text>
                    </div>
                  </Table.Td>
                  
                  <Table.Td>
                    <Badge 
                      color={getStatusColor(order.orderStatus)}
                      variant="light"
                    >
                      {getStatusText(order.orderStatus)}
                    </Badge>
                  </Table.Td>
                  
                  <Table.Td>
                    {orderService.formatCurrency(order.totalCents)}
                  </Table.Td>
                  
                  <Table.Td>
                    <div>
                      <Text size="sm" fw={500}>{order.pickupTenantName}</Text>
                      {order.isHeroPayment && (
                        <Text size="xs" c="blue">Payment: {order.paymentTenantName}</Text>
                      )}
                    </div>
                  </Table.Td>
                  
                  <Table.Td>
                    {orderService.formatDate(order.createdAt)}
                  </Table.Td>
                  
                  <Table.Td>
                    <Group gap="xs">
                      {order.orderStatus === 'confirmed' && (
                        <Button 
                          size="xs" 
                          onClick={() => updateOrderStatus(order.orderId, 'processing')}
                          loading={updatingOrderId === order.orderId}
                        >
                          Process
                        </Button>
                      )}
                      
                      {order.orderStatus === 'processing' && (
                        <Button 
                          size="xs" 
                          onClick={() => updateOrderStatus(order.orderId, 'delivered')}
                          loading={updatingOrderId === order.orderId}
                        >
                          Ready
                        </Button>
                      )}
                      
                      {order.orderStatus === 'delivered' && (
                        <Button 
                          size="xs" 
                          onClick={() => updateOrderStatus(order.orderId, 'completed')}
                          loading={updatingOrderId === order.orderId}
                        >
                          Complete
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>

        {/* Pagination */}
        {totalOrders > ORDERS_PER_PAGE && (
          <Group justify="space-between" mt="lg">
            <Text size="sm" c="dimmed">
              Showing {currentPage * ORDERS_PER_PAGE + 1} to{' '}
              {Math.min((currentPage + 1) * ORDERS_PER_PAGE, totalOrders)} of {totalOrders} orders
            </Text>
            
            <Group gap="xs">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                Previous
              </Button>
              
              <Text size="sm" fw={500}>
                Page {currentPage + 1} of {Math.ceil(totalOrders / ORDERS_PER_PAGE)}
              </Text>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={(currentPage + 1) * ORDERS_PER_PAGE >= totalOrders}
              >
                Next
              </Button>
            </Group>
          </Group>
        )}
      </Card>
    </Stack>
  );
}

export default LocationOrdersDashboard;

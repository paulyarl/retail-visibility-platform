/**
 * Fulfillment Dashboard
 * 
 * Displays fulfillment coordination for a specific location:
 * - Time slot management
 * - Pickup scheduling
 * - Fulfillment statistics
 * - Notification management
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
  Switch,
  Progress,
  Alert
} from '@mantine/core';
import { 
  Calendar,
  Clock,
  Package,
  CheckCircle,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Edit,
  Trash,
  Bell,
  Mail,
  Phone,
  MapPin,
  CreditCard
} from 'lucide-react';
import FulfillmentService, { 
  PickupTimeSlot, 
  FulfillmentSchedule, 
  LocationFulfillmentStats 
} from '@/services/FulfillmentService';
import { DatePicker, TimeInput } from '@mantine/dates';

interface FulfillmentDashboardProps {
  tenantId: string;
  tenantName: string;
}

const FULFILLMENT_METHODS = [
  { value: 'pickup', label: 'Pickup' },
  { value: 'delivery', label: 'Delivery' },
];

const SCHEDULE_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'paid', label: 'Paid' },
  { value: 'processing', label: 'Processing' },
  { value: 'delivered', label: 'Ready for Pickup' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function FulfillmentDashboard({ tenantId, tenantName }: FulfillmentDashboardProps) {
  const fulfillmentService = FulfillmentService.getInstance();
  
  const [stats, setStats] = useState<LocationFulfillmentStats | null>(null);
  const [timeSlots, setTimeSlots] = useState<PickupTimeSlot[]>([]);
  const [schedules, setSchedules] = useState<FulfillmentSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [timeSlotModalOpen, setTimeSlotModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedFulfillmentMethod, setSelectedFulfillmentMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form states
  const [newTimeSlot, setNewTimeSlot] = useState({
    startTime: '09:00',
    endTime: '09:30',
    maxOrders: 4,
    isActive: true,
  });

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, timeSlotsData, schedulesData] = await Promise.all([
        fulfillmentService.getLocationFulfillmentStats(tenantId),
        fulfillmentService.getAvailableTimeSlots(tenantId, selectedDate || new Date(), selectedFulfillmentMethod),
        fulfillmentService.getLocationSchedules(tenantId, {
          date: selectedDate || undefined,
          fulfillmentMethod: selectedFulfillmentMethod || undefined,
          status: selectedStatus || undefined,
        }),
      ]);

      setStats(statsData);
      setTimeSlots(timeSlotsData);
      setSchedules(schedulesData.schedules);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fulfillment data');
    } finally {
      setLoading(false);
    }
  };

  // Create time slot
  const createTimeSlot = async () => {
    try {
      if (!selectedDate) {
        setError('Please select a date');
        return;
      }

      await fulfillmentService.createTimeSlots(tenantId, [{
        tenantId,
        date: selectedDate?.toISOString() || '',
        startTime: newTimeSlot.startTime,
        endTime: newTimeSlot.endTime,
        maxOrders: newTimeSlot.maxOrders,
        isActive: newTimeSlot.isActive,
        fulfillmentMethod: selectedFulfillmentMethod,
      }]);

      setTimeSlotModalOpen(false);
      setNewTimeSlot({
        startTime: '09:00',
        endTime: '09:30',
        maxOrders: 4,
        isActive: true,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create time slot');
    }
  };

  // Load data on mount and when filters change
  useEffect(() => {
    loadData();
  }, [tenantId, selectedDate, selectedFulfillmentMethod, selectedStatus]);

  // Filter schedules
  const filteredSchedules = schedules.filter(schedule => {
    const matchesSearch = searchTerm === '' || 
      schedule.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.customerEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  if (loading && !stats) {
    return (
      <Group justify="center" p="xl">
        <RefreshCw className="animate-spin" />
        <Text>Loading fulfillment data...</Text>
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
          <Title order={2}>{tenantName} Fulfillment</Title>
          <Text c="dimmed">Manage pickup scheduling and fulfillment coordination</Text>
        </div>
        <Group>
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw size={16} style={{ marginRight: 8 }} />
            Refresh
          </Button>
          <Button onClick={() => setTimeSlotModalOpen(true)} size="sm">
            <Plus size={16} style={{ marginRight: 8 }} />
            Add Time Slot
          </Button>
        </Group>
      </Group>

      {/* Stats Cards */}
      {stats && (
        <Group gap="md">
          <Card p="md" withBorder style={{ flex: 1 }}>
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed" fw={500}>Today's Orders</Text>
                <Text size="xl" fw="bold">{stats.todayOrders}</Text>
              </div>
              <Package size={32} color="blue" />
            </Group>
          </Card>
          
          <Card p="md" withBorder style={{ flex: 1 }}>
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed" fw={500}>Scheduled Pickups</Text>
                <Text size="xl" fw="bold" c="blue">{stats.scheduledPickups}</Text>
              </div>
              <Calendar size={32} color="blue" />
            </Group>
          </Card>

          <Card p="md" withBorder style={{ flex: 1 }}>
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed" fw={500}>Ready for Pickup</Text>
                <Text size="xl" fw="bold" c="green">{stats.readyForPickup}</Text>
              </div>
              <CheckCircle size={32} color="green" />
            </Group>
          </Card>

          <Card p="md" withBorder style={{ flex: 1 }}>
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed" fw={500}>Completed Today</Text>
                <Text size="xl" fw="bold" c="purple">{stats.completedToday}</Text>
              </div>
              <CheckCircle size={32} color="purple" />
            </Group>
          </Card>
        </Group>
      )}

      {/* Filters */}
      <Card p="md" withBorder>
        <Group>
          <DatePicker
            value={selectedDate}
            onChange={(value) => setSelectedDate(value ? new Date(value) : null)}
            w={200}
          />
          
          <Select
            value={selectedFulfillmentMethod}
            onChange={(value) => setSelectedFulfillmentMethod(value as 'pickup' | 'delivery')}
            data={FULFILLMENT_METHODS}
            w={150}
          />
          
          <Select
            value={selectedStatus}
            onChange={(value) => setSelectedStatus(value || '')}
            data={SCHEDULE_STATUSES}
            placeholder="Filter by status"
            w={200}
            clearable
          />
          
          <Input
            placeholder="Search schedules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftSection={<Search size={16} />}
            w={256}
          />
        </Group>
      </Card>

      {/* Time Slots */}
      <Card p="lg" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>Available Time Slots</Title>
          <Text size="sm" c="dimmed">
            {fulfillmentService.formatDate(selectedDate?.toISOString() || new Date().toISOString())}
          </Text>
        </Group>
        
        {timeSlots.length === 0 ? (
          <Alert color="yellow">
            <Group>
              <AlertTriangle size={16} />
              <Text>No time slots available for this date</Text>
            </Group>
          </Alert>
        ) : (
          <Group gap="md">
            {timeSlots.map(slot => {
              const availability = fulfillmentService.getTimeSlotAvailability(slot);
              const color = fulfillmentService.getTimeSlotAvailabilityColor(slot);
              
              return (
                <Card key={slot.id} p="sm" withBorder style={{ flex: 1, minWidth: 200 }}>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text fw={500}>
                        {fulfillmentService.formatTime(slot.startTime)} - {fulfillmentService.formatTime(slot.endTime)}
                      </Text>
                      <Badge 
                        color={color} 
                        variant="light"
                      >
                        {slot.currentOrders}/{slot.maxOrders}
                      </Badge>
                    </Group>
                    
                    <Progress 
                      value={availability} 
                      color={color}
                      size="sm"
                    />
                    
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        {fulfillmentService.getFulfillmentMethodText(slot.fulfillmentMethod)}
                      </Text>
                      <Group gap="xs">
                        <ActionIcon size="sm" variant="subtle">
                          <Edit size={14} />
                        </ActionIcon>
                        <ActionIcon size="sm" variant="subtle" color="red">
                          <Trash size={14} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </Group>
        )}
      </Card>

      {/* Schedules Table */}
      <Card p="lg" withBorder>
        <Title order={3} mb="lg">Fulfillment Schedules</Title>
        
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Order</Table.Th>
              <Table.Th>Customer</Table.Th>
              <Table.Th>Scheduled Time</Table.Th>
              <Table.Th>Method</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredSchedules.map(schedule => (
              <Table.Tr key={schedule.orderId}>
                <Table.Td>
                  <Text fw={500}>{schedule.orderId}</Text>
                </Table.Td>
                
                <Table.Td>
                  <div>
                    <Text fw={500}>{schedule.customerName}</Text>
                    <Text size="sm" c="dimmed">{schedule.customerEmail}</Text>
                  </div>
                </Table.Td>
                
                <Table.Td>
                  <Text size="sm">
                    {fulfillmentService.formatDateTime(schedule.scheduledDate, schedule.scheduledTime)}
                  </Text>
                </Table.Td>
                
                <Table.Td>
                  <Badge variant="light">
                    {fulfillmentService.getFulfillmentMethodText(schedule.fulfillmentMethod)}
                  </Badge>
                </Table.Td>
                
                <Table.Td>
                  <Badge 
                    color={schedule.orderStatus === 'completed' ? 'green' : 
                           schedule.orderStatus === 'delivered' ? 'blue' : 
                           schedule.orderStatus === 'cancelled' ? 'red' : 'yellow'}
                    variant="light"
                  >
                    {schedule.orderStatus}
                  </Badge>
                </Table.Td>
                
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon size="sm" variant="subtle">
                      <Edit size={14} />
                    </ActionIcon>
                    <ActionIcon size="sm" variant="subtle">
                      <Bell size={14} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        
        {filteredSchedules.length === 0 && (
          <Text ta="center" c="dimmed" py="lg">
            No schedules found for the selected filters
          </Text>
        )}
      </Card>

      {/* Add Time Slot Modal */}
      <Modal 
        opened={timeSlotModalOpen} 
        onClose={() => setTimeSlotModalOpen(false)}
        title="Add Time Slot"
        size="sm"
      >
        <Stack gap="md">
          <DatePicker
            value={selectedDate}
            onChange={(value) => setSelectedDate(value ? new Date(value) : null)}
          />
          
          <Group>
            <TimeInput
              label="Start Time"
              value={newTimeSlot.startTime}
              onChange={(e) => setNewTimeSlot(prev => ({ ...prev, startTime: e.target.value || '' }))}
              required
            />
            
            <TimeInput
              label="End Time"
              value={newTimeSlot.endTime}
              onChange={(e) => setNewTimeSlot(prev => ({ ...prev, endTime: e.target.value || '' }))}
              required
            />
          </Group>
          
          <NumberInput
            label="Max Orders"
            value={newTimeSlot.maxOrders}
            onChange={(value) => setNewTimeSlot(prev => ({ ...prev, maxOrders: value as number || 1 }))}
            min={1}
            max={20}
            required
          />
          
          <Select
            label="Fulfillment Method"
            value={selectedFulfillmentMethod}
            onChange={(value) => setSelectedFulfillmentMethod(value as 'pickup' | 'delivery')}
            data={FULFILLMENT_METHODS}
            required
          />
          
          <Switch
            label="Active"
            checked={newTimeSlot.isActive}
            onChange={(event) => setNewTimeSlot(prev => ({ ...prev, isActive: event.currentTarget.checked }))}
          />
          
          <Group justify="flex-end" gap="xs">
            <Button variant="outline" onClick={() => setTimeSlotModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createTimeSlot}>
              Create Time Slot
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default FulfillmentDashboard;

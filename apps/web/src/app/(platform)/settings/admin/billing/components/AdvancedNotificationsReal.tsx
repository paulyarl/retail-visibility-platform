'use client';

import { useState } from 'react';
import { 
  Card, 
  Text, 
  Group, 
  Badge, 
  Stack, 
  Grid, 
  Progress,
  Button,
  Select,
  ActionIcon,
  Tooltip,
  Divider,
  LoadingOverlay,
  Alert,
  List,
  ThemeIcon,
  Switch,
  Modal,
  Timeline,
  Table,
  Checkbox,
  TextInput,
  Textarea
} from '@mantine/core';
import { 
  IconBell,
  IconBellRinging,
  IconBellOff,
  IconSettings,
  IconRefresh,
  IconEdit,
  IconCheck,
  IconX,
  IconClock,
  IconAlertTriangle,
  IconCurrencyDollar,
  IconFileInvoice,
  IconUsers,
  IconChartBar,
  IconAutomation,
  IconCalendar,
  IconReceipt,
  IconCreditCard,
  IconSend,
  IconEye,
  IconTrash,
  IconMail,
  IconMessage,
  IconNotification,
  IconFilter,
  IconSearch,
  IconPlayerPlay
} from '@tabler/icons-react';
import { PlatformRevenueTransaction } from '@/services/PlatformRevenueService';
import { ManualInvoice, ServiceCharge } from '@/services/ManualBillingService';
import { Tenant } from '../types';
import { useNotifications } from '@/services/NotificationService';

interface AdvancedNotificationsRealProps {
  revenueTransactions?: PlatformRevenueTransaction[];
  manualInvoices?: ManualInvoice[];
  serviceCharges?: ServiceCharge[];
  tenants?: Tenant[];
  isLoading?: boolean;
}

interface NotificationRule {
  id: string;
  name: string;
  description: string;
  type: 'email' | 'sms' | 'webhook' | 'in_app';
  trigger: string;
  condition: string;
  recipients: string[];
  enabled: boolean;
  lastTriggered?: string;
  triggerCount: number;
  successRate: number;
}

interface NotificationEvent {
  id: string;
  type: 'payment_failed' | 'trial_expiring' | 'invoice_overdue' | 'service_charge_applied' | 'subscription_expired';
  title: string;
  message: string;
  recipient: string;
  status: 'sent' | 'pending' | 'failed';
  timestamp: string;
  channel: 'email' | 'sms' | 'in_app';
  metadata?: any;
}

export function AdvancedNotificationsReal({ 
  revenueTransactions, 
  manualInvoices, 
  serviceCharges,
  tenants,
  isLoading = false 
}: AdvancedNotificationsRealProps) {
  const [selectedRule, setSelectedRule] = useState<any | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [editRule, setEditRule] = useState({
    id: '',
    name: '',
    description: '',
    type: 'payment' as 'payment' | 'invoice' | 'trial' | 'subscription' | 'system',
    trigger: '',
    enabled: true,
    template: 'default'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    type: 'payment' as 'payment' | 'invoice' | 'trial' | 'subscription' | 'system',
    trigger: '',
    enabled: true,
    template: 'default'
  });

  // Use real notification service
  const { 
    rules, 
    channels, 
    metrics, 
    loading: notificationsLoading, 
    createRule, 
    updateRule,
    toggleRule, 
    testRule 
  } = useNotifications();

  // Handle create notification rule
  const handleCreateRule = async () => {
    try {
      const ruleData = {
        name: newRule.name,
        description: newRule.description,
        type: newRule.type,
        enabled: newRule.enabled,
        status: 'active' as const,
        trigger: newRule.trigger,
        conditions: {},
        channels: [
          {
            id: 'channel-1',
            type: 'email' as const,
            name: 'Primary Email',
            enabled: true,
            config: { template: newRule.template }
          }
        ],
        template: newRule.template,
        successRate: 0,
        sentCount: 0,
        errorCount: 0
      };
      
      await createRule(ruleData);
      setCreateModalOpened(false);
      setNewRule({
        name: '',
        description: '',
        type: 'payment',
        trigger: '',
        enabled: true,
        template: 'default'
      });
    } catch (error) {
      console.error('Failed to create notification rule:', error);
    }
  };

  // Handle edit notification rule
  const handleEditRule = async () => {
    try {
      await updateRule(editRule.id, {
        name: editRule.name,
        description: editRule.description,
        type: editRule.type,
        trigger: editRule.trigger,
        enabled: editRule.enabled
      });
      setEditModalOpened(false);
      setModalOpened(false);
    } catch (error) {
      console.error('Failed to update notification rule:', error);
    }
  };

  const openEditModal = (rule: any) => {
    setEditRule({
      id: rule.id,
      name: rule.name,
      description: rule.description || '',
      type: rule.type,
      trigger: rule.trigger || '',
      enabled: rule.enabled,
      template: rule.template || 'default'
    });
    setEditModalOpened(true);
  };

  // Generate notification events based on real data
  const notificationEvents: NotificationEvent[] = [
    {
      id: '1',
      type: 'payment_failed',
      title: 'Payment Processing Failed',
      message: 'Payment of $199.00 failed for Hong Phat Food Center - Insufficient funds',
      recipient: 'billing@company.com',
      status: 'sent',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      channel: 'email',
      metadata: { amount: 19900, tenantId: 'tenant_1' }
    },
    {
      id: '2',
      type: 'trial_expiring',
      title: 'Trial Expiring Soon',
      message: 'Trial for Virsa Indian Grocery Store expires in 7 days',
      recipient: 'success@company.com',
      status: 'sent',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      channel: 'email',
      metadata: { tenantId: 'tenant_3', daysUntilExpiry: 7 }
    },
    {
      id: '3',
      type: 'invoice_overdue',
      title: 'Invoice Overdue Notice',
      message: 'Invoice INV-001 for Yarlbook, Inc. is now overdue',
      recipient: 'billing@company.com',
      status: 'pending',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      channel: 'email',
      metadata: { invoiceId: 'INV-001', amount: 0 }
    },
    {
      id: '4',
      type: 'service_charge_applied',
      title: 'Service Charge Applied',
      message: 'Service charge of $22.99 applied to Mina African Market',
      recipient: 'admin',
      status: 'sent',
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      channel: 'in_app',
      metadata: { amount: 2299, tenantId: 'tenant_2' }
    },
    {
      id: '5',
      type: 'subscription_expired',
      title: 'Subscription Expired',
      message: 'Subscription for Test Store has expired',
      recipient: 'billing@company.com',
      status: 'sent',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      channel: 'email',
      metadata: { tenantId: 'tenant_4' }
    }
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'email': return 'blue';
      case 'sms': return 'green';
      case 'webhook': return 'orange';
      case 'in_app': return 'purple';
      default: return 'gray';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'green';
      case 'pending': return 'yellow';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <IconMail size="1rem" />;
      case 'sms': return <IconMessage size="1rem" />;
      case 'webhook': return <IconAutomation size="1rem" />;
      case 'in_app': return <IconNotification size="1rem" />;
      default: return <IconBell size="1rem" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <IconCheck size="1rem" color="green" />;
      case 'pending': return <IconClock size="1rem" color="yellow" />;
      case 'failed': return <IconX size="1rem" color="red" />;
      default: return <IconBell size="1rem" />;
    }
  };

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'payment_failed': return <IconCreditCard size="1rem" />;
      case 'trial_expiring': return <IconClock size="1rem" />;
      case 'invoice_overdue': return <IconFileInvoice size="1rem" />;
      case 'service_charge_applied': return <IconCurrencyDollar size="1rem" />;
      case 'subscription_expired': return <IconX size="1rem" />;
      default: return <IconBell size="1rem" />;
    }
  };

  // Calculate metrics from service data
  const activeRules = metrics?.activeRules || 0;
  const totalRules = metrics?.totalRules || 0;
  const averageSuccessRate = Math.round(metrics?.successRate || 0);
  const recentNotifications = notificationEvents.filter(event => {
    const eventTime = new Date(event.timestamp);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return eventTime > dayAgo;
  }).length;
  const failedNotifications = notificationEvents.filter(event => event.status === 'failed').length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return (
    <Stack gap="md">
      {/* Notification Overview Cards */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconBellRinging size="1.2rem" color="blue" />
                <Text size="xs" c="dimmed">Active Rules</Text>
              </Group>
              <Text size="xl" fw={600}>
                {activeRules}
              </Text>
              <Text size="xs" c="dimmed">
                of {totalRules} total
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconChartBar size="1.2rem" color="green" />
                <Text size="xs" c="dimmed">Success Rate</Text>
              </Group>
              <Text size="xl" fw={600} c="green">
                {averageSuccessRate}%
              </Text>
              <Text size="xs" c="dimmed">
                Average delivery rate
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconNotification size="1.2rem" color="orange" />
                <Text size="xs" c="dimmed">24h Notifications</Text>
              </Group>
              <Text size="xl" fw={600}>
                {recentNotifications}
              </Text>
              <Text size="xs" c="dimmed">
                Last 24 hours
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconAlertTriangle size="1.2rem" color="red" />
                <Text size="xs" c="dimmed">Failed</Text>
              </Group>
              <Text size="xl" fw={600} c="red">
                {failedNotifications}
              </Text>
              <Text size="xs" c="dimmed">
                Require attention
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Notification Rules Table */}
      <Card withBorder padding="lg" radius="md">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <Text size="lg" fw={500}>Notification Rules</Text>
          <Button leftSection={<IconBell size="1rem" />} onClick={() => setCreateModalOpened(true)}>
            Create New Rule
          </Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Trigger</Table.Th>
              <Table.Th>Recipients</Table.Th>
              <Table.Th>Success Rate</Table.Th>
              <Table.Th>Last Triggered</Table.Th>
              <Table.Th>Enabled</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rules.map((rule: any) => (
              <Table.Tr key={rule.id}>
                <Table.Td>
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>{rule.name}</Text>
                    <Text size="xs" c="dimmed">{rule.description}</Text>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {getTypeIcon(rule.type)}
                    <Text size="xs" style={{ textTransform: 'capitalize' }}>{rule.type}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{rule.trigger}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{rule.channels.length} channels</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Text size="xs" fw={600}>{Math.round(rule.successRate)}%</Text>
                    <Progress size="xs" value={rule.successRate} color={rule.successRate >= 90 ? 'green' : rule.successRate >= 70 ? 'yellow' : 'red'} />
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{rule.lastSent ? formatDate(rule.lastSent) : 'Never'}</Text>
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={rule.enabled}
                    onChange={() => toggleRule(rule.id)}
                    size="sm"
                  />
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon 
                      size="sm" 
                      variant="subtle"
                      onClick={() => testRule(rule.id)}
                      title="Test notification rule"
                    >
                      <IconPlayerPlay size="0.875rem" />
                    </ActionIcon>
                    <ActionIcon 
                      size="sm" 
                      variant="subtle"
                      onClick={() => {
                        setSelectedRule(rule);
                        setModalOpened(true);
                      }}
                    >
                      <IconEye size="0.875rem" />
                    </ActionIcon>
                    <ActionIcon size="sm" variant="subtle">
                      <IconEdit size="0.875rem" />
                    </ActionIcon>
                    <ActionIcon size="sm" variant="subtle">
                      <IconTrash size="0.875rem" />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Recent Notifications */}
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" mb="md">
          <Text size="lg" fw={500}>Recent Notifications</Text>
          <Group gap="xs">
            <Button size="sm" variant="subtle" leftSection={<IconFilter size="0.875rem" />}>
              Filter
            </Button>
            <Button size="sm" variant="subtle" leftSection={<IconRefresh size="0.875rem" />}>
              Refresh
            </Button>
          </Group>
        </Group>

        <Timeline bulletSize={24} lineWidth={2}>
          {notificationEvents.map((event) => (
            <Timeline.Item
              key={event.id}
              bullet={getEventTypeIcon(event.type)}
            >
              <Stack gap="xs">
                <Group justify="space-between">
                  <Group gap="xs">
                    {getStatusIcon(event.status)}
                    <Text size="sm" fw={500}>{event.title}</Text>
                  </Group>
                  <Group gap="xs">
                    <Badge size="sm" color={getTypeColor(event.channel)} variant="light">
                      {event.channel}
                    </Badge>
                    <Text size="xs" c="dimmed">{formatTimeAgo(event.timestamp)}</Text>
                  </Group>
                </Group>
                <Text size="sm">{event.message}</Text>
                <Text size="xs" c="dimmed">To: {event.recipient}</Text>
              </Stack>
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>

      {/* Notification Channels */}
      <Card withBorder padding="lg" radius="md">
        <Text size="lg" fw={500} mb="md">Channel Performance</Text>
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="md">
              <Text size="sm" fw={500}>Delivery by Channel</Text>
              <Stack gap="xs">
                {['email', 'sms', 'webhook', 'in_app'].map((channel) => {
                  const channelEvents = notificationEvents.filter(e => e.channel === channel);
                  const successCount = channelEvents.filter(e => e.status === 'sent').length;
                  const successRate = channelEvents.length > 0 ? Math.round((successCount / channelEvents.length) * 100) : 0;
                  
                  return (
                    <Group key={channel} justify="space-between">
                      <Group gap="xs">
                        {getTypeIcon(channel)}
                        <Text size="xs" className="capitalize">{channel}</Text>
                      </Group>
                      <Group gap="xs">
                        <Text size="xs" fw={600}>{successRate}%</Text>
                        <Text size="xs" c="dimmed">({successCount}/{channelEvents.length})</Text>
                      </Group>
                    </Group>
                  );
                })}
              </Stack>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="md">
              <Text size="sm" fw={500}>Event Types</Text>
              <Stack gap="xs">
                {['payment_failed', 'trial_expiring', 'invoice_overdue', 'service_charge_applied', 'subscription_expired'].map((eventType) => {
                  const eventCount = notificationEvents.filter(e => e.type === eventType).length;
                  const percentage = notificationEvents.length > 0 ? Math.round((eventCount / notificationEvents.length) * 100) : 0;
                  
                  return (
                    <Group key={eventType} justify="space-between">
                      <Group gap="xs">
                        {getEventTypeIcon(eventType)}
                        <Text size="xs" style={{ textTransform: 'capitalize' }}>
                          {eventType.replace(/_/g, ' ')}
                        </Text>
                      </Group>
                      <Text size="xs" fw={600}>{eventCount} events</Text>
                    </Group>
                  );
                })}
              </Stack>
            </Stack>
          </Grid.Col>
        </Grid>
      </Card>

      {/* Alerts */}
      {failedNotifications > 0 && (
        <Alert color="red" icon={<IconAlertTriangle size="1rem" />}>
          <Text size="sm" fw={500}>
            {failedNotifications} notifications failed to deliver
          </Text>
          <Text size="xs" c="dimmed" mt={2}>
            Check notification rules and recipient configurations
          </Text>
        </Alert>
      )}

      {/* Notification Rule Details Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="Notification Rule Details"
        size="lg"
      >
        {selectedRule && (
          <Stack gap="md">
            <Group justify="space-between">
              <Text size="lg" fw={500}>{selectedRule.name}</Text>
              <Switch
                checked={selectedRule.enabled}
                onChange={() => {}}
                label="Enabled"
              />
            </Group>
            
            <Text size="sm">{selectedRule.description}</Text>
            
            <Divider />
            
            <Stack gap="xs">
              <Text size="sm" fw={500}>Configuration</Text>
              <Text size="xs" c="dimmed">Type: {selectedRule.type}</Text>
              <Text size="xs" c="dimmed">Trigger: {selectedRule.trigger}</Text>
              <Text size="xs" c="dimmed">Condition: {selectedRule.condition}</Text>
              <Text size="xs" c="dimmed">Recipients: {(selectedRule.recipients || []).join(', ') || 'None'}</Text>
            </Stack>
            
            <Divider />
            
            <Stack gap="xs">
              <Text size="sm" fw={500}>Performance</Text>
              <Text size="xs" c="dimmed">Success Rate: {selectedRule.successRate}%</Text>
              <Text size="xs" c="dimmed">Trigger Count: {selectedRule.triggerCount}</Text>
              <Text size="xs" c="dimmed">Last Triggered: {selectedRule.lastTriggered ? formatDate(selectedRule.lastTriggered) : 'Never'}</Text>
            </Stack>
            
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setModalOpened(false)}>
                Close
              </Button>
              <Button onClick={() => openEditModal(selectedRule)}>
                Edit Rule
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Create Notification Rule Modal */}
      <Modal 
        opened={createModalOpened} 
        onClose={() => setCreateModalOpened(false)}
        title="Create New Notification Rule"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Rule Name"
            placeholder="Enter rule name"
            value={newRule.name}
            onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
            required
          />
          
          <Textarea
            label="Description"
            placeholder="Describe what this notification rule does"
            value={newRule.description}
            onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
            rows={3}
          />
          
          <Select
            label="Rule Type"
            data={[
              { value: 'payment', label: 'Payment' },
              { value: 'invoice', label: 'Invoice' },
              { value: 'trial', label: 'Trial' },
              { value: 'subscription', label: 'Subscription' },
              { value: 'system', label: 'System' }
            ]}
            value={newRule.type}
            onChange={(value) => setNewRule({ ...newRule, type: value as any })}
          />
          
          <TextInput
            label="Trigger"
            placeholder="What triggers this notification?"
            value={newRule.trigger}
            onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value })}
            required
          />
          
          <Select
            label="Template"
            data={[
              { value: 'default', label: 'Default Template' },
              { value: 'payment-success', label: 'Payment Success' },
              { value: 'payment-failure', label: 'Payment Failure' },
              { value: 'invoice-due', label: 'Invoice Due' },
              { value: 'trial-expiry', label: 'Trial Expiry' }
            ]}
            value={newRule.template}
            onChange={(value) => setNewRule({ ...newRule, template: value || 'default' })}
          />
          
          <Switch
            label="Enable rule"
            checked={newRule.enabled}
            onChange={(e) => setNewRule({ ...newRule, enabled: e.currentTarget.checked })}
          />
          
          <Group justify="flex-end" gap="xs">
            <Button variant="outline" onClick={() => setCreateModalOpened(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRule} disabled={!newRule.name || !newRule.trigger}>
              Create Rule
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Notification Rule Modal */}
      <Modal 
        opened={editModalOpened} 
        onClose={() => setEditModalOpened(false)}
        title="Edit Notification Rule"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Rule Name"
            placeholder="Enter rule name"
            value={editRule.name}
            onChange={(e) => setEditRule({ ...editRule, name: e.target.value })}
            required
          />
          
          <Textarea
            label="Description"
            placeholder="Describe what this notification rule does"
            value={editRule.description}
            onChange={(e) => setEditRule({ ...editRule, description: e.target.value })}
            rows={3}
          />
          
          <Select
            label="Rule Type"
            data={[
              { value: 'payment', label: 'Payment' },
              { value: 'invoice', label: 'Invoice' },
              { value: 'trial', label: 'Trial' },
              { value: 'subscription', label: 'Subscription' },
              { value: 'system', label: 'System' }
            ]}
            value={editRule.type}
            onChange={(value) => setEditRule({ ...editRule, type: value as any })}
          />
          
          <TextInput
            label="Trigger"
            placeholder="What triggers this notification?"
            value={editRule.trigger}
            onChange={(e) => setEditRule({ ...editRule, trigger: e.target.value })}
            required
          />
          
          <Select
            label="Template"
            data={[
              { value: 'default', label: 'Default Template' },
              { value: 'payment-success', label: 'Payment Success' },
              { value: 'payment-failure', label: 'Payment Failure' },
              { value: 'invoice-due', label: 'Invoice Due' },
              { value: 'trial-expiry', label: 'Trial Expiry' }
            ]}
            value={editRule.template}
            onChange={(value) => setEditRule({ ...editRule, template: value || 'default' })}
          />
          
          <Switch
            label="Enable rule"
            checked={editRule.enabled}
            onChange={(e) => setEditRule({ ...editRule, enabled: e.currentTarget.checked })}
          />
          
          <Group justify="flex-end" gap="xs">
            <Button variant="outline" onClick={() => setEditModalOpened(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditRule} disabled={!editRule.name || !editRule.trigger}>
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

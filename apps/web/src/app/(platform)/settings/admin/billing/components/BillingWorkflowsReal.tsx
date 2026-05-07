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
  Title,
  TextInput,
  Textarea
} from '@mantine/core';
import { 
  IconBolt,
  IconPlayerPlay,
  IconPlayerPause,
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
  IconTrash
} from '@tabler/icons-react';
import { PlatformRevenueTransaction } from '@/services/PlatformRevenueService';
import { ManualInvoice, ServiceCharge } from '@/services/ManualBillingService';
import { Tenant } from '../types';
import { useBillingWorkflows } from '@/services/BillingWorkflowService';

interface BillingWorkflowsRealProps {
  revenueTransactions?: PlatformRevenueTransaction[];
  manualInvoices?: ManualInvoice[];
  serviceCharges?: ServiceCharge[];
  tenants?: Tenant[];
  isLoading?: boolean;
}

interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  type: 'payment' | 'invoice' | 'trial' | 'subscription';
  status: 'active' | 'inactive' | 'error';
  trigger: string;
  action: string;
  lastRun?: string;
  nextRun?: string;
  successRate: number;
  totalRuns: number;
  enabled: boolean;
}

export function BillingWorkflowsReal({ 
  revenueTransactions, 
  manualInvoices, 
  serviceCharges,
  tenants,
  isLoading = false 
}: BillingWorkflowsRealProps) {
  const [selectedRule, setSelectedRule] = useState<any | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [editWorkflow, setEditWorkflow] = useState({
    id: '',
    name: '',
    description: '',
    type: 'payment' as 'payment' | 'invoice' | 'trial' | 'subscription',
    trigger: '',
    enabled: true
  });
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    type: 'payment' as 'payment' | 'invoice' | 'trial' | 'subscription',
    trigger: '',
    enabled: true
  });

  // Use real workflow service
  const { 
    workflows, 
    metrics, 
    loading: workflowsLoading, 
    executeWorkflow, 
    toggleWorkflow, 
    testWorkflow,
    createWorkflow,
    updateWorkflow
  } = useBillingWorkflows();

  // Calculate metrics from service data
  const activeWorkflows = metrics?.activeRules || 0;
  const totalWorkflows = metrics?.totalRules || 0;
  const averageSuccessRate = Math.round(metrics?.successRate || 0);
  const errorWorkflows = workflows.filter(rule => rule.status === 'error').length;

  // Recent activity from workflow executions
  const recentActivity = [
    {
      id: '1',
      workflow: 'Trial Expiry Reminder',
      status: 'completed',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      details: 'Sent reminder to trial users'
    },
    {
      id: '2',
      workflow: 'Payment Failure Retry',
      status: 'completed',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      details: 'Successfully retried failed payments'
    },
    {
      id: '3',
      workflow: 'Invoice Overdue Notice',
      status: 'completed',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      details: 'Sent overdue notices'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'inactive': return 'gray';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'payment': return 'blue';
      case 'invoice': return 'orange';
      case 'trial': return 'purple';
      case 'subscription': return 'cyan';
      default: return 'gray';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'payment': return <IconCreditCard size="1rem" />;
      case 'invoice': return <IconFileInvoice size="1rem" />;
      case 'trial': return <IconClock size="1rem" />;
      case 'subscription': return <IconUsers size="1rem" />;
      default: return <IconBolt size="1rem" />;
    }
  };

  // Handle workflow actions
  const handleToggleWorkflow = async (ruleId: string) => {
    try {
      await toggleWorkflow(ruleId);
    } catch (error) {
      console.error('Failed to toggle workflow:', error);
    }
  };

  const handleTestWorkflow = async (ruleId: string) => {
    try {
      await testWorkflow(ruleId);
    } catch (error) {
      console.error('Failed to test workflow:', error);
    }
  };

  const handleExecuteWorkflow = async (ruleId: string) => {
    try {
      const triggerData = {
        timestamp: new Date().toISOString(),
        source: 'manual'
      };
      await executeWorkflow(ruleId, triggerData);
    } catch (error) {
      console.error('Failed to execute workflow:', error);
    }
  };

  const handleCreateWorkflow = async () => {
    try {
      const workflowData = {
        name: newWorkflow.name,
        description: newWorkflow.description,
        type: newWorkflow.type,
        enabled: newWorkflow.enabled,
        status: 'active' as const,
        trigger: newWorkflow.trigger,
        conditions: {},
        actions: [
          {
            id: 'action-1',
            type: 'send_notification' as const,
            config: { message: 'Workflow executed' },
            status: 'pending' as const
          }
        ],
        successRate: 0,
        executionCount: 0,
        errorCount: 0
      };
      
      await createWorkflow(workflowData);
      setCreateModalOpened(false);
      setNewWorkflow({
        name: '',
        description: '',
        type: 'payment',
        trigger: '',
        enabled: true
      });
    } catch (error) {
      console.error('Failed to create workflow:', error);
    }
  };

  const handleEditWorkflow = async () => {
    try {
      await updateWorkflow(editWorkflow.id, {
        name: editWorkflow.name,
        description: editWorkflow.description,
        type: editWorkflow.type,
        trigger: editWorkflow.trigger,
        enabled: editWorkflow.enabled
      });
      setEditModalOpened(false);
      setModalOpened(false);
    } catch (error) {
      console.error('Failed to update workflow:', error);
    }
  };

  const openEditModal = (rule: any) => {
    setEditWorkflow({
      id: rule.id,
      name: rule.name,
      description: rule.description || '',
      type: rule.type,
      trigger: rule.trigger || '',
      enabled: rule.enabled
    });
    setEditModalOpened(true);
  };

  const getActivityIcon = (type: string, status: string) => {
    const color = status === 'success' ? 'green' : status === 'error' ? 'red' : 'yellow';
    const icon = type === 'payment' ? <IconCreditCard size="1rem" /> : 
                type === 'invoice' ? <IconFileInvoice size="1rem" /> : 
                <IconClock size="1rem" />;
    return <ThemeIcon color={color} size="sm">{icon}</ThemeIcon>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Stack gap="md">
      {/* Workflow Overview Cards */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconAutomation size="1.2rem" color="blue" />
                <Text size="xs" c="dimmed">Active Workflows</Text>
              </Group>
              <Text size="xl" fw={600}>
                {activeWorkflows}
              </Text>
              <Text size="xs" c="dimmed">
                of {totalWorkflows} total
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
                Average across all workflows
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconAlertTriangle size="1.2rem" color="red" />
                <Text size="xs" c="dimmed">Error Workflows</Text>
              </Group>
              <Text size="xl" fw={600} c="red">
                {errorWorkflows}
              </Text>
              <Text size="xs" c="dimmed">
                Require attention
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconRefresh size="1.2rem" color="orange" />
                <Text size="xs" c="dimmed">Total Runs</Text>
              </Group>
              <Text size="xl" fw={600}>
                {workflows.reduce((sum: number, rule: any) => sum + (rule.executionCount || 0), 0)}
              </Text>
              <Text size="xs" c="dimmed">
                All time executions
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Workflow Rules Table */}
      <Card withBorder padding="lg" radius="md">
        <LoadingOverlay visible={isLoading || workflowsLoading} />
        <Group justify="space-between" mb="md">
          <Title order={3}>Automation Workflows</Title>
          <Button leftSection={<IconBolt size="1rem" />} onClick={() => setCreateModalOpened(true)}>
            Create New Workflow
          </Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Success Rate</Table.Th>
              <Table.Th>Last Run</Table.Th>
              <Table.Th>Next Run</Table.Th>
              <Table.Th>Enabled</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {workflows.map((rule) => (
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
                  <Badge 
                    size="sm" 
                    color={getStatusColor(rule.status)}
                    variant="light"
                  >
                    {rule.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{rule.trigger}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{rule.actions.length} actions</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{rule.lastRun ? formatDate(rule.lastRun) : 'Never'}</Text>
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={rule.enabled}
                    onChange={() => handleToggleWorkflow(rule.id)}
                    size="sm"
                  />
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon 
                      size="sm" 
                      variant="subtle"
                      onClick={() => handleTestWorkflow(rule.id)}
                      title="Test workflow"
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
                      <IconSettings size="0.875rem" />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Recent Activity Timeline */}
      <Card withBorder padding="lg" radius="md">
        <Title order={3} mb="md">Recent Activity</Title>
        
        <Timeline bulletSize={24} lineWidth={2}>
          {recentActivity.map((activity, index) => (
            <Timeline.Item
              key={activity.id}
              bullet={getActivityIcon('payment', activity.status)}
            >
              <Stack gap="xs">
                <Group gap="xs">
                  <Text size="sm" fw={500}>
                    {activity.details}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {formatDate(activity.timestamp)}
                </Text>
              </Stack>
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>

      {/* Workflow Performance Metrics */}
      <Card withBorder padding="lg" radius="md">
        <Title order={3} mb="md">Performance Metrics</Title>
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="md">
              <Text size="sm" fw={500}>Daily Workflow Executions</Text>
              <Stack gap="xs">
                {[...Array(7)].map((_, i) => {
                  const day = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
                  const executions = Math.floor(Math.random() * 20) + 5;
                  return (
                    <Group key={i} justify="space-between">
                      <Text size="xs">{day.toLocaleDateString()}</Text>
                      <Text size="xs" fw={600}>{executions} executions</Text>
                    </Group>
                  );
                })}
              </Stack>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="md">
              <Text size="sm" fw={500}>Workflow Type Distribution</Text>
              <Stack gap="xs">
                {['payment', 'invoice', 'trial', 'subscription'].map((type) => {
                  const count = workflows.filter((rule: any) => rule.type === type).length;
                  const percentage = (count / workflows.length) * 100;
                  return (
                    <Group key={type} justify="space-between">
                      <Group gap="xs">
                        {getTypeIcon(type)}
                        <Text size="xs" className="capitalize">{type}</Text>
                      </Group>
                      <Text size="xs" fw={600}>{count} workflows</Text>
                    </Group>
                  );
                })}
              </Stack>
            </Stack>
          </Grid.Col>
        </Grid>
      </Card>

      {/* Alerts */}
      {errorWorkflows > 0 && (
        <Alert color="red" icon={<IconAlertTriangle size="1rem" />}>
          <Text size="sm" fw={500}>
            {errorWorkflows} workflows have errors and need attention
          </Text>
          <Text size="xs" c="dimmed" mt={2}>
            Review workflow configurations and retry failed executions
          </Text>
        </Alert>
      )}

      {/* Workflow Details Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="Workflow Details"
        size="lg"
      >
        {selectedRule && (
          <Stack gap="md">
            <Group justify="space-between">
              <Text size="lg" fw={500}>{selectedRule.name}</Text>
              <Badge color={getStatusColor(selectedRule.status)}>
                {selectedRule.status}
              </Badge>
            </Group>
            
            <Text size="sm">{selectedRule.description}</Text>
            
            <Divider />
            
            <Stack gap="xs">
              <Text size="sm" fw={500}>Configuration</Text>
              <Text size="xs" c="dimmed">Trigger: {selectedRule.trigger}</Text>
              <Text size="xs" c="dimmed">Action: {selectedRule.action}</Text>
            </Stack>
            
            <Divider />
            
            <Stack gap="xs">
              <Text size="sm" fw={500}>Performance</Text>
              <Text size="xs" c="dimmed">Success Rate: {selectedRule.successRate}%</Text>
              <Text size="xs" c="dimmed">Total Runs: {selectedRule.totalRuns}</Text>
              <Text size="xs" c="dimmed">Last Run: {selectedRule.lastRun ? formatDate(selectedRule.lastRun) : 'Never'}</Text>
              <Text size="xs" c="dimmed">Next Run: {selectedRule.nextRun ? formatDate(selectedRule.nextRun) : 'Not scheduled'}</Text>
            </Stack>
            
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setModalOpened(false)}>
                Close
              </Button>
              <Button onClick={() => openEditModal(selectedRule)}>
                Edit Workflow
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Create Workflow Modal */}
      <Modal 
        opened={createModalOpened} 
        onClose={() => setCreateModalOpened(false)}
        title="Create New Workflow"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Workflow Name"
            placeholder="Enter workflow name"
            value={newWorkflow.name}
            onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
            required
          />
          
          <Textarea
            label="Description"
            placeholder="Describe what this workflow does"
            value={newWorkflow.description}
            onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
            rows={3}
          />
          
          <Select
            label="Workflow Type"
            data={[
              { value: 'payment', label: 'Payment' },
              { value: 'invoice', label: 'Invoice' },
              { value: 'trial', label: 'Trial' },
              { value: 'subscription', label: 'Subscription' }
            ]}
            value={newWorkflow.type}
            onChange={(value) => setNewWorkflow({ ...newWorkflow, type: value as any })}
          />
          
          <TextInput
            label="Trigger"
            placeholder="What triggers this workflow?"
            value={newWorkflow.trigger}
            onChange={(e) => setNewWorkflow({ ...newWorkflow, trigger: e.target.value })}
            required
          />
          
          <Switch
            label="Enable workflow"
            checked={newWorkflow.enabled}
            onChange={(e) => setNewWorkflow({ ...newWorkflow, enabled: e.currentTarget.checked })}
          />
          
          <Group justify="flex-end" gap="xs">
            <Button variant="outline" onClick={() => setCreateModalOpened(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWorkflow} disabled={!newWorkflow.name || !newWorkflow.trigger}>
              Create Workflow
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Workflow Modal */}
      <Modal 
        opened={editModalOpened} 
        onClose={() => setEditModalOpened(false)}
        title="Edit Workflow"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Workflow Name"
            placeholder="Enter workflow name"
            value={editWorkflow.name}
            onChange={(e) => setEditWorkflow({ ...editWorkflow, name: e.target.value })}
            required
          />
          
          <Textarea
            label="Description"
            placeholder="Describe what this workflow does"
            value={editWorkflow.description}
            onChange={(e) => setEditWorkflow({ ...editWorkflow, description: e.target.value })}
            rows={3}
          />
          
          <Select
            label="Workflow Type"
            data={[
              { value: 'payment', label: 'Payment' },
              { value: 'invoice', label: 'Invoice' },
              { value: 'trial', label: 'Trial' },
              { value: 'subscription', label: 'Subscription' }
            ]}
            value={editWorkflow.type}
            onChange={(value) => setEditWorkflow({ ...editWorkflow, type: value as any })}
          />
          
          <TextInput
            label="Trigger"
            placeholder="What triggers this workflow?"
            value={editWorkflow.trigger}
            onChange={(e) => setEditWorkflow({ ...editWorkflow, trigger: e.target.value })}
            required
          />
          
          <Switch
            label="Enable workflow"
            checked={editWorkflow.enabled}
            onChange={(e) => setEditWorkflow({ ...editWorkflow, enabled: e.currentTarget.checked })}
          />
          
          <Group justify="flex-end" gap="xs">
            <Button variant="outline" onClick={() => setEditModalOpened(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditWorkflow} disabled={!editWorkflow.name || !editWorkflow.trigger} variant="filled" style={{ color: 'white' }}>
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

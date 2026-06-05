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
  Modal
} from '@mantine/core';
import { 
  IconBolt,
  IconPlayerPlay,
  IconPlayerPause,
  IconSettings,
  IconRefresh,
  IconEdit,
  IconTrash,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconClock,
  IconEye,
  IconTestPipe,
  IconCalendar,
  IconFilter
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

interface BillingWorkflowsProps {
  refreshInterval?: number;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  type: 'payment_retry' | 'dunning' | 'subscription_renewal' | 'usage_alert';
  status: 'active' | 'inactive' | 'error';
  trigger: string;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  lastRun?: string;
  successRate: number;
  totalRuns: number;
  failedRuns: number;
  configuration: {
    maxRetries: number;
    retryInterval: number;
    notificationThreshold: number;
    escalationRules: string[];
  };
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  affectedEntities: number;
  results: {
    success: number;
    failed: number;
    skipped: number;
  };
  logs: Array<{
    timestamp: string;
    level: 'info' | 'warning' | 'error';
    message: string;
  }>;
}

export function BillingWorkflowsFixed({ refreshInterval = 60000 }: BillingWorkflowsProps) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  // Mock data for now - would be fetched from API
  const workflows: Workflow[] = [
    {
      id: 'wf_001',
      name: 'Payment Retry Automation',
      description: 'Automatically retry failed payments with escalating notification rules',
      type: 'payment_retry',
      status: 'active',
      trigger: 'payment_failed',
      frequency: 'immediate',
      lastRun: '2024-04-25T14:30:00Z',
      successRate: 94.2,
      totalRuns: 1247,
      failedRuns: 72,
      configuration: {
        maxRetries: 3,
        retryInterval: 3600,
        notificationThreshold: 2,
        escalationRules: ['email_notification', 'account_suspension', 'manual_review']
      }
    },
    {
      id: 'wf_002',
      name: 'Dunning Management',
      description: 'Systematic dunning process for overdue payments',
      type: 'dunning',
      status: 'active',
      trigger: 'payment_failed',
      frequency: 'daily',
      lastRun: '2024-04-25T09:00:00Z',
      successRate: 87.5,
      totalRuns: 456,
      failedRuns: 57,
      configuration: {
        maxRetries: 5,
        retryInterval: 86400,
        notificationThreshold: 1,
        escalationRules: ['payment_reminder', 'service_warning', 'account_suspension']
      }
    },
    {
      id: 'wf_003',
      name: 'Subscription Renewal',
      description: 'Automatic subscription renewal with grace period handling',
      type: 'subscription_renewal',
      status: 'active',
      trigger: 'subscription_expiry',
      frequency: 'daily',
      lastRun: '2024-04-25T02:00:00Z',
      successRate: 99.1,
      totalRuns: 89,
      failedRuns: 1,
      configuration: {
        maxRetries: 3,
        retryInterval: 3600,
        notificationThreshold: 1,
        escalationRules: ['renewal_reminder', 'grace_period_warning', 'service_interruption']
      }
    }
  ];

  const executions: WorkflowExecution[] = [
    {
      id: 'exec_001',
      workflowId: 'wf_001',
      status: 'completed',
      startedAt: '2024-04-25T14:30:00Z',
      completedAt: '2024-04-25T14:32:15Z',
      duration: 135,
      affectedEntities: 12,
      results: {
        success: 11,
        failed: 1,
        skipped: 0
      },
      logs: [
        { timestamp: '2024-04-25T14:30:00Z', level: 'info', message: 'Starting payment retry workflow' },
        { timestamp: '2024-04-25T14:30:15Z', level: 'info', message: 'Processing 12 failed payments' },
        { timestamp: '2024-04-25T14:31:30Z', level: 'warning', message: 'Payment failed for tenant_003 (insufficient funds)' },
        { timestamp: '2024-04-25T14:32:15Z', level: 'info', message: 'Workflow completed: 11 successful, 1 failed' }
      ]
    },
    {
      id: 'exec_002',
      workflowId: 'wf_002',
      status: 'running',
      startedAt: '2024-04-25T15:00:00Z',
      affectedEntities: 8,
      results: {
        success: 3,
        failed: 0,
        skipped: 5
      },
      logs: [
        { timestamp: '2024-04-25T15:00:00Z', level: 'info', message: 'Starting dunning process' },
        { timestamp: '2024-04-25T15:00:30Z', level: 'info', message: 'Sending payment reminders to 8 overdue accounts' },
        { timestamp: '2024-04-25T15:01:15Z', level: 'info', message: '3 payments collected, 5 still overdue' }
      ]
    }
  ];

  const isLoading = false;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'inactive': return 'gray';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <IconCheck size="1rem" color="green" />;
      case 'inactive': return <IconPlayerPause size="1rem" color="gray" />;
      case 'error': return <IconX size="1rem" color="red" />;
      default: return <IconClock size="1rem" color="gray" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'payment_retry': return <IconBolt size="1rem" color="blue" />;
      case 'dunning': return <IconAlertTriangle size="1rem" color="orange" />;
      case 'subscription_renewal': return <IconCalendar size="1rem" color="purple" />;
      case 'usage_alert': return <IconFilter size="1rem" color="yellow" />;
      default: return <IconSettings size="1rem" color="gray" />;
    }
  };

  const getExecutionStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'running': return 'blue';
      case 'failed': return 'red';
      case 'cancelled': return 'gray';
      default: return 'gray';
    }
  };

  const handleToggleWorkflow = (workflowId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    console.log(`Toggling workflow ${workflowId} from ${currentStatus} to ${newStatus}`);
  };

  const handleExecuteWorkflow = (workflowId: string) => {
    console.log('Executing workflow:', workflowId);
    setShowTestModal(true);
  };

  const activeWorkflows = workflows.filter(w => w.status === 'active').length;
  const totalExecutions = executions.length;
  const successRate = executions.length > 0 
    ? (executions.filter(e => e.status === 'completed').length / executions.length * 100).toFixed(1)
    : '0.0';

  return (
    <Stack gap="md">
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" align="center">
          <div>
            <Text size="lg" fw={600}>Billing Workflows</Text>
            <Text size="sm" c="dimmed">Manage automated billing workflows and execution monitoring</Text>
          </div>
          <Group gap="sm">
            <Button
              size="sm"
              variant="outline"
              leftSection={<IconSettings size="0.875rem" />}
              onClick={() => setShowConfigModal(true)}
            >
              Configure Workflow
            </Button>
            <ActionIcon 
              variant="light" 
              color="blue"
              loading={isLoading}
            >
              <IconRefresh size="1rem" />
            </ActionIcon>
          </Group>
        </Group>
      </Card>

      <LoadingOverlay visible={isLoading} />

      {/* Workflow Stats */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconBolt size="1rem" color="blue" />
                <Text size="xs" c="dimmed">Active Workflows</Text>
              </Group>
              <Text size="xl" fw={600}>{activeWorkflows}</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconPlayerPlay size="1rem" color="green" />
                <Text size="xs" c="dimmed">Total Executions</Text>
              </Group>
              <Text size="xl" fw={600}>{totalExecutions}</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconCheck size="1rem" color="green" />
                <Text size="xs" c="dimmed">Success Rate</Text>
              </Group>
              <Text size="xl" fw={600} c="green">{successRate}%</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconAlertTriangle size="1rem" color="red" />
                <Text size="xs" c="dimmed">Failed Executions</Text>
              </Group>
              <Text size="xl" fw={600} c="red">
                {executions.filter(e => e.status === 'failed').length}
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Workflows List */}
      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Text size="md" fw={600}>Active Workflows</Text>
          
          <Stack gap="lg">
            {workflows.map((workflow) => (
              <Card key={workflow.id} padding="md" withBorder bg="gray.0">
                <Stack gap="md">
                  <Group justify="space-between" align="start">
                    <div style={{ flex: 1 }}>
                      <Group gap="sm">
                        {getTypeIcon(workflow.type)}
                        <div>
                          <Text size="md" fw={600}>{workflow.name}</Text>
                          <Text size="sm" c="dimmed">{workflow.description}</Text>
                          <Group gap="sm">
                            <Badge size="sm" color={getStatusColor(workflow.status)} variant="light">
                              {workflow.status}
                            </Badge>
                            <Badge size="sm" variant="outline">
                              {workflow.type.replace('_', ' ')}
                            </Badge>
                          </Group>
                        </div>
                      </Group>
                      <Group gap="sm">
                        <Switch
                          checked={workflow.status === 'active'}
                          onChange={() => handleToggleWorkflow(workflow.id, workflow.status)}
                          size="sm"
                          label={workflow.status === 'active' ? 'Active' : 'Inactive'}
                        />
                      </Group>
                    </div>
                    
                    <div>
                      <Text size="xs" c="dimmed">Trigger: {workflow.trigger}</Text>
                      <Text size="xs" c="dimmed">Frequency: {workflow.frequency}</Text>
                    </div>
                    
                    <Grid>
                      <Grid.Col span={4}>
                        <Text size="xs" c="dimmed">Total Runs</Text>
                        <Text size="sm">{workflow.totalRuns}</Text>
                      </Grid.Col>
                      <Grid.Col span={4}>
                        <Text size="xs" c="dimmed">Success Rate</Text>
                        <Text size="sm" c={workflow.successRate >= 95 ? 'green' : 'orange'}>
                          {workflow.successRate.toFixed(1)}%
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={4}>
                        <Text size="xs" c="dimmed">Failed Runs</Text>
                        <Text size="sm" c="red">{workflow.failedRuns}</Text>
                      </Grid.Col>
                    </Grid>
                    
                    <Group justify="space-between" align="center">
                      <Group gap="sm">
                        {workflow.lastRun && (
                          <Text size="xs" c="dimmed">
                            Last run: {new Date(workflow.lastRun).toLocaleString()}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed">
                          Max retries: {workflow.configuration.maxRetries}
                        </Text>
                      </Group>
                      
                      <Group gap="sm">
                        <ActionIcon 
                          size="sm" 
                          variant="subtle"
                          onClick={() => handleExecuteWorkflow(workflow.id)}
                        >
                          <IconTestPipe size="0.875rem" />
                        </ActionIcon>
                        <ActionIcon 
                          size="sm" 
                          variant="subtle"
                          onClick={() => {
                            setSelectedWorkflow(workflow);
                            setShowConfigModal(true);
                          }}
                        >
                          <IconEdit size="0.875rem" />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Group>
                </Stack>
              </Card>
              ))}
          </Stack>
        </Stack>
      </Card>

      {/* Recent Executions */}
      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Text size="md" fw={600}>Recent Executions</Text>
          
          <Stack gap="lg">
            {executions.map((execution) => (
              <Card key={execution.id} padding="md" withBorder bg="gray.0">
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Group gap="sm">
                      <Badge size="sm" color={getExecutionStatusColor(execution.status)} variant="light">
                        {execution.status}
                      </Badge>
                      <Text size="sm" c="dimmed">
                        {new Date(execution.startedAt).toLocaleString()}
                      </Text>
                    </Group>
                    
                    <Group gap="sm">
                      <Text size="xs" c="dimmed">
                        Duration: {execution.duration ? `${execution.duration}s` : 'Running...'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Entities: {execution.affectedEntities}
                      </Text>
                    </Group>
                  </Group>
                  
                  <Grid>
                    <Grid.Col span={4}>
                      <Text size="xs" c="dimmed">Success</Text>
                      <Text size="sm" c="green">{execution.results.success}</Text>
                    </Grid.Col>
                    <Grid.Col span={4}>
                      <Text size="xs" c="dimmed">Failed</Text>
                      <Text size="sm" c="red">{execution.results.failed}</Text>
                    </Grid.Col>
                    <Grid.Col span={4}>
                      <Text size="xs" c="dimmed">Skipped</Text>
                      <Text size="sm" c="gray">{execution.results.skipped}</Text>
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Card>
            ))}
          </Stack>
        </Stack>
      </Card>

      {/* Configure Workflow Modal */}
      <Modal
        opened={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title={selectedWorkflow ? `Configure ${selectedWorkflow.name}` : 'Create Workflow'}
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">Workflow configuration coming soon...</Text>
          
          <Group gap="sm" justify="flex-end">
            <Button variant="outline" onClick={() => setShowConfigModal(false)}>
              Cancel
            </Button>
            <Button>
              {selectedWorkflow ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Test Modal */}
      <Modal
        opened={showTestModal}
        onClose={() => setShowTestModal(false)}
        title="Test Workflow"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">Workflow testing coming soon...</Text>
          
          <Group gap="sm" justify="flex-end">
            <Button variant="outline" onClick={() => setShowTestModal(false)}>
              Cancel
            </Button>
            <Button>
              Test Workflow
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

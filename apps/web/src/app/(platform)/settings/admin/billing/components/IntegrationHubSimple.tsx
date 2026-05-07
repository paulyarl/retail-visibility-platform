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
  Table,
  TextInput,
  Textarea,
  Switch,
  Modal,
  Code,
  Tabs,
  Checkbox,
  NumberInput
} from '@mantine/core';
import { 
  IconPlug,
  IconDatabase,
  IconChartBar,
  IconUsers,
  IconCreditCard,
  IconLock,
  IconRefresh,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconSettings,
  IconTestPipe,
  IconDownload,
  IconUpload,
  IconEdit,
  IconPlus,
  IconClock
} from '@tabler/icons-react';

interface IntegrationHubProps {
  refreshInterval?: number;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  type: 'accounting' | 'analytics' | 'crm' | 'payment' | 'tax' | 'custom';
  provider: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSync?: string;
  syncFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  dataFlow: 'inbound' | 'outbound' | 'bidirectional';
  successRate: number;
  totalSyncs: number;
}

export function IntegrationHubSimple({ refreshInterval = 60000 }: IntegrationHubProps) {
  const [selectedTab, setSelectedTab] = useState<'integrations' | 'webhooks' | 'data-sync'>('integrations');
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Mock data for now - would be fetched from API
  const integrations: Integration[] = [
    {
      id: 'int_001',
      name: 'QuickBooks Online',
      description: 'Accounting software integration for financial data synchronization',
      type: 'accounting',
      provider: 'Intuit',
      status: 'connected',
      lastSync: '2024-04-25T15:30:00Z',
      syncFrequency: 'daily',
      dataFlow: 'bidirectional',
      successRate: 98.7,
      totalSyncs: 234
    },
    {
      id: 'int_002',
      name: 'Salesforce CRM',
      description: 'Customer relationship management and sales pipeline tracking',
      type: 'crm',
      provider: 'Salesforce',
      status: 'connected',
      lastSync: '2024-04-25T14:15:00Z',
      syncFrequency: 'hourly',
      dataFlow: 'bidirectional',
      successRate: 96.2,
      totalSyncs: 1567
    },
    {
      id: 'int_003',
      name: 'Google Analytics 4',
      description: 'Web analytics and marketing performance tracking',
      type: 'analytics',
      provider: 'Google',
      status: 'connected',
      lastSync: '2024-04-25T16:00:00Z',
      syncFrequency: 'realtime',
      dataFlow: 'inbound',
      successRate: 99.8,
      totalSyncs: 456789
    },
    {
      id: 'int_004',
      name: 'Stripe Tax Calculation',
      description: 'Automated tax calculation and compliance reporting',
      type: 'tax',
      provider: 'Stripe Tax',
      status: 'connected',
      lastSync: '2024-04-25T12:00:00Z',
      syncFrequency: 'daily',
      dataFlow: 'outbound',
      successRate: 94.5,
      totalSyncs: 89
    },
    {
      id: 'int_005',
      name: 'Custom ERP System',
      description: 'Enterprise resource planning integration',
      type: 'custom',
      provider: 'CustomAPI',
      status: 'error',
      lastSync: '2024-04-20T10:00:00Z',
      syncFrequency: 'weekly',
      dataFlow: 'bidirectional',
      successRate: 45.2,
      totalSyncs: 12
    }
  ];

  const isLoading = false;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'green';
      case 'disconnected': return 'gray';
      case 'error': return 'red';
      case 'pending': return 'yellow';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <IconCheck size="1rem" />;
      case 'disconnected': return <IconX size="1rem" />;
      case 'error': return <IconAlertTriangle size="1rem" />;
      case 'pending': return <IconClock size="1rem" />;
      default: return <IconClock size="1rem" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'accounting': return <IconDatabase size="1rem" />;
      case 'analytics': return <IconChartBar size="1rem" />;
      case 'crm': return <IconUsers size="1rem" />;
      case 'payment': return <IconCreditCard size="1rem" />;
      case 'tax': return <IconLock size="1rem" />;
      case 'custom': return <IconSettings size="1rem" />;
      default: return <IconPlug size="1rem" />;
    }
  };

  const getDataFlowIcon = (flow: string) => {
    switch (flow) {
      case 'inbound': return <IconDownload size="1rem" color="blue" />;
      case 'outbound': return <IconUpload size="1rem" color="green" />;
      case 'bidirectional': return <IconRefresh size="1rem" color="purple" />;
      default: return <IconRefresh size="1rem" color="gray" />;
    }
  };

  const connectedIntegrations = integrations.filter(i => i.status === 'connected').length;

  return (
    <div>
    <Stack gap="md">
      {/* Header Controls */}
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" align="center">
          <div>
            <Text size="lg" fw={"600"}>Integration Hub</Text>
            <Text size="sm" c="dimmed" component="span">Manage third-party integrations and data synchronization</Text>
          </div>
          <Group gap="sm">
            <Button
              size="sm"
              variant="outline"
              leftSection={<IconPlus size="0.875rem" />}
              onClick={() => setShowConfigModal(true)}
            >
              Add Integration
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

      {/* Integration Stats */}
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconPlug size="1rem" color="blue" />
                <Text size="xs" c="dimmed">Connected Integrations</Text>
              </Group>
              <Text size="xl" fw={600}>{connectedIntegrations}</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconTestPipe size="1rem" color="purple" />
                <Text size="xs" c="dimmed">Active Webhooks</Text>
              </Group>
              <Text size="xl" fw={"600"}>12</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconRefresh size="1rem" color="green" />
                <Text size="xs" c="dimmed">Active Syncs</Text>
              </Group>
              <Text size="xl" fw={"600"}>8</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconChartBar size="1rem" color="orange" />
                <Text size="xs" c="dimmed">Data Points Synced</Text>
              </Group>
              <Text size="xl" fw={"600"}>456.7K</Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Tab Navigation */}
      <Card withBorder padding="lg" radius="md">
        <Tabs value={selectedTab} onChange={(value) => setSelectedTab(value as any)}>
          <Tabs.List>
            <Tabs.Tab value="integrations">Integrations</Tabs.Tab>
            <Tabs.Tab value="webhooks">Webhooks</Tabs.Tab>
            <Tabs.Tab value="data-sync">Data Sync</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Card>

      {/* Integrations Tab */}
      {selectedTab === 'integrations' && (
        <Stack gap="md">
          <Stack gap="lg">
            {integrations.map((integration) => (
              <Card key={integration.id} padding="md" withBorder bg="gray.0">
                <Stack gap="md">
                  <Group justify="space-between" align="start">
                    <div style={{ flex: 1 }}>
                      <Group gap="sm">
                        {getTypeIcon(integration.type)}
                        <div>
                          <Text size="md" fw={600}>{integration.name}</Text>
                          <Text size="sm" c="dimmed" component="span">{integration.description}</Text>
                          <Group gap="sm">
                            <Badge 
                              size="sm" 
                              color={getStatusColor(integration.status)}
                              variant="light"
                            >
                              {integration.status}
                            </Badge>
                            <Badge size="sm" variant="outline">
                              {integration.provider}
                            </Badge>
                          </Group>
                        </div>
                      </Group>
                      <Group gap="sm">
                        <Switch 
                          checked={integration.status === 'connected'}
                          onChange={() => {
                            console.log(`Toggling integration ${integration.id}`);
                          }}
                          size="sm"
                          label={integration.status === 'connected' ? 'Connected' : 'Disconnected'}
                        />
                      </Group>
                    </div>
                    
                    <div>
                      <Text size="xs" c="dimmed" component="span">Data Flow: 
                        <Text size="xs" c="blue" component="span">
                          {getDataFlowIcon(integration.dataFlow)}
                          {integration.dataFlow}
                        </Text>
                      </Text>
                    </div>
                    
                    <Grid>
                      <Grid.Col span={6}>
                        <Text size="xs" c="dimmed">Last Sync</Text>
                        <Text size="sm">
                          {integration.lastSync ? 
                            new Date(integration.lastSync).toLocaleString() : 
                            'Never'
                          }
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Text size="xs" c="dimmed">Frequency</Text>
                        <Text size="sm">{integration.syncFrequency}</Text>
                      </Grid.Col>
                    </Grid>
                    
                    <Grid>
                      <Grid.Col span={4}>
                        <Text size="xs" c="dimmed">Total Syncs</Text>
                        <Text size="sm">{integration.totalSyncs}</Text>
                      </Grid.Col>
                      <Grid.Col span={4}>
                        <Text size="xs" c="dimmed">Success Rate</Text>
                        <Text size="sm" c={integration.successRate >= 95 ? 'green' : 'orange'}>
                          {integration.successRate.toFixed(1)}%
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={4}>
                        <Text size="xs" c="dimmed">Actions</Text>
                        <Group gap="sm">
                          <ActionIcon 
                            size="sm" 
                            variant="subtle"
                            onClick={() => {
                              console.log('Testing integration:', integration.id);
                            }}
                          >
                            <IconTestPipe size="0.875rem" />
                          </ActionIcon>
                          <ActionIcon 
                            size="sm" 
                            variant="subtle"
                            onClick={() => {
                              console.log('Configuring integration:', integration.id);
                            }}
                          >
                            <IconEdit size="0.875rem" />
                          </ActionIcon>
                        </Group>
                      </Grid.Col>
                    </Grid>
                    </Group>
                  </Stack>
                </Card>
            ))}
          </Stack>
        </Stack>
      )}

      {/* Webhooks Tab */}
      {selectedTab === 'webhooks' && (
        <Card withBorder padding="lg" radius="md">
          <Stack gap="md">
            <Text size="md" fw={"600"}>Webhooks</Text>
            <Text size="sm" c="dimmed" ta="center" py="xl">
              Webhook management coming soon...
            </Text>
          </Stack>
        </Card>
      )}

      {/* Data Sync Tab */}
      {selectedTab === 'data-sync' && (
        <Card withBorder padding="lg" radius="md">
          <Stack gap="md">
            <Text size="md" fw={"600"}>Data Synchronization</Text>
            <Text size="sm" c="dimmed" ta="center" py="xl">
              Data sync management coming soon...
            </Text>
          </Stack>
        </Card>
      )}

      {/* Create Integration Modal */}
      <Modal
        opened={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title="Create Integration"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Integration Name"
            placeholder="Enter integration name"
          />
          
          <Textarea
            label="Description"
            placeholder="Enter integration description"
          />
          
          <Select
            label="Type"
            data={[
              { value: 'accounting', label: 'Accounting' },
              { value: 'analytics', label: 'Analytics' },
              { value: 'crm', label: 'CRM' },
              { value: 'payment', label: 'Payment' },
              { value: 'tax', label: 'Tax' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          
          <Select
            label="Provider"
            data={[
              { value: 'quickbooks', label: 'QuickBooks' },
              { value: 'salesforce', label: 'Salesforce' },
              { value: 'google', label: 'Google' },
              { value: 'stripe', label: 'Stripe' },
              { value: 'paypal', label: 'PayPal' },
              { value: 'custom', label: 'Custom API' },
            ]}
          />
          
          <Select
            label="Sync Frequency"
            data={[
              { value: 'real-time', label: 'Real-time' },
              { value: 'hourly', label: 'Hourly' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
          />
          
          <Select
            label="Data Flow"
            data={[
              { value: 'inbound', label: 'Inbound Only' },
              { value: 'outbound', label: 'Outbound Only' },
              { value: 'bidirectional', label: 'Bidirectional' },
            ]}
          />
          
          <TextInput
            label="API Key"
            placeholder="Enter API key"
            type="password"
          />
          
          <TextInput
            label="Webhook URL"
            placeholder="Enter webhook URL"
          />
          
          <Group gap="sm" justify="flex-end">
            <Button variant="outline" onClick={() => setShowConfigModal(false)}>
              Cancel
            </Button>
            <Button>
              Create Integration
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
    </div>
  );
}

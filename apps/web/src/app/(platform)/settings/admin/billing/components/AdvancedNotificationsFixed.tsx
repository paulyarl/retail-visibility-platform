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
  ActionIcon,
  LoadingOverlay
} from '@mantine/core';
import { 
  IconBell,
  IconMail,
  IconMessage,
  IconDeviceMobile,
  IconSend,
  IconRefresh,
  IconSettings,
  IconUsers,
  IconCreditCard,
  IconChartBar
} from '@tabler/icons-react';

interface AdvancedNotificationsProps {
  refreshInterval?: number;
}

export function AdvancedNotificationsFixed({ refreshInterval = 60000 }: AdvancedNotificationsProps) {
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const isLoading = false;

  const templates = [
    {
      id: 'tpl_001',
      name: 'Payment Failed Notification',
      description: 'Notifies customers when their payment fails',
      type: 'email',
      category: 'payment',
      isActive: true,
      deliveryRate: 94.5,
      totalSent: 1247,
      totalFailed: 68
    },
    {
      id: 'tpl_002',
      name: 'Subscription Expiry Warning',
      description: 'Warns customers about upcoming subscription expiry',
      type: 'email',
      category: 'subscription',
      isActive: true,
      deliveryRate: 96.2,
      totalSent: 89,
      totalFailed: 3
    }
  ];

  const totalTemplates = templates.length;
  const activeTemplates = templates.filter(t => t.isActive).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <IconMail size="1rem" />;
      case 'sms': return <IconMessage size="1rem" />;
      case 'push': return <IconDeviceMobile size="1rem" />;
      default: return <IconBell size="1rem" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'payment': return <IconCreditCard size="1rem" />;
      case 'subscription': return <IconUsers size="1rem" />;
      case 'usage': return <IconChartBar size="1rem" />;
      default: return <IconBell size="1rem" />;
    }
  };

  return (
    <Stack gap="md">
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" align="center">
          <div>
            <Text size="lg" fw={600}>Advanced Notifications</Text>
            <Text size="sm" c="dimmed">Manage notification templates and automation rules</Text>
          </div>
          <Group gap="sm">
            <Button
              size="sm"
              variant="outline"
              leftSection={<IconSend size="0.875rem" />}
              onClick={() => setShowTemplateModal(true)}
            >
              Create Template
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

      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconBell size="1rem" color="blue" />
                <Text size="xs" c="dimmed">Total Templates</Text>
              </Group>
              <Text size="xl" fw={600}>{totalTemplates}</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconUsers size="1rem" color="green" />
                <Text size="xs" c="dimmed">Active Templates</Text>
              </Group>
              <Text size="xl" fw={600} c="green">{activeTemplates}</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconSettings size="1rem" color="orange" />
                <Text size="xs" c="dimmed">Active Rules</Text>
              </Group>
              <Text size="xl" fw={600} c="orange">5</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconChartBar size="1rem" color="purple" />
                <Text size="xs" c="dimmed">Total Campaigns</Text>
              </Group>
              <Text size="xl" fw={600} c="purple">12</Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Text size="md" fw={600}>Notification Templates</Text>
          
          <Stack gap="lg">
            {templates.map((template) => (
              <Card key={template.id} padding="md" withBorder bg="gray.0">
                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Group gap="sm">
                      {getTypeIcon(template.type)}
                      {getCategoryIcon(template.category)}
                      <div>
                        <Text size="md" fw={600}>{template.name}</Text>
                        <Text size="sm" c="dimmed">{template.description}</Text>
                        <Group gap="sm" mt="xs">
                          <Badge size="sm" variant="outline">
                            {template.category}
                          </Badge>
                        </Group>
                      </div>
                    </Group>
                    
                    <Group gap="sm">
                      <Text size="xs" c="dimmed">Delivery Rate: {template.deliveryRate.toFixed(1)}%</Text>
                      <Text size="xs" c="dimmed">Sent: {template.totalSent}</Text>
                      <Text size="xs" c="dimmed">Failed: {template.totalFailed}</Text>
                    </Group>
                  </Group>
                </Stack>
              </Card>
            ))}
          </Stack>
        </Stack>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Text size="md" fw={600}>Create Template</Text>
          <Text size="sm">Template creation coming soon...</Text>
          
          <Group gap="sm" justify="flex-end">
            <Button variant="outline" onClick={() => setShowTemplateModal(false)}>
              Cancel
            </Button>
            <Button>
              Create Template
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}

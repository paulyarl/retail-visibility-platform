"use client";

import { useState, useEffect } from 'react';
import {
  Card,
  Switch,
  Text,
  TextInput,
  Select,
  Group,
  Button,
  Stack,
  Divider,
  MultiSelect,
  Alert,
  ActionIcon,
  Tooltip,
  Box,
  NumberInput,
  Table,
  Badge,
  Modal
} from '@mantine/core';
import { 
  IconInfoCircle, 
  IconAlertTriangle, 
  IconCheck, 
  IconBulb,
  IconSettings,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconEdit,
  IconTrash,
  IconClock,
  IconCalendar
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { TickerMessage, TickerConfig, tickerConfigService } from '@/services/TickerConfigService';
import { DateTimePicker } from '@mantine/dates';

interface EnhancedTickerSettingsProps {
  onSave?: (config: TickerConfig) => void;
  availableTiers?: string[];
  availableTenants?: Array<{ id: string; name: string }>;
}

export default function EnhancedTickerSettings({ 
  onSave, 
  availableTiers = ['Free', 'Basic', 'Premium', 'Enterprise'],
  availableTenants = []
}: EnhancedTickerSettingsProps) {
  const [config, setConfig] = useState<TickerConfig>({
    enabled: false,
    messages: [],
    globalSettings: {
      maxMessages: 3,
      scrollSpeed: 'medium',
      autoRotate: true,
      rotationInterval: 5
    }
  });

  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messageModal, setMessageModal] = useState<{ open: boolean; message?: TickerMessage; mode: 'create' | 'edit' }>({
    open: false,
    mode: 'create'
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const result = await tickerConfigService.getTickerConfig();
      if (result.success && result.data) {
        setConfig(result.data);
      }
    } catch (error) {
      console.error('Failed to load ticker config:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await tickerConfigService.updateGlobalSettings(config.globalSettings);
      
      if (result.success) {
        onSave?.(config);
        notifications.show({
          title: 'Settings Saved',
          message: 'Platform ticker settings have been updated successfully.',
          color: 'green',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to save ticker settings.',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMessage = async (message: Omit<TickerMessage, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    const result = await tickerConfigService.addMessage(message);
    if (result.success) {
      setConfig(prev => ({
        ...prev,
        messages: [...prev.messages, result.data!]
      }));
      setMessageModal({ open: false, mode: 'create' });
      notifications.show({
        title: 'Message Added',
        message: 'Ticker message has been added successfully.',
        color: 'green',
      });
    }
  };

  const handleUpdateMessage = async (messageId: string, updates: Partial<TickerMessage>) => {
    const result = await tickerConfigService.updateMessage(messageId, updates);
    if (result.success) {
      setConfig(prev => ({
        ...prev,
        messages: prev.messages.map(msg => 
          msg.id === messageId ? result.data! : msg
        )
      }));
      setMessageModal({ open: false, mode: 'create' });
      notifications.show({
        title: 'Message Updated',
        message: 'Ticker message has been updated successfully.',
        color: 'green',
      });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const result = await tickerConfigService.deleteMessage(messageId);
    if (result.success) {
      setConfig(prev => ({
        ...prev,
        messages: prev.messages.filter(msg => msg.id !== messageId)
      }));
      notifications.show({
        title: 'Message Deleted',
        message: 'Ticker message has been deleted successfully.',
        color: 'green',
      });
    }
  };

  const updateGlobalSettings = (key: keyof TickerConfig['globalSettings'], value: any) => {
    setConfig(prev => ({
      ...prev,
      globalSettings: {
        ...prev.globalSettings,
        [key]: value
      }
    }));
  };

  const tenantOptions = availableTenants.map(tenant => ({
    value: tenant.id,
    label: tenant.name
  }));

  const tierOptions = availableTiers.map(tier => ({
    value: tier,
    label: tier
  }));

  return (
    <Stack gap="md">
      <Card shadow="sm" padding="lg" withBorder>
        <Group justify="space-between" mb="md">
          <Group>
            <IconSettings size={20} />
            <Text size="lg" fw={600}>Platform Notification Ticker</Text>
          </Group>
          <Group>
            <Tooltip label="Preview ticker">
              <ActionIcon
                variant={preview ? "filled" : "subtle"}
                onClick={() => setPreview(!preview)}
              >
                {preview ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Stack gap="md">
          {/* Enable/Disable */}
          <Group justify="space-between">
            <div>
              <Text fw={500}>Enable Platform Ticker</Text>
              <Text size="sm" c="dimmed">
                Show notification ticker to all merchants
              </Text>
            </div>
            <Switch
              checked={config.enabled}
              onChange={(e) => setConfig(prev => ({ ...prev, enabled: e.currentTarget.checked }))}
            />
          </Group>

          <Divider />

          {/* Global Settings */}
          <Stack gap="sm">
            <Text fw={500}>Global Settings</Text>
            
            <Group grow>
              <NumberInput
                label="Maximum Messages"
                min={1}
                max={10}
                value={config.globalSettings.maxMessages}
                onChange={(value) => updateGlobalSettings('maxMessages', Number(value) || 3)}
                disabled={!config.enabled}
              />

              <Select
                label="Scroll Speed"
                data={[
                  { value: 'slow', label: 'Slow' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'fast', label: 'Fast' }
                ]}
                value={config.globalSettings.scrollSpeed}
                onChange={(value) => updateGlobalSettings('scrollSpeed', value)}
                disabled={!config.enabled}
              />
            </Group>

            <Group grow>
              <Switch
                label="Auto-rotate messages"
                checked={config.globalSettings.autoRotate}
                onChange={(e) => updateGlobalSettings('autoRotate', e.currentTarget.checked)}
                disabled={!config.enabled}
              />

              <NumberInput
                label="Rotation Interval (seconds)"
                min={3}
                max={60}
                value={config.globalSettings.rotationInterval}
                onChange={(value) => updateGlobalSettings('rotationInterval', Number(value) || 5)}
                disabled={!config.enabled || !config.globalSettings.autoRotate}
              />
            </Group>
          </Stack>

          <Divider />

          {/* Messages Management */}
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={500}>Messages</Text>
              <Button
                size="sm"
                leftSection={<IconPlus size={14} />}
                onClick={() => setMessageModal({ open: true, mode: 'create' })}
                disabled={!config.enabled}
              >
                Add Message
              </Button>
            </Group>

            {config.messages.length === 0 ? (
              <Alert color="gray" variant="light">
                <Text size="sm">No messages configured. Click "Add Message" to create one.</Text>
              </Alert>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Message</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Priority</Table.Th>
                    <Table.Th>Target</Table.Th>
                    <Table.Th>Schedule</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {config.messages.map((message) => (
                    <Table.Tr key={message.id}>
                      <Table.Td>
                        <Text size="sm" lineClamp={1} title={message.message}>
                          {message.message}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge 
                          size="sm" 
                          color={
                            message.type === 'info' ? 'blue' :
                            message.type === 'warning' ? 'yellow' :
                            message.type === 'success' ? 'green' : 'red'
                          }
                        >
                          {message.type}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" variant="light">
                          {message.priority}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {message.targetAudience === 'all' ? 'All' :
                           message.targetAudience === 'specific_tiers' ? 
                           `${message.targetTiers?.length || 0} tiers` :
                           `${message.targetTenants?.length || 0} tenants`}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {message.startDate && message.endDate ? (
                          <Group gap={4}>
                            <IconCalendar size={12} />
                            <Text size="xs">
                              {new Date(message.startDate).toLocaleDateString()} - {new Date(message.endDate).toLocaleDateString()}
                            </Text>
                          </Group>
                        ) : (
                          <Text size="xs" c="dimmed">No schedule</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            onClick={() => setMessageModal({ open: true, message, mode: 'edit' })}
                          >
                            <IconEdit size={12} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={() => handleDeleteMessage(message.id)}
                          >
                            <IconTrash size={12} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>

          <Group justify="flex-end" mt="md">
            <Button onClick={handleSave} loading={loading} disabled={!config.enabled}>
              Save Settings
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* Message Modal */}
      <Modal
        opened={messageModal.open}
        onClose={() => setMessageModal({ open: false, mode: 'create' })}
        title={messageModal.mode === 'create' ? 'Add Message' : 'Edit Message'}
        size="lg"
      >
        <MessageForm
          message={messageModal.message}
          availableTiers={tierOptions}
          availableTenants={tenantOptions}
          onSubmit={messageModal.mode === 'create' ? handleAddMessage : (msg) => 
            handleUpdateMessage(messageModal.message!.id, msg)
          }
          onCancel={() => setMessageModal({ open: false, mode: 'create' })}
        />
      </Modal>
    </Stack>
  );
}

// Message Form Component
interface MessageFormProps {
  message?: TickerMessage;
  availableTiers: Array<{ value: string; label: string }>;
  availableTenants: Array<{ value: string; label: string }>;
  onSubmit: (message: Omit<TickerMessage, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => void;
  onCancel: () => void;
}

function MessageForm({ message, availableTiers, availableTenants, onSubmit, onCancel }: MessageFormProps) {
  const [formData, setFormData] = useState({
    message: message?.message || '',
    type: message?.type || 'info' as const,
    icon: message?.icon || 'info' as const,
    scrolling: message?.scrolling || false,
    dismissible: message?.dismissible !== false,
    targetAudience: message?.targetAudience || 'all' as const,
    targetTiers: message?.targetTiers || [],
    targetTenants: message?.targetTenants || [],
    startDate: message?.startDate || null,
    endDate: message?.endDate || null,
    priority: message?.priority || 1,
    isActive: message?.isActive !== false
  });

  const handleSubmit = () => {
    onSubmit({
      ...formData,
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined
    });
  };

  return (
    <Stack gap="md">
      <TextInput
        label="Message"
        placeholder="Enter your notification message..."
        value={formData.message}
        onChange={(e) => setFormData(prev => ({ ...prev, message: e.currentTarget.value }))}
        required
      />

      <Group grow>
        <Select
          label="Type"
          data={[
            { value: 'info', label: 'Information' },
            { value: 'warning', label: 'Warning' },
            { value: 'success', label: 'Success' },
            { value: 'error', label: 'Error' }
          ]}
          value={formData.type}
          onChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}
        />

        <Select
          label="Icon"
          data={[
            { value: 'info', label: 'Info Circle' },
            { value: 'warning', label: 'Warning Triangle' },
            { value: 'success', label: 'Check Mark' },
            { value: 'bulb', label: 'Light Bulb' }
          ]}
          value={formData.icon}
          onChange={(value: any) => setFormData(prev => ({ ...prev, icon: value }))}
        />
      </Group>

      <Group grow>
        <NumberInput
          label="Priority"
          min={1}
          max={10}
          value={formData.priority}
          onChange={(value) => setFormData(prev => ({ ...prev, priority: Number(value) || 1 }))}
        />

        <Switch
          label="Enable scrolling"
          checked={formData.scrolling}
          onChange={(e) => setFormData(prev => ({ ...prev, scrolling: e.currentTarget.checked }))}
        />

        <Switch
          label="Allow dismissal"
          checked={formData.dismissible}
          onChange={(e) => setFormData(prev => ({ ...prev, dismissible: e.currentTarget.checked }))}
        />
      </Group>

      <Select
        label="Target Audience"
        data={[
          { value: 'all', label: 'All merchants' },
          { value: 'specific_tiers', label: 'Specific subscription tiers' },
          { value: 'specific_tenants', label: 'Specific tenants' }
        ]}
        value={formData.targetAudience}
        onChange={(value: any) => setFormData(prev => ({ ...prev, targetAudience: value }))}
      />

      {formData.targetAudience === 'specific_tiers' && (
        <MultiSelect
          label="Select tiers"
          data={availableTiers}
          value={formData.targetTiers}
          onChange={(value: any) => setFormData(prev => ({ ...prev, targetTiers: value }))}
        />
      )}

      {formData.targetAudience === 'specific_tenants' && (
        <MultiSelect
          label="Select tenants"
          data={availableTenants}
          value={formData.targetTenants}
          onChange={(value: any) => setFormData(prev => ({ ...prev, targetTenants: value }))}
          searchable
          maxDropdownHeight={200}
        />
      )}

      <Stack gap="sm">
        <Text fw={500} size="sm">Schedule (Optional)</Text>
        <Text size="xs" c="dimmed">Set start and end times for automatic scheduling</Text>
        
        <Group grow>
          <DateTimePicker
            label="Start Date & Time"
            placeholder="Select start date and time"
            value={formData.startDate ? new Date(formData.startDate) : null}
            onChange={(value) => setFormData(prev => ({ ...prev, startDate: value?.toString() || null }))}
            clearable
            leftSection={<IconCalendar size={16} />}
          />

          <DateTimePicker
            label="End Date & Time"
            placeholder="Select end date and time"
            value={formData.endDate ? new Date(formData.endDate) : null}
            onChange={(value) => setFormData(prev => ({ ...prev, endDate: value?.toString() || null }))}
            clearable
            leftSection={<IconCalendar size={16} />}
          />
        </Group>

        {(formData.startDate || formData.endDate) && (
          <Alert color="blue" variant="light">
            <Group gap="sm">
              <IconClock size={14} />
              <Text>
                {formData.startDate && formData.endDate 
                  ? `Message will show from ${formData.startDate.toLocaleString()} to ${formData.endDate.toLocaleString()}`
                  : formData.startDate 
                  ? `Message will start showing at ${formData.startDate.toLocaleString()}`
                  : `Message will stop showing at ${formData.endDate?.toLocaleString()}`
                }
              </Text>
            </Group>
          </Alert>
        )}
      </Stack>

      <Switch
        label="Active"
        checked={formData.isActive}
        onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.currentTarget.checked }))}
      />

      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!formData.message}>
          {message ? 'Update' : 'Create'}
        </Button>
      </Group>
    </Stack>
  );
}

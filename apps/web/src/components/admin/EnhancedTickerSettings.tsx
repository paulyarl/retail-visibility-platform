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
import PlatformTicker from '@/components/notifications/PlatformTicker';
import { useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();
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
      //console.log('[EnhancedTickerSettings] Loading config from API...');
      const result = await tickerConfigService.getTickerConfig();
      //console.log('[EnhancedTickerSettings] Page load API response:', result);
      
      if (result.success && result.data) {
        // The API response is double-wrapped: { success: true, data: { success: true, data: TickerConfig } }
        // We need to access result.data.data to get the actual TickerConfig
        const actualConfig = (result.data as any).data;
        //console.log('[EnhancedTickerSettings] Actual ticker config:', actualConfig);
        //console.log('[EnhancedTickerSettings] Messages in config:', actualConfig?.messages);
        //console.log('[EnhancedTickerSettings] Messages length:', actualConfig?.messages?.length);
        //console.log('[EnhancedTickerSettings] Config enabled:', actualConfig?.enabled);
        
        // Set the actual config data
        setConfig(actualConfig);
        
        // Log what we just set
        //console.log('[EnhancedTickerSettings] Config set to:', actualConfig);
        //console.log('[EnhancedTickerSettings] Current config state after set:', config);
      } else {
        console.log('[EnhancedTickerSettings] Page load - API response failed or no data:', result);
      }
    } catch (error) {
      console.error('[EnhancedTickerSettings] Failed to load ticker config:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Send both enabled and globalSettings to the settings endpoint
      const settingsPayload = {
        enabled: config?.enabled,
        ...config.globalSettings
      };
      
      const result = await tickerConfigService.updateGlobalSettings(settingsPayload);
      
      if (result.success) {
       /*  console.log('[EnhancedTickerSettings] Save successful, API response:', result);
        console.log('[EnhancedTickerSettings] Current config enabled state:', config.enabled); */
        // Update local config with the response data, preserving existing messages
        if (result.data) {
          // Extract only the TickerConfig data from the API response
          const apiResponseData = (result.data as any).data as TickerConfig;
         /*  console.log('[EnhancedTickerSettings] API response data:', apiResponseData);
          console.log('[EnhancedTickerSettings] API enabled state:', apiResponseData.enabled); */
          const tickerConfigData = {
            enabled: apiResponseData.enabled,
            messages: config.messages, // Preserve existing messages
            globalSettings: apiResponseData.globalSettings
          };
         // console.log('[EnhancedTickerSettings] New config data:', tickerConfigData);
          
          setConfig(tickerConfigData);
          onSave?.(tickerConfigData);
        }
        
        notifications.show({
          title: 'Settings Saved',
          message: 'Platform ticker settings have been updated successfully.',
          color: 'green',
        });

        // Invalidate ticker config cache so ShellWithTicker gets updated immediately
       // console.log('[EnhancedTickerSettings] Invalidating ticker config cache');
        queryClient.invalidateQueries({ queryKey: ['ticker-config'] });
        queryClient.invalidateQueries({ queryKey: ['ticker-messages'] });
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
      const newMessage = { ...message, ...result.data! };
      setConfig(prev => ({
        ...prev,
        messages: [...prev.messages, newMessage]
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
   /*  console.log('[EnhancedTickerSettings] Updating message:', { messageId, updates });
    console.log('[EnhancedTickerSettings] Updates targetAudience:', updates.targetAudience);
    console.log('[EnhancedTickerSettings] Updates targetTiers:', updates.targetTiers);
    console.log('[EnhancedTickerSettings] Updates targetTiers length:', updates.targetTiers?.length); */

    if (!messageId) {
      console.error('[EnhancedTickerSettings] Cannot update message: missing ID');
      notifications.show({
        title: 'Error',
        message: 'Cannot update message: missing message ID.',
        color: 'red',
      });
      return;
    }

    const result = await tickerConfigService.updateMessage(messageId, updates);
    if (result.success) {
      console.log('[EnhancedTickerSettings] Message updated successfully:', result.data);
      // The response is double-wrapped, so we need to access result.data.data
      const updatedMessage = (result.data as any).data;
     /*  console.log('[EnhancedTickerSettings] Updated message targetAudience:', updatedMessage?.targetAudience);
      console.log('[EnhancedTickerSettings] Updated message targetTiers:', updatedMessage?.targetTiers);
      console.log('[EnhancedTickerSettings] Updated message targetTiers length:', updatedMessage?.targetTiers?.length);
       */
      setConfig(prev => ({
        ...prev,
        messages: prev.messages.map(msg => 
          msg.id === messageId ? updatedMessage : msg
        )
      }));
      setMessageModal({ open: false, mode: 'create' });
      notifications.show({
        title: 'Message Updated',
        message: 'Ticker message has been updated successfully.',
        color: 'green',
      });
    } else {
      console.error('[EnhancedTickerSettings] Failed to update message:', result.error);
      notifications.show({
        title: 'Error',
        message: result.userMessage || 'Failed to update message.',
        color: 'red',
      });
    }
  };

  const handleActivateMessage = async (messageId: string) => {
    if (!messageId) {
      console.error('[EnhancedTickerSettings] Cannot activate message: missing ID');
      notifications.show({
        title: 'Error',
        message: 'Cannot activate message: missing message ID.',
        color: 'red',
      });
      return;
    }

    console.log('[EnhancedTickerSettings] Activating message:', messageId);
    const result = await tickerConfigService.updateMessage(messageId, { isActive: true });
    if (result.success) {
      setConfig(prev => ({
        ...prev,
        messages: prev.messages.map(msg => 
          msg.id === messageId ? { ...msg, isActive: true } : msg
        )
      }));
      notifications.show({
        title: 'Message Activated',
        message: 'Ticker message has been activated and will appear in the ticker.',
        color: 'green',
      });
    } else {
      console.error('[EnhancedTickerSettings] Failed to activate message:', result.error);
      notifications.show({
        title: 'Error',
        message: result.userMessage || 'Failed to activate message.',
        color: 'red',
      });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!messageId) {
      console.error('[EnhancedTickerSettings] Cannot delete message: missing ID');
      notifications.show({
        title: 'Error',
        message: 'Cannot delete message: missing message ID.',
        color: 'red',
      });
      return;
    }

    console.log('[EnhancedTickerSettings] Deleting message:', messageId);
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
    } else {
      console.error('[EnhancedTickerSettings] Failed to delete message:', result.error);
      notifications.show({
        title: 'Error',
        message: result.userMessage || 'Failed to delete message.',
        color: 'red',
      });
    }
  };

  const updateGlobalSettings = (key: keyof TickerConfig['globalSettings'], value: any) => {
    setConfig(prev => ({
      ...(prev || {}),
      globalSettings: {
        ...(prev?.globalSettings || {}),
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
              checked={config?.enabled || false}
              onChange={(e) => setConfig(prev => ({ ...prev, enabled: e?.currentTarget?.checked || false }))}
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
                value={config.globalSettings?.maxMessages || 3}
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
                value={config.globalSettings?.scrollSpeed || 'medium'}
                onChange={(value) => updateGlobalSettings('scrollSpeed', value)}
                disabled={!config.enabled}
              />
            </Group>

            <Group grow>
              <Switch
                label="Auto-rotate messages"
                checked={config.globalSettings?.autoRotate !== false}
                onChange={(e) => updateGlobalSettings('autoRotate', e?.currentTarget?.checked || false)}
                disabled={!config.enabled}
              />

              <NumberInput
                label="Rotation Interval (seconds)"
                min={3}
                max={60}
                value={config.globalSettings?.rotationInterval || 5}
                onChange={(value) => updateGlobalSettings('rotationInterval', Number(value) || 5)}
                disabled={!config.enabled || config.globalSettings?.autoRotate === false}
              />
            </Group>
          </Stack>

          <Divider />

            {(config.messages || []).length === 0 ? (
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
                  {(config.messages || []).map((message, index) => {
                    const uniqueKey = message.id ||
                      `${message.message}-${index}` ||
                      `message-${index}-${Date.now()}`;
                    return (
                      <Table.Tr key={uniqueKey}>
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
                            {!message.isActive && (
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color="green"
                                onClick={() => handleActivateMessage(message.id)}
                                title="Activate message"
                              >
                                <IconCheck size={12} />
                              </ActionIcon>
                            )}
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              onClick={() => {
                                console.log('[EnhancedTickerSettings] Editing message:', message);
                                setMessageModal({ open: true, message, mode: 'edit' });
                              }}
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
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setMessageModal({ open: true, mode: 'create' })}>
              Add Message
            </Button>
            <Button onClick={handleSave} loading={loading}>
              Save Settings
            </Button>
          </Group>
        </Stack>
        
      </Card>

      {preview && (
        <Box style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
          <PlatformTicker
            messages={config.messages || []}
            maxMessages={config.globalSettings?.maxMessages || 3}
            autoRotate={config.globalSettings?.autoRotate !== false}
            rotationInterval={config.globalSettings?.rotationInterval || 5}
          />
        </Box>
      )}

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
          onSubmit={messageModal.mode === 'create' ? handleAddMessage : (msg) => {
            const messageId = messageModal.message?.id;
            if (!messageId) {
              console.error('[EnhancedTickerSettings] Cannot update message: missing ID', messageModal.message);
              notifications.show({
                title: 'Error',
                message: 'Cannot update message: missing message ID.',
                color: 'red',
              });
              return;
            }
            handleUpdateMessage(messageId, msg);
          }}
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

  // Update form data when message prop changes (for edit mode)
  useEffect(() => {
    if (message) {
      console.log('[MessageForm] Updating form data for message:', message);
      setFormData({
        message: message.message || '',
        type: message.type || 'info' as const,
        icon: message.icon || 'info' as const,
        scrolling: message.scrolling || false,
        dismissible: message.dismissible !== false,
        targetAudience: message.targetAudience || 'all' as const,
        targetTiers: message.targetTiers || [],
        targetTenants: message.targetTenants || [],
        startDate: message.startDate || null,
        endDate: message.endDate || null,
        priority: message.priority || 1,
        isActive: message.isActive !== false
      });
    }
  }, [message]);

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
        onChange={(e) => setFormData(prev => ({ ...prev, message: e?.currentTarget?.value || '' }))}
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
          onChange={(e) => setFormData(prev => ({ ...prev, scrolling: e?.currentTarget?.checked || false }))}
        />

        <Switch
          label="Allow dismissal"
          checked={formData.dismissible}
          onChange={(e) => setFormData(prev => ({ ...prev, dismissible: e?.currentTarget?.checked || false }))}
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
                  ? `Message will show from ${new Date(formData.startDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} to ${new Date(formData.endDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`
                  : formData.startDate 
                  ? `Message will start showing at ${new Date(formData.startDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`
                  : `Message will stop showing at ${new Date(formData.endDate!).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`}
              </Text>
            </Group>
          </Alert>
        )}
      </Stack>

      <Switch
        label="Active"
        checked={formData.isActive}
        onChange={(e) => setFormData(prev => ({ ...prev, isActive: e?.currentTarget?.checked || false }))}
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

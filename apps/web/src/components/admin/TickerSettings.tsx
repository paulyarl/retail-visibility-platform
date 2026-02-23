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
  Box
} from '@mantine/core';
import { 
  IconInfoCircle, 
  IconAlertTriangle, 
  IconCheck, 
  IconBulb,
  IconSettings,
  IconEye,
  IconEyeOff
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface TickerConfig {
  enabled: boolean;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  icon: 'info' | 'warning' | 'success' | 'bulb';
  scrolling: boolean;
  dismissible: boolean;
  targetAudience: 'all' | 'specific_tiers' | 'specific_tenants';
  targetIds?: string[];
}

interface TickerSettingsProps {
  onSave?: (config: TickerConfig) => void;
  initialConfig?: Partial<TickerConfig>;
  availableTiers?: string[];
  availableTenants?: Array<{ id: string; name: string }>;
}

export default function TickerSettings({ 
  onSave, 
  initialConfig, 
  availableTiers = ['Free', 'Basic', 'Premium', 'Enterprise'],
  availableTenants = []
}: TickerSettingsProps) {
  const [config, setConfig] = useState<TickerConfig>({
    enabled: false,
    message: '',
    type: 'info',
    icon: 'info',
    scrolling: false,
    dismissible: true,
    targetAudience: 'all',
    targetIds: [],
    ...initialConfig
  });

  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onSave?.(config);
      notifications.show({
        title: 'Settings Saved',
        message: 'Platform ticker settings have been updated successfully.',
        color: 'green',
      });
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

  const updateConfig = (key: keyof TickerConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
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
              onChange={(e) => updateConfig('enabled', e.currentTarget.checked)}
            />
          </Group>

          <Divider />

          {/* Message Configuration */}
          <Stack gap="sm">
            <Text fw={500}>Message Configuration</Text>
            
            <TextInput
              label="Message"
              placeholder="Enter your notification message..."
              value={config.message}
              onChange={(e) => updateConfig('message', e.currentTarget.value)}
              disabled={!config.enabled}
              required={config.enabled}
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
                value={config.type}
                onChange={(value) => updateConfig('type', value as any)}
                disabled={!config.enabled}
              />

              <Select
                label="Icon"
                data={[
                  { value: 'info', label: 'Info Circle' },
                  { value: 'warning', label: 'Warning Triangle' },
                  { value: 'success', label: 'Check Mark' },
                  { value: 'bulb', label: 'Light Bulb' }
                ]}
                value={config.icon}
                onChange={(value) => updateConfig('icon', value as any)}
                disabled={!config.enabled}
              />
            </Group>
          </Stack>

          <Divider />

          {/* Behavior Options */}
          <Stack gap="sm">
            <Text fw={500}>Behavior Options</Text>
            
            <Group justify="space-between">
              <Text size="sm">Enable scrolling animation</Text>
              <Switch
                checked={config.scrolling}
                onChange={(e) => updateConfig('scrolling', e.currentTarget.checked)}
                disabled={!config.enabled}
              />
            </Group>

            <Group justify="space-between">
              <Text size="sm">Allow users to dismiss</Text>
              <Switch
                checked={config.dismissible}
                onChange={(e) => updateConfig('dismissible', e.currentTarget.checked)}
                disabled={!config.enabled}
              />
            </Group>
          </Stack>

          <Divider />

          {/* Target Audience */}
          <Stack gap="sm">
            <Text fw={500}>Target Audience</Text>
            
            <Select
              label="Show to"
              data={[
                { value: 'all', label: 'All merchants' },
                { value: 'specific_tiers', label: 'Specific subscription tiers' },
                { value: 'specific_tenants', label: 'Specific tenants' }
              ]}
              value={config.targetAudience}
              onChange={(value) => updateConfig('targetAudience', value as any)}
              disabled={!config.enabled}
            />

            {config.targetAudience === 'specific_tiers' && (
              <MultiSelect
                label="Select tiers"
                data={tierOptions}
                value={config.targetIds}
                onChange={(value) => updateConfig('targetIds', value)}
                disabled={!config.enabled}
              />
            )}

            {config.targetAudience === 'specific_tenants' && (
              <MultiSelect
                label="Select tenants"
                data={tenantOptions}
                value={config.targetIds}
                onChange={(value) => updateConfig('targetIds', value)}
                disabled={!config.enabled}
                searchable
                maxDropdownHeight={200}
              />
            )}
          </Stack>

          {/* Preview */}
          {preview && config.enabled && config.message && (
            <>
              <Divider />
              <Box>
                <Text size="sm" fw={500} mb="sm">Preview</Text>
                <div style={{ transform: 'scale(0.9)', transformOrigin: 'top left' }}>
                  {/* Here you would include the actual PlatformTicker component */}
                  <Alert color={config.type === 'info' ? 'blue' : config.type === 'warning' ? 'yellow' : config.type === 'success' ? 'green' : 'red'} variant="light" p="xs">
                    <Group justify="space-between">
                      <Group gap="sm">
                        {config.icon === 'info' && <IconInfoCircle size={16} />}
                        {config.icon === 'warning' && <IconAlertTriangle size={16} />}
                        {config.icon === 'success' && <IconCheck size={16} />}
                        {config.icon === 'bulb' && <IconBulb size={16} />}
                        <Text size="sm" fw={500}>{config.message}</Text>
                      </Group>
                      {config.dismissible && (
                        <ActionIcon size="sm" variant="subtle">
                          ×
                        </ActionIcon>
                      )}
                    </Group>
                  </Alert>
                </div>
              </Box>
            </>
          )}

          <Group justify="flex-end" mt="md">
            <Button onClick={handleSave} loading={loading} disabled={!config.enabled || !config.message}>
              Save Settings
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}

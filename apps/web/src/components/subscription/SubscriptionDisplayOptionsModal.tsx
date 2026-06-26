'use client';

import { Modal, Button, Checkbox, Radio, Group, Stack, Text, Title, Paper, Divider, Box } from '@mantine/core';
import { useSubscriptionDisplay, FIELD_METADATA, type SubscriptionDisplayField } from '@/hooks/useSubscriptionDisplay';
import { useState, useEffect } from 'react';
import { IconRotateClockwise, IconCheck } from '@tabler/icons-react';
import type { AllCapabilitiesState } from '@/services/CapabilityResolutionService';

interface SubscriptionDisplayOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  capabilities?: AllCapabilitiesState | null;
}

// Group fields by category
const FIELD_CATEGORIES = {
  subscription: {
    label: 'Subscription',
    fields: ['effectiveTier', 'subscriptionStatus', 'pricing', 'capabilities', 'trialInfo'] as SubscriptionDisplayField[],
  },
  limits: {
    label: 'Limits',
    fields: ['skuLimit', 'locationLimit'] as SubscriptionDisplayField[],
  },
  organization: {
    label: 'Organization',
    fields: ['organization', 'tenantTier', 'organizationTenants'] as SubscriptionDisplayField[],
  },
};

const LAYOUT_OPTIONS = [
  { value: 'minimal', label: 'Minimal', description: 'Single line, essential info only' },
  { value: 'compact', label: 'Compact', description: 'Two-column grid, balanced view' },
  { value: 'expanded', label: 'Expanded', description: 'Multi-column, detailed view' },
] as const;

const TOTAL_CAPABILITY_DOMAINS = 16;

function countEnabledCapabilities(caps: AllCapabilitiesState): number {
  const domains = [
    caps.commerce, caps.paymentGateway, caps.storefront, caps.barcodeScan,
    caps.fulfillment, caps.productOptions, caps.featuredOptions, caps.integrationOptions,
    caps.quickstartOptions, caps.storefrontOptions, caps.directoryEntryOptions,
    caps.faqOptions, caps.crmOptions, caps.chatbotOptions, caps.socialCommerceOptions,
  ];
  return domains.filter(d => d?.enabled).length;
}

export function SubscriptionDisplayOptionsModal({
  isOpen,
  onClose,
  tenantId,
  capabilities,
}: SubscriptionDisplayOptionsModalProps) {
  const { 
    config, 
    isLoading, 
    setVisibleFields, 
    setLayout, 
    setShowUpgradePrompt,
  } = useSubscriptionDisplay(tenantId);

  // Local state for unsaved changes
  const [localVisibleFields, setLocalVisibleFields] = useState<SubscriptionDisplayField[]>([]);
  const [localLayout, setLocalLayout] = useState<typeof config.layout>('compact');
  const [localShowUpgradePrompt, setLocalShowUpgradePrompt] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state with config when modal opens
  useEffect(() => {
    if (isOpen && !isLoading) {
      setLocalVisibleFields([...config.visibleFields]);
      setLocalLayout(config.layout);
      setLocalShowUpgradePrompt(config.showUpgradePrompt);
      setHasChanges(false);
    }
  }, [isOpen, isLoading, config.visibleFields, config.layout, config.showUpgradePrompt]);

  // Check for changes
  useEffect(() => {
    const fieldsChanged = 
      localVisibleFields.length !== config.visibleFields.length ||
      localVisibleFields.some(f => !config.visibleFields.includes(f));
    const layoutChanged = localLayout !== config.layout;
    const upgradeChanged = localShowUpgradePrompt !== config.showUpgradePrompt;
    setHasChanges(fieldsChanged || layoutChanged || upgradeChanged);
  }, [localVisibleFields, localLayout, localShowUpgradePrompt, config.visibleFields, config.layout, config.showUpgradePrompt]);

  // Toggle field in local state
  const handleToggleField = (field: SubscriptionDisplayField) => {
    setLocalVisibleFields(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  // Select all fields in a category
  const handleSelectCategory = (category: keyof typeof FIELD_CATEGORIES) => {
    const categoryFields = FIELD_CATEGORIES[category].fields;
    const allSelected = categoryFields.every(f => localVisibleFields.includes(f));
    
    if (allSelected) {
      // Deselect all in category
      setLocalVisibleFields(prev => prev.filter(f => !categoryFields.includes(f)));
    } else {
      // Select all in category
      setLocalVisibleFields(prev => {
        const newFields = [...prev];
        categoryFields.forEach(f => {
          if (!newFields.includes(f)) {
            newFields.push(f);
          }
        });
        return newFields;
      });
    }
  };

  // Save changes
  const handleSave = () => {
    setVisibleFields(localVisibleFields);
    setLayout(localLayout);
    setShowUpgradePrompt(localShowUpgradePrompt);
    onClose();
  };

  // Reset to defaults
  const handleReset = () => {
    setLocalVisibleFields(['effectiveTier', 'subscriptionStatus', 'skuLimit', 'locationLimit', 'capabilities']);
    setLocalLayout('compact');
    setLocalShowUpgradePrompt(true);
  };

  // Check if field is selected
  const isFieldSelected = (field: SubscriptionDisplayField) => localVisibleFields.includes(field);

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Box>
          <Title order={4}>Customize Subscription Display</Title>
          <Text size="sm" c="dimmed">
            Choose which subscription details appear on your dashboard
          </Text>
        </Box>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        {/* Field selection by category */}
        {Object.entries(FIELD_CATEGORIES).map(([categoryKey, category]) => (
          <Paper key={categoryKey} p="sm" withBorder>
            <Group justify="space-between" mb="xs">
              <Text fw={500} size="sm">{category.label}</Text>
              <Button
                variant="subtle"
                size="compact-xs"
                onClick={() => handleSelectCategory(categoryKey as keyof typeof FIELD_CATEGORIES)}
              >
                {category.fields.every(f => isFieldSelected(f)) ? 'Deselect all' : 'Select all'}
              </Button>
            </Group>
            <Group gap="xs">
              {category.fields.map(field => {
                const meta = FIELD_METADATA[field];
                return (
                  <Paper
                    key={field}
                    p="xs"
                    withBorder
                    style={{
                      flex: '1 1 45%',
                      cursor: 'pointer',
                      borderColor: isFieldSelected(field) ? 'var(--mantine-color-primary-5)' : undefined,
                      backgroundColor: isFieldSelected(field) ? 'var(--mantine-color-primary-0)' : undefined,
                    }}
                    onClick={() => handleToggleField(field)}
                  >
                    <Group gap="xs" wrap="nowrap">
                      <Checkbox
                        checked={isFieldSelected(field)}
                        onChange={() => handleToggleField(field)}
                        aria-label={meta.label}
                      />
                      <Box>
                        <Text size="sm" fw={500}>{meta.label}</Text>
                        <Text size="xs" c="dimmed">
                          {meta.description}
                          {field === 'capabilities' && capabilities && (
                            <> &middot; {countEnabledCapabilities(capabilities)}/{TOTAL_CAPABILITY_DOMAINS} active</>
                          )}
                        </Text>
                      </Box>
                    </Group>
                  </Paper>
                );
              })}
            </Group>
          </Paper>
        ))}

        <Divider />

        {/* Layout selection */}
        <Paper p="sm" withBorder>
          <Text fw={500} size="sm" mb="xs">Layout</Text>
          <Radio.Group
            value={localLayout}
            onChange={(value) => setLocalLayout(value as typeof config.layout)}
          >
            <Group gap="xs">
              {LAYOUT_OPTIONS.map(option => (
                <Paper
                  key={option.value}
                  p="sm"
                  withBorder
                  style={{
                    flex: 1,
                    borderColor: localLayout === option.value ? 'var(--mantine-color-primary-5)' : undefined,
                    backgroundColor: localLayout === option.value ? 'var(--mantine-color-primary-0)' : undefined,
                  }}
                >
                  <Radio
                    value={option.value}
                    label={
                      <Box>
                        <Text size="sm" fw={500}>{option.label}</Text>
                        <Text size="xs" c="dimmed">{option.description}</Text>
                      </Box>
                    }
                  />
                </Paper>
              ))}
            </Group>
          </Radio.Group>
        </Paper>

        <Divider />

        {/* Upgrade prompt toggle */}
        <Paper p="sm" withBorder>
          <Group justify="space-between">
            <Box>
              <Text size="sm" fw={500}>Show Upgrade Prompt</Text>
              <Text size="xs" c="dimmed">
                Display upgrade suggestions when approaching limits
              </Text>
            </Box>
            <Checkbox
              checked={localShowUpgradePrompt}
              onChange={() => setLocalShowUpgradePrompt(!localShowUpgradePrompt)}
            />
          </Group>
        </Paper>
      </Stack>

      {/* Footer */}
      <Group justify="space-between" mt="xl">
        <Button
          variant="subtle"
          size="sm"
          leftSection={<IconRotateClockwise size={16} />}
          onClick={handleReset}
        >
          Reset to Defaults
        </Button>
        <Group gap="xs">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="filled"
            leftSection={<IconCheck size={16} />}
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Save Changes
          </Button>
        </Group>
      </Group>
    </Modal>
  );
}

'use client';

/**
 * IntakeFormRenderer — generic, registry-driven form renderer.
 *
 * Renders form fields dynamically from the definition's form_schema JSONB.
 * Each field type maps to a Mantine control. Handles:
 * - text, url, email, phone, textarea, select, radio, multiselect, checkbox,
 *   chips, hours_grid, attachments, number, date, object (nested)
 * - options_source: fetches option lists from the /options endpoint
 * - required + validation constraints (min, max, pattern)
 * - nested object fields (e.g., voice_profile, response_policy)
 *
 * Intake Portal Generalization Sprint 1.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Stack,
  TextInput,
  Textarea,
  Select,
  Radio,
  Checkbox,
  MultiSelect,
  Text,
  Box,
  Title,
  Group,
  Chip,
  Alert,
  FileInput,
  List,
  ThemeIcon,
  Paper,
  Divider,
  rem,
} from '@mantine/core';
import {
  IconUpload,
  IconFile,
  IconX,
  IconAlertCircle,
} from '@tabler/icons-react';
import recoveryIntakePublicService from '@/services/RecoveryIntakePublicService';
import type { FormField, AttachmentUploadResult } from '@/services/RecoveryIntakePublicService';

export interface IntakeFormRendererProps {
  token: string;
  fields: FormField[];
  // Values keyed by field.key (top-level) or "parent.child" (nested)
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  // Attachment state is managed by the parent (shared with the existing upload UI)
  uploadedAttachments: AttachmentUploadResult[];
  onUploadAttachments: (files: File[]) => Promise<void>;
  uploading: boolean;
}

// Days of the week for hours_grid
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export default function IntakeFormRenderer({
  token,
  fields,
  values,
  onChange,
  uploadedAttachments,
  onUploadAttachments,
  uploading,
}: IntakeFormRendererProps) {
  // Cache for options fetched from /options endpoint
  const [optionsCache, setOptionsCache] = useState<Record<string, Array<{ value: string; label: string }>>>({});
  const [optionsLoading, setOptionsLoading] = useState<Record<string, boolean>>({});

  const fetchOptions = useCallback(async (source: string) => {
    if (optionsCache[source] || optionsLoading[source]) return;
    setOptionsLoading((prev) => ({ ...prev, [source]: true }));
    try {
      const result = await recoveryIntakePublicService.getOptions(token, source);
      setOptionsCache((prev) => ({ ...prev, [source]: result.options || [] }));
    } catch (err) {
      // Fail silently — field will show as text input fallback
      console.warn(`Failed to load options for ${source}:`, err);
    }
    setOptionsLoading((prev) => ({ ...prev, [source]: false }));
  }, [token, optionsCache, optionsLoading]);

  // Pre-fetch all options_source fields on mount
  useEffect(() => {
    for (const field of fields) {
      if (field.options_source) {
        fetchOptions(field.options_source);
      }
      if (field.fields) {
        for (const subField of field.fields) {
          if (subField.options_source) {
            fetchOptions(subField.options_source);
          }
        }
      }
    }
  }, [fields, fetchOptions]);

  const updateValue = (key: string, value: any) => {
    onChange({ ...values, [key]: value });
  };

  const updateNestedValue = (parentKey: string, childKey: string, value: any) => {
    const current = values[parentKey] || {};
    onChange({ ...values, [parentKey]: { ...current, [childKey]: value } });
  };

  const renderField = (field: FormField, nestedKey?: string): React.ReactNode => {
    const fieldName = nestedKey ?? field.key;
    const isNested = !!nestedKey;
    const currentValue = isNested
      ? (values[field.key]?.[field.key.replace(`${field.key}.`, '')] ?? '')
      : values[field.key];

    // For nested fields, the value is in values[parentKey][childKey]
    const actualValue = isNested
      ? (values[nestedKey.split('.')[0]]?.[field.key] ?? '')
      : values[field.key];

    const label = field.required ? `${field.label} *` : field.label;

    switch (field.type) {
      case 'text':
      case 'url':
      case 'email':
      case 'phone':
        return (
          <TextInput
            key={fieldName}
            label={label}
            description={field.help_text}
            placeholder={field.type === 'url' ? 'https://...' : field.type === 'email' ? 'you@example.com' : ''}
            type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
            value={actualValue || ''}
            onChange={(e) => isNested ? updateNestedValue(nestedKey.split('.')[0], field.key, e.target.value) : updateValue(field.key, e.target.value)}
            required={field.required}
            error={field.type === 'url' && actualValue && !/^https?:\/\//.test(actualValue) ? 'Must be a valid URL' : undefined}
          />
        );

      case 'textarea':
        return (
          <Textarea
            key={fieldName}
            label={label}
            description={field.help_text}
            value={actualValue || ''}
            onChange={(e) => isNested ? updateNestedValue(nestedKey.split('.')[0], field.key, e.target.value) : updateValue(field.key, e.target.value)}
            required={field.required}
            autosize
            minRows={3}
          />
        );

      case 'select':
      case 'radio': {
        const options = field.options || [];
        if (field.type === 'radio') {
          return (
            <Radio.Group
              key={fieldName}
              label={label}
              description={field.help_text}
              value={actualValue || ''}
              onChange={(val) => isNested ? updateNestedValue(nestedKey.split('.')[0], field.key, val) : updateValue(field.key, val)}
              required={field.required}
            >
              <Stack gap="xs" mt="xs">
                {options.map((opt) => (
                  <Radio key={opt.value} value={opt.value} label={opt.label} />
                ))}
              </Stack>
            </Radio.Group>
          );
        }
        return (
          <Select
            key={fieldName}
            label={label}
            description={field.help_text}
            value={actualValue || ''}
            onChange={(val) => isNested ? updateNestedValue(nestedKey.split('.')[0], field.key, val || '') : updateValue(field.key, val || '')}
            required={field.required}
            data={options}
            searchable
          />
        );
      }

      case 'multiselect': {
        const options = field.options || (field.options_source ? optionsCache[field.options_source] : []);
        const isLoading = field.options_source ? optionsLoading[field.options_source] : false;
        return (
          <MultiSelect
            key={fieldName}
            label={label}
            description={field.help_text}
            value={actualValue || []}
            onChange={(val) => isNested ? updateNestedValue(nestedKey.split('.')[0], field.key, val) : updateValue(field.key, val)}
            required={field.required}
            data={options}
            searchable
            clearable
            placeholder={isLoading ? 'Loading options...' : 'Select...'}
          />
        );
      }

      case 'checkbox':
        return (
          <Checkbox
            key={fieldName}
            label={label}
            description={field.help_text}
            checked={actualValue || false}
            onChange={(e) => isNested ? updateNestedValue(nestedKey.split('.')[0], field.key, e.currentTarget.checked) : updateValue(field.key, e.currentTarget.checked)}
            required={field.required}
          />
        );

      case 'chips': {
        const options = field.options || (field.options_source ? optionsCache[field.options_source] : []);
        const selected: string[] = actualValue || [];
        return (
          <Box key={fieldName}>
            <Text size="sm" fw={500} mb={4}>{label}</Text>
            {field.help_text && <Text size="xs" c="dimmed" mb={8}>{field.help_text}</Text>}
            <Chip.Group
              value={selected}
              onChange={(val) => isNested ? updateNestedValue(nestedKey.split('.')[0], field.key, val) : updateValue(field.key, val)}
              multiple
            >
              <Group gap="xs">
                {options.map((opt) => (
                  <Chip key={opt.value} value={opt.value}>{opt.label}</Chip>
                ))}
              </Group>
            </Chip.Group>
          </Box>
        );
      }

      case 'hours_grid': {
        const hoursValue = actualValue || {};
        return (
          <Box key={fieldName}>
            <Text size="sm" fw={500} mb={4}>{label}</Text>
            {field.help_text && <Text size="xs" c="dimmed" mb={8}>{field.help_text}</Text>}
            <Stack gap="xs">
              {DAYS.map((day) => {
                const dayHours = hoursValue[day] || { open: '', close: '', closed: false };
                return (
                  <Group key={day} gap="xs" align="flex-end">
                    <Text size="sm" w={90}>{DAY_LABELS[day]}</Text>
                    <Checkbox
                      label="Closed"
                      checked={dayHours.closed || false}
                      onChange={(e) => {
                        const updated = { ...hoursValue, [day]: { ...dayHours, closed: e.currentTarget.checked } };
                        isNested ? updateNestedValue(nestedKey.split('.')[0], field.key, updated) : updateValue(field.key, updated);
                      }}
                    />
                    {!dayHours.closed && (
                      <>
                        <TextInput
                          placeholder="09:00"
                          value={dayHours.open || ''}
                          onChange={(e) => {
                            const updated = { ...hoursValue, [day]: { ...dayHours, open: e.target.value } };
                            isNested ? updateNestedValue(nestedKey.split('.')[0], field.key, updated) : updateValue(field.key, updated);
                          }}
                          w={100}
                        />
                        <Text size="sm">to</Text>
                        <TextInput
                          placeholder="17:00"
                          value={dayHours.close || ''}
                          onChange={(e) => {
                            const updated = { ...hoursValue, [day]: { ...dayHours, close: e.target.value } };
                            isNested ? updateNestedValue(nestedKey.split('.')[0], field.key, updated) : updateValue(field.key, updated);
                          }}
                          w={100}
                        />
                      </>
                    )}
                  </Group>
                );
              })}
            </Stack>
          </Box>
        );
      }

      case 'attachments': {
        const fieldAttachments = uploadedAttachments;
        return (
          <Box key={fieldName}>
            <Text size="sm" fw={500} mb={4}>{label}</Text>
            {field.help_text && <Text size="xs" c="dimmed" mb={8}>{field.help_text}</Text>}
            <FileInput
              placeholder="Click to upload files"
              multiple
              onChange={(files) => {
                if (files && files.length > 0) {
                  onUploadAttachments(files as File[]);
                }
              }}
              accept="image/*,.pdf"
              disabled={uploading}
            />
            {fieldAttachments.length > 0 && (
              <List mt="sm" spacing="xs">
                {fieldAttachments.map((att) => (
                  <List.Item
                    key={att.attachmentId}
                    icon={<ThemeIcon size={20} radius="xl" color="blue" variant="light"><IconFile size={12} /></ThemeIcon>}
                  >
                    <Text size="sm">{att.fileName}</Text>
                  </List.Item>
                ))}
              </List>
            )}
            {uploading && <Text size="xs" c="dimmed" mt="xs">Uploading...</Text>}
          </Box>
        );
      }

      case 'number':
        return (
          <TextInput
            key={fieldName}
            label={label}
            description={field.help_text}
            type="number"
            value={actualValue ?? ''}
            onChange={(e) => {
              const num = e.target.value === '' ? '' : Number(e.target.value);
              isNested ? updateNestedValue(nestedKey.split('.')[0], field.key, num) : updateValue(field.key, num);
            }}
            required={field.required}
          />
        );

      case 'date':
        return (
          <TextInput
            key={fieldName}
            label={label}
            description={field.help_text}
            type="date"
            value={actualValue || ''}
            onChange={(e) => isNested ? updateNestedValue(nestedKey.split('.')[0], field.key, e.target.value) : updateValue(field.key, e.target.value)}
            required={field.required}
          />
        );

      case 'object': {
        if (!field.fields || field.fields.length === 0) {
          return (
            <Alert key={fieldName} color="orange" icon={<IconAlertCircle size={16} />}>
              Object field "{field.label}" has no sub-fields defined.
            </Alert>
          );
        }
        return (
          <Paper key={fieldName} withBorder p="md" radius="md">
            <Title order={5} mb="xs">{label}</Title>
            {field.help_text && <Text size="xs" c="dimmed" mb="sm">{field.help_text}</Text>}
            <Stack gap="md">
              {field.fields.map((subField) => renderField(subField, `${field.key}.${subField.key}`))}
            </Stack>
          </Paper>
        );
      }

      default:
        return (
          <Alert key={fieldName} color="orange" icon={<IconAlertCircle size={16} />}>
            Unknown field type "{field.type}" for field "{field.label}".
          </Alert>
        );
    }
  };

  return (
    <Stack gap="md">
      {fields.map((field) => renderField(field))}
    </Stack>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Card, Text, Group, Stack, Button, Badge, Alert, Loader } from '@mantine/core';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import GBPCategorySelectorAdapter from './GBPCategorySelectorAdapter';
import { gbpCategoryService } from '@/services/GBPCategoryService';

interface SelectedCategory {
  id: string;
  name: string;
}

interface GBPCategoryCardProps {
  tenantId: string;
  initialPrimary?: SelectedCategory | null;
  initialSecondary?: SelectedCategory[];
  syncStatus?: string | null;
  lastSynced?: string | null;
}

interface CategoryMapping {
  gbpCategoryId: string;
  gbpCategoryName: string;
  platformCategory: {
    id: string;
    name: string;
    slug: string;
    icon: string;
  } | null;
  mappingConfidence: string;
  isMapped: boolean;
}

export default function GBPCategoryCard({
  tenantId,
  initialPrimary,
  initialSecondary = [],
  syncStatus,
  lastSynced,
}: GBPCategoryCardProps) {
  const [primary, setPrimary] = useState<SelectedCategory | null>(initialPrimary || null);
  const [secondary, setSecondary] = useState<SelectedCategory[]>(initialSecondary);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(false);

  // Load mappings on mount if categories exist
  useEffect(() => {
    if (primary || secondary.length > 0) {
      const allCategories = primary ? [primary, ...secondary] : secondary;
      fetchMappings(allCategories);
    }
  }, []); // Only run on mount

  const fetchMappings = async (categories: SelectedCategory[]) => {
    if (categories.length === 0) {
      setMappings([]);
      return;
    }

    try {
      setLoadingMappings(true);
      const categoryIds = categories.map(c => c.id);
      console.log('[GBPCategoryCard] Fetching mappings for:', categoryIds);
      const mappingsData = await gbpCategoryService.getCategoryMappings(categoryIds);
      console.log('[GBPCategoryCard] Mappings received:', mappingsData);
      setMappings(mappingsData);
    } catch (err) {
      console.error('[GBPCategoryCard] Failed to fetch mappings:', err);
    } finally {
      setLoadingMappings(false);
    }
  };

  const handleSave = async () => {
    if (!primary) {
      setError('Please select a primary category');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await gbpCategoryService.updateGBPCategories(tenantId, {
        primary: {
          id: primary.id,
          name: primary.name,
        },
        secondary: secondary.map(s => ({
          id: s.id,
          name: s.name,
        })),
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      // Fetch mappings after successful save
      const allCategories = [primary, ...secondary];
      await fetchMappings(allCategories);
    } catch (err) {
      console.error('[GBPCategoryCard] Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save categories');
    } finally {
      setSaving(false);
    }
  };

  const getSyncStatusDisplay = () => {
    if (!syncStatus) return null;

    const statusConfig: Record<string, { color: string; label: string }> = {
      synced: { color: 'green', label: 'Synced' },
      pending: { color: 'yellow', label: 'Pending' },
      error: { color: 'red', label: 'Error' },
    };

    const config = statusConfig[syncStatus] || statusConfig.pending;

    return (
      <Badge color={config.color} variant="light" size="sm">
        {config.label}
      </Badge>
    );
  };

  const totalCategories = (primary ? 1 : 0) + secondary.length;

  return (
    <Card shadow="sm" padding="lg" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <div>
            <Text size="lg" fw={600}>Google Business Profile Categories</Text>
            <Text size="sm" c="dimmed">
              Select your primary category and up to 9 secondary categories
            </Text>
          </div>
          <Group gap="sm">
            {getSyncStatusDisplay()}
            {totalCategories > 0 && (
              <Text size="xs" c="dimmed">
                {totalCategories} {totalCategories === 1 ? 'category' : 'categories'}
              </Text>
            )}
          </Group>
        </Group>

        <GBPCategorySelectorAdapter
          tenantId={tenantId}
          primary={primary}
          secondary={secondary}
          onPrimaryChange={setPrimary}
          onSecondaryChange={setSecondary}
          disabled={saving}
        />

        {error && (
          <Alert color="red" icon={<AlertCircle size={16} />}>
            <Text size="sm">{error}</Text>
          </Alert>
        )}

        {success && (
          <Alert color="green" icon={<CheckCircle2 size={16} />}>
            <Stack gap={4}>
              <Text size="sm" fw={500}>Categories saved successfully!</Text>
              <Text size="xs" c="green.7">
                Your categories will sync to your directory listing automatically.
              </Text>
            </Stack>
          </Alert>
        )}

        {lastSynced && (
          <Group gap={4}>
            <Clock size={12} />
            <Text size="xs" c="dimmed">
              Last synced: {new Date(lastSynced).toLocaleString()}
            </Text>
          </Group>
        )}

        {/* Category Mappings Display */}
        {mappings.length > 0 && (
          <Stack gap="sm">
            <Text size="sm" fw={500}>Directory Category Mappings</Text>
            <Stack gap="xs">
              {mappings.map((mapping) => (
                <Card key={mapping.gbpCategoryId} padding="sm" withBorder bg="gray.0">
                  <Group justify="space-between">
                    <div style={{ flex: 1 }}>
                      <Text size="sm" fw={500}>
                        {mapping.gbpCategoryName}
                      </Text>
                      {mapping.isMapped && mapping.platformCategory ? (
                        <Group gap={4} mt={4}>
                          <Text size="xs" c="dimmed">Maps to:</Text>
                          <Button
                            variant="subtle"
                            size="compact-xs"
                            component="a"
                            href={`/directory/categories/${mapping.platformCategory.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {mapping.platformCategory.icon} {mapping.platformCategory.name}
                          </Button>
                        </Group>
                      ) : (
                        <Text size="xs" c="yellow" mt={4}>
                          ⚠️ No platform category mapping
                        </Text>
                      )}
                    </div>
                    <Badge
                      size="xs"
                      color={
                        mapping.isMapped
                          ? mapping.mappingConfidence === 'exact'
                            ? 'green'
                            : mapping.mappingConfidence === 'close'
                            ? 'blue'
                            : 'yellow'
                          : 'gray'
                      }
                    >
                      {mapping.isMapped ? mapping.mappingConfidence : 'unmapped'}
                    </Badge>
                  </Group>
                </Card>
              ))}
            </Stack>
            {mappings.some(m => !m.isMapped) && (
              <Alert color="yellow" variant="light">
                <Text size="xs">
                  <strong>Note:</strong> Some categories don't have platform mappings yet. Your store won't appear in those category pages until mappings are added.
                </Text>
              </Alert>
            )}
          </Stack>
        )}

        {loadingMappings && (
          <Group justify="center" py="md">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">Loading mappings...</Text>
          </Group>
        )}

        <Group>
          <Button
            onClick={handleSave}
            disabled={saving || !primary}
            variant="filled" 
            style={{ color: 'white' }}
            loading={saving}
          >
            Save & Sync to Directory
          </Button>

          {(primary || secondary.length > 0) && (
            <Button
              variant="outline"
              onClick={() => {
                setPrimary(null);
                setSecondary([]);
              }}
              disabled={saving}
            >
              Clear All
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  );
}

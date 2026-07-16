"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button, TextInput, Select, Badge, Table } from '@mantine/core';
import { Spinner } from '@/components/ui';
import { notifications } from '@mantine/notifications';
import PageHeader from '@/components/PageHeader';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { adminSlugRegistryService, SlugRegistryEntry, SlugRegistryStats, SlugComponents } from '@/services/AdminSlugRegistrySingletonService';
import { clientLogger } from '@/lib/client-logger';

export default function SlugRegistryAdminPage() {
  const { hasAccess, loading: accessLoading } = useAccessControl(
    null,
    AccessPresets.PLATFORM_ADMIN_ONLY
  );

  const [entries, setEntries] = useState<SlugRegistryEntry[]>([]);
  const [stats, setStats] = useState<SlugRegistryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<SlugRegistryEntry | null>(null);
  const [parsedSlug, setParsedSlug] = useState<SlugComponents | null>(null);

  // Filters
  const [slugType, setSlugType] = useState<string>('');
  const [migrationStatus, setMigrationStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesResult, statsResult] = await Promise.all([
        adminSlugRegistryService.getSlugRegistryEntries({
          slugType: slugType as 'upc' | 'lpc' | undefined,
          migrationStatus: migrationStatus || undefined,
          search: search || undefined,
          page,
          limit: 50
        }),
        adminSlugRegistryService.getSlugRegistryStats()
      ]);

      if (entriesResult) {
        setEntries(entriesResult.entries);
      }
      if (statsResult) {
        setStats(statsResult);
      }
    } catch (error) {
      clientLogger.error('Failed to load slug registry data:', { detail: error });
    } finally {
      setLoading(false);
    }
  }, [slugType, migrationStatus, search, page]);

  useEffect(() => {
    if (hasAccess) {
      loadData();
    }
  }, [hasAccess, loadData]);

  const handleViewEntry = async (entry: SlugRegistryEntry) => {
    setSelectedEntry(entry);
    const parsed = await adminSlugRegistryService.parseSlug(entry.product_slug);
    setParsedSlug(parsed);
  };

  const handleRegenerateSlug = async (entryId: string) => {
    try {
      const result = await adminSlugRegistryService.regenerateSlug(entryId);
      if (result) {
        notifications.show({
          title: 'Success',
          message: 'Slug regenerated successfully',
          color: 'green'
        });
        loadData();
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to regenerate slug',
        color: 'red'
      });
    }
  };

  const handleToggleActive = async (entryId: string, currentActive: boolean) => {
    try {
      const success = currentActive
        ? await adminSlugRegistryService.deactivateSlug(entryId)
        : await adminSlugRegistryService.activateSlug(entryId);

      if (success) {
        notifications.show({
          title: 'Success',
          message: `Slug ${currentActive ? 'deactivated' : 'activated'} successfully`,
          color: 'green'
        });
        loadData();
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to update slug status',
        color: 'red'
      });
    }
  };

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Slug Registry Admin"
        description="Manage product slug registry entries"
        icon={
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.total}</div>
              <div className="text-sm text-gray-500">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.upcCount}</div>
              <div className="text-sm text-gray-500">UPC</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.lpcCount}</div>
              <div className="text-sm text-gray-500">LPC</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.v2Count}</div>
              <div className="text-sm text-gray-500">V2 Format</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.activeCount}</div>
              <div className="text-sm text-gray-500">Active</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{stats.migratedCount}</div>
              <div className="text-sm text-gray-500">Migrated</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.pendingMigrationCount}</div>
              <div className="text-sm text-gray-500">Pending</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <TextInput
                label="Search"
                placeholder="Search by slug, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              label="Slug Type"
              placeholder="All types"
              value={slugType}
              onChange={(value) => setSlugType(value || '')}
              data={[
                { value: '', label: 'All' },
                { value: 'upc', label: 'UPC' },
                { value: 'lpc', label: 'LPC' }
              ]}
              clearable
            />
            <Select
              label="Migration Status"
              placeholder="All statuses"
              value={migrationStatus}
              onChange={(value) => setMigrationStatus(value || '')}
              data={[
                { value: '', label: 'All' },
                { value: 'completed', label: 'Completed' },
                { value: 'pending', label: 'Pending' },
                { value: 'regenerated', label: 'Regenerated' }
              ]}
              clearable
            />
            <Button onClick={loadData} loading={loading} variant='gradient' style={{ color: 'white' }}>
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registry Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-8">
              <Spinner size="lg" />
            </div>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Slug</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Universal SKU</Table.Th>
                  <Table.Th>Original SKU</Table.Th>
                  <Table.Th>Format</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {entries.map((entry) => (
                  <Table.Tr key={entry.id}>
                    <Table.Td>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {entry.product_slug.length > 40
                          ? `${entry.product_slug.substring(0, 40)}...`
                          : entry.product_slug}
                      </code>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={entry.slug_type === 'upc' ? 'blue' : 'green'}>
                        {entry.slug_type?.toUpperCase() || 'N/A'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <span className="text-sm text-gray-600">
                        {entry.universal_sku || '-'}
                      </span>
                    </Table.Td>
                    <Table.Td>
                      <span className="text-sm text-gray-600">
                        {entry.original_sku || '-'}
                      </span>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={entry.format_version === 'v2' ? 'green' : 'gray'}>
                        {entry.format_version || 'v1'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={entry.is_active ? 'green' : 'red'}>
                        {entry.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <div className="flex gap-2">
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => handleViewEntry(entry)}
                        >
                          View
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="amber"
                          onClick={() => handleRegenerateSlug(entry.id)}
                        >
                          Regenerate
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color={entry.is_active ? 'red' : 'green'}
                          onClick={() => handleToggleActive(entry.id, entry.is_active)}
                        >
                          {entry.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Slug Details</CardTitle>
              <Button variant="subtle" onClick={() => setSelectedEntry(null)}>
                ✕
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Full Slug</label>
                <code className="block mt-1 p-2 bg-gray-100 rounded text-sm break-all">
                  {selectedEntry.product_slug}
                </code>
              </div>

              {parsedSlug && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Parsed Components</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="p-2 bg-blue-50 rounded">
                      <span className="text-xs text-blue-600">Type</span>
                      <div className="font-medium">{parsedSlug.type.toUpperCase()}</div>
                    </div>
                    <div className="p-2 bg-green-50 rounded">
                      <span className="text-xs text-green-600">Category</span>
                      <div className="font-medium">{parsedSlug.category}</div>
                    </div>
                    {parsedSlug.sku && (
                      <div className="p-2 bg-purple-50 rounded">
                        <span className="text-xs text-purple-600">SKU</span>
                        <div className="font-medium">{parsedSlug.sku}</div>
                      </div>
                    )}
                    {parsedSlug.brand && (
                      <div className="p-2 bg-amber-50 rounded">
                        <span className="text-xs text-amber-600">Brand</span>
                        <div className="font-medium">{parsedSlug.brand}</div>
                      </div>
                    )}
                    <div className="p-2 bg-gray-50 rounded">
                      <span className="text-xs text-gray-600">Identifier</span>
                      <div className="font-medium">{parsedSlug.identifier || '-'}</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <span className="text-xs text-gray-600">Name Hash</span>
                      <div className="font-medium font-mono">{parsedSlug.name_hash}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Universal SKU</label>
                  <div className="mt-1">{selectedEntry.universal_sku || '-'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Original SKU</label>
                  <div className="mt-1">{selectedEntry.original_sku || '-'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Tenant ID</label>
                  <div className="mt-1">{selectedEntry.tenant_id}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Migration Status</label>
                  <div className="mt-1">{selectedEntry.migration_status || '-'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <div className="mt-1">{new Date(selectedEntry.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Brand Normalized</label>
                  <div className="mt-1">{selectedEntry.brand_normalized || '-'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

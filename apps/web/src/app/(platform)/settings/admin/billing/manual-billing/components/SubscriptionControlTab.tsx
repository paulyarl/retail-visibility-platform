'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Badge,
  Text,
  Group,
  ActionIcon,
  Modal,
  Stack,
  Card,
  Alert,
  Loader,
  Pagination,
  Input,
  Switch,
  TextInput,
  Textarea,
  Select,
  NumberInput
} from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import {
  IconSearch,
  IconSettings,
  IconShield,
  IconClock,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconPlus
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { manualBillingService } from '@/services/ManualBillingService';
import { useForm } from '@mantine/form';

interface Tenant {
  id: string;
  name: string;
  subscriptionStatus: string;
  subscriptionTier: string;
  subscriptionEndsAt?: Date;
  trialEndsAt?: Date;
  graceEndsAt?: Date;
  manualSubscriptionControl: boolean;
  manualSubscriptionExpiresAt?: Date;
  manualSubscriptionReason?: string;
  effectiveExpiresAt?: Date;
  effectiveExpiresType?: string;
}

export default function SubscriptionControlTab() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [controlModalOpen, setControlModalOpen] = useState(false);
  const [addControlModalOpen, setAddControlModalOpen] = useState(false);
  const [bulkControlModalOpen, setBulkControlModalOpen] = useState(false);
  const [bulkControlLoading, setBulkControlLoading] = useState(false);
  const itemsPerPage = 10;

  const controlForm = useForm({
    initialValues: {
      enabled: false,
      hasExpirationDate: false,
      expiresAt: null as Date | null,
      reason: ''
    },
    validate: {
      reason: (value, values) => values.enabled && !value.trim() ? 'Reason is required when enabling manual control' : null
    }
  });

  const addControlForm = useForm({
    initialValues: {
      tenantId: '',
      enabled: false,
      expiresAt: null as Date | null,
      reason: ''
    },
    validate: {
      tenantId: (value) => !value ? 'Tenant is required' : null,
      reason: (value, values) => values.enabled && !value.trim() ? 'Reason is required when enabling manual control' : null
    }
  });

  // Fetch data
  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const tenantsData = await manualBillingService.getAllTenants();
      
      const transformedTenants = tenantsData.map((tenant: any) => ({
        id: tenant.id,
        name: tenant.name,
        subscriptionStatus: tenant.subscriptionStatus || 'unknown',
        subscriptionTier: tenant.subscriptionTier || 'unknown',
        subscriptionEndsAt: tenant.subscriptionEndsAt ? new Date(tenant.subscriptionEndsAt) : undefined,
        trialEndsAt: tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : undefined,
        graceEndsAt: tenant.graceEndsAt ? new Date(tenant.graceEndsAt) : undefined,
        manualSubscriptionControl: tenant.manualSubscriptionControl || false,
        manualSubscriptionExpiresAt: tenant.manualSubscriptionExpiresAt ? new Date(tenant.manualSubscriptionExpiresAt) : undefined,
        manualSubscriptionReason: tenant.manualSubscriptionReason,
        effectiveExpiresAt: tenant.effectiveExpiresAt ? new Date(tenant.effectiveExpiresAt) : undefined,
        effectiveExpiresType: tenant.effectiveExpiresType || null
      }));
      setTenants(transformedTenants);
      setTotalPages(Math.ceil(transformedTenants.length / itemsPerPage));
    } catch (error) {
      console.error('Error fetching tenants:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch tenants',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Update total pages when tenants change
  useEffect(() => {
    setTotalPages(Math.ceil(tenants.length / itemsPerPage));
  }, [tenants]);

  // Handle expiration date changes when toggle changes
  useEffect(() => {
    if (controlForm.values.hasExpirationDate && !controlForm.values.expiresAt) {
      // Set default date 30 days from now when toggle is ON but no date set
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      controlForm.setFieldValue('expiresAt', defaultDate);
    } else if (!controlForm.values.hasExpirationDate && controlForm.values.expiresAt) {
      // Clear date when toggle is OFF but date is set
      controlForm.setFieldValue('expiresAt', null);
    }
  }, [controlForm.values.hasExpirationDate]);

  // Filter tenants
  const filteredTenants = tenants.filter(tenant =>
    (tenant.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    tenant.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tenant.subscriptionStatus || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Paginate
  const paginatedTenants = filteredTenants.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge color="green" variant="light">Active</Badge>;
      case 'trial':
        return <Badge color="blue" variant="light">Trial</Badge>;
      case 'past_due':
        return <Badge color="yellow" variant="light">Past Due</Badge>;
      case 'expired':
        return <Badge color="red" variant="light">Expired</Badge>;
      case 'cancelled':
        return <Badge color="gray" variant="light">Cancelled</Badge>;
      default:
        return <Badge color="gray" variant="light">{status}</Badge>;
    }
  };

  const getControlBadge = (enabled: boolean, expiresAt?: Date) => {
    if (!enabled) {
      return <Badge color="gray" variant="light">Automatic</Badge>;
    }
    
    if (!expiresAt) {
      return <Badge color="orange" variant="light">Manual (Indefinite)</Badge>;
    }
    
    const now = new Date();
    if (expiresAt < now) {
      return <Badge color="red" variant="light">Manual (Expired)</Badge>;
    }
    
    return <Badge color="blue" variant="light">Manual</Badge>;
  };

  const getTimeRemaining = (expiresAt: Date | null | undefined | string, status?: string) => {
    if (!expiresAt) {
      if (status === 'trial') {
        return 'Trial Active';
      }
      return 'Never';
    }
    
    // Convert string to Date if needed
    const date = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff <= 0) {
      return 'Expired';
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (days < 7) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    } else {
      const weeks = Math.floor(days / 7);
      const remainingDays = days % 7;
      if (remainingDays === 0) {
        return `${weeks} week${weeks !== 1 ? 's' : ''}`;
      } else {
        return `${weeks} week${weeks !== 1 ? 's' : ''}, ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
      }
    }
  };

  const openControlModal = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    
    controlForm.setValues({
      enabled: tenant.manualSubscriptionControl || false,
      hasExpirationDate: !!tenant.manualSubscriptionExpiresAt,
      expiresAt: tenant.manualSubscriptionExpiresAt,
      reason: tenant.manualSubscriptionReason || ''
    });
    
    setControlModalOpen(true);
  };

  const handleUpdateControl = async (values: typeof controlForm.values) => {
    if (!selectedTenant) return;

    try {
      // Send expiresAt as-is - frontend has full control
      const result = await manualBillingService.updateSubscriptionControl(selectedTenant.id, {
        enabled: values.enabled,
        expiresAt: values.expiresAt?.toISOString(),
        reason: values.reason
      });

      if (result.success) {
        // Update UI immediately using returned tenant data
        if (result.tenant) {
          setTenants(prevTenants => 
            prevTenants.map(tenant => 
              tenant.id === selectedTenant.id
                ? {
                    ...tenant,
                    manualSubscriptionControl: result.tenant!.manualSubscriptionControl,
                    manualSubscriptionExpiresAt: result.tenant!.manualSubscriptionExpiresAt,
                    manualSubscriptionReason: result.tenant!.manualSubscriptionReason
                  }
                : tenant
            )
          );
        }

        notifications.show({
          title: 'Success',
          message: 'Subscription control updated successfully',
          color: 'green'
        });
        setControlModalOpen(false);
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to update subscription control',
          color: 'red'
        });
      }
    } catch (error) {
      console.error('Error updating subscription control:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update subscription control',
        color: 'red'
      });
    }
  };

  const handleAddControl = async (values: typeof addControlForm.values) => {
    try {
      const result = await manualBillingService.updateSubscriptionControl(values.tenantId, {
        enabled: values.enabled,
        expiresAt: values.expiresAt?.toISOString(),
        reason: values.reason
      });

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: 'Subscription control added successfully',
          color: 'green'
        });
        setAddControlModalOpen(false);
        addControlForm.reset();
        
        // Note: Tenant data is managed by useBillingData hook, so the list will refresh automatically
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to add subscription control',
          color: 'red'
        });
      }
    } catch (error) {
      console.error('Error adding subscription control:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to add subscription control',
        color: 'red'
      });
    }
  };

  const handleBulkControlForLegacy = () => {
    // Find legacy tenants: active status, no expiration, no manual control
    const legacyTenants = tenants.filter(tenant => 
      tenant.subscriptionStatus === 'active' && 
      !tenant.subscriptionEndsAt && 
      !tenant.manualSubscriptionControl
    );

    if (legacyTenants.length === 0) {
      notifications.show({
        title: 'No Legacy Tenants',
        message: 'No tenants found that need manual control migration',
        color: 'blue'
      });
      return;
    }

    setBulkControlModalOpen(true);
  };

  const handleBulkControl = async () => {
    try {
      setBulkControlLoading(true);
      
      // Find legacy tenants
      const legacyTenants = tenants.filter(tenant => 
        tenant.subscriptionStatus === 'active' && 
        !tenant.subscriptionEndsAt && 
        !tenant.manualSubscriptionControl
      );

      if (legacyTenants.length === 0) {
        notifications.show({
          title: 'No Legacy Tenants',
          message: 'No tenants found that need manual control migration',
          color: 'blue'
        });
        setBulkControlModalOpen(false);
        return;
      }

      // Enable manual control for all legacy tenants
      const results = await Promise.all(
        legacyTenants.map(tenant =>
          manualBillingService.updateSubscriptionControl(tenant.id, {
            enabled: true,
            expiresAt: undefined, // Indefinite control
            reason: 'Legacy migration - active tenant without payment method or expiration'
          })
        )
      );

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      // Update UI immediately using returned tenant data
      const successfulUpdates = results
        .filter(r => r.success)
        .map(r => r.tenant);

      if (successfulUpdates.length > 0) {
        // Update the tenants array immediately for instant UI feedback
        setTenants(prevTenants => 
          prevTenants.map(tenant => {
            const update = successfulUpdates.find(u => u && u.id === tenant.id);
            if (update) {
              return {
                ...tenant,
                manualSubscriptionControl: update.manualSubscriptionControl,
                manualSubscriptionExpiresAt: update.manualSubscriptionExpiresAt,
                manualSubscriptionReason: update.manualSubscriptionReason
              };
            }
            return tenant;
          })
        );
      }

      if (successCount > 0) {
        notifications.show({
          title: 'Bulk Migration Complete',
          message: `Successfully enabled manual control for ${successCount} tenants${failCount > 0 ? ` (${failCount} failed)` : ''}`,
          color: successCount === legacyTenants.length ? 'green' : 'orange'
        });
        
        // Refresh data to ensure consistency
        fetchTenants();
      }

      setBulkControlModalOpen(false);
    } catch (error) {
      console.error('Error during bulk control:', error);
      notifications.show({
        title: 'Bulk Control Error',
        message: 'Failed to enable manual control for legacy tenants',
        color: 'red'
      });
    } finally {
      setBulkControlLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <Stack gap="md">
      {/* Info Alert */}
      <Alert
        icon={<IconAlertTriangle size={16} />}
        title="Manual Subscription Control"
        color="blue"
        variant="light"
      >
        <Text size="sm">
          Manual subscription control allows administrators to override automated billing and subscription expiration.
          When enabled, the tenant's subscription will not expire automatically based on payment status.
        </Text>
      </Alert>

      {/* Search and Filters */}
      <Group justify="space-between">
        <Input
          placeholder="Search tenants..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1 }}
          miw={300}
        />
        <Group>
          <Button
            variant="light"
            leftSection={<IconShield size={16} />}
            onClick={() => handleBulkControlForLegacy()}
          >
            Migrate Legacy
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setAddControlModalOpen(true)}
          >
            Add Control
          </Button>
        </Group>
      </Group>

      {/* Tenants Table */}
      <Card shadow="sm" padding="md" withBorder>
        {paginatedTenants.length === 0 ? (
          <div className="text-center p-8">
            <IconSettings size={48} color="gray" className="mx-auto mb-4" />
            <Text size="lg" c="dimmed">
              {searchQuery ? 'No tenants found matching your search' : 'No tenants found'}
            </Text>
          </div>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tenant</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Tier</Table.Th>
                <Table.Th>Subscription Expires</Table.Th>
                <Table.Th>Control Mode</Table.Th>
                <Table.Th>Manual Expires</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedTenants.map((tenant) => (
                <Table.Tr key={tenant.id}>
                  <Table.Td>
                    <div>
                      <Text size="sm" fw={500}>{tenant.name}</Text>
                      <Text size="xs" c="dimmed">{tenant.id}</Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    {getStatusBadge(tenant.subscriptionStatus || 'unknown')}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{tenant.subscriptionTier || 'unknown'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {tenant.effectiveExpiresAt 
                        ? tenant.effectiveExpiresAt.toLocaleDateString()
                        : 'Never'
                      }
                    </Text>
                    {tenant.effectiveExpiresAt && (
                      <Text size="xs" c="dimmed" mt={2}>
                        {getTimeRemaining(tenant.effectiveExpiresAt)}
                        {tenant.effectiveExpiresType === 'manual' && (
                          <Text span c="blue" ml={4}>
                            (Manual Override)
                          </Text>
                        )}
                      </Text>
                    )}
                    {!tenant.effectiveExpiresAt && tenant.subscriptionStatus === 'trial' && tenant.trialEndsAt && (
                      <Text size="xs" c="blue" mt={2}>
                        Trial: {getTimeRemaining(tenant.trialEndsAt, 'trial')}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {getControlBadge(tenant.manualSubscriptionControl || false, tenant.manualSubscriptionExpiresAt)}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {tenant.manualSubscriptionExpiresAt 
                        ? (new Date(tenant.manualSubscriptionExpiresAt)).toLocaleDateString()
                        : tenant.manualSubscriptionControl ? 'Indefinite' : '-'
                      }
                    </Text>
                    {tenant.manualSubscriptionExpiresAt && (
                      <Text size="xs" c="dimmed" mt={2}>
                        {getTimeRemaining(tenant.manualSubscriptionExpiresAt)}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      size="sm"
                      color="blue"
                      onClick={() => openControlModal(tenant)}
                      title="Control Subscription"
                    >
                      <IconSettings size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          value={currentPage}
          onChange={setCurrentPage}
          total={totalPages}
        />
      )}

      {/* Control Modal */}
      <Modal
        opened={controlModalOpen}
        onClose={() => setControlModalOpen(false)}
        title="Subscription Control"
        size="md"
      >
        {selectedTenant && (
          <form onSubmit={controlForm.onSubmit(handleUpdateControl)}>
            <Stack gap="md">
              <Group>
                <Text size="sm" c="dimmed">Tenant:</Text>
                <Text size="sm" fw={500}>{selectedTenant.name}</Text>
              </Group>
              
              <Group>
                <Text size="sm" c="dimmed">Current Status:</Text>
                {getStatusBadge((selectedTenant as any).subscriptionStatus || 'unknown')}
              </Group>
              
              <Group>
                <Text size="sm" c="dimmed">Current Tier:</Text>
                <Text size="sm">{(selectedTenant as any).subscriptionTier || 'unknown'}</Text>
              </Group>

              <Switch
                label="Enable Manual Subscription Control"
                description="When enabled, automated billing and expiration will be overridden"
                {...controlForm.getInputProps('enabled', { type: 'checkbox' })}
              />

              {controlForm.values.enabled && (
                <>
                  <Input.Wrapper 
                    label="Manual Control Expires (Optional)"
                    description="Leave empty for indefinite control"
                  >
                    <Group>
                      <Switch
                        label="Set expiration date"
                        {...controlForm.getInputProps('hasExpirationDate', { type: 'checkbox' })}
                      />
                    </Group>
                    {controlForm.values.expiresAt && (
                      <>
                        <Group mt="md">
                          <NumberInput
                            placeholder="Day"
                            min={1}
                            max={31}
                            w={70}
                            value={controlForm.values.expiresAt ? new Date(controlForm.values.expiresAt).getDate() : ''}
                            onChange={(value) => {
                              const current = controlForm.values.expiresAt ? new Date(controlForm.values.expiresAt) : new Date();
                              if (value) {
                                current.setDate(Number(value));
                                controlForm.setFieldValue('expiresAt', current);
                              }
                            }}
                          />
                          <Select
                            placeholder="Month"
                            data={[
                              { value: '0', label: 'January' },
                              { value: '1', label: 'February' },
                              { value: '2', label: 'March' },
                              { value: '3', label: 'April' },
                              { value: '4', label: 'May' },
                              { value: '5', label: 'June' },
                              { value: '6', label: 'July' },
                              { value: '7', label: 'August' },
                              { value: '8', label: 'September' },
                              { value: '9', label: 'October' },
                              { value: '10', label: 'November' },
                              { value: '11', label: 'December' }
                            ]}
                            w={120}
                            value={controlForm.values.expiresAt ? String(new Date(controlForm.values.expiresAt).getMonth()) : ''}
                            onChange={(value) => {
                              const current = controlForm.values.expiresAt ? new Date(controlForm.values.expiresAt) : new Date();
                              if (value) {
                                current.setMonth(parseInt(value));
                                controlForm.setFieldValue('expiresAt', current);
                              }
                            }}
                          />
                          <NumberInput
                            placeholder="Year"
                            min={new Date().getFullYear()}
                            max={new Date().getFullYear() + 10}
                            w={90}
                            value={controlForm.values.expiresAt ? new Date(controlForm.values.expiresAt).getFullYear() : ''}
                            onChange={(value) => {
                              const current = controlForm.values.expiresAt ? new Date(controlForm.values.expiresAt) : new Date();
                              if (value) {
                                current.setFullYear(Number(value));
                                controlForm.setFieldValue('expiresAt', current);
                              }
                            }}
                          />
                        </Group>
                        <Text size="xs" c="dimmed" mt={4}>
                          Selected: {controlForm.values.expiresAt ? new Date(controlForm.values.expiresAt).toLocaleDateString() : 'No date selected'}
                        </Text>
                      </>
                    )}
                  </Input.Wrapper>

                  <Textarea
                    label="Reason for Manual Control"
                    placeholder="Why is manual control being enabled?"
                    required
                    {...controlForm.getInputProps('reason')}
                  />
                </>
              )}

              <Group justify="flex-end" mt="md">
                <Button
                  variant="light"
                  onClick={() => setControlModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" color="blue">
                  Update Control
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>

      {/* Add Control Modal */}
      <Modal
        opened={addControlModalOpen}
        onClose={() => setAddControlModalOpen(false)}
        title="Add Subscription Control"
        size="md"
      >
        <form onSubmit={addControlForm.onSubmit(handleAddControl)}>
          <Stack gap="md">
            <Select
              label="Select Tenant"
              placeholder="Choose a tenant to control"
              data={tenants.map(tenant => ({
                value: tenant.id,
                label: `${tenant.name} (${tenant.id})`
              }))}
              searchable
              {...addControlForm.getInputProps('tenantId')}
            />

            <Switch
              label="Enable Manual Subscription Control"
              description="When enabled, automated billing and expiration will be overridden"
              {...addControlForm.getInputProps('enabled', { type: 'checkbox' })}
            />

            {addControlForm.values.enabled && (
                <>
                  <Input.Wrapper 
                    label="Manual Control Expires (Optional)"
                    description="Leave empty for indefinite control"
                  >
                    <Group>
                      <Switch
                        label="Set expiration date"
                        checked={!!addControlForm.values.expiresAt}
                        onChange={(checked) => {
                          if (!checked) {
                            addControlForm.setFieldValue('expiresAt', null);
                          } else {
                            // Set default date 30 days from now
                            const defaultDate = new Date();
                            defaultDate.setDate(defaultDate.getDate() + 30);
                            addControlForm.setFieldValue('expiresAt', defaultDate);
                          }
                        }}
                      />
                    </Group>
                    {addControlForm.values.expiresAt && (
                      <>
                        <Group mt="md">
                          <NumberInput
                            placeholder="Day"
                            min={1}
                            max={31}
                            w={70}
                            value={addControlForm.values.expiresAt ? new Date(addControlForm.values.expiresAt).getDate() : ''}
                            onChange={(value) => {
                              const current = addControlForm.values.expiresAt ? new Date(addControlForm.values.expiresAt) : new Date();
                              if (value) {
                                current.setDate(Number(value));
                                addControlForm.setFieldValue('expiresAt', current);
                              }
                            }}
                          />
                          <Select
                            placeholder="Month"
                            data={[
                              { value: '0', label: 'January' },
                              { value: '1', label: 'February' },
                              { value: '2', label: 'March' },
                              { value: '3', label: 'April' },
                              { value: '4', label: 'May' },
                              { value: '5', label: 'June' },
                              { value: '6', label: 'July' },
                              { value: '7', label: 'August' },
                              { value: '8', label: 'September' },
                              { value: '9', label: 'October' },
                              { value: '10', label: 'November' },
                              { value: '11', label: 'December' }
                            ]}
                            w={120}
                            value={addControlForm.values.expiresAt ? String(new Date(addControlForm.values.expiresAt).getMonth()) : ''}
                            onChange={(value) => {
                              const current = addControlForm.values.expiresAt ? new Date(addControlForm.values.expiresAt) : new Date();
                              if (value) {
                                current.setMonth(parseInt(value));
                                addControlForm.setFieldValue('expiresAt', current);
                              }
                            }}
                          />
                          <NumberInput
                            placeholder="Year"
                            min={new Date().getFullYear()}
                            max={new Date().getFullYear() + 10}
                            w={90}
                            value={addControlForm.values.expiresAt ? new Date(addControlForm.values.expiresAt).getFullYear() : ''}
                            onChange={(value) => {
                              const current = addControlForm.values.expiresAt ? new Date(addControlForm.values.expiresAt) : new Date();
                              if (value) {
                                current.setFullYear(Number(value));
                                addControlForm.setFieldValue('expiresAt', current);
                              }
                            }}
                          />
                        </Group>
                        <Text size="xs" c="dimmed" mt={4}>
                          Selected: {addControlForm.values.expiresAt.toLocaleDateString()}
                        </Text>
                      </>
                    )}
                  </Input.Wrapper>

                  <Textarea
                    label="Reason for Manual Control"
                    placeholder="Why is manual control being enabled?"
                    required
                    {...addControlForm.getInputProps('reason')}
                  />
                </>
              )}

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                onClick={() => setAddControlModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" color="blue">
                Add Control
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    {/* Bulk Control Modal */}
      <Modal
        opened={bulkControlModalOpen}
        onClose={() => setBulkControlModalOpen(false)}
        title="Legacy Tenant Migration"
        size="md"
      >
        <Stack gap="md">
          <Alert
            icon={<IconAlertTriangle size={20} />}
            title="Legacy Migration Required"
            color="yellow"
          >
            <Text size="sm">
              Found tenants with active status but no payment methods or expiration dates. 
              These tenants will be placed under manual control to bridge the gap to the automated system.
            </Text>
          </Alert>

          <Card padding="md" withBorder>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Legacy Tenants Found:</Text>
              <Badge size="lg" color="yellow">
                {tenants.filter(tenant => 
                  tenant.subscriptionStatus === 'active' && 
                  !tenant.subscriptionEndsAt && 
                  !tenant.manualSubscriptionControl
                ).length}
              </Badge>
            </Group>
          </Card>

          <Group justify="space-between" mt="md">
            <Button
              variant="light"
              onClick={() => setBulkControlModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="blue"
              onClick={handleBulkControl}
              loading={bulkControlLoading}
              disabled={bulkControlLoading}
            >
              Enable Manual Control for All
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

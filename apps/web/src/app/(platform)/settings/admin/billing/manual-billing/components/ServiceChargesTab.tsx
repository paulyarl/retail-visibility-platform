'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Badge,
  Text,
  Group,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  Select,
  Stack,
  Card,
  Alert,
  Loader,
  Pagination,
  Input,
  Switch,
  NumberInput,
  Grid,
  Progress,
  Divider
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconEye,
  IconEdit,
  IconReceipt,
  IconInvoice,
  IconCurrencyDollar,
  IconChartBar,
  IconFileInvoice
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { manualBillingService, type ServiceCharge, type ServiceChargeConfiguration, type ServiceChargeStats } from '@/services/ManualBillingService';
import { useBillingData } from '../../hooks/useBillingData';
import { clientLogger } from '@/lib/client-logger';

export default function ServiceChargesTab() {
  const { tenants, loading: tenantsLoading } = useBillingData();
  const [charges, setCharges] = useState<ServiceCharge[]>([]);
  const [configurations, setConfigurations] = useState<ServiceChargeConfiguration[]>([]);
  const [stats, setStats] = useState<ServiceChargeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<ServiceCharge | null>(null);
  const [selectedCharges, setSelectedCharges] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  // Form for adding service charge
  const createForm = useForm({
    initialValues: {
      tenantId: '',
      chargeType: 'custom' as const,
      amountDollars: 0,
      description: '',
      applyToInvoice: false,
      reason: ''
    },
    validate: {
      tenantId: (value) => !value ? 'Tenant is required' : null,
      amountDollars: (value) => value <= 0 ? 'Amount must be greater than 0' : null,
      description: (value) => !value.trim() ? 'Description is required' : null,
      reason: (value) => !value.trim() ? 'Reason is required for audit trail' : null
    }
  });

  // Form for editing service charge
  const editForm = useForm({
    initialValues: {
      chargeType: 'custom' as const,
      amountDollars: 0,
      description: '',
      reason: ''
    },
    validate: {
      amountDollars: (value) => value <= 0 ? 'Amount must be greater than 0' : null,
      description: (value) => !value.trim() ? 'Description is required' : null,
      reason: (value) => !value.trim() ? 'Reason is required for audit trail' : null
    }
  });

  // Fetch data
  useEffect(() => {
    fetchServiceCharges();
    fetchConfigurations();
    fetchStats();
  }, [currentPage, searchQuery]);

  const fetchServiceCharges = async () => {
    try {
      setLoading(true);
      const charges = await manualBillingService.getAllServiceCharges();
      setCharges(charges);
      setTotalPages(Math.ceil(charges.length / itemsPerPage));
    } catch (error) {
      clientLogger.error('Error fetching service charges:', { detail: error });
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch service charges',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigurations = async () => {
    try {
      const configurations = await manualBillingService.getServiceChargeConfigurations();
      setConfigurations(configurations);
    } catch (error) {
      clientLogger.error('Error fetching configurations:', { detail: error });
    }
  };

  const fetchStats = async () => {
    try {
      // This would call the actual API
      // const data = await response.json();      
      // Mock stats for now
      const mockStats: ServiceChargeStats = {
        totalCharges: 0,
        totalAmountCents: 0,
        uninvoicedCharges: 0,
        invoicedCharges: 0
      };
      setStats(mockStats);
    } catch (error) {
      clientLogger.error('Error fetching stats:', { detail: error });
    }
  };

  const handleAddServiceCharge = async (values: typeof createForm.values) => {
    try {
      const result = await manualBillingService.addServiceCharge({
        ...values,
        amountCents: Math.round(values.amountDollars * 100), // Convert dollars to cents
        createdBy: 'current-admin-id', // This would come from auth context
        createdByEmail: 'admin@example.com' // This would come from auth context
      });

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: 'Service charge added successfully',
          color: 'green'
        });
        setCreateModalOpen(false);
        createForm.reset();
        // Invalidate cache to ensure fresh data
        manualBillingService.invalidateCache('service-charges');
        fetchServiceCharges();
        fetchStats();
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to add service charge',
          color: 'red'
        });
      }
    } catch (error) {
      clientLogger.error('Error adding service charge:', { detail: error });
      notifications.show({
        title: 'Error',
        message: 'Failed to add service charge',
        color: 'red'
      });
    }
  };

  const handleCreateInvoice = async () => {
    if (selectedCharges.length === 0) {
      notifications.show({
        title: 'Error',
        message: 'Please select at least one service charge to invoice',
        color: 'red'
      });
      return;
    }

    // Get the reason from the temporary storage
    const reason = (window as any).tempInvoiceReason;
    if (!reason?.trim()) {
      notifications.show({
        title: 'Error',
        message: 'Reason is required',
        color: 'red'
      });
      return;
    }

    try {
      const result = await manualBillingService.createInvoiceForServiceCharges({
        tenantId: charges.find(c => selectedCharges.includes(c.id))?.tenantId || '',
        serviceChargeIds: selectedCharges,
        reason: reason,
        createdBy: 'current-admin-id', // This would come from auth context
        createdByEmail: 'admin@example.com' // This would come from auth context
      } as any);

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: 'Invoice created successfully',
          color: 'green'
        });
        setInvoiceModalOpen(false);
        setSelectedCharges([]);
        // Clear temporary reason
        delete (window as any).tempInvoiceReason;
        fetchServiceCharges();
        fetchStats();
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to create invoice',
          color: 'red'
        });
      }
    } catch (error) {
      clientLogger.error('Error creating invoice:', { detail: error });
      notifications.show({
        title: 'Error',
        message: 'Failed to create invoice',
        color: 'red'
      });
    }
  };

  const openViewDetailsModal = (charge: ServiceCharge) => {
    setSelectedCharge(charge);
    setViewDetailsModalOpen(true);
  };

  const openEditModal = (charge: ServiceCharge) => {
    setSelectedCharge(charge);
    editForm.setValues({
      chargeType: charge.chargeType as any,
      amountDollars: charge.amountCents / 100,
      description: charge.description,
      reason: ''
    });
    setEditModalOpen(true);
  };

  const handleEditServiceCharge = async (values: typeof editForm.values) => {
    if (!selectedCharge) return;

    try {
      const result = await manualBillingService.updateServiceCharge(selectedCharge.id, {
        chargeType: values.chargeType,
        amountCents: Math.round(values.amountDollars * 100),
        description: values.description
      });

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: 'Service charge updated successfully',
          color: 'green'
        });
        setEditModalOpen(false);
        // Update the service charge in the list directly
        setCharges(prevCharges => 
          prevCharges.map(charge => 
            charge.id === selectedCharge.id 
              ? {
                  ...charge,
                  chargeType: values.chargeType,
                  amountCents: Math.round(values.amountDollars * 100),
                  description: values.description,
                  updatedAt: new Date().toISOString()
                }
              : charge
          )
        );
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to update service charge',
          color: 'red'
        });
      }
    } catch (error) {
      clientLogger.error('Error editing service charge:', { detail: error });
      notifications.show({
        title: 'Error',
        message: 'Failed to edit service charge',
        color: 'red'
      });
    }
  };

  const getChargeTypeBadge = (type: string) => {
    switch (type) {
      case 'setup_fee':
        return <Badge color="blue" variant="light">Setup Fee</Badge>;
      case 'service_fee':
        return <Badge color="green" variant="light">Service Fee</Badge>;
      case 'custom':
        return <Badge color="orange" variant="light">Custom</Badge>;
      default:
        return <Badge color="gray" variant="light">{type}</Badge>;
    }
  };

  const getInvoiceStatusBadge = (invoiceId?: string) => {
    if (invoiceId) {
      return <Badge color="green" variant="light" size="sm">Invoiced</Badge>;
    }
    return <Badge color="yellow" variant="light" size="sm">Pending</Badge>;
  };

  const filteredCharges = charges.filter(charge =>
    (charge.tenantName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (charge.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    charge.chargeType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const paginatedCharges = filteredCharges.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const uninvoicedCharges = filteredCharges.filter(charge => !charge.invoiceId);
  const totalUninvoicedAmount = uninvoicedCharges.reduce((sum, charge) => sum + charge.amountCents, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <Stack gap="md">
      {/* Stats Cards */}
      {stats && (
        <Grid>
          <Grid.Col span={3}>
            <Card shadow="sm" padding="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" color="dimmed">Total Charges</Text>
                  <Text size="lg" fw={500}>{stats.totalCharges}</Text>
                </div>
                <IconReceipt size={20} color="blue" />
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={3}>
            <Card shadow="sm" padding="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" color="dimmed">Total Amount</Text>
                  <Text size="lg" fw={500}>${(stats.totalAmountCents / 100).toFixed(2)}</Text>
                </div>
                <IconCurrencyDollar size={20} color="green" />
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={3}>
            <Card shadow="sm" padding="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" color="dimmed">Uninvoiced</Text>
                  <Text size="lg" fw={500}>{stats.uninvoicedCharges}</Text>
                </div>
                <IconFileInvoice size={20} color="orange" />
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={3}>
            <Card shadow="sm" padding="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" color="dimmed">Invoiced</Text>
                  <Text size="lg" fw={500}>{stats.invoicedCharges}</Text>
                </div>
                <IconInvoice size={20} color="purple" />
              </Group>
            </Card>
          </Grid.Col>
        </Grid>
      )}

      {/* Header */}
      <Group justify="space-between">
        <div>
          <Input
            placeholder="Search service charges..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 300 }}
          />
        </div>
        <Group>
          {uninvoicedCharges.length > 0 && (
            <Button
              leftSection={<IconInvoice size={16} />}
              onClick={() => setInvoiceModalOpen(true)}
              variant="light"
            >
              Invoice Selected ({selectedCharges.length})
            </Button>
          )}
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setCreateModalOpen(true)}
          >
            Add Service Charge
          </Button>
        </Group>
      </Group>

      {/* Uninvoiced Charges Alert */}
      {uninvoicedCharges.length > 0 && (
        <Alert
          icon={<IconFileInvoice size={16} />}
          title="Uninvoiced Service Charges"
          color="orange"
          variant="light"
        >
          <Group justify="space-between">
            <Text size="sm">
              You have {uninvoicedCharges.length} uninvoiced service charges totaling 
              ${(totalUninvoicedAmount / 100).toFixed(2)}
            </Text>
            <Button
              size="sm"
              onClick={() => setInvoiceModalOpen(true)}
              variant="outline"
            >
              Create Invoice
            </Button>
          </Group>
        </Alert>
      )}

      {/* Table */}
      <Card shadow="sm" padding="md" withBorder>
        {paginatedCharges.length === 0 ? (
          <div className="text-center py-8">
            <IconReceipt size={48} className="mx-auto mb-4 text-gray-400" />
            <Text color="dimmed">No service charges found</Text>
            <Text size="sm" color="dimmed" mt="xs">
              Add service charges for one-time fees or custom billing scenarios
            </Text>
          </div>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  {uninvoicedCharges.length > 0 && (
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCharges(uninvoicedCharges.map(c => c.id));
                        } else {
                          setSelectedCharges([]);
                        }
                      }}
                    />
                  )}
                </Table.Th>
                <Table.Th>Charge ID</Table.Th>
                <Table.Th>Tenant</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Applied</Table.Th>
                <Table.Th>Updated</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedCharges.map((charge) => (
                <Table.Tr key={charge.id}>
                  <Table.Td>
                    {!charge.invoiceId && (
                      <input
                        type="checkbox"
                        checked={selectedCharges.includes(charge.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCharges([...selectedCharges, charge.id]);
                          } else {
                            setSelectedCharges(selectedCharges.filter(id => id !== charge.id));
                          }
                        }}
                      />
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>{charge.id}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{charge.tenantName}</Text>
                  </Table.Td>
                  <Table.Td>
                    {getChargeTypeBadge(charge.chargeType)}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{charge.description}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      ${(charge.amountCents / 100).toFixed(2)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {getInvoiceStatusBadge(charge.invoiceId)}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(charge.appliedAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {(charge as any).updatedAt 
                        ? new Date((charge as any).updatedAt).toLocaleDateString()
                        : '-'
                      }
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        size="sm"
                        color="blue"
                        onClick={() => openViewDetailsModal(charge)}
                        title="View Details"
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                      <ActionIcon
                        size="sm"
                        color="orange"
                        onClick={() => openEditModal(charge)}
                        title="Edit Charge"
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Group>
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

      {/* Add Service Charge Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Service Charge"
        size="md"
      >
        <form onSubmit={createForm.onSubmit(handleAddServiceCharge)}>
          <Stack gap="md">
            <Select
              label="Tenant"
              placeholder="Select tenant"
              data={tenants.map(t => ({ value: t.id, label: t.name }))}
              {...createForm.getInputProps('tenantId')}
              required
            />

            <Select
              label="Charge Type"
              placeholder="Select charge type"
              data={configurations.map(c => ({ value: c.chargeType, label: c.name }))}
              {...createForm.getInputProps('chargeType')}
              required
            />

            <NumberInput
              label="Amount ($)"
              placeholder="0.00"
              decimalScale={2}
              min={0}
              step={0.01}
              {...createForm.getInputProps('amountDollars')}
              required
            />

            <Textarea
              label="Description"
              placeholder="What is this service charge for?"
              {...createForm.getInputProps('description')}
              required
            />

            <Switch
              label="Create invoice immediately"
              description="Generate a manual invoice for this service charge"
              {...createForm.getInputProps('applyToInvoice')}
            />

            <TextInput
              label="Reason"
              placeholder="Why this service charge is being applied"
              {...createForm.getInputProps('reason')}
              required
            />

            <Alert color="blue" variant="light">
              <Text size="sm">
                Service charges are one-time fees that can be applied to tenant accounts. 
                These can include setup fees, service fees, or custom charges.
              </Text>
            </Alert>

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                Add Service Charge
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Create Invoice Modal */}
      <Modal
        opened={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        title="Create Invoice for Service Charges"
        size="md"
      >
        <Stack gap="md">
          <Alert color="blue" variant="light">
            <Text size="sm">
              This will create a manual invoice for {selectedCharges.length} selected service charges.
              The total amount will be ${(totalUninvoicedAmount / 100).toFixed(2)}.
            </Text>
          </Alert>

          <Divider />

          <Text size="sm" fw={500}>Selected Charges:</Text>
          {uninvoicedCharges
            .filter(charge => selectedCharges.includes(charge.id))
            .map(charge => (
              <Group key={charge.id} justify="space-between">
                <Text size="sm">{charge.description}</Text>
                <Text size="sm" fw={500}>
                  ${(charge.amountCents / 100).toFixed(2)}
                </Text>
              </Group>
            ))}

          <Divider />

          <Group justify="space-between">
            <Text size="sm" fw={500}>Total Amount:</Text>
            <Text size="lg" fw={500}>
              ${(totalUninvoicedAmount / 100).toFixed(2)}
            </Text>
          </Group>

          <Divider />

          <TextInput
            label="Reason"
            placeholder="Why are you creating this invoice?"
            id="invoice-reason"
            required
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="light"
              onClick={() => setInvoiceModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={() => {
              const reasonInput = document.getElementById('invoice-reason') as HTMLInputElement;
              if (!reasonInput?.value.trim()) {
                notifications.show({
                  title: 'Error',
                  message: 'Reason is required',
                  color: 'red'
                });
                return;
              }
              // Store the reason temporarily and call handleCreateInvoice
              (window as any).tempInvoiceReason = reasonInput.value;
              handleCreateInvoice();
            }} color="green">
              Create Invoice
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* View Details Modal */}
      <Modal
        opened={viewDetailsModalOpen}
        onClose={() => setViewDetailsModalOpen(false)}
        title="Service Charge Details"
        size="md"
      >
        {selectedCharge && (
          <Stack gap="md">
            <Group>
              <Text size="sm" c="dimmed">Charge ID:</Text>
              <Text size="sm" fw={500}>{selectedCharge.id}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Tenant:</Text>
              <Text size="sm" fw={500}>{selectedCharge.tenantName}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Type:</Text>
              {getChargeTypeBadge(selectedCharge.chargeType)}
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Amount:</Text>
              <Text size="sm" fw={500}>${(selectedCharge.amountCents / 100).toFixed(2)}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Description:</Text>
              <Text size="sm">{selectedCharge.description}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Status:</Text>
              {getInvoiceStatusBadge(selectedCharge.invoiceId)}
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Applied:</Text>
              <Text size="sm">{new Date(selectedCharge.appliedAt).toLocaleString()}</Text>
            </Group>
            {(selectedCharge as any).updatedAt && (
              <Group>
                <Text size="sm" c="dimmed">Updated:</Text>
                <Text size="sm">{new Date((selectedCharge as any).updatedAt).toLocaleString()}</Text>
              </Group>
            )}
            <Group>
              <Text size="sm" c="dimmed">Created:</Text>
              <Text size="sm">{new Date(selectedCharge.createdAt).toLocaleString()}</Text>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Edit Service Charge Modal */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Service Charge"
        size="md"
      >
        <form onSubmit={editForm.onSubmit(handleEditServiceCharge)}>
          <Stack gap="md">
            <Select
              label="Charge Type"
              placeholder="Select charge type"
              data={[
                { value: 'setup_fee', label: 'Setup Fee' },
                { value: 'service_fee', label: 'Service Fee' },
                { value: 'custom', label: 'Custom' }
              ]}
              {...editForm.getInputProps('chargeType')}
              required
            />

            <NumberInput
              label="Amount ($)"
              placeholder="0.00"
              decimalScale={2}
              min={0}
              step={0.01}
              {...editForm.getInputProps('amountDollars')}
              required
            />

            <Textarea
              label="Description"
              placeholder="What is this service charge for?"
              {...editForm.getInputProps('description')}
              required
            />

            <TextInput
              label="Reason"
              placeholder="Why this service charge is being modified"
              {...editForm.getInputProps('reason')}
              required
            />

            <Group justify="flex-end" gap="sm">
              <Button variant="light" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="filled" style={{ color: 'white' }}>
                Save Changes
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

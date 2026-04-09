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
  Grid,
  Card,
  Alert,
  Loader,
  Pagination,
  Input,
  Switch,
  Textarea as MantineTextarea
} from '@mantine/core';
import {
  IconSearch,
  IconEye,
  IconEdit,
  IconTrash,
  IconPlus,
  IconCreditCard,
  IconBuildingStore,
  IconBuildingBank,
  IconCash,
  IconCheck,
  IconAlertTriangle,
  IconClock
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { manualBillingService, type ManualPaymentMethod } from '@/services/ManualBillingService';
import { useBillingData } from '../../hooks/useBillingData';

export default function PaymentMethodsTab() {
  const { tenants, loading: tenantsLoading } = useBillingData();
  const [paymentMethods, setPaymentMethods] = useState<ManualPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<ManualPaymentMethod | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  // Form for adding manual payment method
  const createForm = useForm({
    initialValues: {
      tenantId: '',
      gatewayType: 'manual' as const,
      paymentReference: '',
      adminNotes: '',
      isDefault: false,
      reason: ''
    },
    validate: {
      tenantId: (value) => !value ? 'Tenant is required' : null,
      paymentReference: (value) => !value.trim() ? 'Payment reference is required' : null,
      reason: (value) => !value.trim() ? 'Reason is required for audit trail' : null
    }
  });

  // Form for editing payment method
  const editForm = useForm({
    initialValues: {
      gatewayType: 'manual' as const,
      paymentReference: '',
      adminNotes: '',
      isDefault: false
    },
    validate: {
      paymentReference: (value) => !value.trim() ? 'Payment reference is required' : null
    }
  });

  // Fetch data
  useEffect(() => {
    fetchPaymentMethods();
  }, [currentPage, searchQuery]);

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      // Fetch all payment methods (admin view)
      const paymentMethods = await manualBillingService.getAllManualPaymentMethods();
      setPaymentMethods(paymentMethods);
      setTotalPages(Math.ceil(paymentMethods.length / itemsPerPage));
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch payment methods',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaymentMethod = async (values: typeof createForm.values) => {
    try {
      const result = await manualBillingService.addManualPaymentMethod({
        ...values,
        createdBy: 'current-admin-id', // This would come from auth context
        createdByEmail: 'admin@example.com' // This would come from auth context
      });

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: 'Manual payment method added successfully',
          color: 'green'
        });
        setCreateModalOpen(false);
        createForm.reset();
        // Invalidate cache to ensure fresh data
        manualBillingService.invalidateCache('all-manual-payment-methods');
        fetchPaymentMethods();
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to add payment method',
          color: 'red'
        });
      }
    } catch (error) {
      console.error('Error adding payment method:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to add payment method',
        color: 'red'
      });
    }
  };

  const openViewDetailsModal = (method: ManualPaymentMethod) => {
    setSelectedPaymentMethod(method);
    setViewDetailsModalOpen(true);
  };

  const openEditModal = (method: ManualPaymentMethod) => {
    setSelectedPaymentMethod(method);
    editForm.setValues({
      gatewayType: method.gatewayType as any,
      paymentReference: method.paymentReference,
      adminNotes: method.adminNotes || '',
      isDefault: method.isDefault
    });
    setEditModalOpen(true);
  };

  const handleEditPaymentMethod = async (values: typeof editForm.values) => {
    if (!selectedPaymentMethod) return;

    try {
      const result = await manualBillingService.updatePaymentMethod(selectedPaymentMethod.id, {
        gatewayType: values.gatewayType,
        paymentReference: values.paymentReference,
        adminNotes: values.adminNotes,
        isDefault: values.isDefault
      });

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: 'Payment method updated successfully',
          color: 'green'
        });
        setEditModalOpen(false);
        // Update the payment method in the list directly
        setPaymentMethods(prevMethods => 
          prevMethods.map(method => 
            method.id === selectedPaymentMethod.id 
              ? {
                  ...method,
                  gatewayType: values.gatewayType,
                  paymentReference: values.paymentReference,
                  adminNotes: values.adminNotes,
                  isDefault: values.isDefault,
                  updatedAt: new Date().toISOString()
                }
              : method
          )
        );
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to update payment method',
          color: 'red'
        });
      }
    } catch (error) {
      console.error('Error editing payment method:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to edit payment method',
        color: 'red'
      });
    }
  };

  const handleDeletePaymentMethod = async (method: ManualPaymentMethod) => {
    try {
      const result = await manualBillingService.deletePaymentMethod(method.id);

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: 'Payment method deleted successfully',
          color: 'green'
        });
        // Remove the payment method from the list directly
        setPaymentMethods(prevMethods => 
          prevMethods.filter(m => m.id !== method.id)
        );
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to delete payment method',
          color: 'red'
        });
      }
    } catch (error) {
      console.error('Error deleting payment method:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete payment method',
        color: 'red'
      });
    }
  };

  const getGatewayIcon = (type: string) => {
    switch (type) {
      case 'bank':
        return <IconBuildingBank size={16} />;
      case 'cash':
        return <IconCash size={16} />;
      case 'manual':
        return <IconCreditCard size={16} />;
      default:
        return <IconCreditCard size={16} />;
    }
  };

  const getGatewayBadge = (type: string) => {
    switch (type) {
      case 'bank':
        return <Badge color="blue" variant="light">Bank Transfer</Badge>;
      case 'cash':
        return <Badge color="green" variant="light">Cash</Badge>;
      case 'manual':
        return <Badge color="orange" variant="light">Manual</Badge>;
      default:
        return <Badge color="gray" variant="light">{type}</Badge>;
    }
  };

  const getVerificationBadge = (verified: boolean, verifiedAt?: string) => {
    if (verified && verifiedAt) {
      return (
        <Group gap="xs">
          <IconCheck size={12} color="green" />
          <Text size="xs" color="green">Verified</Text>
        </Group>
      );
    }
    return (
      <Group gap="xs">
        <IconClock size={12} color="orange" />
        <Text size="xs" color="orange">Pending</Text>
      </Group>
    );
  };

  // Filter payment methods
  const filteredPaymentMethods = paymentMethods.filter(method =>
    (method.tenantName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    method.gatewayType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (method.paymentReference || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const paginatedPaymentMethods = filteredPaymentMethods.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <div>
          <Input
            placeholder="Search payment methods..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 300 }}
          />
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateModalOpen(true)}
        >
          Add Payment Method
        </Button>
      </Group>

      {/* Table */}
      <Card shadow="sm" padding="md" withBorder>
        {paginatedPaymentMethods.length === 0 ? (
          <div className="text-center py-8">
            <IconCreditCard size={48} className="mx-auto mb-4 text-gray-400" />
            <Text color="dimmed">No manual payment methods found</Text>
            <Text size="sm" color="dimmed" mt="xs">
              Add manual payment methods for tenants who use alternative payment methods
            </Text>
          </div>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Method ID</Table.Th>
                <Table.Th>Tenant</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Reference</Table.Th>
                <Table.Th>Default</Table.Th>
                <Table.Th>Verification</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th>Updated</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedPaymentMethods.map((method) => (
                <Table.Tr key={method.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{method.id}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{method.tenantName}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {getGatewayIcon(method.gatewayType)}
                      {getGatewayBadge(method.gatewayType)}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{method.paymentReference}</Text>
                  </Table.Td>
                  <Table.Td>
                    {method.isDefault ? (
                      <Badge color="blue" variant="light" size="sm">Default</Badge>
                    ) : (
                      <Text size="sm" color="dimmed">No</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {getVerificationBadge(!!method.verifiedBy, method.verifiedAt)}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(method.createdAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {(method as any).updatedAt
                        ? new Date((method as any).updatedAt).toLocaleDateString()
                        : 'N/A'
                      }
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        size="sm"
                        color="blue"
                        onClick={() => openViewDetailsModal(method)}
                        title="View Details"
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                      <ActionIcon
                        size="sm"
                        color="orange"
                        onClick={() => openEditModal(method)}
                        title="Edit Payment Method"
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        size="sm"
                        color="red"
                        onClick={() => handleDeletePaymentMethod(method)}
                        title="Delete"
                      >
                        <IconTrash size={16} />
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

      {/* Add Payment Method Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Manual Payment Method"
        size="md"
      >
        <form onSubmit={createForm.onSubmit(handleAddPaymentMethod)}>
          <Stack gap="md">
            <Select
              label="Tenant"
              placeholder="Select tenant"
              data={tenants.map(t => ({ value: t.id, label: t.name }))}
              {...createForm.getInputProps('tenantId')}
              required
            />

            <Select
              label="Payment Type"
              placeholder="Select payment type"
              data={[
                { value: 'manual', label: 'Manual Payment' },
                { value: 'bank', label: 'Bank Transfer' },
                { value: 'cash', label: 'Cash' },
                { value: 'other', label: 'Other' }
              ]}
              leftSection={getGatewayIcon(createForm.values.gatewayType)}
              {...createForm.getInputProps('gatewayType')}
              required
            />

            <TextInput
              label="Payment Reference"
              placeholder="Bank account number, cash receipt number, etc."
              {...createForm.getInputProps('paymentReference')}
              required
            />

            <Textarea
              label="Admin Notes"
              placeholder="Any additional notes about this payment method"
              {...createForm.getInputProps('adminNotes')}
            />

            <TextInput
              label="Reason"
              placeholder="Reason for adding this payment method (required for audit)"
              {...createForm.getInputProps('reason')}
              required
            />

            <Switch
              label="Set as default payment method"
              description="This will be the primary payment method for manual billing"
              {...createForm.getInputProps('isDefault')}
            />

            <Alert color="blue" variant="light">
              <Text size="sm">
                Manual payment methods are used for alternative billing scenarios outside the normal subscription flow. 
                These can include bank transfers, cash payments, or other custom arrangements.
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
                Add Payment Method
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* View Details Modal */}
      <Modal
        opened={viewDetailsModalOpen}
        onClose={() => setViewDetailsModalOpen(false)}
        title="Payment Method Details"
        size="md"
      >
        {selectedPaymentMethod && (
          <Stack gap="md">
            <Group>
              <Text size="sm" c="dimmed">Method ID:</Text>
              <Text size="sm" fw={500}>{selectedPaymentMethod.id}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Tenant:</Text>
              <Text size="sm" fw={500}>{selectedPaymentMethod.tenantName}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Type:</Text>
              {getGatewayBadge(selectedPaymentMethod.gatewayType)}
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Reference:</Text>
              <Text size="sm" fw={500}>{selectedPaymentMethod.paymentReference}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Default:</Text>
              <Badge color={selectedPaymentMethod.isDefault ? 'green' : 'gray'} variant="light">
                {selectedPaymentMethod.isDefault ? 'Yes' : 'No'}
              </Badge>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Verification:</Text>
              {getVerificationBadge(!!selectedPaymentMethod.verifiedBy, selectedPaymentMethod.verifiedAt)}
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Created:</Text>
              <Text size="sm">{new Date(selectedPaymentMethod.createdAt).toLocaleString()}</Text>
            </Group>
            {(selectedPaymentMethod as any).updatedAt && (
              <Group>
                <Text size="sm" c="dimmed">Updated:</Text>
                <Text size="sm">{new Date((selectedPaymentMethod as any).updatedAt).toLocaleString()}</Text>
              </Group>
            )}
            {selectedPaymentMethod.adminNotes && (
              <div>
                <Text size="sm" c="dimmed">Admin Notes:</Text>
                <Text size="sm">{selectedPaymentMethod.adminNotes}</Text>
              </div>
            )}
          </Stack>
        )}
      </Modal>

      {/* Edit Payment Method Modal */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Payment Method"
        size="md"
      >
        <form onSubmit={editForm.onSubmit(handleEditPaymentMethod)}>
          <Stack gap="md">
            <Select
              label="Payment Type"
              placeholder="Select payment type"
              data={[
                { value: 'manual', label: 'Manual Payment' },
                { value: 'bank', label: 'Bank Transfer' },
                { value: 'cash', label: 'Cash' },
                { value: 'other', label: 'Other' }
              ]}
              leftSection={getGatewayIcon(editForm.values.gatewayType)}
              {...editForm.getInputProps('gatewayType')}
              required
            />

            <TextInput
              label="Payment Reference"
              placeholder="Bank account number, cash receipt number, etc."
              {...editForm.getInputProps('paymentReference')}
              required
            />

            <Textarea
              label="Admin Notes"
              placeholder="Any additional notes about this payment method"
              {...editForm.getInputProps('adminNotes')}
            />

            <Switch
              label="Set as default payment method"
              description="This will be the primary payment method for manual billing"
              {...editForm.getInputProps('isDefault')}
            />

            <Group justify="flex-end" gap="sm">
              <Button variant="light" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Changes
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

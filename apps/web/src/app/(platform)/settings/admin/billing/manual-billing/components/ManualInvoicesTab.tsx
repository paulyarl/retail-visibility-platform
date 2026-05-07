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
  NumberInput,
  Select,
  Stack,
  Grid,
  Card,
  Alert,
  Loader,
  Pagination,
  Input
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconEye,
  IconCheck,
  IconX,
  IconEdit,
  IconFileInvoice,
  IconCalendar,
  IconCurrencyDollar
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { manualBillingService, type ManualInvoice } from '@/services/ManualBillingService';
import { useBillingData } from '../../hooks/useBillingData';

export default function ManualInvoicesTab() {
  const { tenants, loading: tenantsLoading } = useBillingData();
  const [invoices, setInvoices] = useState<ManualInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<ManualInvoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  // Form for creating manual invoice
  const createForm = useForm({
    initialValues: {
      tenantId: '',
      amountDollars: 0,
      description: '',
      paymentInstructions: '',
      reason: ''
    },
    validate: {
      tenantId: (value) => !value ? 'Tenant is required' : null,
      amountDollars: (value) => value <= 0 ? 'Amount must be greater than 0' : null,
      description: (value) => !value.trim() ? 'Description is required' : null
    }
  });

  // Form for marking invoice as paid
  const markPaidForm = useForm({
    initialValues: {
      paymentReference: '',
      amountDollars: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    },
    validate: {
      paymentReference: (value) => !value.trim() ? 'Payment reference is required' : null,
      amountDollars: (value) => value <= 0 ? 'Amount must be greater than 0' : null
    }
  });

  // Form for editing invoice
  const editForm = useForm({
    initialValues: {
      amountDollars: 0,
      description: '',
      paymentInstructions: ''
    },
    validate: {
      amountDollars: (value) => value <= 0 ? 'Amount must be greater than 0' : null,
      description: (value) => !value.trim() ? 'Description is required' : null
    }
  });

  // Fetch data
  useEffect(() => {
    fetchInvoices();
  }, [currentPage, searchQuery]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      // Fetch all invoices (no tenant filter for admin view)
      const invoices = await manualBillingService.getAllManualInvoices();
      setInvoices(invoices);
      setTotalPages(Math.ceil(invoices.length / itemsPerPage));
    } catch (error) {
      console.error('Error fetching invoices:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch invoices',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async (values: typeof createForm.values) => {
    try {
      const result = await manualBillingService.createManualInvoice({
        ...values,
        amountCents: Math.round(values.amountDollars * 100), // Convert dollars to cents
        adminCreatedBy: 'current-admin-id', // This would come from auth context
        adminEmail: 'admin@example.com' // This would come from auth context
      });

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: 'Manual invoice created successfully',
          color: 'green'
        });
        setCreateModalOpen(false);
        createForm.reset();
        // Invalidate cache to ensure fresh data
        manualBillingService.invalidateCache('all-manual-invoices');
        fetchInvoices();
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to create invoice',
          color: 'red'
        });
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to create invoice',
        color: 'red'
      });
    }
  };

  const handleMarkAsPaid = async (values: typeof markPaidForm.values) => {
    if (!selectedInvoice) return;

    try {
      const result = await manualBillingService.markInvoiceAsPaid({
        invoiceId: selectedInvoice.id,
        paymentReference: values.paymentReference,
        amountCents: Math.round(values.amountDollars * 100), // Convert dollars to cents
        paymentDate: values.paymentDate,
        notes: values.notes,
        verifiedBy: 'current-admin-id', // This would come from auth context
        verifiedByEmail: 'admin@example.com' // This would come from auth context
      });

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: 'Invoice marked as paid',
          color: 'green'
        });
        setMarkPaidModalOpen(false);
        markPaidForm.reset();
        setSelectedInvoice(null);
        fetchInvoices();
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to mark invoice as paid',
          color: 'red'
        });
      }
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to mark invoice as paid',
        color: 'red'
      });
    }
  };

  const openMarkPaidModal = (invoice: ManualInvoice) => {
    setSelectedInvoice(invoice);
    markPaidForm.setValues({
      paymentReference: '',
      amountDollars: invoice.amountCents / 100, // Convert cents to dollars for display
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setMarkPaidModalOpen(true);
  };

  const openViewDetailsModal = (invoice: ManualInvoice) => {
    setSelectedInvoice(invoice);
    setViewDetailsModalOpen(true);
  };

  const openEditModal = (invoice: ManualInvoice) => {
    setSelectedInvoice(invoice);
    editForm.setValues({
      amountDollars: invoice.amountCents / 100,
      description: invoice.description,
      paymentInstructions: invoice.paymentInstructions || ''
    });
    setEditModalOpen(true);
  };

  const handleEditInvoice = async (values: typeof editForm.values) => {
    if (!selectedInvoice) return;

    try {
      const result = await manualBillingService.updateInvoice(selectedInvoice.id, {
        amountCents: Math.round(values.amountDollars * 100),
        description: values.description,
        paymentInstructions: values.paymentInstructions
      });

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: 'Invoice updated successfully',
          color: 'green'
        });
        setEditModalOpen(false);
        // Update the invoice in the list directly
        setInvoices(prevInvoices => 
          prevInvoices.map(inv => 
            inv.id === selectedInvoice.id 
              ? {
                  ...inv,
                  amountCents: Math.round(values.amountDollars * 100),
                  description: values.description,
                  paymentInstructions: values.paymentInstructions,
                  updatedAt: new Date().toISOString()
                }
              : inv
          )
        );
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to update invoice',
          color: 'red'
        });
      }
    } catch (error) {
      console.error('Error editing invoice:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to edit invoice',
        color: 'red'
      });
    }
  };

  const handleCancelInvoice = async (invoice: ManualInvoice) => {
    try {
      const result = await manualBillingService.cancelInvoice(invoice.id);

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: 'Invoice cancelled successfully',
          color: 'green'
        });
        // Update the invoice status in the list directly
        setInvoices(prevInvoices => 
          prevInvoices.map(inv => 
            inv.id === invoice.id 
              ? {
                  ...inv,
                  status: 'cancelled',
                  updatedAt: new Date().toISOString()
                }
              : inv
          )
        );
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to cancel invoice',
          color: 'red'
        });
      }
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to cancel invoice',
        color: 'red'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge color="green" variant="light">Paid</Badge>;
      case 'pending':
        return <Badge color="yellow" variant="light">Pending</Badge>;
      case 'cancelled':
        return <Badge color="red" variant="light">Cancelled</Badge>;
      default:
        return <Badge color="gray" variant="light">{status}</Badge>;
    }
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(invoice =>
    (invoice.tenantName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (invoice.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    invoice.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const paginatedInvoices = filteredInvoices.slice(
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
            placeholder="Search invoices..."
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
          Create Manual Invoice
        </Button>
      </Group>

      {/* Table */}
      <Card shadow="sm" padding="md" withBorder>
        {paginatedInvoices.length === 0 ? (
          <div className="text-center py-8">
            <IconFileInvoice size={48} className="mx-auto mb-4 text-gray-400" />
            <Text color="dimmed">No manual invoices found</Text>
            <Text size="sm" color="dimmed" mt="xs">
              Create your first manual invoice to get started
            </Text>
          </div>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Invoice ID</Table.Th>
                <Table.Th>Tenant</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th>Updated</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedInvoices.map((invoice) => (
                <Table.Tr key={invoice.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{invoice.id}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{invoice.tenantName}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{invoice.description}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      ${(invoice.amountCents / 100).toFixed(2)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {getStatusBadge(invoice.status)}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(invoice.createdAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {invoice.updatedAt 
                        ? new Date(invoice.updatedAt).toLocaleDateString()
                        : '-'
                      }
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {invoice.status === 'pending' && (
                        <>
                          <ActionIcon
                            size="sm"
                            color="green"
                            onClick={() => openMarkPaidModal(invoice)}
                            title="Mark as Paid"
                          >
                            <IconCheck size={16} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            color="orange"
                            onClick={() => openEditModal(invoice)}
                            title="Edit Invoice"
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            color="red"
                            onClick={() => handleCancelInvoice(invoice)}
                            title="Cancel Invoice"
                          >
                            <IconX size={16} />
                          </ActionIcon>
                        </>
                      )}
                      <ActionIcon
                        size="sm"
                        color="blue"
                        onClick={() => openViewDetailsModal(invoice)}
                        title="View Details"
                      >
                        <IconEye size={16} />
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

      {/* Create Invoice Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Manual Invoice"
        size="md"
      >
        <form onSubmit={createForm.onSubmit(handleCreateInvoice)}>
          <Stack gap="md">
            <Select
              label="Tenant"
              placeholder="Select tenant"
              data={tenants.map(t => ({ value: t.id, label: t.name }))}
              {...createForm.getInputProps('tenantId')}
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

            <TextInput
              label="Description"
              placeholder="Invoice description"
              {...createForm.getInputProps('description')}
              required
            />

            <Textarea
              label="Payment Instructions"
              placeholder="How the tenant should pay this invoice"
              {...createForm.getInputProps('paymentInstructions')}
            />

            <TextInput
              label="Reason"
              placeholder="Why this manual invoice is being created"
              {...createForm.getInputProps('reason')}
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                Create Invoice
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Mark as Paid Modal */}
      <Modal
        opened={markPaidModalOpen}
        onClose={() => setMarkPaidModalOpen(false)}
        title="Mark Invoice as Paid"
        size="md"
      >
        <form onSubmit={markPaidForm.onSubmit(handleMarkAsPaid)}>
          <Stack gap="md">
            {selectedInvoice && (
              <Alert color="blue" variant="light">
                <Text size="sm">
                  Marking invoice <strong>{selectedInvoice.id}</strong> as paid for 
                  <strong> ${(selectedInvoice.amountCents / 100).toFixed(2)}</strong>
                </Text>
              </Alert>
            )}

            <TextInput
              label="Payment Reference"
              placeholder="Check number, transaction ID, etc."
              {...markPaidForm.getInputProps('paymentReference')}
              required
            />

            <NumberInput
              label="Amount Paid ($)"
              placeholder="0.00"
              decimalScale={2}
              min={0}
              step={0.01}
              {...markPaidForm.getInputProps('amountDollars')}
              required
            />

            <TextInput
              label="Payment Date"
              type="date"
              {...markPaidForm.getInputProps('paymentDate')}
              required
            />

            <Textarea
              label="Notes"
              placeholder="Any additional notes about this payment"
              {...markPaidForm.getInputProps('notes')}
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                onClick={() => setMarkPaidModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" color="green">
                Mark as Paid
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* View Details Modal */}
      <Modal
        opened={viewDetailsModalOpen}
        onClose={() => setViewDetailsModalOpen(false)}
        title="Invoice Details"
        size="md"
      >
        {selectedInvoice && (
          <Stack gap="md">
            <Group>
              <Text size="sm" c="dimmed">Invoice ID:</Text>
              <Text size="sm" fw={500}>{selectedInvoice.id}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Tenant:</Text>
              <Text size="sm" fw={500}>{selectedInvoice.tenantName}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Amount:</Text>
              <Text size="sm" fw={500}>${(selectedInvoice.amountCents / 100).toFixed(2)}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Status:</Text>
              {getStatusBadge(selectedInvoice.status)}
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Created:</Text>
              <Text size="sm">{new Date(selectedInvoice.createdAt).toLocaleString()}</Text>
            </Group>
            {selectedInvoice.paidAt && (
              <Group>
                <Text size="sm" c="dimmed">Paid At:</Text>
                <Text size="sm">{new Date(selectedInvoice.paidAt).toLocaleString()}</Text>
              </Group>
            )}
            {selectedInvoice.paymentInstructions && (
              <div>
                <Text size="sm" c="dimmed">Payment Instructions:</Text>
                <Text size="sm">{selectedInvoice.paymentInstructions}</Text>
              </div>
            )}
          </Stack>
        )}
      </Modal>

      {/* Edit Invoice Modal */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Invoice"
        size="md"
      >
        <form onSubmit={editForm.onSubmit(handleEditInvoice)}>
          <Stack gap="md">
            <NumberInput
              label="Amount ($)"
              placeholder="0.00"
              decimalScale={2}
              min={0}
              step={0.01}
              {...editForm.getInputProps('amountDollars')}
              required
            />

            <TextInput
              label="Description"
              placeholder="Invoice description"
              {...editForm.getInputProps('description')}
              required
            />

            <Textarea
              label="Payment Instructions"
              placeholder="How to pay this invoice"
              {...editForm.getInputProps('paymentInstructions')}
              minRows={3}
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

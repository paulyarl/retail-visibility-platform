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
  Input
} from '@mantine/core';
import {
  IconSearch,
  IconEye,
  IconCalendar,
  IconCurrencyDollar,
  IconReceipt,
  IconClock,
  IconCheck
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { manualBillingService } from '@/services/ManualBillingService';
import { clientLogger } from '@/lib/client-logger';

interface Invoice {
  id: string;
  tenantId: string;
  tenantName: string;
  tier: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  amountCents: number;
  status: string;
  dueDate?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
  isManual: boolean;
  paymentInstructions?: string;
  payments: Array<{
    id: string;
    gatewayType: string;
    transactionId: string;
    amountCents: number;
    status: string;
    createdAt: Date;
  }>;
}

export default function AllInvoicesTab() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = useState(false);
  const itemsPerPage = 10;

  // Fetch data
  useEffect(() => {
    fetchInvoices();
  }, [currentPage, searchQuery]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const invoices = await manualBillingService.getAllInvoices();
      setInvoices(invoices);
      setTotalPages(Math.ceil(invoices.length / itemsPerPage));
    } catch (error) {
      clientLogger.error('Error fetching invoices:', { detail: error });
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch invoices',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(invoice =>
    (invoice.tenantName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    invoice.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    invoice.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Paginate
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge color="gray" variant="light">Draft</Badge>;
      case 'pending':
        return <Badge color="yellow" variant="light">Pending</Badge>;
      case 'paid':
        return <Badge color="green" variant="light">Paid</Badge>;
      case 'overdue':
        return <Badge color="red" variant="light">Overdue</Badge>;
      case 'cancelled':
        return <Badge color="gray" variant="light">Cancelled</Badge>;
      default:
        return <Badge color="gray" variant="light">{status}</Badge>;
    }
  };

  const getTypeBadge = (isManual: boolean) => {
    return isManual 
      ? <Badge color="blue" variant="light">Manual</Badge>
      : <Badge color="green" variant="light">Automated</Badge>;
  };

  const openViewDetailsModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setViewDetailsModalOpen(true);
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
      {/* Search and Filters */}
      <Group justify="space-between">
        <Input
          placeholder="Search invoices..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1 }}
          miw={300}
        />
      </Group>

      {/* Invoices Table */}
      <Card shadow="sm" padding="md" withBorder>
        {paginatedInvoices.length === 0 ? (
          <div className="text-center p-8">
            <IconReceipt size={48} color="gray" className="mx-auto mb-4" />
            <Text size="lg" c="dimmed">
              {searchQuery ? 'No invoices found matching your search' : 'No invoices found'}
            </Text>
          </div>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Invoice ID</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Tenant</Table.Th>
                <Table.Th>Tier</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Billing Period</Table.Th>
                <Table.Th>Created</Table.Th>
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
                    {getTypeBadge(invoice.isManual)}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{invoice.tenantName}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{invoice.tier}</Text>
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
                      {new Date(invoice.billingPeriodStart).toLocaleDateString()} - {' '}
                      {new Date(invoice.billingPeriodEnd).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(invoice.createdAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      size="sm"
                      color="blue"
                      onClick={() => openViewDetailsModal(invoice)}
                      title="View Details"
                    >
                      <IconEye size={16} />
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

      {/* View Details Modal */}
      <Modal
        opened={viewDetailsModalOpen}
        onClose={() => setViewDetailsModalOpen(false)}
        title="Invoice Details"
        size="lg"
      >
        {selectedInvoice && (
          <Stack gap="md">
            <Group>
              <Text size="sm" c="dimmed">Invoice ID:</Text>
              <Text size="sm" fw={500}>{selectedInvoice.id}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Type:</Text>
              {getTypeBadge(selectedInvoice.isManual)}
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Tenant:</Text>
              <Text size="sm" fw={500}>{selectedInvoice.tenantName}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Tier:</Text>
              <Text size="sm">{selectedInvoice.tier}</Text>
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
              <Text size="sm" c="dimmed">Billing Period:</Text>
              <Text size="sm">
                {new Date(selectedInvoice.billingPeriodStart).toLocaleDateString()} - {' '}
                {new Date(selectedInvoice.billingPeriodEnd).toLocaleDateString()}
              </Text>
            </Group>
            {selectedInvoice.dueDate && (
              <Group>
                <Text size="sm" c="dimmed">Due Date:</Text>
                <Text size="sm">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</Text>
              </Group>
            )}
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
            <Group>
              <Text size="sm" c="dimmed">Created:</Text>
              <Text size="sm">{new Date(selectedInvoice.createdAt).toLocaleString()}</Text>
            </Group>
            {selectedInvoice.updatedAt && (
              <Group>
                <Text size="sm" c="dimmed">Updated:</Text>
                <Text size="sm">{new Date(selectedInvoice.updatedAt).toLocaleString()}</Text>
              </Group>
            )}
            
            {selectedInvoice.payments.length > 0 && (
              <div>
                <Text size="sm" fw={500} mb="xs">Payments:</Text>
                <Stack gap="xs">
                  {selectedInvoice.payments.map((payment) => (
                    <Card key={payment.id} padding="sm" withBorder>
                      <Group justify="space-between">
                        <Text size="sm">{payment.gatewayType}</Text>
                        <Text size="sm" fw={500}>
                          ${(payment.amountCents / 100).toFixed(2)}
                        </Text>
                      </Group>
                      <Group gap="xs">
                        {getStatusBadge(payment.status)}
                        {payment.transactionId && (
                          <Text size="xs" c="dimmed">
                            ID: {payment.transactionId}
                          </Text>
                        )}
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </div>
            )}
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

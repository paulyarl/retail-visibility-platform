'use client';

import { useState, useEffect } from 'react';
import { Card, Badge, Button, Modal, Group, Text, Stack, Alert, Loader, Table, Pagination } from '@mantine/core';
import { IconFileInvoice, IconDownload, IconChevronRight, IconAlertCircle, IconCheck, IconClock } from '@tabler/icons-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { subscriptionBillingService, type Invoice, type InvoicePayment } from '@/services/SubscriptionBillingService';
import { useAuth } from '@/contexts/AuthContext';
import { clientLogger } from '@/lib/client-logger';

const ITEMS_PER_PAGE = 10;

const STATUS_COLORS: Record<string, string> = {
  draft: 'gray',
  open: 'blue',
  paid: 'green',
  void: 'red',
  uncollectible: 'dark',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <IconClock size="0.875rem" />,
  open: <IconClock size="0.875rem" />,
  paid: <IconCheck size="0.875rem" />,
  void: <IconAlertCircle size="0.875rem" />,
  uncollectible: <IconAlertCircle size="0.875rem" />,
};

export default function InvoiceHistoryPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await subscriptionBillingService.getInvoices({ limit: 100 });
      setInvoices(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  
  const formatDate = (dateStr: string | Date | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTier = (tier: string) => {
    return tier.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const totalPages = Math.ceil(invoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = invoices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      const tenantId = user?.tenants?.[0]?.id || '';
      const blob = await subscriptionBillingService.downloadInvoicePdf(invoice.id, tenantId);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      clientLogger.error('Error downloading invoice:', { detail: error });
      alert('Failed to download invoice PDF');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-neutral-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <PageHeader
        title="Invoice History"
        description="View and download your billing invoices"
        icon={Icons.Settings}
        backLink={{
          href: '/settings/subscription',
          label: 'Back to Subscription'
        }}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert 
            icon={<IconAlertCircle size="1rem" />} 
            title="Error" 
            color="red" 
            onClose={() => setError(null)}
            withCloseButton
            mb="lg"
          >
            {error}
          </Alert>
        )}

        <Card withBorder padding="lg" radius="md">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <IconFileInvoice size="1.25rem" />
                Invoices
              </h3>
              <Badge variant="light">
                {invoices.length} total
              </Badge>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader size="lg" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                <IconFileInvoice size="3rem" className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No invoices yet</p>
                <p className="text-sm mt-1">Invoices will appear here once you subscribe to a paid plan</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Invoice</Table.Th>
                        <Table.Th>Plan</Table.Th>
                        <Table.Th>Amount</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Date</Table.Th>
                        <Table.Th>Paid</Table.Th>
                        <Table.Th></Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {paginatedInvoices.map((invoice) => (
                        <Table.Tr key={invoice.id}>
                          <Table.Td>
                            <Text fw={500} size="sm">{invoice.id}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{formatTier(invoice.tier)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={600} size="sm">{formatPrice(invoice.amountCents)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge 
                              color={STATUS_COLORS[invoice.status] || 'gray'} 
                              variant="light"
                              leftSection={STATUS_ICONS[invoice.status]}
                            >
                              {invoice.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="neutral">{formatDate(invoice.createdAt)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="neutral">{formatDate(invoice.paidAt)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <Button 
                                size="xs" 
                                variant="subtle"
                                onClick={() => handleViewInvoice(invoice)}
                              >
                                View
                              </Button>
                              <Button 
                                size="xs" 
                                variant="subtle"
                                leftSection={<IconDownload size="0.875rem" />}
                                onClick={() => handleDownloadInvoice(invoice)}
                              >
                                PDF
                              </Button>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination 
                      total={totalPages} 
                      value={currentPage}
                      onChange={setCurrentPage}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Invoice Detail Modal */}
      <Modal
        opened={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title={`Invoice ${selectedInvoice?.id || ''}`}
        size="lg"
      >
        {selectedInvoice && (
          <Stack gap="md">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text size="sm" c="neutral">Plan</Text>
                <Text fw={500}>{formatTier(selectedInvoice.tier)}</Text>
              </div>
              <div>
                <Text size="sm" c="neutral">Amount</Text>
                <Text fw={600}>{formatPrice(selectedInvoice.amountCents)}</Text>
              </div>
              <div>
                <Text size="sm" c="neutral">Billing Period</Text>
                <Text size="sm">
                  {formatDate(selectedInvoice.billingPeriodStart)} - {formatDate(selectedInvoice.billingPeriodEnd)}
                </Text>
              </div>
              <div>
                <Text size="sm" c="neutral">Status</Text>
                <Badge 
                  color={STATUS_COLORS[selectedInvoice.status] || 'gray'} 
                  variant="light"
                >
                  {selectedInvoice.status}
                </Badge>
              </div>
              <div>
                <Text size="sm" c="neutral">Created</Text>
                <Text size="sm">{formatDate(selectedInvoice.createdAt)}</Text>
              </div>
              <div>
                <Text size="sm" c="neutral">Paid</Text>
                <Text size="sm">{formatDate(selectedInvoice.paidAt)}</Text>
              </div>
            </div>

            {selectedInvoice.payments.length > 0 && (
              <div>
                <Text fw={500} mb="xs">Payment History</Text>
                <div className="space-y-2">
                  {selectedInvoice.payments.map((payment) => (
                    <div 
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                    >
                      <div>
                        <Text size="sm" fw={500}>{payment.gatewayType}</Text>
                        <Text size="xs" c="neutral">
                          Transaction: {payment.transactionId}
                        </Text>
                      </div>
                      <div className="text-right">
                        <Text size="sm" fw={500}>{formatPrice(payment.amountCents)}</Text>
                        <Badge 
                          size="sm"
                          color={payment.status === 'succeeded' ? 'green' : 'gray'}
                          variant="light"
                        >
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setShowInvoiceModal(false)}>
                Close
              </Button>
              <Button 
                leftSection={<IconDownload size="1rem" />}
                onClick={() => handleDownloadInvoice(selectedInvoice)}
              >
                Download PDF
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  );
}

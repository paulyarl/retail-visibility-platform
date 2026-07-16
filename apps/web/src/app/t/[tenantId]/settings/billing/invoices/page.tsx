'use client';

import { useState, useEffect } from 'react';
import { Card, Badge, Button, Modal, Group, Text, Stack, Alert, Loader, Table, Pagination, Select } from '@mantine/core';
import { 
  IconFileInvoice, 
  IconDownload, 
  IconChevronRight, 
  IconAlertCircle, 
  IconCheck, 
  IconClock,
  IconCreditCard,
  IconRefresh
} from '@tabler/icons-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { tenantBillingService } from '@/services/TenantBillingService';
import { clientLogger } from '@/lib/client-logger';

const ITEMS_PER_PAGE = 10;

interface Invoice {
  id: string;
  number: string;
  amount_cents: number;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  due_date: Date | null;
  created_at: Date;
  paid_at: Date | null;
  billing_period_start: Date;
  billing_period_end: Date;
  subscription_tier: string;
  type: 'subscription' | 'platform_fee' | 'service_charge';
  payment_method?: string;
}

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

const INVOICE_TYPE_LABELS: Record<string, string> = {
  subscription: 'Subscription',
  platform_fee: 'Platform Fee',
  service_charge: 'Service Charge'
};

export default function TenantInvoicesPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string>('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const resolveTenantId = async () => {
      const resolvedParams = await params;
      setTenantId(resolvedParams.tenantId);
    };
    resolveTenantId();
  }, [params]);

  useEffect(() => {
    if (tenantId) {
      loadInvoices();
      loadPaymentMethods();
    }
  }, [tenantId, statusFilter, typeFilter]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get recent activity which includes invoices
      const activity = await tenantBillingService.getRecentActivity(tenantId, 100);
      
      console.log('[Invoices] Activity data:', activity);
      
      // Transform activity data into invoice format
      const invoiceData: Invoice[] = activity
        .filter(item => item.type === 'invoice')
        .map((item, index) => {
          const dateObj = new Date(item.date);
          return {
            id: item.id,
            number: `INV-${String(index + 1).padStart(4, '0')}`,
            amount_cents: item.amount || 0,
            status: item.status === 'paid' ? 'paid' : item.status === 'failed' ? 'void' : 'open',
            due_date: item.dueDate ? new Date(item.dueDate) : new Date(dateObj.getTime() + 30 * 24 * 60 * 60 * 1000),
            created_at: dateObj,
            paid_at: (item as any).paidAt ? new Date((item as any).paidAt) : null,
            billing_period_start: new Date(dateObj.getTime() - 30 * 24 * 60 * 60 * 1000),
            billing_period_end: dateObj,
            subscription_tier: 'Storefront',
            type: 'subscription'
          };
        });

      console.log('[Invoices] Transformed invoice data:', invoiceData);
      setInvoices(invoiceData);
    } catch (err: any) {
      clientLogger.error('[Invoices] Error:', { detail: err });
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const methods = await tenantBillingService.getPaymentMethods(tenantId);
      setPaymentMethods(methods);
    } catch (err) {
      clientLogger.error('Failed to load payment methods:', { detail: err });
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  
  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTier = (tier: string) => {
    return tier.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const filteredInvoices = invoices.filter(invoice => {
    const statusMatch = statusFilter === 'all' || invoice.status === statusFilter;
    const typeMatch = typeFilter === 'all' || invoice.type === typeFilter;
    return statusMatch && typeMatch;
  });

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handlePayInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowPayModal(true);
  };

  const handleProcessPayment = async () => {
    if (!selectedInvoice || !selectedPaymentMethod) return;

    try {
      setPaying(true);
      const result = await tenantBillingService.payInvoice(
        tenantId, 
        selectedInvoice.id, 
        selectedPaymentMethod
      );

      if (result.success) {
        setShowPayModal(false);
        setSelectedInvoice(null);
        setSelectedPaymentMethod('');
        await loadInvoices(); // Refresh invoices
      } else {
        setError(result.error || 'Payment failed');
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      // This would download the actual PDF
      const blob = await tenantBillingService.downloadStatement(tenantId, invoice.id);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      clientLogger.error('Error downloading invoice:', { detail: error });
      setError('Failed to download invoice PDF');
    }
  };

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert color="red" icon={<IconAlertCircle />}>
          {error}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice History"
        description="View and manage your billing invoices"
        icon={Icons.FileInvoice}
        backLink={{
          href: `/t/${tenantId}/settings/billing`,
          label: 'Back to Billing'
        }}
      />

      {/* Filters */}
      <Card>
        <Group>
          <Select
            label="Status"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || 'all')}
            data={[
              { value: 'all', label: 'All Status' },
              { value: 'open', label: 'Open' },
              { value: 'paid', label: 'Paid' },
              { value: 'void', label: 'Void' },
              { value: 'draft', label: 'Draft' }
            ]}
            w={150}
          />
          
          <Select
            label="Type"
            value={typeFilter}
            onChange={(value) => setTypeFilter(value || 'all')}
            data={[
              { value: 'all', label: 'All Types' },
              { value: 'subscription', label: 'Subscription' },
              { value: 'platform_fee', label: 'Platform Fee' },
              { value: 'service_charge', label: 'Service Charge' }
            ]}
            w={150}
          />

          <Button
            variant="outline"
            leftSection={<IconRefresh size="1rem" />}
            onClick={loadInvoices}
            ml="auto"
          >
            Refresh
          </Button>
        </Group>
      </Card>

      {/* Invoices Table */}
      <Card>
        {filteredInvoices.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 text-gray-400">
              <IconFileInvoice size={48} />
            </div>
            <Text size="lg" fw={500}>No invoices found</Text>
            <Text size="sm" c="dimmed">
              {statusFilter !== 'all' || typeFilter !== 'all' 
                ? 'Try adjusting your filters'
                : 'Invoices will appear here once you have billing activity'}
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Invoice</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Due Date</Table.Th>
                <Table.Th>Paid On</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedInvoices.map((invoice) => (
              <Table.Tr key={invoice.id}>
                <Table.Td>
                  <Group>
                    <IconFileInvoice size="1rem" />
                    <div>
                      <Text fw={500}>{invoice.number}</Text>
                      <Text size="sm" c="dimmed">{formatTier(invoice.subscription_tier)}</Text>
                    </div>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light">
                    {INVOICE_TYPE_LABELS[invoice.type] || invoice.type}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text fw={500}>{formatPrice(invoice.amount_cents)}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={STATUS_COLORS[invoice.status]}
                    variant="light"
                    leftSection={STATUS_ICONS[invoice.status]}
                  >
                    {invoice.status.toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {invoice.due_date && invoice.status !== 'paid' && 
                   (new Date(invoice.due_date).getTime() - Date.now()) < 14 * 24 * 60 * 60 * 1000 ? (
                    <Badge color="red" variant="light" size="sm">
                      {formatDate(invoice.due_date)}
                    </Badge>
                  ) : (
                    <Text size="sm">{formatDate(invoice.due_date)}</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {invoice.paid_at ? (
                    <Badge color="green" variant="light" size="sm">
                      {formatDate(invoice.paid_at)}
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">-</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatDate(invoice.created_at)}</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button
                      variant="outline"
                      size="sm"
                      leftSection={<IconChevronRight size="1rem" />}
                      onClick={() => handleViewInvoice(invoice)}
                    >
                      View
                    </Button>
                    
                    {invoice.status === 'open' && (
                      <Button
                        variant="filled"
                        size="sm"
                        leftSection={<IconCreditCard size="1rem" />}
                        onClick={() => handlePayInvoice(invoice)}
                      >
                        Pay
                      </Button>
                    )}
                    
                    <Button
                      variant="subtle"
                      size="sm"
                      leftSection={<IconDownload size="1rem" />}
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
        )}

        {totalPages > 1 && (
          <div className="flex justify-center mt-4">
            <Pagination
              value={currentPage}
              onChange={setCurrentPage}
              total={totalPages}
            />
          </div>
        )}
      </Card>

      {/* Invoice Details Modal */}
      <Modal
        opened={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title={selectedInvoice ? `Invoice ${selectedInvoice.number}` : 'Invoice Details'}
        size="md"
      >
        {selectedInvoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text size="sm" c="dimmed">Invoice Number</Text>
                <Text fw={500}>{selectedInvoice.number}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Type</Text>
                <Text fw={500}>{INVOICE_TYPE_LABELS[selectedInvoice.type]}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Amount</Text>
                <Text fw={500}>{formatPrice(selectedInvoice.amount_cents)}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Status</Text>
                <Badge
                  color={STATUS_COLORS[selectedInvoice.status]}
                  variant="light"
                  leftSection={STATUS_ICONS[selectedInvoice.status]}
                >
                  {selectedInvoice.status.toUpperCase()}
                </Badge>
              </div>
              <div>
                <Text size="sm" c="dimmed">Due Date</Text>
                <Text>{formatDate(selectedInvoice.due_date)}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Created</Text>
                <Text>{formatDate(selectedInvoice.created_at)}</Text>
              </div>
            </div>
            
            <div>
              <Text size="sm" c="dimmed">Billing Period</Text>
              <Text>
                {formatDate(selectedInvoice.billing_period_start)} - {formatDate(selectedInvoice.billing_period_end)}
              </Text>
            </div>
            
            {selectedInvoice.paid_at && (
              <div>
                <Text size="sm" c="dimmed">Paid On</Text>
                <Text>{formatDate(selectedInvoice.paid_at)}</Text>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal
        opened={showPayModal}
        onClose={() => setShowPayModal(false)}
        title="Pay Invoice"
        size="md"
      >
        {selectedInvoice && (
          <div className="space-y-4">
            <Alert color="blue">
              <Text>
                You are about to pay {formatPrice(selectedInvoice.amount_cents)} for invoice {selectedInvoice.number}
              </Text>
            </Alert>
            
            <div>
              <label className="block text-sm font-medium mb-2">Select Payment Method</label>
              <Select
                value={selectedPaymentMethod}
                onChange={(value) => setSelectedPaymentMethod(value || '')}
                data={paymentMethods.map(method => ({
                  value: method.id,
                  label: `${method.type === 'card' ? 'Card' : 'Bank'} ending in ${method.last4}`
                }))}
                placeholder="Choose payment method"
              />
            </div>
            
            <Group justify="flex-end">
              <Button
                variant="outline"
                onClick={() => setShowPayModal(false)}
                disabled={paying}
              >
                Cancel
              </Button>
              <Button
                onClick={handleProcessPayment}
                loading={paying}
                disabled={!selectedPaymentMethod || paying}
              >
                Pay {formatPrice(selectedInvoice.amount_cents)}
              </Button>
            </Group>
          </div>
        )}
      </Modal>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { 
  Card, 
  Text, 
  Group, 
  Badge, 
  Stack, 
  Grid, 
  Progress,
  Button,
  Select,
  ActionIcon,
  Tooltip,
  Divider,
  LoadingOverlay,
  Alert,
  Table,
  TextInput,
  Modal,
  Checkbox
} from '@mantine/core';
import { 
  IconReceipt, 
  IconDownload,
  IconEye,
  IconSend,
  IconRefresh,
  IconSearch,
  IconFilter,
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconX
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { PlatformInvoice } from '@/services/AdminBillingService';
import { useInvoiceManagement } from '../hooks/useInvoiceManagement';
import { manualBillingService } from '@/services/ManualBillingService';
import { subscriptionBillingService } from '@/services/SubscriptionBillingService';

interface InvoiceManagementProps {
  manualInvoices?: any[];
  manualBillingInvoices?: any[];
  isLoading?: boolean;
  refreshInterval?: number;
}

interface InvoiceStats {
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  failedAmount: number;
  overdueCount: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
}

interface InvoiceData {
  id: string;
  amountCents?: number;
  totalAmount?: number;
  status: string;
  dueDate?: string;
  createdAt?: string;
  created_at?: string;
  tenantName?: string;
  description?: string;
  paymentMethod?: string;
  invoiceNumber?: string;
}

export function InvoiceManagement({ 
  manualInvoices = [], 
  manualBillingInvoices = [], 
  isLoading = false,
  refreshInterval 
}: InvoiceManagementProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showBulkActions, setShowBulkActions] = useState<boolean>(false);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [viewLoading, setViewLoading] = useState<string | null>(null);
  const [sendLoading, setSendLoading] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Use real invoice data - combine manual invoices and manual billing invoices, ensuring unique IDs
  const invoices = [...manualInvoices, ...manualBillingInvoices].reduce((unique: InvoiceData[], invoice: InvoiceData) => {
    const existingIndex = unique.findIndex((inv: InvoiceData) => inv.id === invoice.id);
    if (existingIndex === -1) {
      return [...unique, invoice];
    }
    // If duplicate exists, keep the one with more recent data
    const existingDate = new Date(unique[existingIndex].createdAt || unique[existingIndex].created_at || 0);
    const newDate = new Date(invoice.createdAt || invoice.created_at || 0);
    if (newDate > existingDate) {
      unique[existingIndex] = invoice;
    }
    return unique;
  }, [] as InvoiceData[]);
  // Calculate stats from real API data (convert cents to dollars)
  const stats: InvoiceStats = {
    totalInvoices: invoices.length,
    totalAmount: invoices.reduce((sum: number, inv: InvoiceData) => sum + ((inv.amountCents || inv.totalAmount || 0) / 100), 0),
    paidAmount: invoices.filter((inv: InvoiceData) => inv.status === 'paid').reduce((sum: number, inv: InvoiceData) => sum + ((inv.amountCents || inv.totalAmount || 0) / 100), 0),
    pendingAmount: invoices.filter((inv: InvoiceData) => inv.status === 'pending').reduce((sum: number, inv: InvoiceData) => sum + ((inv.amountCents || inv.totalAmount || 0) / 100), 0),
    failedAmount: invoices.filter((inv: InvoiceData) => inv.status === 'failed' || inv.status === 'overdue').reduce((sum: number, inv: InvoiceData) => sum + ((inv.amountCents || inv.totalAmount || 0) / 100), 0),
    overdueCount: invoices.filter((inv: InvoiceData) => 
      inv.status === 'pending' && inv.dueDate && new Date(inv.dueDate) < new Date()
    ).length,
    thisMonthRevenue: invoices.filter((inv: InvoiceData) => 
      inv.status === 'paid' && new Date(inv.createdAt || inv.created_at || '').getMonth() === new Date().getMonth()
    ).reduce((sum: number, inv: InvoiceData) => sum + ((inv.amountCents || inv.totalAmount || 0) / 100), 0),
    lastMonthRevenue: 0 // Would calculate from historical data
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'green';
      case 'pending': return 'blue';
      case 'overdue': return 'red';
      case 'draft': return 'gray';
      case 'cancelled': return 'gray';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <IconCheck size="1rem" />;
      case 'pending': return <IconClock size="1rem" />;
      case 'overdue': return <IconAlertTriangle size="1rem" />;
      case 'draft': return <IconClock size="1rem" />;
      case 'cancelled': return <IconX size="1rem" />;
      default: return <IconClock size="1rem" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'subscription': return 'blue';
      case 'usage': return 'orange';
      case 'one_time': return 'green';
      case 'refund': return 'red';
      default: return 'gray';
    }
  };

  const filteredInvoices = invoices.filter((invoice: InvoiceData) => {
    const matchesStatus = selectedStatus === 'all' || invoice.status === selectedStatus;
    const matchesSearch = !searchQuery || 
      invoice.tenantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || 
      (selectedType === 'recurring' && invoice.description?.includes('subscription')) ||
      (selectedType === 'one-time' && !invoice.description?.includes('subscription'));
    
    return matchesStatus && matchesSearch && matchesType;
  });

  const handleBulkAction = (action: 'send' | 'retry' | 'cancel') => {
    console.log(`Bulk action: ${action} on invoices:`, selectedInvoices);
    // Implementation for bulk actions
  };

  const handleInvoiceAction = async (invoiceId: string, action: 'view' | 'send' | 'retry' | 'cancel') => {
    const invoice = invoices.find((inv: InvoiceData) => inv.id === invoiceId);
    if (!invoice) return;

    if (action === 'view') {
      setViewLoading(invoiceId);
      try {
        // Determine if manual or subscription invoice based on ID pattern
        const isManualInvoice = invoiceId.startsWith('inv-');
        
        let blob: Blob;
        if (isManualInvoice) {
          // Manual invoice - use ManualBillingService
          const result = await manualBillingService.generateInvoicePDF(invoiceId);
          if (!result.success || !result.pdfUrl) {
            setAlertMessage({ type: 'error', message: result.error || 'Failed to generate invoice PDF' });
            return;
          }
          // Fetch the blob from the URL
          const response = await fetch(result.pdfUrl);
          blob = await response.blob();
        } else {
          // Subscription invoice - use SubscriptionBillingService
          // Need tenant ID - for admin view, we may need to fetch it
          const tenantId = (invoice as any).tenantId || '';
          if (!tenantId) {
            setAlertMessage({ type: 'error', message: 'Tenant ID required for subscription invoice' });
            return;
          }
          blob = await subscriptionBillingService.downloadInvoicePdf(invoiceId, tenantId);
        }

        // Create blob URL and open in new tab
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        setAlertMessage({ type: 'success', message: 'Invoice PDF opened in new tab' });
      } catch (error) {
        setAlertMessage({ type: 'error', message: 'Failed to generate invoice PDF' });
      } finally {
        setViewLoading(null);
      }
    } else if (action === 'send') {
      setSendLoading(invoiceId);
      try {
        // Only manual invoices can be sent via ManualBillingService
        const isManualInvoice = invoiceId.startsWith('inv-');
        if (!isManualInvoice) {
          setAlertMessage({ type: 'error', message: 'Only manual invoices can be sent manually' });
          return;
        }
        const result = await manualBillingService.sendInvoice(invoiceId);
        if (result.success) {
          setAlertMessage({ type: 'success', message: 'Invoice sent successfully' });
        } else {
          setAlertMessage({ type: 'error', message: result.error || 'Failed to send invoice' });
        }
      } catch (error) {
        setAlertMessage({ type: 'error', message: 'Failed to send invoice' });
      } finally {
        setSendLoading(null);
      }
    }
  };

  const revenueGrowth = stats.lastMonthRevenue > 0 
    ? ((stats.thisMonthRevenue - stats.lastMonthRevenue) / stats.lastMonthRevenue * 100)
    : 0;

  return (
    <div>
    {/* Alert Message */}
    {alertMessage && (
      <Alert
        icon={alertMessage.type === 'success' ? <IconCheck size="1rem" /> : <IconAlertTriangle size="1rem" />}
        title={alertMessage.type === 'success' ? 'Success' : 'Error'}
        color={alertMessage.type === 'success' ? 'green' : 'red'}
        withCloseButton
        onClose={() => setAlertMessage(null)}
        mb="md"
      >
        {alertMessage.message}
      </Alert>
    )}
    <Stack gap="md">
      {/* Header Controls */}
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" align="center">
          <div>
            <Text size="lg" fw={"600"}>Invoice Management</Text>
            <Text size="sm" c="dimmed">Manage and monitor all platform invoices</Text>
          </div>
          <Group gap="sm">
            <Button
              size="sm"
              variant="outline"
              leftSection={<IconDownload size="0.875rem" />}
            >
              Export CSV
            </Button>
            <ActionIcon 
              variant="light" 
              color="blue"
              loading={isLoading}
            >
              <IconRefresh size="1rem" />
            </ActionIcon>
          </Group>
        </Group>
      </Card>

      <LoadingOverlay visible={isLoading} />

      {/* Invoice Stats */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 2 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">Total Invoices</Text>
              <Text size="xl" fw={"600"}>{stats.totalInvoices}</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 2 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">Total Amount</Text>
              <Text size="xl" fw={"600"}>{formatCurrency(stats.totalAmount)}</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 2 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">Paid Amount</Text>
              <Text size="xl" fw={"600"} c="green">{formatCurrency(stats.paidAmount)}</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 2 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">Pending Amount</Text>
              <Text size="xl" fw={"600"} c="blue">{formatCurrency(stats.pendingAmount)}</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 2 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">Failed Amount</Text>
              <Text size="xl" fw={"600"} c="red">{formatCurrency(stats.failedAmount)}</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 2 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">Overdue</Text>
              <Text size="xl" fw={"600"} c="orange">{stats.overdueCount}</Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Revenue Performance */}
      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Text size="md" fw={"600"}>Revenue Performance</Text>
          <Group justify="space-between">
            <div>
              <Text size="sm" c="dimmed">This Month</Text>
              <Text size="lg" fw={"600"}>{formatCurrency(stats.thisMonthRevenue)}</Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">Last Month</Text>
              <Text size="lg" fw={"600"}>{formatCurrency(stats.lastMonthRevenue)}</Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">Growth</Text>
              <Text size="lg" fw={"600"} c={revenueGrowth >= 0 ? 'green' : 'red'}>
                {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%
              </Text>
            </div>
          </Group>
        </Stack>
      </Card>

      {/* Filters and Search */}
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <TextInput
              placeholder="Search invoices..."
              leftSection={<IconSearch size="1rem" />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 300 }}
            />
            <Select
              size="sm"
              placeholder="Status"
              data={[
                { value: 'all', label: 'All Status' },
                { value: 'draft', label: 'Draft' },
                { value: 'pending', label: 'Pending' },
                { value: 'paid', label: 'Paid' },
                { value: 'failed', label: 'Failed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              value={selectedStatus}
              onChange={(value) => setSelectedStatus(value || '')}
            />
            <Select
              size="sm"
              placeholder="Type"
              data={[
                { value: 'all', label: 'All Types' },
                { value: 'subscription', label: 'Subscription' },
                { value: 'usage', label: 'Usage' },
                { value: 'one_time', label: 'One Time' },
                { value: 'refund', label: 'Refund' },
              ]}
              value={selectedType}
              onChange={(value) => setSelectedType(value || '')}
            />
          </Group>
          
          <Group gap="sm">
            {selectedInvoices.length > 0 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('send')}
                >
                  Send ({selectedInvoices.length})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('retry')}
                >
                  Retry ({selectedInvoices.length})
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              leftSection={<IconFilter size="0.875rem" />}
              onClick={() => setShowBulkActions(!showBulkActions)}
            >
              Bulk Actions
            </Button>
          </Group>
        </Group>
      </Card>

      {/* Invoices Table */}
      <Card withBorder padding="lg" radius="md">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              {showBulkActions && (
                <Table.Th>
                  <Checkbox
                    checked={selectedInvoices.length === filteredInvoices.length}
                    indeterminate={selectedInvoices.length > 0 && selectedInvoices.length < filteredInvoices.length}
                    onChange={(e) => {
                      if (e.currentTarget.checked) {
                        setSelectedInvoices(filteredInvoices.map((inv: InvoiceData) => inv.id));
                      } else {
                        setSelectedInvoices([]);
                      }
                    }}
                  />
                </Table.Th>
              )}
              <Table.Th>Invoice</Table.Th>
              <Table.Th>Tenant</Table.Th>
              <Table.Th>Amount</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Due Date</Table.Th>
              <Table.Th>Payment Method</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredInvoices.map((invoice: InvoiceData) => (
              <Table.Tr key={`${invoice.id}-${invoice.createdAt || invoice.created_at || 'unknown'}`}>
                {showBulkActions && (
                  <Table.Td>
                    <Checkbox
                      checked={selectedInvoices.includes(invoice.id)}
                      onChange={(e) => {
                        if (e.currentTarget.checked) {
                          setSelectedInvoices([...selectedInvoices, invoice.id]);
                        } else {
                          setSelectedInvoices(selectedInvoices.filter(id => id !== invoice.id));
                        }
                      } } />
                  </Table.Td>
                )}
                <Table.Td>
                  <Stack gap={0}>
                    <Text size="sm" fw={"500"}>{invoice.invoiceNumber || invoice.id}</Text>
                  <Text size="xs" c="dimmed">
                    Created {new Date(invoice.createdAt || invoice.created_at || '').toLocaleDateString()}
                  </Text>
                </Stack>
              </Table.Td><Table.Td>
                  <Text size="sm">{invoice.tenantName}</Text>
                </Table.Td><Table.Td>
                  <Text size="sm" fw={"600"}>{formatCurrency((invoice.amountCents || invoice.totalAmount || 0) / 100)}</Text>
                </Table.Td><Table.Td>
                  <Badge
                    size="sm"
                    color={getStatusColor(invoice.status)}
                    variant="light"
                    leftSection={getStatusIcon(invoice.status)}
                  >
                    {invoice.status}
                  </Badge>
                </Table.Td><Table.Td>
                  <Badge
                    size="sm"
                    color="blue"
                    variant="light"
                  >
                    Platform Fee
                  </Badge>
                </Table.Td><Table.Td>
                  <Text size="sm">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}</Text>
                </Table.Td><Table.Td>
                  <Text size="sm">Platform Billing</Text>
                </Table.Td><Table.Td>
                  <Group gap="xs">
                    <Tooltip label="View PDF">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={() => handleInvoiceAction(invoice.id, 'view')}
                        loading={viewLoading === invoice.id}
                      >
                        <IconEye size="0.875rem" />
                      </ActionIcon>
                    </Tooltip>
                    {invoice.status === 'pending' && (
                      <Tooltip label="Send Invoice">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          onClick={() => handleInvoiceAction(invoice.id, 'send')}
                          loading={sendLoading === invoice.id}
                        >
                          <IconSend size="0.875rem" />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {invoice.status === 'overdue' && (
                      <Tooltip label="Retry Payment">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          onClick={() => handleInvoiceAction(invoice.id, 'retry')}
                        >
                          <IconRefresh size="0.875rem" />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Invoice Detail Modal */}
      <Modal
        opened={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={`Invoice ${selectedInvoice?.invoiceNumber}`}
        size="md"
      >
        {selectedInvoice && (
          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed">Tenant</Text>
                <Text size="md" fw={"500"}>{selectedInvoice.tenantName}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Amount</Text>
                <Text size="md" fw={"600"}>{formatCurrency((selectedInvoice.amountCents || selectedInvoice.totalAmount || 0) / 100)}</Text>
              </div>
            </Group>
            
            <Divider />
            
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Status</Text>
                <Badge 
                  size="sm" 
                  color={getStatusColor(selectedInvoice.status)}
                  variant="light"
                >
                  {selectedInvoice.status}
                </Badge>
              </Group>
              
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Type</Text>
                <Badge 
                  size="sm" 
                  color="blue"
                  variant="light"
                >
                  Platform Fee
                </Badge>
              </Group>
              
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Created</Text>
                <Text size="sm">{new Date(selectedInvoice.createdAt).toLocaleDateString()}</Text>
              </Group>
              
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Due Date</Text>
                <Text size="sm">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</Text>
              </Group>
              
              {selectedInvoice.paidAt && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Paid Date</Text>
                  <Text size="sm">{new Date(selectedInvoice.paidAt).toLocaleDateString()}</Text>
                </Group>
              )}
              
              </Stack>
            
            <Divider />
            
            <div>
              <Text size="sm" c="dimmed" mb="xs">Fees Breakdown</Text>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="xs">Platform Fees</Text>
                  <Text size="xs" fw={500}>{formatCurrency(selectedInvoice.fees?.platformFees || 0)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs">Processing Fees</Text>
                  <Text size="xs" fw={500}>{formatCurrency(selectedInvoice.fees?.processingFees || 0)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs">Other Fees</Text>
                  <Text size="xs" fw={500}>{formatCurrency(selectedInvoice.fees?.otherFees || 0)}</Text>
                </Group>
              </Stack>
            </div>
            
            <Group gap="sm" justify="flex-end">
              <Button
                size="sm"
                variant="outline"
                leftSection={<IconDownload size="0.875rem" />}
              >
                Download PDF
              </Button>
              {selectedInvoice.status === 'pending' && (
                <Button
                  size="sm"
                  leftSection={<IconSend size="0.875rem" />}
                >
                  Send Reminder
                </Button>
              )}
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
    </div>
  );
}

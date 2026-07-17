'use client';

import { useState, useEffect } from 'react';
import { Card, Badge, Button, Group, Text, Stack, Alert, Loader, Table, Pagination, Select, Modal } from '@mantine/core';
import { 
  IconFileDescription, 
  IconDownload, 
  IconCalendar,
  IconRefresh,
  IconEye,
  IconFilter,
  IconAlertTriangle
} from '@tabler/icons-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { tenantBillingService } from '@/services/TenantBillingService';
import { clientLogger } from '@/lib/client-logger';

interface BillingStatement {
  id: string;
  period: string;
  startDate: Date;
  endDate: Date;
  totalAmount: number;
  subscriptionAmount: number;
  platformFees: number;
  transactionFees: number;
  status: 'draft' | 'available' | 'paid';
  generatedAt: Date;
  paidAt?: Date | null;
  downloadUrl?: string;
}

export default function BillingStatementsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string>('');
  const [statements, setStatements] = useState<BillingStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStatement, setSelectedStatement] = useState<BillingStatement | null>(null);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    const resolveTenantId = async () => {
      const resolvedParams = await params;
      setTenantId(resolvedParams.tenantId);
    };
    resolveTenantId();
  }, [params]);

  useEffect(() => {
    if (tenantId) {
      loadStatements();
    }
  }, [tenantId, yearFilter, statusFilter]);

  const loadStatements = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tenantBillingService.getBillingStatements(tenantId, 100);
      setStatements(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load statements');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'green';
      case 'draft': return 'gray';
      case 'paid': return 'blue';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return '✅';
      case 'draft': return '📝';
      case 'paid': return '💳';
      default: return '📄';
    }
  };

  const filteredStatements = (statements || []).filter(statement => {
    const yearMatch = yearFilter === 'all' || 
      new Date(statement.startDate).getFullYear().toString() === yearFilter;
    const statusMatch = statusFilter === 'all' || statement.status === statusFilter;
    return yearMatch && statusMatch;
  });

  const totalPages = Math.ceil(filteredStatements.length / ITEMS_PER_PAGE);
  const paginatedStatements = filteredStatements.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleViewStatement = (statement: BillingStatement) => {
    setSelectedStatement(statement);
    setShowStatementModal(true);
  };

  const handleDownloadStatement = async (statement: BillingStatement) => {
    try {
      const blob = await tenantBillingService.downloadStatement(tenantId, statement.id);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Generate clean filename
      const dateStr = new Date().toISOString().split('T')[0];
      const safePeriod = statement.period.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const shortId = statement.id.substring(0, 8);
      a.download = `statement-${safePeriod}-${dateStr}-${shortId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      clientLogger.error('Error downloading statement:', { detail: error });
      setError('Failed to download statement PDF');
    }
  };

  const getAvailableYears = () => {
    const years = new Set(statements.map(s => new Date(s.startDate).getFullYear()));
    return Array.from(years).sort((a, b) => b - a).map(year => ({
      value: year.toString(),
      label: year.toString()
    }));
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
        <Alert color="red" icon={<IconAlertTriangle />}>
          {error}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing Statements"
        description="Download and view your monthly billing statements"
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
            label="Year"
            value={yearFilter}
            onChange={(value) => setYearFilter(value || 'all')}
            data={[
              { value: 'all', label: 'All Years' },
              ...getAvailableYears()
            ]}
            w={120}
          />
          
          <Select
            label="Status"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || 'all')}
            data={[
              { value: 'all', label: 'All Status' },
              { value: 'available', label: 'Available' },
              { value: 'draft', label: 'Draft' },
              { value: 'paid', label: 'Paid' }
            ]}
            w={120}
          />

          <Button
            variant="outline"
            leftSection={<IconRefresh size="1rem" />}
            onClick={loadStatements}
            ml="auto"
          >
            Refresh
          </Button>
        </Group>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-center">
            <Text size="xs" c="dimmed">Total Statements</Text>
            <Text size="lg" fw={500}>{statements.length}</Text>
          </div>
        </Card>
        
        <Card>
          <div className="text-center">
            <Text size="xs" c="dimmed">Available</Text>
            <Text size="lg" fw={500} c="green">
              {statements.filter(s => s.status === 'available').length}
            </Text>
          </div>
        </Card>
        
        <Card>
          <div className="text-center">
            <Text size="xs" c="dimmed">Paid</Text>
            <Text size="lg" fw={500} c="blue">
              {statements.filter(s => s.status === 'paid').length}
            </Text>
          </div>
        </Card>
        
        <Card>
          <div className="text-center">
            <Text size="xs" c="dimmed">Total Billed</Text>
            <Text size="lg" fw={500}>
              {formatCurrency(statements.reduce((sum, s) => sum + s.totalAmount, 0))}
            </Text>
          </div>
        </Card>
      </div>

      {/* Statements Table */}
      <Card>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Period</Table.Th>
              <Table.Th>Amount</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Generated</Table.Th>
              <Table.Th>Paid On</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {paginatedStatements.map((statement) => (
              <Table.Tr key={statement.id}>
                <Table.Td>
                  <Group>
                    <IconFileDescription size="1rem" />
                    <div>
                      <Text fw={500}>{statement.period}</Text>
                      <Text size="sm" c="dimmed">
                        {formatDate(statement.startDate)} - {formatDate(statement.endDate)}
                      </Text>
                    </div>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text fw={500}>{formatCurrency(statement.totalAmount)}</Text>
                  <Text size="sm" c="dimmed">
                    Sub: {formatCurrency(statement.subscriptionAmount)} | 
                    Fees: {formatCurrency(statement.platformFees + statement.transactionFees)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={getStatusColor(statement.status)}
                    variant="light"
                    leftSection={getStatusIcon(statement.status)}
                  >
                    {statement.status.toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatDate(statement.generatedAt)}</Text>
                </Table.Td>
                <Table.Td>
                  {statement.paidAt ? (
                    <Badge color="green" variant="light" size="sm">
                      {formatDate(statement.paidAt)}
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">-</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button
                      variant="outline"
                      size="sm"
                      leftSection={<IconEye size="1rem" />}
                      onClick={() => handleViewStatement(statement)}
                    >
                      View
                    </Button>
                    
                    <Button
                      variant="subtle"
                      size="sm"
                      leftSection={<IconDownload size="1rem" />}
                      onClick={() => handleDownloadStatement(statement)}
                      disabled={statement.status === 'draft'}
                    >
                      PDF
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

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

      {/* Statement Details Modal */}
      <Modal
        opened={showStatementModal}
        onClose={() => setShowStatementModal(false)}
        title={selectedStatement ? `Statement: ${selectedStatement.period}` : 'Statement Details'}
        size="md"
      >
        {selectedStatement && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text size="sm" c="dimmed">Period</Text>
                <Text fw={500}>{selectedStatement.period}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Status</Text>
                <Badge
                  color={getStatusColor(selectedStatement.status)}
                  variant="light"
                  leftSection={getStatusIcon(selectedStatement.status)}
                >
                  {selectedStatement.status.toUpperCase()}
                </Badge>
              </div>
              <div>
                <Text size="sm" c="dimmed">Total Amount</Text>
                <Text fw={500}>{formatCurrency(selectedStatement.totalAmount)}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Generated</Text>
                <Text>{formatDate(selectedStatement.generatedAt)}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Paid On</Text>
                {selectedStatement.paidAt ? (
                  <Badge color="green" variant="light" size="sm">
                    {formatDate(selectedStatement.paidAt)}
                  </Badge>
                ) : (
                  <Text c="dimmed">-</Text>
                )}
              </div>
            </div>
            
            <div>
              <Text size="sm" c="dimmed">Billing Period</Text>
              <Text>
                {formatDate(selectedStatement.startDate)} - {formatDate(selectedStatement.endDate)}
              </Text>
            </div>
            
            <div>
              <Text size="sm" c="dimmed" mb="sm">Breakdown</Text>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Text>Subscription Fees</Text>
                  <Text>{formatCurrency(selectedStatement.subscriptionAmount)}</Text>
                </div>
                <div className="flex justify-between">
                  <Text>Platform Fees</Text>
                  <Text>{formatCurrency(selectedStatement.platformFees)}</Text>
                </div>
                <div className="flex justify-between">
                  <Text>Transaction Fees</Text>
                  <Text>{formatCurrency(selectedStatement.transactionFees)}</Text>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <Text>Total</Text>
                  <Text>{formatCurrency(selectedStatement.totalAmount)}</Text>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Information Card */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">About Billing Statements</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            Billing statements are generated monthly and provide a comprehensive summary of all charges 
            for the billing period, including subscription fees, platform fees, and transaction fees.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Text fw={500} c="blue" mb="1">Available</Text>
              <Text size="sm">Statement is ready for download and payment</Text>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <Text fw={500} c="gray" mb="1">Draft</Text>
              <Text size="sm">Statement is being prepared</Text>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <Text fw={500} c="green" mb="1">Paid</Text>
              <Text size="sm">Statement has been paid</Text>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

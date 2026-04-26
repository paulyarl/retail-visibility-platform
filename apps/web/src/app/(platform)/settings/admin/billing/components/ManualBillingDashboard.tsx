'use client';

import { 
  Card, 
  Text, 
  Group, 
  Badge, 
  Stack, 
  Grid, 
  Progress,
  Title,
  Divider,
  Table,
  LoadingOverlay,
  Alert,
  Button
} from '@mantine/core';
import { 
  IconFileInvoice,
  IconCurrencyDollar,
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconX,
  IconEye,
  IconSend,
  IconEdit
} from '@tabler/icons-react';
import { ServiceCharge, ManualInvoice } from '@/services/ManualBillingService';

// Define interfaces that match the service return types
export interface ManualBillingInvoice {
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

interface ManualBillingDashboardProps {
  manualBillingInvoices?: ManualBillingInvoice[];
  manualInvoices?: ManualInvoice[];
  serviceCharges?: ServiceCharge[];
  isLoading?: boolean;
}

export function ManualBillingDashboard({ 
  manualBillingInvoices, 
  manualInvoices, 
  serviceCharges,
  isLoading = false 
}: ManualBillingDashboardProps) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'green';
      case 'pending': return 'yellow';
      case 'cancelled': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <IconCheck size="1rem" color="green" />;
      case 'pending': return <IconClock size="1rem" color="yellow" />;
      case 'cancelled': return <IconX size="1rem" color="red" />;
      default: return <IconClock size="1rem" color="gray" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'professional': return 'blue';
      case 'commitment': return 'green';
      case 'storefront': return 'orange';
      case 'trial_discovery':
      case 'trial_commitment': return 'purple';
      case 'discovery': return 'gray';
      default: return 'gray';
    }
  };

  // Calculate summary stats
  const allInvoices = [...(manualBillingInvoices || []), ...(manualInvoices || [])];
  const totalInvoices = allInvoices.length;
  const paidInvoices = allInvoices.filter(inv => inv.status === 'paid').length;
  const pendingInvoices = allInvoices.filter(inv => inv.status === 'pending').length;
  const cancelledInvoices = allInvoices.filter(inv => inv.status === 'cancelled').length;
  const totalAmount = allInvoices.reduce((sum, inv) => sum + inv.amountCents, 0);
  const paidAmount = allInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amountCents, 0);
  const pendingAmount = allInvoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.amountCents, 0);

  return (
    <Stack gap="md">
      {/* Summary Cards */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconFileInvoice size="1.2rem" color="blue" />
                <Text size="xs" c="dimmed">Total Invoices</Text>
              </Group>
              <Text size="xl" fw={600}>
                {totalInvoices}
              </Text>
              <Text size="xs" c="dimmed">
                {paidInvoices} paid, {pendingInvoices} pending
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconCurrencyDollar size="1.2rem" color="green" />
                <Text size="xs" c="dimmed">Total Amount</Text>
              </Group>
              <Text size="xl" fw={600} c="green">
                {formatCurrency(totalAmount)}
              </Text>
              <Text size="xs" c="dimmed">
                {formatCurrency(paidAmount)} collected
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconClock size="1.2rem" color="yellow" />
                <Text size="xs" c="dimmed">Pending Amount</Text>
              </Group>
              <Text size="xl" fw={600} c="yellow">
                {formatCurrency(pendingAmount)}
              </Text>
              <Text size="xs" c="dimmed">
                {pendingInvoices} invoices
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconAlertTriangle size="1.2rem" color="orange" />
                <Text size="xs" c="dimmed">Service Charges</Text>
              </Group>
              <Text size="xl" fw={600} c="orange">
                {serviceCharges?.length || 0}
              </Text>
              <Text size="xs" c="dimmed">
                {formatCurrency(serviceCharges?.reduce((sum, charge) => sum + charge.amountCents, 0) || 0)}
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Invoice Status Progress */}
      <Card withBorder padding="lg" radius="md">
        <Title order={3} mb="md">Invoice Status Overview</Title>
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="sm">Paid</Text>
            <Text size="sm" fw={600}>
              {paidInvoices} ({totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0}%)
            </Text>
          </Group>
          <Progress 
            value={totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0} 
            color="green" 
          />

          <Group justify="space-between">
            <Text size="sm">Pending</Text>
            <Text size="sm" fw={600}>
              {pendingInvoices} ({totalInvoices > 0 ? Math.round((pendingInvoices / totalInvoices) * 100) : 0}%)
            </Text>
          </Group>
          <Progress 
            value={totalInvoices > 0 ? (pendingInvoices / totalInvoices) * 100 : 0} 
            color="yellow" 
          />

          <Group justify="space-between">
            <Text size="sm">Cancelled</Text>
            <Text size="sm" fw={600}>
              {cancelledInvoices} ({totalInvoices > 0 ? Math.round((cancelledInvoices / totalInvoices) * 100) : 0}%)
            </Text>
          </Group>
          <Progress 
            value={totalInvoices > 0 ? (cancelledInvoices / totalInvoices) * 100 : 0} 
            color="red" 
          />
        </Stack>
      </Card>

      {/* Service Charges */}
      {serviceCharges && serviceCharges.length > 0 && (
        <Card withBorder padding="lg" radius="md">
          <Title order={3} mb="md">Recent Service Charges</Title>
          
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tenant</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Applied</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {serviceCharges.slice(0, 5).map((charge) => (
                <Table.Tr key={charge.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{charge.tenantName}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" color="orange" variant="light">
                      {charge.chargeType.replace('_', ' ')}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{charge.description}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {formatCurrency(charge.amountCents)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(charge.appliedAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {charge.invoiceId ? (
                        <Badge size="sm" color="green" variant="light">
                          Invoiced
                        </Badge>
                      ) : (
                        <Badge size="sm" color="yellow" variant="light">
                          Pending
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* Recent Manual Invoices */}
      <Card withBorder padding="lg" radius="md">
        <LoadingOverlay visible={isLoading} />
        <Title order={3} mb="md">Recent Manual Invoices</Title>
        
        {manualInvoices && manualInvoices.length > 0 ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Invoice ID</Table.Th>
                <Table.Th>Tenant</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {manualInvoices.slice(0, 10).map((invoice) => (
                <Table.Tr key={invoice.id}>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {invoice.id.slice(0, 12)}...
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>{invoice.tenantName}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{invoice.description}</Text>
                    {invoice.paymentInstructions && (
                      <Text size="xs" c="dimmed" mt={2}>
                        {invoice.paymentInstructions}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {formatCurrency(invoice.amountCents)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {getStatusIcon(invoice.status)}
                      <Badge 
                        size="sm" 
                        color={getStatusColor(invoice.status)}
                        variant="light"
                      >
                        {invoice.status}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" variant="subtle">
                        <IconEye size="0.875rem" />
                      </Button>
                      {invoice.status === 'pending' && (
                        <Button size="xs" variant="subtle">
                          <IconSend size="0.875rem" />
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No manual invoices found
          </Text>
        )}
      </Card>

      {/* Manual Billing Invoices */}
      {manualBillingInvoices && manualBillingInvoices.length > 0 && (
        <Card withBorder padding="lg" radius="md">
          <Title order={3} mb="md">All Billing Invoices</Title>
          
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tenant</Table.Th>
                <Table.Th>Tier</Table.Th>
                <Table.Th>Billing Period</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Manual</Table.Th>
                <Table.Th>Due Date</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {manualBillingInvoices.slice(0, 10).map((invoice) => (
                <Table.Tr key={invoice.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{invoice.tenantName}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge 
                      size="sm" 
                      color={getTierColor(invoice.tier)}
                      variant="light"
                    >
                      {invoice.tier}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(invoice.billingPeriodStart).toLocaleDateString()} - {new Date(invoice.billingPeriodEnd).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {formatCurrency(invoice.amountCents)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {getStatusIcon(invoice.status)}
                      <Badge 
                        size="sm" 
                        color={getStatusColor(invoice.status)}
                        variant="light"
                      >
                        {invoice.status}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge 
                      size="sm" 
                      color={invoice.isManual ? 'orange' : 'blue'}
                      variant="light"
                    >
                      {invoice.isManual ? 'Manual' : 'Auto'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* Risk Alerts */}
      {pendingInvoices > 0 && (
        <Alert color="yellow" icon={<IconAlertTriangle size="1rem" />}>
          <Text size="sm" fw={500}>
            {pendingInvoices} pending invoices requiring attention
          </Text>
          <Text size="xs" c="dimmed" mt={2}>
            Total pending amount: {formatCurrency(pendingAmount)}
          </Text>
        </Alert>
      )}
    </Stack>
  );
}

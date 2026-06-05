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
  LoadingOverlay
} from '@mantine/core';
import { 
  IconTrendingUp,
  IconTrendingDown,
  IconCurrencyDollar,
  IconCreditCard,
  IconReceipt,
  IconClock,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import { RevenueSummary, PlatformRevenueTransaction } from '@/services/PlatformRevenueService';

interface PaymentAnalyticsProps {
  revenueSummary?: RevenueSummary;
  revenueTransactions?: PlatformRevenueTransaction[];
  isLoading?: boolean;
}

export function PaymentAnalyticsReal({ 
  revenueSummary, 
  revenueTransactions, 
  isLoading = false 
}: PaymentAnalyticsProps) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'pending': return 'yellow';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <IconCheck size="1rem" color="green" />;
      case 'pending': return <IconClock size="1rem" color="yellow" />;
      case 'failed': return <IconX size="1rem" color="red" />;
      default: return <IconClock size="1rem" color="gray" />;
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'subscription': return 'blue';
      case 'transaction_fee': return 'orange';
      case 'deposit_forfeit': return 'red';
      case 'payout': return 'purple';
      default: return 'gray';
    }
  };

  return (
    <Stack gap="md">
      {/* Revenue Summary Cards */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconCurrencyDollar size="1.2rem" color="blue" />
                <Text size="xs" c="dimmed">Gross Volume</Text>
              </Group>
              <Text size="xl" fw={600}>
                {revenueSummary ? formatCurrency(revenueSummary.gross_volume_cents) : '$0.00'}
              </Text>
              {revenueSummary && (
                <Text size="xs" c="dimmed">
                  {revenueSummary.total_transactions} transactions
                </Text>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconTrendingUp size="1.2rem" color="green" />
                <Text size="xs" c="dimmed">Platform Revenue</Text>
              </Group>
              <Text size="xl" fw={600} c="green">
                {revenueSummary ? formatCurrency(revenueSummary.platform_revenue_cents) : '$0.00'}
              </Text>
              {revenueSummary && (
                <Text size="xs" c="dimmed">
                  {((revenueSummary.platform_revenue_cents / revenueSummary.gross_volume_cents) * 100).toFixed(1)}% of gross
                </Text>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconCreditCard size="1.2rem" color="orange" />
                <Text size="xs" c="dimmed">Gateway Fees</Text>
              </Group>
              <Text size="xl" fw={600} c="orange">
                {revenueSummary ? formatCurrency(revenueSummary.gateway_fees_cents) : '$0.00'}
              </Text>
              {revenueSummary && (
                <Text size="xs" c="dimmed">
                  {((revenueSummary.gateway_fees_cents / revenueSummary.gross_volume_cents) * 100).toFixed(1)}% of gross
                </Text>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconReceipt size="1.2rem" color="blue" />
                <Text size="xs" c="dimmed">Net to Merchants</Text>
              </Group>
              <Text size="xl" fw={600} c="blue">
                {revenueSummary ? formatCurrency(revenueSummary.net_to_merchants_cents) : '$0.00'}
              </Text>
              {revenueSummary && (
                <Text size="xs" c="dimmed">
                  {((revenueSummary.net_to_merchants_cents / revenueSummary.gross_volume_cents) * 100).toFixed(1)}% of gross
                </Text>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Revenue by Type */}
      {revenueSummary && revenueSummary.by_type && (
        <Card withBorder padding="lg" radius="md">
          <Title order={3} mb="md">Revenue by Type</Title>
          <Stack gap="md">
            <Group justify="space-between">
              <Text size="sm">Subscriptions</Text>
              <Text size="sm" fw={600}>
                {formatCurrency(revenueSummary.by_type.subscriptions)}
              </Text>
            </Group>
            <Progress 
              value={revenueSummary.platform_revenue_cents > 0 ? (revenueSummary.by_type.subscriptions / revenueSummary.platform_revenue_cents) * 100 : 0} 
              color="blue" 
            />

            <Group justify="space-between">
              <Text size="sm">Transaction Fees</Text>
              <Text size="sm" fw={600}>
                {formatCurrency(revenueSummary.by_type.transaction_fees)}
              </Text>
            </Group>
            <Progress 
              value={revenueSummary.platform_revenue_cents > 0 && revenueSummary.by_type.transaction_fees > 0 ? (revenueSummary.by_type.transaction_fees / revenueSummary.platform_revenue_cents) * 100 : 0} 
              color="orange" 
            />

            <Group justify="space-between">
              <Text size="sm">Deposit Forfeits</Text>
              <Text size="sm" fw={600}>
                {formatCurrency(revenueSummary.by_type.deposit_forfeits)}
              </Text>
            </Group>
            <Progress 
              value={revenueSummary.platform_revenue_cents > 0 && revenueSummary.by_type.deposit_forfeits > 0 ? (revenueSummary.by_type.deposit_forfeits / revenueSummary.platform_revenue_cents) * 100 : 0} 
              color="red" 
            />
          </Stack>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card withBorder padding="lg" radius="md">
        <LoadingOverlay visible={isLoading} />
        <Title order={3} mb="md">Recent Transactions</Title>
        
        {revenueTransactions && revenueTransactions.length > 0 ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Tenant ID</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Gross</Table.Th>
                <Table.Th>Platform Fee</Table.Th>
                <Table.Th>Gateway Fee</Table.Th>
                <Table.Th>Net</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {revenueTransactions.slice(0, 10).map((transaction) => (
                <Table.Tr key={transaction.id}>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {transaction.tenant_id ? transaction.tenant_id.slice(0, 8) + '...' : 'N/A'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge 
                      size="sm" 
                      color={getTransactionTypeColor(transaction.transaction_type)}
                      variant="light"
                    >
                      {transaction.transaction_type.replace('_', ' ')}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {formatCurrency(transaction.gross_amount_cents)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="green">
                      {formatCurrency(transaction.platform_fee_cents)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="orange">
                      {formatCurrency(transaction.gateway_fee_cents)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {formatCurrency(transaction.net_amount_cents)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {getStatusIcon(transaction.status)}
                      <Badge 
                        size="sm" 
                        color={getStatusColor(transaction.status)}
                        variant="light"
                      >
                        {transaction.status}
                      </Badge>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No transactions found
          </Text>
        )}
      </Card>
    </Stack>
  );
}

import { useQuery } from '@tanstack/react-query';
import { adminBillingService } from '@/services/AdminBillingService';
import { platformRevenueService } from '@/services/PlatformRevenueService';
import { manualBillingService } from '@/services/ManualBillingService';

export function useAdminBillingData(period: string = '90d') {
  const { data: revenueOverview, isLoading: revenueLoading, error: revenueError } = useQuery({
    queryKey: ['admin-revenue-overview', period],
    queryFn: () => adminBillingService.getRevenueOverview(period),
    refetchInterval: 300000, // Refresh every 5 minutes
    staleTime: 60000, // Consider data stale after 1 minute
  });

  const { data: revenueTrends, isLoading: trendsLoading, error: trendsError } = useQuery({
    queryKey: ['admin-revenue-trends', period],
    queryFn: () => adminBillingService.getRevenueTrends(period),
    refetchInterval: 300000,
    staleTime: 60000,
  });

  const { data: revenueSummary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['admin-revenue-summary', period],
    queryFn: () => platformRevenueService.getRevenueSummary(period as '7d' | '30d' | '90d' | '1y'),
    refetchInterval: 300000,
    staleTime: 60000,
  });

  const { data: revenueTransactions, isLoading: transactionsLoading, error: transactionsError } = useQuery({
    queryKey: ['admin-revenue-transactions'],
    queryFn: () => platformRevenueService.getRevenueTransactions(),
    refetchInterval: 300000,
    staleTime: 60000,
  });

  const { data: manualBillingInvoices, isLoading: manualBillingLoading, error: manualBillingError } = useQuery({
    queryKey: ['admin-manual-billing-invoices'],
    queryFn: () => manualBillingService.getAllInvoices(),
    refetchInterval: 300000,
    staleTime: 60000,
  });

  const { data: manualInvoices, isLoading: manualInvoicesLoading, error: manualInvoicesError } = useQuery({
    queryKey: ['admin-manual-invoices'],
    queryFn: () => manualBillingService.getAllManualInvoices(),
    refetchInterval: 300000,
    staleTime: 60000,
  });

  const { data: serviceCharges, isLoading: serviceChargesLoading, error: serviceChargesError } = useQuery({
    queryKey: ['admin-service-charges'],
    queryFn: () => manualBillingService.getAllServiceCharges(),
    refetchInterval: 300000,
    staleTime: 60000,
  });

  return {
    revenueOverview,
    revenueTrends,
    revenueSummary,
    revenueTransactions,
    manualBillingInvoices,
    manualInvoices,
    serviceCharges,
    isLoading: revenueLoading || trendsLoading || summaryLoading || transactionsLoading || manualBillingLoading || manualInvoicesLoading || serviceChargesLoading,
    error: revenueError || trendsError || summaryError || transactionsError || manualBillingError || manualInvoicesError || serviceChargesError,
    refetch: () => {
      // Refetch all queries
    }
  };
}

export function useTenantFinancialData(tenantId: string | null) {
  const {
    data: financialMetrics,
    isLoading: financialLoading,
    error: financialError,
    refetch: refetchFinancial
  } = useQuery({
    queryKey: ['admin-tenant-financial', tenantId],
    queryFn: () => tenantId ? adminBillingService.getTenantFinancialMetrics(tenantId) : null,
    enabled: !!tenantId,
    refetchInterval: 300000, // Refresh every 5 minutes
    staleTime: 60000, // Consider data stale after 1 minute
  });

  const {
    data: accountHealth,
    isLoading: healthLoading,
    error: healthError,
    refetch: refetchHealth
  } = useQuery({
    queryKey: ['admin-tenant-health', tenantId],
    queryFn: () => tenantId ? adminBillingService.getTenantAccountHealth(tenantId) : null,
    enabled: !!tenantId,
    refetchInterval: 300000, // Refresh every 5 minutes
    staleTime: 60000, // Consider data stale after 1 minute
  });

  const {
    data: paymentHistory,
    isLoading: paymentsLoading,
    error: paymentsError,
    refetch: refetchPayments
  } = useQuery({
    queryKey: ['admin-tenant-payments', tenantId],
    queryFn: () => tenantId ? adminBillingService.getTenantPaymentHistory(tenantId) : null,
    enabled: !!tenantId,
    refetchInterval: 300000, // Refresh every 5 minutes
    staleTime: 60000, // Consider data stale after 1 minute
  });

  return {
    financialMetrics,
    accountHealth,
    paymentHistory,
    isLoading: financialLoading || healthLoading || paymentsLoading,
    error: financialError || healthError || paymentsError,
    refetch: () => {
      refetchFinancial();
      refetchHealth();
      refetchPayments();
    }
  };
}

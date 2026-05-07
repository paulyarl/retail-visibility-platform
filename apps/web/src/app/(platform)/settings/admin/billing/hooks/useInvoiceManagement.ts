import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminBillingService } from '@/services/AdminBillingService';

export function useInvoiceManagement(filters: {
  status?: string;
  tenantId?: string;
  periodStart?: string;
  periodEnd?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const queryClient = useQueryClient();

  const {
    data: invoicesData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['admin-invoices', filters],
    queryFn: () => adminBillingService.getPlatformInvoices(filters),
    refetchInterval: 300000, // Refresh every 5 minutes
    staleTime: 60000, // Consider data stale after 1 minute
  });

  const generatePdfMutation = useMutation({
    mutationFn: (invoiceId: string) => adminBillingService.generateInvoicePdf(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
    }
  });

  const sendReminderMutation = useMutation({
    mutationFn: ({ invoiceId, options }: { invoiceId: string; options: any }) => 
      adminBillingService.sendInvoiceReminder(invoiceId, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
    }
  });

  const waiveFeesMutation = useMutation({
    mutationFn: ({ invoiceId, options }: { invoiceId: string; options: any }) => 
      adminBillingService.waiveInvoiceFees(invoiceId, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
    }
  });

  return {
    invoices: invoicesData?.invoices || [],
    total: invoicesData?.total || 0,
    pagination: invoicesData?.pagination,
    isLoading,
    error,
    refetch,
    generatePdf: generatePdfMutation,
    sendReminder: sendReminderMutation,
    waiveFees: waiveFeesMutation
  };
}

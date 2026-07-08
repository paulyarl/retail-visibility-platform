'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { CrmAlert } from '@/types/crm';

/**
 * Lightweight component that polls for CRM alerts across all tenant-scoped pages
 * and fires toast notifications when new alerts arrive.
 *
 * Mounted once in the tenant layout so toasts appear on any /t/[tenantId]/* page,
 * not just the dashboard.
 */
export default function CrmAlertToastWatcher({ tenantId }: { tenantId: string }) {
  const { user } = useAuth();
  const prevAlertIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  const { data: alerts } = useQuery<CrmAlert[]>({
    queryKey: ['crm', 'alerts', tenantId, 'toast-watcher'],
    queryFn: () => crmTenantCrmService.listAlerts(),
    enabled: !!user && !!tenantId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    retry: 0,
    throwOnError: false,
  });

  useEffect(() => {
    if (!alerts) return;

    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      prevAlertIdsRef.current = new Set(alerts.map(a => a.id));
      return;
    }

    const prevIds = prevAlertIdsRef.current;
    const newAlerts = alerts.filter(a => !prevIds.has(a.id));

    for (const alert of newAlerts) {
      toast({
        title: alert.title,
        description: alert.body || 'New alert',
        variant: alert.type === 'warning' ? 'warning' : 'info',
        duration: 30000,
      });
    }

    if (newAlerts.length > 0) {
      prevAlertIdsRef.current = new Set(alerts.map(a => a.id));
    }
  }, [alerts]);

  return null;
}

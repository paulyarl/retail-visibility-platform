import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

export interface FlyerReportTenant {
  id: string;
  name: string | null;
  slug: string | null;
}

export interface FlyerReportEntry {
  id: string;
  reason: string;
  detail: string | null;
  status: 'open' | 'actioned' | 'dismissed' | string;
  createdAt: string;
  flyer: {
    id: string;
    title: string;
    status: string;
    shareCode: string | null;
    heroImageUrl: string | null;
    startsAt: string;
    endsAt: string;
    impressions: number;
    clicks: number;
    tenant: FlyerReportTenant | null;
  } | null;
}

export interface FlyerReportsResponse {
  reports: FlyerReportEntry[];
  counts: Record<string, number>;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

class AdminFlyerReportService extends AdminApiSingleton {
  private static instance: AdminFlyerReportService;

  private constructor() {
    super('admin-flyer-report-service');
  }

  static getInstance(): AdminFlyerReportService {
    if (!AdminFlyerReportService.instance) AdminFlyerReportService.instance = new AdminFlyerReportService();
    return AdminFlyerReportService.instance;
  }

  async listReports(status = 'open'): Promise<FlyerReportsResponse> {
    const result = await this.makeDefaultRequest<ApiEnvelope<FlyerReportsResponse>>(
      `/api/admin/flyer-reports?status=${encodeURIComponent(status)}`,
      {},
      `admin-flyer-reports-${status}`,
      0,
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data.data;
  }

  async resolveReport(reportId: string, action: 'suppress' | 'dismiss'): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<null>>(
      `/api/admin/flyer-reports/${reportId}/resolve`,
      { method: 'POST', body: JSON.stringify({ action }) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
  }

  async restoreFlyer(flyerId: string): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<null>>(
      `/api/admin/flyer-reports/flyers/${flyerId}/restore`,
      { method: 'POST' },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
  }
}

export const adminFlyerReportService = AdminFlyerReportService.getInstance();
export default AdminFlyerReportService;

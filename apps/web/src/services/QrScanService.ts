import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface QrScanResult {
  tenantId: string;
  tenantName: string;
  subdomain: string | null;
  slug: string | null;
  isDemo: boolean;
}

class QrScanService extends PublicApiSingleton {
  private static instance: QrScanService;

  private constructor() {
    super('qr-scan', { ttl: 0 });
  }

  public static getInstance(): QrScanService {
    if (!QrScanService.instance) {
      QrScanService.instance = new QrScanService();
    }
    return QrScanService.instance;
  }

  async trackScan(
    tenantId: string,
    payload: { source: string; referrer: string | null; userAgent: string }
  ): Promise<QrScanResult | null> {
    const result = await this.makeDefaultRequest<QrScanResult>(
      `/api/public/qr/${encodeURIComponent(tenantId)}/scan`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    return (result as any)?.data ?? null;
  }
}

export const qrScanService = QrScanService.getInstance();
export default qrScanService;

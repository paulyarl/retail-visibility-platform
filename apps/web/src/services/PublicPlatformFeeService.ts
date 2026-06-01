import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

interface PlatformFeeResponse {
  success: boolean;
  platformFeePercentage: number;
}

class PublicPlatformFeeService extends PublicApiSingleton {
  private static instance: PublicPlatformFeeService;

  private constructor() {
    super('public-platform-fee-service');
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes cache
  }

  public static getInstance(): PublicPlatformFeeService {
    if (!PublicPlatformFeeService.instance) {
      PublicPlatformFeeService.instance = new PublicPlatformFeeService();
    }
    return PublicPlatformFeeService.instance;
  }

  /**
   * Get current platform fee percentage from public API
   */
  async getPlatformFeePercentage(): Promise<number> {
    try {
      const response = await this.makeDefaultRequest(
        '/api/public/platform-fee',
        {},
        'platform-fee',
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[PublicPlatformFeeService] Failed to fetch platform fee:', response.error);
        return 3.0; // Default fallback
      }

      const data = response.data as PlatformFeeResponse;
      if (data && typeof data.platformFeePercentage === 'number') {
        return data.platformFeePercentage;
      }

      return 3.0; // Default fallback
    } catch (error) {
      console.error('[PublicPlatformFeeService] Error fetching platform fee:', error);
      return 3.0; // Default fallback
    }
  }
}

// Export singleton instance
export const publicPlatformFeeService = PublicPlatformFeeService.getInstance();

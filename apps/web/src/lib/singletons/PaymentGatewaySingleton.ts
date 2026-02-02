/**
 * Payment Gateway Singleton
 * 
 * Manages payment gateway data with automatic caching.
 * Provides tenant-specific gateway information with 5-minute cache TTL.
 */

interface PaymentGateway {
  id: string;
  type: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  config?: any;
}

interface PaymentGatewayState {
  gateways: PaymentGateway[];
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
}

class PaymentGatewaySingleton {
  private static instances: Map<string, PaymentGatewaySingleton> = new Map();
  private state: PaymentGatewayState;
  private listeners: Set<() => void> = new Set();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

  private constructor(private tenantId: string) {
    this.state = {
      gateways: [],
      loading: false,
      error: null,
      lastFetch: null
    };
  }

  static getInstance(tenantId: string): PaymentGatewaySingleton {
    if (!PaymentGatewaySingleton.instances.has(tenantId)) {
      PaymentGatewaySingleton.instances.set(tenantId, new PaymentGatewaySingleton(tenantId));
    }
    return PaymentGatewaySingleton.instances.get(tenantId)!;
  }

  static destroyInstance(tenantId: string): void {
    PaymentGatewaySingleton.instances.delete(tenantId);
  }

  private setState(updates: Partial<PaymentGatewayState>) {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): PaymentGatewayState {
    return this.state;
  }

  async fetchGateways(forceRefresh = false): Promise<PaymentGateway[]> {
    // Check cache first
    if (!forceRefresh && this.state.lastFetch) {
      const cacheAge = Date.now() - this.state.lastFetch;
      if (cacheAge < this.CACHE_TTL) {
        console.log(`PaymentGatewaySingleton: Using cached gateways for tenant ${this.tenantId} (age: ${Math.round(cacheAge / 1000)}s)`);
        return this.state.gateways;
      }
    }

    this.setState({ loading: true, error: null });

    try {
      console.log(`PaymentGatewaySingleton: Fetching gateways for tenant ${this.tenantId}`);
      const response = await fetch(`${this.API_BASE_URL}/api/tenants/${this.tenantId}/payment-gateways/public`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch payment gateways: ${response.status}`);
      }

      const data = await response.json();
      const gateways = data.gateways || [];

      this.setState({
        gateways,
        loading: false,
        error: null,
        lastFetch: Date.now()
      });

      console.log(`PaymentGatewaySingleton: Fetched ${gateways.length} gateways for tenant ${this.tenantId}`);
      return gateways;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`PaymentGatewaySingleton: Error fetching gateways:`, error);
      
      this.setState({
        loading: false,
        error: errorMessage
      });

      throw error;
    }
  }

  getActiveGateways(): PaymentGateway[] {
    return this.state.gateways.filter(g => g.isActive);
  }

  getDefaultGateway(): PaymentGateway | undefined {
    return this.state.gateways.find(g => g.isDefault);
  }

  hasActiveGateway(): boolean {
    return this.state.gateways.some(g => g.isActive);
  }

  clearCache(): void {
    this.setState({
      gateways: [],
      lastFetch: null,
      error: null
    });
  }
}

// Export singleton getter
export function getPaymentGatewaySingleton(tenantId: string): PaymentGatewaySingleton {
  return PaymentGatewaySingleton.getInstance(tenantId);
}

export function destroyPaymentGatewaySingleton(tenantId: string): void {
  PaymentGatewaySingleton.destroyInstance(tenantId);
}

export default PaymentGatewaySingleton;

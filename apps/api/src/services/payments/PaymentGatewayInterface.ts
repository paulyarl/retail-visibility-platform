export interface PaymentMethod {
  type: 'card' | 'bank_account' | 'paypal' | 'other';
  token?: string;
  details?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  authorizationId?: string;
  amount: number;
  currency: string;
  status: 'authorized' | 'captured' | 'failed' | 'pending';
  gatewayResponse: Record<string, any>;
  error?: string;
  
  // Fee breakdown
  gatewayFeeCents?: number;
  platformFeeCents?: number;
  totalFeesCents?: number;
  netAmountCents?: number;
  
  // Platform fee details
  platformFeePercentage?: number;
  platformFeeFixedCents?: number;
  feeWaived?: boolean;
  feeWaivedReason?: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  gatewayResponse: Record<string, any>;
  error?: string;
}

export interface GatewayCredentials {
  apiKey: string;
  apiSecret?: string;
  webhookSecret?: string;
}

export abstract class PaymentGatewayInterface {
  protected credentials: GatewayCredentials;
  protected isTestMode: boolean;
  
  constructor(credentials: GatewayCredentials, isTestMode: boolean = false) {
    this.credentials = credentials;
    this.isTestMode = isTestMode;
  }
  
  /**
   * Authorize payment (hold funds without capturing)
   * Used for authorize-then-capture flow
   */
  abstract authorize(
    amount: number,
    currency: string,
    paymentMethod: PaymentMethod,
    metadata?: Record<string, any>
  ): Promise<PaymentResult>;
  
  /**
   * Capture previously authorized payment
   * Amount can be less than or equal to authorized amount
   */
  abstract capture(
    authorizationId: string,
    amount?: number
  ): Promise<PaymentResult>;
  
  /**
   * Direct charge (authorize + capture in one step)
   * Used for immediate payment capture
   */
  abstract charge(
    amount: number,
    currency: string,
    paymentMethod: PaymentMethod,
    metadata?: Record<string, any>
  ): Promise<PaymentResult>;
  
  /**
   * Refund a captured payment
   * Amount can be partial or full refund
   */
  abstract refund(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<RefundResult>;
  
  /**
   * Get payment status from gateway
   */
  abstract getStatus(transactionId: string): Promise<PaymentResult>;
  
  /**
   * Validate webhook signature
   * Returns true if signature is valid
   */
  abstract validateWebhook(
    payload: string | Buffer,
    signature: string
  ): boolean;
  
  /**
   * Get gateway name
   */
  abstract getGatewayName(): string;
}

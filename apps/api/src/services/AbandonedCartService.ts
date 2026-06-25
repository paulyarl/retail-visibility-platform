import { BaseService } from './BaseService';
import { emailService } from './email-service';
import { CrmAlertService } from './CrmAlertService';
import { logger } from '../logger';
import { generateAbandonedCartId } from '../lib/id-generator';

export interface CartItemInput {
  product_id: string;
  product_name: string;
  quantity: number;
  price_cents: number;
  product_image?: string;
  variant_id?: string;
  variant_name?: string;
}

export interface TrackCartInput {
  cartId?: string;
  tenantId: string;
  customerEmail?: string;
  customerName?: string;
  customerId?: string;
  items: CartItemInput[];
}

export interface AbandonedCartSummary {
  total: number;
  recovered: number;
  pending: number;
  conversionRate: number;
  totalValueCents: number;
  recoveredValueCents: number;
}

class AbandonedCartService extends BaseService {
  private static instance: AbandonedCartService;

  private constructor() {
    super();
  }

  static getInstance(): AbandonedCartService {
    if (!AbandonedCartService.instance) {
      AbandonedCartService.instance = new AbandonedCartService();
    }
    return AbandonedCartService.instance;
  }

  async trackCart(input: TrackCartInput): Promise<void> {
    try {
      const cartValueCents = input.items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
      const itemCount = input.items.reduce((sum, item) => sum + item.quantity, 0);

      if (cartValueCents === 0 || input.items.length === 0) {
        return;
      }

      const existing = await this.prisma.abandoned_carts.findFirst({
        where: {
          tenant_id: input.tenantId,
          cart_id: input.cartId || undefined,
          converted: false,
        },
        orderBy: { created_at: 'desc' },
      });

      if (existing) {
        await this.prisma.abandoned_carts.update({
          where: { id: existing.id },
          data: {
            items: input.items as any,
            cart_value_cents: cartValueCents,
            item_count: itemCount,
            customer_email: input.customerEmail || existing.customer_email,
            customer_name: input.customerName || existing.customer_name,
            customer_id: input.customerId || existing.customer_id,
            updated_at: new Date(),
          },
        });
      } else {
        await this.prisma.abandoned_carts.create({
          data: {
            id: generateAbandonedCartId(input.tenantId),
            tenant_id: input.tenantId,
            cart_id: input.cartId || null,
            customer_email: input.customerEmail || null,
            customer_name: input.customerName || null,
            customer_id: input.customerId || null,
            items: input.items as any,
            cart_value_cents: cartValueCents,
            item_count: itemCount,
          },
        });
      }
    } catch (error) {
      logger.warn('AbandonedCartService.trackCart failed', undefined, {
        error: error instanceof Error ? error.message : String(error),
        tenantId: input.tenantId,
      });
    }
  }

  async markCartConverted(cartId: string, orderId?: string, tenantId?: string): Promise<void> {
    try {
      const where: any = { cart_id: cartId, converted: false };
      if (tenantId) where.tenant_id = tenantId;

      await this.prisma.abandoned_carts.updateMany({
        where,
        data: {
          converted: true,
          converted_at: new Date(),
          converted_order_id: orderId || null,
          updated_at: new Date(),
        },
      });
    } catch (error) {
      logger.warn('AbandonedCartService.markCartConverted failed', undefined, {
        error: error instanceof Error ? error.message : String(error),
        cartId,
      });
    }
  }

  async markCartConvertedByEmail(email: string, tenantId: string, orderId?: string): Promise<void> {
    try {
      await this.prisma.abandoned_carts.updateMany({
        where: {
          tenant_id: tenantId,
          customer_email: email,
          converted: false,
        },
        data: {
          converted: true,
          converted_at: new Date(),
          converted_order_id: orderId || null,
          updated_at: new Date(),
        },
      });
    } catch (error) {
      logger.warn('AbandonedCartService.markCartConvertedByEmail failed', undefined, {
        error: error instanceof Error ? error.message : String(error),
        email,
        tenantId,
      });
    }
  }

  async getAbandonedCarts(
    tenantId: string,
    options?: {
      converted?: boolean;
      recoveryEmailSent?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ carts: any[]; total: number }> {
    const where: any = { tenant_id: tenantId };
    if (options?.converted !== undefined) where.converted = options.converted;
    if (options?.recoveryEmailSent !== undefined) where.recovery_email_sent = options.recoveryEmailSent;

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const [carts, total] = await Promise.all([
      this.prisma.abandoned_carts.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.abandoned_carts.count({ where }),
    ]);

    return { carts, total };
  }

  async getSummary(tenantId: string): Promise<AbandonedCartSummary> {
    const carts = await this.prisma.abandoned_carts.findMany({
      where: { tenant_id: tenantId },
      select: {
        converted: true,
        recovery_email_sent: true,
        cart_value_cents: true,
      },
    });

    const total = carts.length;
    const recovered = carts.filter(c => c.converted).length;
    const pending = carts.filter(c => !c.converted && !c.recovery_email_sent).length;
    const totalValueCents = carts.reduce((sum, c) => sum + c.cart_value_cents, 0);
    const recoveredValueCents = carts.filter(c => c.converted).reduce((sum, c) => sum + c.cart_value_cents, 0);

    return {
      total,
      recovered,
      pending,
      conversionRate: total > 0 ? (recovered / total) * 100 : 0,
      totalValueCents,
      recoveredValueCents,
    };
  }

  async sendRecoveryEmail(abandonedCartId: string): Promise<boolean> {
    try {
      const cart = await this.prisma.abandoned_carts.findUnique({
        where: { id: abandonedCartId },
      });

      if (!cart) {
        logger.warn('AbandonedCartService.sendRecoveryEmail: cart not found', undefined, { abandonedCartId });
        return false;
      }

      if (cart.converted) {
        logger.info('AbandonedCartService.sendRecoveryEmail: cart already converted, skipping', undefined, { abandonedCartId });
        return false;
      }

      if (cart.recovery_email_sent) {
        logger.info('AbandonedCartService.sendRecoveryEmail: recovery email already sent', undefined, { abandonedCartId });
        return false;
      }

      if (!cart.customer_email) {
        logger.warn('AbandonedCartService.sendRecoveryEmail: no customer email', undefined, { abandonedCartId });
        return false;
      }

      const tenant = await this.prisma.tenants.findUnique({
        where: { id: cart.tenant_id },
        select: { name: true, metadata: true },
      });

      const tenantName = tenant?.name || 'Store';
      const webUrl = process.env.WEB_URL || 'http://localhost:3000';
      const recoveryUrl = `${webUrl}/tenant/${cart.tenant_id}?recover_cart=${cart.cart_id || cart.id}`;

      const items = (cart.items as any[]) || [];
      const itemListHtml = items.map((item: any) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${item.product_name || 'Product'}${item.variant_name ? ` (${item.variant_name})` : ''}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity || 1}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${(((item.price_cents || 0) * (item.quantity || 1)) / 100).toFixed(2)}</td>
        </tr>
      `).join('');

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#333;">You left items in your cart at ${tenantName}</h2>
          <p style="color:#666;font-size:16px;">We noticed you didn't complete your purchase. Your cart is still saved and ready for you!</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:8px;text-align:left;">Product</th>
                <th style="padding:8px;text-align:center;">Qty</th>
                <th style="padding:8px;text-align:right;">Price</th>
              </tr>
            </thead>
            <tbody>${itemListHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding:12px;text-align:right;font-weight:bold;">Total:</td>
                <td style="padding:12px;text-align:right;font-weight:bold;">$${(cart.cart_value_cents / 100).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          <div style="text-align:center;margin:30px 0;">
            <a href="${recoveryUrl}" style="background:#2563eb;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block;">Complete Your Purchase</a>
          </div>
          <p style="color:#999;font-size:12px;margin-top:20px;">If you didn't mean to leave items in your cart, you can safely ignore this email.</p>
        </div>
      `;

      const result = await emailService.sendEmail({
        to: cart.customer_email,
        subject: `Don't forget your cart at ${tenantName}!`,
        html,
        text: `You left items in your cart at ${tenantName}. Total: $${(cart.cart_value_cents / 100).toFixed(2)}. Visit ${recoveryUrl} to complete your purchase.`,
      });

      if (result.success) {
        await this.prisma.abandoned_carts.update({
          where: { id: abandonedCartId },
          data: {
            recovery_email_sent: true,
            recovery_email_sent_at: new Date(),
            updated_at: new Date(),
          },
        });
        logger.info('AbandonedCartService: recovery email sent', undefined, {
          tenantId: cart.tenant_id,
          abandonedCartId,
          email: cart.customer_email,
        });

        // Fire CRM alert to customer (fire-and-forget)
        CrmAlertService.getInstance().createAbandonedCartAlert({
          tenantId: cart.tenant_id,
          abandonedCartId,
          customerEmail: cart.customer_email,
          customerName: cart.customer_name || undefined,
          cartValueCents: cart.cart_value_cents,
          itemCount: cart.item_count,
          recoveryUrl,
        }).catch(err => logger.warn('AbandonedCartService: CRM alert failed', undefined, { error: err instanceof Error ? err.message : String(err), abandonedCartId }));

        return true;
      } else {
        logger.warn('AbandonedCartService: recovery email failed', undefined, {
          tenantId: cart.tenant_id,
          abandonedCartId,
          error: result.error,
        });
        return false;
      }
    } catch (error) {
      logger.error('AbandonedCartService.sendRecoveryEmail error', undefined, {
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
        abandonedCartId,
      });
      return false;
    }
  }

  async getCartsForRecovery(minAgeHours: number = 1, maxAgeHours: number = 24): Promise<any[]> {
    const now = new Date();
    const minAge = new Date(now.getTime() - maxAgeHours * 60 * 60 * 1000);
    const maxAge = new Date(now.getTime() - minAgeHours * 60 * 60 * 1000);

    return this.prisma.abandoned_carts.findMany({
      where: {
        recovery_email_sent: false,
        converted: false,
        customer_email: { not: null },
        created_at: { gte: minAge, lte: maxAge },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async resetRecoveryEmailState(cartId: string): Promise<void> {
    await this.prisma.abandoned_carts.update({
      where: { id: cartId },
      data: { recovery_email_sent: false, recovery_email_sent_at: null, updated_at: new Date() },
    });
  }
}

export const abandonedCartService = AbandonedCartService.getInstance();
export default AbandonedCartService;

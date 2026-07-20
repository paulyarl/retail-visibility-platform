/**
 * Funnel Service
 *
 * CRUD for tenant sales funnels and their steps.
 * Gated by the funnel_options capability.
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';
import { generateFunnelId, generateFunnelStepId } from '../lib/id-generator';
import { resolveEffectiveCapabilities } from './EffectiveCapabilityResolver';
import BotKnowledgeEmbeddingService from './BotKnowledgeEmbeddingService';
import type { FunnelStepType } from './resolvers/types';

export interface FunnelStepInput {
  id?: string;
  step_type: FunnelStepType;
  offer_item_id: string;
  display_title?: string | null;
  display_description?: string | null;
  price_cents?: number | null;
  discount_cents?: number;
  sort_order?: number;
  accept_to_step_id?: string | null;
  skip_to_step_id?: string | null;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export interface FunnelInput {
  name: string;
  entry_item_id?: string | null;
  trigger_type?: 'product' | 'cart_value' | 'always';
  min_cart_value_cents?: number | null;
  is_active?: boolean;
  is_default?: boolean;
  metadata?: Record<string, any>;
  steps: FunnelStepInput[];
}

export interface FunnelWithSteps {
  id: string;
  tenant_id: string;
  name: string;
  entry_item_id: string | null;
  trigger_type: string;
  min_cart_value_cents: number | null;
  is_active: boolean;
  is_default: boolean;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
  steps: {
    id: string;
    funnel_id: string;
    step_type: string;
    offer_item_id: string;
    display_title: string | null;
    display_description: string | null;
    price_cents: number | null;
    discount_cents: number;
    sort_order: number;
    accept_to_step_id: string | null;
    skip_to_step_id: string | null;
    is_active: boolean;
    metadata: Record<string, any> | null;
    created_at: Date;
    updated_at: Date;
  }[];
}

class FunnelService extends BaseService {
  private static instance: FunnelService;

  private constructor() {
    super();
  }

  static getInstance(): FunnelService {
    if (!FunnelService.instance) {
      FunnelService.instance = new FunnelService();
    }
    return FunnelService.instance;
  }

  private refreshFunnelKnowledge(tenantId: string) {
    // Fire-and-forget knowledge embedding refresh
    BotKnowledgeEmbeddingService.getInstance()
      .refreshFunnelEmbeddings(tenantId)
      .catch((err) => {
        this.logger.warn('[FunnelService] Failed to refresh funnel embeddings', undefined, {
          tenantId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  private async assertBuilderEnabled(tenantId: string) {
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps?.effective.funnel.builder_enabled) {
      throw new Error('Funnel builder is not enabled for this tenant');
    }
  }

  private async validateSteps(tenantId: string, steps: FunnelStepInput[]) {
    const caps = await resolveEffectiveCapabilities(tenantId);
    const allowed = caps?.effective.funnel.allowed_steps || [];

    for (const step of steps) {
      if (!allowed.includes(step.step_type)) {
        throw new Error(`Funnel step type '${step.step_type}' is not allowed by this tenant's plan`);
      }

      if (step.step_type === 'coupon_offer') {
        if (!step.offer_item_id) {
          throw new Error('Every coupon_offer step must have a coupon offer_item_id');
        }
        const coupon = await prisma.tenant_coupons.findFirst({
          where: { id: step.offer_item_id, tenant_id: tenantId, is_active: true },
        });
        if (!coupon) {
          throw new Error(`Coupon ${step.offer_item_id} not found or is not active`);
        }
        step.display_title = step.display_title ?? coupon.code;
        step.display_description = step.display_description ?? `Use code ${coupon.code} on a future purchase`;
      } else if (!step.offer_item_id) {
        throw new Error('Every funnel step must have an offer_item_id');
      }
    }

    const seenOfferIds = new Set<string>();
    for (const step of steps) {
      if (seenOfferIds.has(step.offer_item_id)) {
        throw new Error('Duplicate offer_item_id within a funnel is not allowed');
      }
      seenOfferIds.add(step.offer_item_id);
    }
  }

  async createFunnel(tenantId: string, input: FunnelInput): Promise<FunnelWithSteps> {
    await this.assertBuilderEnabled(tenantId);
    await this.validateSteps(tenantId, input.steps);

    const funnelId = generateFunnelId(tenantId);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const funnel = await tx.tenant_sales_funnels.create({
          data: {
            id: funnelId,
            tenant_id: tenantId,
            name: input.name,
            entry_item_id: input.entry_item_id ?? null,
            trigger_type: input.trigger_type ?? 'product',
            min_cart_value_cents: input.min_cart_value_cents ?? null,
            is_active: input.is_active ?? true,
            is_default: input.is_default ?? false,
            metadata: input.metadata ?? {},
          },
        });

        const stepRecords = await Promise.all(
          input.steps.map(async (step, index) => {
            const stepId = step.id ?? generateFunnelStepId(tenantId);
            return tx.tenant_funnel_steps.create({
              data: {
                id: stepId,
                tenant_id: tenantId,
                funnel_id: funnelId,
                step_type: step.step_type,
                offer_item_id: step.offer_item_id,
                display_title: step.display_title ?? null,
                display_description: step.display_description ?? null,
                price_cents: step.price_cents ?? null,
                discount_cents: step.discount_cents ?? 0,
                sort_order: step.sort_order ?? index,
                accept_to_step_id: step.accept_to_step_id ?? null,
                skip_to_step_id: step.skip_to_step_id ?? null,
                is_active: step.is_active ?? true,
                metadata: step.metadata ?? {},
              },
            });
          })
        );

        return { ...funnel, steps: stepRecords };
      });

      this.refreshFunnelKnowledge(tenantId);
      return result as FunnelWithSteps;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async updateFunnel(tenantId: string, funnelId: string, input: Partial<FunnelInput>): Promise<FunnelWithSteps> {
    await this.assertBuilderEnabled(tenantId);

    if (input.steps) {
      await this.validateSteps(tenantId, input.steps);
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.tenant_sales_funnels.findFirst({
          where: { id: funnelId, tenant_id: tenantId },
          include: { tenant_funnel_steps: { orderBy: { sort_order: 'asc' } } },
        });

        if (!existing) {
          throw new Error('Funnel not found');
        }

        const updateData: any = { updated_at: new Date() };
        if (input.name !== undefined) updateData.name = input.name;
        if (input.entry_item_id !== undefined) updateData.entry_item_id = input.entry_item_id;
        if (input.trigger_type !== undefined) updateData.trigger_type = input.trigger_type;
        if (input.min_cart_value_cents !== undefined) updateData.min_cart_value_cents = input.min_cart_value_cents;
        if (input.is_active !== undefined) updateData.is_active = input.is_active;
        if (input.is_default !== undefined) updateData.is_default = input.is_default;
        if (input.metadata !== undefined) updateData.metadata = input.metadata;

        const funnel = await tx.tenant_sales_funnels.update({
          where: { id: funnelId },
          data: updateData,
        });

        let stepRecords = existing.tenant_funnel_steps;

        if (input.steps) {
          // Delete steps not present in the update
          const incomingIds = input.steps.map((s) => s.id).filter(Boolean) as string[];
          await tx.tenant_funnel_steps.deleteMany({
            where: { funnel_id: funnelId, id: { notIn: incomingIds } },
          });

          // Upsert steps
          stepRecords = await Promise.all(
            input.steps.map(async (step, index) => {
              const stepId = step.id || generateFunnelStepId(tenantId);
              const data = {
                tenant_id: tenantId,
                funnel_id: funnelId,
                step_type: step.step_type,
                offer_item_id: step.offer_item_id,
                display_title: step.display_title ?? null,
                display_description: step.display_description ?? null,
                price_cents: step.price_cents ?? null,
                discount_cents: step.discount_cents ?? 0,
                sort_order: step.sort_order ?? index,
                accept_to_step_id: step.accept_to_step_id ?? null,
                skip_to_step_id: step.skip_to_step_id ?? null,
                is_active: step.is_active ?? true,
                metadata: step.metadata ?? {},
              };

              const existingStep = step.id
                ? await tx.tenant_funnel_steps.findFirst({ where: { id: step.id, funnel_id: funnelId } })
                : null;

              if (existingStep) {
                return tx.tenant_funnel_steps.update({ where: { id: step.id }, data });
              }

              return tx.tenant_funnel_steps.create({ data: { id: stepId, ...data } });
            })
          );
        }

        return { ...funnel, steps: stepRecords };
      });

      this.refreshFunnelKnowledge(tenantId);
      return result as FunnelWithSteps;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async getFunnel(tenantId: string, funnelId: string): Promise<FunnelWithSteps | null> {
    try {
      const funnel = await prisma.tenant_sales_funnels.findFirst({
        where: { id: funnelId, tenant_id: tenantId },
        include: {
          tenant_funnel_steps: {
            where: { is_active: true },
            orderBy: { sort_order: 'asc' },
          },
        },
      });

      if (!funnel) return null;

      const { tenant_funnel_steps, ...rest } = funnel as any;
      return { ...rest, steps: tenant_funnel_steps ?? [] } as unknown as FunnelWithSteps;
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  async listFunnels(tenantId: string, includeInactive = false): Promise<FunnelWithSteps[]> {
    try {
      const funnels = await prisma.tenant_sales_funnels.findMany({
        where: {
          tenant_id: tenantId,
          ...(includeInactive ? {} : { is_active: true }),
        },
        include: {
          tenant_funnel_steps: {
            where: includeInactive ? undefined : { is_active: true },
            orderBy: { sort_order: 'asc' },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      return funnels.map(({ tenant_funnel_steps, ...rest }: any) => ({
        ...rest,
        steps: tenant_funnel_steps ?? [],
      })) as unknown as FunnelWithSteps[];
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  async deleteFunnel(tenantId: string, funnelId: string): Promise<void> {
    try {
      await prisma.tenant_sales_funnels.deleteMany({
        where: { id: funnelId, tenant_id: tenantId },
      });
      this.refreshFunnelKnowledge(tenantId);
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async deactivateFunnel(tenantId: string, funnelId: string): Promise<FunnelWithSteps | null> {
    return this.updateFunnel(tenantId, funnelId, { is_active: false });
  }

  async getFunnelOptionsSettings(tenantId: string): Promise<{
    funnel_options_enabled: boolean;
    order_bump_enabled: boolean;
    upsell_enabled: boolean;
    downsell_enabled: boolean;
    oto_enabled: boolean;
    coupon_offer_enabled: boolean;
  }> {
    const rows = await prisma.$queryRaw<
      Array<{
        funnel_options_enabled: boolean | null;
        order_bump_enabled: boolean | null;
        upsell_enabled: boolean | null;
        downsell_enabled: boolean | null;
        oto_enabled: boolean | null;
        coupon_offer_enabled: boolean | null;
      }>
    >(
      Prisma.sql`SELECT funnel_options_enabled, order_bump_enabled, upsell_enabled, downsell_enabled, oto_enabled, coupon_offer_enabled
                 FROM tenant_funnel_options_settings
                 WHERE tenant_id = ${tenantId}`
    );

    const row = rows[0];
    return {
      funnel_options_enabled: row?.funnel_options_enabled ?? true,
      order_bump_enabled: row?.order_bump_enabled ?? true,
      upsell_enabled: row?.upsell_enabled ?? true,
      downsell_enabled: row?.downsell_enabled ?? true,
      oto_enabled: row?.oto_enabled ?? true,
      coupon_offer_enabled: row?.coupon_offer_enabled ?? true,
    };
  }

  async updateFunnelOptionsSettings(
    tenantId: string,
    settings: {
      funnelOptionsEnabled?: boolean;
      orderBumpEnabled?: boolean;
      upsellEnabled?: boolean;
      downsellEnabled?: boolean;
      otoEnabled?: boolean;
      couponOfferEnabled?: boolean;
    }
  ): Promise<void> {
    await prisma.$executeRaw(
      Prisma.sql`INSERT INTO tenant_funnel_options_settings (
        tenant_id,
        funnel_options_enabled,
        order_bump_enabled,
        upsell_enabled,
        downsell_enabled,
        oto_enabled,
        coupon_offer_enabled
      ) VALUES (
        ${tenantId},
        ${settings.funnelOptionsEnabled ?? true},
        ${settings.orderBumpEnabled ?? true},
        ${settings.upsellEnabled ?? true},
        ${settings.downsellEnabled ?? true},
        ${settings.otoEnabled ?? true},
        ${settings.couponOfferEnabled ?? true}
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        funnel_options_enabled = EXCLUDED.funnel_options_enabled,
        order_bump_enabled = EXCLUDED.order_bump_enabled,
        upsell_enabled = EXCLUDED.upsell_enabled,
        downsell_enabled = EXCLUDED.downsell_enabled,
        oto_enabled = EXCLUDED.oto_enabled,
        coupon_offer_enabled = EXCLUDED.coupon_offer_enabled`
    );
  }
}

export default FunnelService;

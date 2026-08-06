/**
 * Write-behind adapters for registry-driven intake submission.
 *
 * Each adapter is a whitelisted function that writes a specific field from
 * the evidence payload to its domain table(s). Adapters are tenant-aware:
 * if no tenant is linked to the campaign, the adapter falls back to
 * payload-only + logger.warn (the evidence_payload on the intake row is
 * always the system of record at intake time).
 *
 * Adding a new write target is the ONLY code change a novel write target
 * ever requires — new intake kinds become definition rows, new write
 * targets become adapter functions (plan §7.5).
 *
 * Intake Portal Generalization Sprint 1.
 */

import { prisma } from '../../prisma';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';

// ====================
// TYPES
// ====================

export interface AdapterContext {
  intakeId: string;
  campaignId: string;
  tenantId: string | null;
  ctx?: RequestCtx;
}

export type WriteBehindAdapter = (
  value: any,
  adapterCtx: AdapterContext,
) => Promise<void>;

// ====================
// ADAPTER REGISTRY
// ====================

const adapters: Record<string, WriteBehindAdapter> = {
  // ─── payload_only (explicit no-op) ────────────────────────────────
  payload_only: async () => {
    // No-op — evidence_payload is the system of record
  },

  // ─── business_hours_write ─────────────────────────────────────────
  // Writes confirmed_hours → business_hours_list.periods +
  // business_hours_special_list (tenant-linked only)
  business_hours_write: async (value: any, adapterCtx: AdapterContext) => {
    if (!adapterCtx.tenantId) {
      logger.warn('business_hours_write: no tenant linked — payload only', adapterCtx.ctx, {
        intakeId: adapterCtx.intakeId,
        campaignId: adapterCtx.campaignId,
      });
      return;
    }

    if (!value || typeof value !== 'object') return;

    try {
      // Convert hours grid to periods array
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const periods: Array<{ day: string; open: string | null; close: string | null; closed: boolean }> = [];

      for (const day of days) {
        const dayHours = value[day];
        if (!dayHours) {
          periods.push({ day, open: null, close: null, closed: true });
          continue;
        }
        periods.push({
          day,
          open: dayHours.open || null,
          close: dayHours.close || null,
          closed: dayHours.closed ?? false,
        });
      }

      await prisma.business_hours_list.upsert({
        where: { tenant_id: adapterCtx.tenantId },
        create: {
          id: `bhl-${adapterCtx.tenantId}`,
          tenant_id: adapterCtx.tenantId,
          periods: periods as any,
        },
        update: {
          periods: periods as any,
          updated_at: new Date(),
        },
      });

      // Write special hours if provided
      if (Array.isArray(value.special_hours)) {
        for (const special of value.special_hours) {
          if (!special.date) continue;
          const date = new Date(special.date);
          if (isNaN(date.getTime())) continue;

          await prisma.business_hours_special_list.upsert({
            where: {
              tenant_id_date: { tenant_id: adapterCtx.tenantId, date },
            },
            create: {
              id: `bhsl-${adapterCtx.tenantId}-${special.date}`,
              tenant_id: adapterCtx.tenantId,
              date,
              isClosed: special.closed ?? false,
              open: special.hours || null,
              close: null,
              note: special.hours || null,
            },
            update: {
              isClosed: special.closed ?? false,
              open: special.hours || null,
              updated_at: new Date(),
            },
          });
        }
      }

      logger.info('business_hours_write: hours written', adapterCtx.ctx, {
        tenantId: adapterCtx.tenantId,
        campaignId: adapterCtx.campaignId,
      });
    } catch (error) {
      logger.error('business_hours_write failed', adapterCtx.ctx, {
        error: (error as Error).message,
        tenantId: adapterCtx.tenantId,
      });
    }
  },

  // ─── gbp_attributes_write ─────────────────────────────────────────
  // Writes attribute_confirmations → gbp_attributes upsert by
  // [tenant_id, attribute_id] (tenant-linked only)
  gbp_attributes_write: async (value: any, adapterCtx: AdapterContext) => {
    if (!adapterCtx.tenantId) {
      logger.warn('gbp_attributes_write: no tenant linked — payload only', adapterCtx.ctx, {
        intakeId: adapterCtx.intakeId,
        campaignId: adapterCtx.campaignId,
      });
      return;
    }

    if (!value || typeof value !== 'object') return;

    try {
      for (const [attributeId, attrValue] of Object.entries(value)) {
        if (!attributeId) continue;

        // Determine value type from the value
        let valueType = 'enum';
        let valueBool: boolean | null = null;
        let valueEnum: string | null = null;
        let valueUrl: string | null = null;

        if (typeof attrValue === 'boolean') {
          valueType = 'bool';
          valueBool = attrValue;
        } else if (typeof attrValue === 'string') {
          if (attrValue.startsWith('http')) {
            valueType = 'url';
            valueUrl = attrValue;
          } else {
            valueEnum = attrValue;
          }
        }

        await prisma.gbp_attributes.upsert({
          where: {
            tenant_id_attribute_id: {
              tenant_id: adapterCtx.tenantId,
              attribute_id: attributeId,
            },
          },
          create: {
            id: `gba-${adapterCtx.tenantId}-${attributeId}`.substring(0, 50),
            tenant_id: adapterCtx.tenantId,
            attribute_id: attributeId,
            value_type: valueType,
            value_bool: valueBool,
            value_enum: valueEnum,
            value_url: valueUrl,
            is_synced: false,
          },
          update: {
            value_type: valueType,
            value_bool: valueBool,
            value_enum: valueEnum,
            value_url: valueUrl,
            is_synced: false,
            updated_at: new Date(),
          },
        });
      }

      logger.info('gbp_attributes_write: attributes written', adapterCtx.ctx, {
        tenantId: adapterCtx.tenantId,
        campaignId: adapterCtx.campaignId,
        count: Object.keys(value).length,
      });
    } catch (error) {
      logger.error('gbp_attributes_write failed', adapterCtx.ctx, {
        error: (error as Error).message,
        tenantId: adapterCtx.tenantId,
      });
    }
  },

  // ─── gbp_media_write ──────────────────────────────────────────────
  // Writes photo attachments → gbp_media rows (tenant-linked only)
  gbp_media_write: async (value: any, adapterCtx: AdapterContext) => {
    if (!adapterCtx.tenantId) {
      logger.warn('gbp_media_write: no tenant linked — payload only', adapterCtx.ctx, {
        intakeId: adapterCtx.intakeId,
        campaignId: adapterCtx.campaignId,
      });
      return;
    }

    if (!Array.isArray(value) || value.length === 0) return;

    try {
      // Fetch attachment URLs from the intake's attachments
      const attachments = await prisma.mkt_dispute_attachments.findMany({
        where: {
          dispute_intake_id: adapterCtx.intakeId,
          id: { in: value },
        },
        select: { id: true, file_url: true, file_name: true },
      });

      for (const attachment of attachments) {
        const mediaId = `gbm-${adapterCtx.tenantId}-${attachment.id}`.substring(0, 50);
        await prisma.gbp_media.upsert({
          where: { id: mediaId },
          create: {
            id: mediaId,
            tenant_id: adapterCtx.tenantId,
            source_url: attachment.file_url,
            description: attachment.file_name,
            category: 'additional',
            is_active: true,
          },
          update: {
            source_url: attachment.file_url,
            description: attachment.file_name,
            is_active: true,
            updated_at: new Date(),
          },
        });
      }

      logger.info('gbp_media_write: media written', adapterCtx.ctx, {
        tenantId: adapterCtx.tenantId,
        campaignId: adapterCtx.campaignId,
        count: attachments.length,
      });
    } catch (error) {
      logger.error('gbp_media_write failed', adapterCtx.ctx, {
        error: (error as Error).message,
        tenantId: adapterCtx.tenantId,
      });
    }
  },

  // ─── gbp_categories_write ─────────────────────────────────────────
  // Writes category preferences → gbp_listing_categories ONLY when a
  // synced gbp_locations_list row exists; otherwise payload-only + warn
  gbp_categories_write: async (value: any, adapterCtx: AdapterContext) => {
    if (!adapterCtx.tenantId) {
      logger.warn('gbp_categories_write: no tenant linked — payload only', adapterCtx.ctx, {
        intakeId: adapterCtx.intakeId,
        campaignId: adapterCtx.campaignId,
      });
      return;
    }

    if (!Array.isArray(value) || value.length === 0) return;

    try {
      // Check for a synced gbp_locations_list row for this tenant
      const location = await prisma.gbp_locations_list.findFirst({
        where: { account_id: { contains: adapterCtx.tenantId } },
      });

      if (!location) {
        logger.warn('gbp_categories_write: no synced GBP location — payload only', adapterCtx.ctx, {
          tenantId: adapterCtx.tenantId,
          campaignId: adapterCtx.campaignId,
        });
        return;
      }

      // Write category preferences to gbp_listing_categories
      for (let i = 0; i < value.length; i++) {
        const categoryId = value[i];
        await prisma.gbp_listing_categories.upsert({
          where: {
            listing_id_gbp_category_id: {
              listing_id: location.id,
              gbp_category_id: categoryId,
            },
          },
          create: {
            listing_id: location.id,
            gbp_category_id: categoryId,
            is_primary: i === 0,
          },
          update: {
            is_primary: i === 0,
            updated_at: new Date(),
          },
        });
      }

      logger.info('gbp_categories_write: categories written', adapterCtx.ctx, {
        tenantId: adapterCtx.tenantId,
        campaignId: adapterCtx.campaignId,
        locationId: location.id,
        count: value.length,
      });
    } catch (error) {
      logger.error('gbp_categories_write failed', adapterCtx.ctx, {
        error: (error as Error).message,
        tenantId: adapterCtx.tenantId,
      });
    }
  },

  // ─── owner_voice_profile_upsert ───────────────────────────────────
  // Upserts mkt_owner_voice_profile (campaign-scoped, keyed on campaign_id @unique)
  owner_voice_profile_upsert: async (value: any, adapterCtx: AdapterContext) => {
    if (!value || typeof value !== 'object') return;

    try {
      const vp = value;
      await prisma.mkt_owner_voice_profile.upsert({
        where: { campaign_id: adapterCtx.campaignId },
        create: {
          id: `ovp-${adapterCtx.campaignId}`.substring(0, 255),
          campaign_id: adapterCtx.campaignId,
          person: vp.person || null,
          formality: vp.formality || null,
          humor: vp.humor || null,
          apology_style: vp.apology_style || null,
          signoff_style: vp.signoff_style || null,
          signature: vp.signature || null,
        },
        update: {
          person: vp.person || null,
          formality: vp.formality || null,
          humor: vp.humor || null,
          apology_style: vp.apology_style || null,
          signoff_style: vp.signoff_style || null,
          signature: vp.signature || null,
          updated_at: new Date(),
        },
      });

      logger.info('owner_voice_profile_upsert: voice profile written', adapterCtx.ctx, {
        campaignId: adapterCtx.campaignId,
      });
    } catch (error) {
      logger.error('owner_voice_profile_upsert failed', adapterCtx.ctx, {
        error: (error as Error).message,
        campaignId: adapterCtx.campaignId,
      });
    }
  },

  // ─── review_pipeline_per_platform ─────────────────────────────────
  // Upserts one mkt_review_response_pipeline row per platform in
  // review_request_config.platforms (composite key [campaign_id, platform])
  review_pipeline_per_platform: async (value: any, adapterCtx: AdapterContext) => {
    // This adapter is called for both response_policy and review_request_config.
    // We need to merge both into the pipeline metadata. The caller passes
    // the full evidence payload context via the adapter config, but since
    // adapters are called per-field, we handle this by reading both fields
    // from the intake's evidence_payload if available.
    //
    // For the response_policy field: write metadata.response_policy
    // For the review_request_config field: write metadata.review_request_config
    //   + create one pipeline row per platform

    if (!value || typeof value !== 'object') return;

    try {
      // If this is review_request_config with platforms, create per-platform rows
      if (Array.isArray(value.platforms)) {
        for (const platform of value.platforms) {
          await prisma.mkt_review_response_pipeline.upsert({
            where: {
              campaign_id_platform: {
                campaign_id: adapterCtx.campaignId,
                platform,
              },
            },
            create: {
              id: `rrp-${adapterCtx.campaignId}-${platform}`.substring(0, 255),
              campaign_id: adapterCtx.campaignId,
              platform,
              stage: 'backlog',
              metadata: {
                review_request_config: value,
              } as any,
            },
            update: {
              metadata: {
                review_request_config: value,
              } as any,
              updated_at: new Date(),
            },
          });
        }

        logger.info('review_pipeline_per_platform: pipelines created', adapterCtx.ctx, {
          campaignId: adapterCtx.campaignId,
          platforms: value.platforms,
        });
      }
      // If this is response_policy, update existing pipeline rows with the policy
      else if (value.approval_mode || value.negative_threshold) {
        const pipelines = await prisma.mkt_review_response_pipeline.findMany({
          where: { campaign_id: adapterCtx.campaignId },
        });

        for (const pipeline of pipelines) {
          const existingMeta = (pipeline.metadata as any) || {};
          await prisma.mkt_review_response_pipeline.update({
            where: { id: pipeline.id },
            data: {
              metadata: {
                ...existingMeta,
                response_policy: value,
              } as any,
              updated_at: new Date(),
            },
          });
        }

        logger.info('review_pipeline_per_platform: response policy applied', adapterCtx.ctx, {
          campaignId: adapterCtx.campaignId,
          pipelineCount: pipelines.length,
        });
      }
    } catch (error) {
      logger.error('review_pipeline_per_platform failed', adapterCtx.ctx, {
        error: (error as Error).message,
        campaignId: adapterCtx.campaignId,
      });
    }
  },
};

// ====================
// EXECUTION
// ====================

/**
 * Execute all field_mappings for a definition against the evidence payload.
 * Each mapping calls its adapter with the field's value. Failures are
 * logged but do NOT block the intake submission — the evidence_payload
 * is always persisted first and is the system of record.
 */
export async function executeFieldMappings(
  fieldMappings: Array<{ field: string; adapter: string; config?: Record<string, any> }>,
  evidencePayload: Record<string, any>,
  adapterCtx: AdapterContext,
): Promise<void> {
  for (const mapping of fieldMappings) {
    const adapter = adapters[mapping.adapter];
    if (!adapter) {
      logger.warn('Unknown write-behind adapter — skipping', adapterCtx.ctx, {
        intakeKind: adapterCtx.intakeId,
        field: mapping.field,
        adapter: mapping.adapter,
      });
      continue;
    }

    const value = evidencePayload[mapping.field];
    if (value === undefined || value === null) continue;

    try {
      await adapter(value, adapterCtx);
    } catch (error) {
      // Best-effort — adapter failures don't block the intake
      logger.error('Write-behind adapter threw', adapterCtx.ctx, {
        field: mapping.field,
        adapter: mapping.adapter,
        error: (error as Error).message,
      });
    }
  }
}

/**
 * Check if an adapter name is registered (for validation at seed/admin time).
 */
export function isKnownAdapter(name: string): boolean {
  return name in adapters;
}

/**
 * Register a custom adapter at runtime (for testing or extensibility).
 */
export function registerAdapter(name: string, adapter: WriteBehindAdapter): void {
  adapters[name] = adapter;
}

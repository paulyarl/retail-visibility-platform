/**
 * Bot Platform Guide Service
 *
 * Reads effective capabilities + tier info and generates context summaries
 * tailored to the interaction surface (dashboard vs storefront).
 *
 * - Dashboard context: merchant-facing, focuses on what's enabled, what's
 *   not yet configured, and next steps. Uses tier awareness to suggest upgrades.
 * - Storefront context: customer-facing, focuses on store capabilities,
 *   product discovery, directory presence, and shopping features.
 *
 * Used by:
 * - BotDynamicResponseService (system prompt injection for GPT context)
 * - BotSkillService (platform_guide skill execution)
 * - bot-merchant.ts (authenticated dashboard chat endpoint)
 */

import { resolveEffectiveCapabilities } from './EffectiveCapabilityResolver';
import { prisma } from '../prisma';
import { logger } from '../logger';
import type { EffectiveCapabilities } from './resolvers/types';

export type PlatformContextSurface = 'dashboard' | 'storefront';

export interface PlatformGuideContext {
  surface: PlatformContextSurface;
  tierKey: string;
  tierName: string;
  tierDescription: string;
  summary: string;
  enabledCapabilities: string[];
  disabledCapabilities: string[];
  recommendations: string[];
  rawCapabilities: EffectiveCapabilities | null;
}

class BotPlatformGuideService {
  private static instance: BotPlatformGuideService;

  static getInstance(): BotPlatformGuideService {
    if (!BotPlatformGuideService.instance) {
      BotPlatformGuideService.instance = new BotPlatformGuideService();
    }
    return BotPlatformGuideService.instance;
  }

  /**
   * Build a platform guide context for a tenant, tailored to the surface.
   */
  async buildContext(
    tenantId: string,
    surface: PlatformContextSurface
  ): Promise<PlatformGuideContext> {
    const caps = await resolveEffectiveCapabilities(tenantId, { detail: 'summary' });

    if (!caps) {
      return {
        surface,
        tierKey: 'unknown',
        tierName: 'Unknown',
        tierDescription: '',
        summary: 'Unable to retrieve platform capabilities at this time.',
        enabledCapabilities: [],
        disabledCapabilities: [],
        recommendations: [],
        rawCapabilities: null,
      };
    }

    const { tier, effective } = caps;

    const enabled: string[] = [];
    const disabled: string[] = [];

    // Check each capability domain
    if (effective.commerce?.enabled) enabled.push('Commerce (orders, payments)');
    else disabled.push('Commerce (orders, payments)');

    if (effective.payment_gateway?.enabled) enabled.push('Payment Gateway');
    else disabled.push('Payment Gateway');

    if (effective.storefront?.enabled) enabled.push('Storefront');
    else disabled.push('Storefront');

    if (effective.storefront_options?.enabled) enabled.push('Storefront Options (hours, gallery, QR, SEO)');
    else disabled.push('Storefront Options (hours, gallery, QR, SEO)');

    if (effective.directory_entry?.enabled) enabled.push('Directory Listing');
    else disabled.push('Directory Listing');

    if (effective.faq?.enabled) enabled.push('FAQ Management');
    else disabled.push('FAQ Management');

    if (effective.crm?.enabled) enabled.push('CRM (Support Tickets)');
    else disabled.push('CRM (Support Tickets)');

    if (effective.chatbot?.enabled) enabled.push('Chatbot');
    else disabled.push('Chatbot');

    if (effective.fulfillment?.enabled) enabled.push('Fulfillment');
    else disabled.push('Fulfillment');

    if (effective.product_options?.enabled) enabled.push('Product Options (variants)');
    else disabled.push('Product Options (variants)');

    if (effective.featured?.enabled) enabled.push('Featured Products');
    else disabled.push('Featured Products');

    if (effective.integrations?.enabled) enabled.push('Integrations');
    else disabled.push('Integrations');

    if (effective.quickstart?.enabled) enabled.push('Quickstart');
    else disabled.push('Quickstart');

    if (effective.barcode_scan?.enabled) enabled.push('Barcode Scanning');
    else disabled.push('Barcode Scanning');

    const recommendations = this.buildRecommendations(effective, surface);
    const summary = this.buildSummary(tier, enabled, disabled, surface);

    return {
      surface,
      tierKey: tier.key,
      tierName: tier.name,
      tierDescription: tier.description,
      summary,
      enabledCapabilities: enabled,
      disabledCapabilities: disabled,
      recommendations,
      rawCapabilities: caps,
    };
  }

  /**
   * Generate a system prompt context block for GPT injection.
   * This is appended to the bot's system prompt so GPT knows the tenant's
   * platform context.
   */
  async buildPromptContext(
    tenantId: string,
    surface: PlatformContextSurface
  ): Promise<string> {
    const ctx = await this.buildContext(tenantId, surface);

    const lines: string[] = [
      `\n\n--- Platform Context (${surface}) ---`,
      `Tenant tier: ${ctx.tierName} (${ctx.tierKey})`,
      `Enabled capabilities: ${ctx.enabledCapabilities.join(', ') || 'none'}`,
    ];

    if (surface === 'dashboard') {
      lines.push(
        `Not yet enabled: ${ctx.disabledCapabilities.join(', ') || 'none'}`,
      );
      if (ctx.recommendations.length > 0) {
        lines.push(`Recommended next steps for the merchant:`);
        ctx.recommendations.forEach(r => lines.push(`  - ${r}`));
      }
      lines.push(
        `You are interacting with the MERCHANT (store owner) on their dashboard.`,
        `Help them understand their platform features, suggest next steps, and guide them to settings pages.`,
        `Do not share internal tier keys or technical details. Use friendly, actionable language.`,
      );
    } else {
      lines.push(
        `You are interacting with a CUSTOMER on the storefront.`,
        `Focus on helping them discover products, navigate the store, and find what they need.`,
        `Do not mention platform tiers, capabilities, or internal settings.`,
      );
    }

    lines.push(`--- End Platform Context ---\n`);

    return lines.join('\n');
  }

  /**
   * Build a skill card schema for the platform_guide skill.
   * This is returned by BotSkillService.executeSkill for the widget to render.
   */
  async buildSkillCard(tenantId: string, surface: PlatformContextSurface): Promise<{
    cardSchema: any;
    data: any;
  }> {
    const ctx = await this.buildContext(tenantId, surface);

    const cardSchema = {
      type: 'platform_guide',
      title: surface === 'dashboard' ? 'Your Platform Overview' : 'Store Capabilities',
      sections: [
        {
          label: 'Tier',
          value: ctx.tierName,
          icon: 'badge',
        },
        {
          label: 'Enabled Features',
          items: ctx.enabledCapabilities,
        },
        ...(surface === 'dashboard'
          ? [
              {
                label: 'Not Yet Enabled',
                items: ctx.disabledCapabilities,
              },
              {
                label: 'Recommended Next Steps',
                items: ctx.recommendations,
              },
            ]
          : []),
      ],
    };

    return { cardSchema, data: ctx };
  }

  private buildSummary(
    tier: { key: string; name: string; description: string },
    enabled: string[],
    disabled: string[],
    surface: PlatformContextSurface
  ): string {
    if (surface === 'dashboard') {
      return `This merchant is on the ${tier.name} tier. They have ${enabled.length} capabilities enabled and ${disabled.length} not yet activated.`;
    }
    return `This store is on the ${tier.name} plan with ${enabled.length} features available for customers.`;
  }

  private buildRecommendations(
    effective: EffectiveCapabilities['effective'],
    surface: PlatformContextSurface
  ): string[] {
    const recs: string[] = [];

    if (surface !== 'dashboard') return recs;

    // Capability-specific recommendations
    if (!effective.storefront?.enabled) {
      recs.push('Enable your storefront to start selling online. Go to Settings → Storefront.');
    }
    if (effective.storefront?.enabled && !effective.directory_entry?.enabled) {
      recs.push('Publish your directory listing to appear in the local business directory. Go to Settings → Directory.');
    }
    if (!effective.faq?.enabled) {
      recs.push('Set up FAQs to help customers find answers quickly and reduce support tickets. Go to Settings → FAQ.');
    }
    if (!effective.crm?.enabled) {
      recs.push('Enable CRM to manage customer support tickets and inquiries. Go to Settings → CRM.');
    }
    if (effective.chatbot?.enabled && !effective.chatbot.dynamic_enabled) {
      recs.push('Upgrade to enable AI-powered bot responses for richer customer interactions. Go to Settings → Subscription.');
    }
    if (!effective.payment_gateway?.enabled) {
      recs.push('Connect a payment gateway to accept online payments. Go to Settings → Payments.');
    }
    if (effective.storefront_options?.enabled && !effective.storefront_hours?.hours_enabled) {
      recs.push('Display your business hours on your storefront. Go to Settings → Storefront Options.');
    }
    if (!effective.featured?.enabled) {
      recs.push('Feature your best products on your storefront. Go to Settings → Featured Products.');
    }

    // App Store recommendation — suggest the unified store when there are disabled capabilities
    const hasDisabled = !effective.storefront?.enabled ||
      !effective.directory_entry?.enabled ||
      !effective.faq?.enabled ||
      !effective.crm?.enabled ||
      !effective.payment_gateway?.enabled ||
      !effective.featured?.enabled ||
      !effective.fulfillment?.enabled ||
      !effective.commerce?.enabled;
    if (hasDisabled) {
      recs.push('Browse the App Store to purchase features, placements, and promotions in one place. Go to Settings → App Store.');
    }

    return recs;
  }
}

export default BotPlatformGuideService;

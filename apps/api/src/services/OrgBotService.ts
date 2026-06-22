/**
 * OrgBotService — Builds org-level context for the organization dashboard chatbot.
 *
 * The org bot reuses the existing per-tenant bot infrastructure (conversations,
 * guardrails, dynamic response) but uses the hero location's tenant as the host
 * and injects org-level context (org name, all location names, chain-wide stats)
 * into the system prompt.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

export interface OrgBotContext {
  orgId: string;
  orgName: string;
  heroTenantId: string;
  locationNames: string[];
  totalLocations: number;
  totalActiveBots: number;
}

class OrgBotService {
  private static instance: OrgBotService;

  private constructor() {}

  static getInstance(): OrgBotService {
    if (!OrgBotService.instance) {
      OrgBotService.instance = new OrgBotService();
    }
    return OrgBotService.instance;
  }

  /**
   * Build org-level context for the bot system prompt.
   * Uses the hero location's tenant as the host tenant for the conversation.
   */
  async buildOrgContext(orgId: string): Promise<OrgBotContext | null> {
    const org = await prisma.organizations_list.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        tenants: {
          select: {
            id: true,
            name: true,
            metadata: true,
          },
        },
      },
    });

    if (!org || org.tenants.length === 0) {
      logger.warn('[OrgBotService] Organization not found or has no tenants', undefined, { orgId });
      return null;
    }

    // Find hero location (metadata.isHeroLocation === true), fallback to first
    const heroTenant =
      org.tenants.find((t) => {
        const meta = t.metadata as any;
        return meta?.isHeroLocation === true;
      }) || org.tenants[0];

    // Count active bots across locations
    const botConfigs = await prisma.bot_configurations.findMany({
      where: {
        tenant_id: { in: org.tenants.map((t) => t.id) },
        status: 'active',
      },
      select: { tenant_id: true },
    });

    return {
      orgId: org.id,
      orgName: org.name,
      heroTenantId: heroTenant.id,
      locationNames: org.tenants.map((t) => t.name),
      totalLocations: org.tenants.length,
      totalActiveBots: botConfigs.length,
    };
  }

  /**
   * Build the org-level system prompt addition.
   * This is appended to the standard bot system prompt.
   */
  buildSystemPromptAddition(ctx: OrgBotContext): string {
    const locationList = ctx.locationNames.join(', ');
    return `\n\nOrganization context:
You are the assistant for ${ctx.orgName}, a chain with ${ctx.totalLocations} location${ctx.totalLocations !== 1 ? 's' : ''}: ${locationList}.
The user is an organization administrator managing the entire chain.
Help them with questions about any of their locations, chain-wide settings, propagation, and platform features.
When discussing a specific location, refer to it by name.
Chain-wide bot status: ${ctx.totalActiveBots} of ${ctx.totalLocations} locations have chatbot active.`;
  }

  /**
   * Build a custom greeting for the org bot.
   */
  buildGreeting(ctx: OrgBotContext): string {
    return `Hi! I'm the assistant for ${ctx.orgName}. I can help you manage your ${ctx.totalLocations} location${ctx.totalLocations !== 1 ? 's' : ''}. Ask me about any location's settings, capabilities, or platform features.`;
  }
}

export default OrgBotService;

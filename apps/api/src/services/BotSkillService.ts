/**
 * Bot Skill Service
 *
 * Execute skills against public API endpoints with capability/tier/status gating.
 * Reads from bot_skills + bot_skill_configurations.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { resolveEffectiveCapabilities } from './EffectiveCapabilityResolver';
import BotPlatformGuideService from './BotPlatformGuideService';

export interface SkillResult {
  skillName: string;
  success: boolean;
  data: any;
  cardSchema: any;
  error?: string;
}

export interface SkillWithConfig {
  id: string;
  name: string;
  version: string;
  description: string | null;
  endpoint: string;
  requiredCapabilities: string[];
  tierGates: string[];
  capabilityGates: string[];
  tenantStatusGates: string[];
  featuredAware: boolean;
  refreshCadenceMinutes: number;
  status: string;
  skillCardSchema: any;
  defaultConfig: any;
  enabled: boolean;
  config: any;
}

function toSkillWithConfig(row: any): SkillWithConfig {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    description: row.description,
    endpoint: row.endpoint,
    requiredCapabilities: row.required_capabilities,
    tierGates: row.tier_gates,
    capabilityGates: row.capability_gates,
    tenantStatusGates: row.tenant_status_gates,
    featuredAware: row.featured_aware,
    refreshCadenceMinutes: row.refresh_cadence_minutes,
    status: row.status,
    skillCardSchema: row.skill_card_schema,
    defaultConfig: row.default_config,
    enabled: row.bot_skill_configurations?.[0]?.enabled ?? false,
    config: row.bot_skill_configurations?.[0]?.config ?? null,
  };
}

export class BotSkillService {
  private static instance: BotSkillService;

  static getInstance(): BotSkillService {
    if (!BotSkillService.instance) {
      BotSkillService.instance = new BotSkillService();
    }
    return BotSkillService.instance;
  }

  /**
   * List all active skills with tenant-specific config.
   */
  async listSkills(tenantId: string): Promise<SkillWithConfig[]> {
    const skills = await prisma.bot_skills.findMany({
      where: { status: 'active' },
      include: {
        bot_skill_configurations: {
          where: { tenant_id: tenantId },
        },
      },
      orderBy: { name: 'asc' },
    });

    return skills.map(toSkillWithConfig);
  }

  /**
   * Update a tenant's skill configuration (enable/disable, config overrides).
   */
  async updateSkillConfig(tenantId: string, skillId: string, data: {
    enabled?: boolean;
    config?: any;
  }): Promise<void> {
    const existing = await prisma.bot_skill_configurations.findUnique({
      where: { tenant_id_skill_id: { tenant_id: tenantId, skill_id: skillId } },
    });

    if (existing) {
      await prisma.bot_skill_configurations.update({
        where: { tenant_id_skill_id: { tenant_id: tenantId, skill_id: skillId } },
        data: {
          ...(data.enabled !== undefined && { enabled: data.enabled }),
          ...(data.config !== undefined && { config: data.config }),
          updated_at: new Date(),
        },
      });
    } else {
      await prisma.bot_skill_configurations.create({
        data: {
          tenant_id: tenantId,
          skill_id: skillId,
          enabled: data.enabled ?? false,
          config: data.config ?? null,
        },
      });
    }
  }

  /**
   * Check if a skill is available for a tenant based on tier/capability/status gates.
   */
  async isSkillAvailable(tenantId: string, skill: SkillWithConfig): Promise<boolean> {
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps) return false;
    const chatbotCaps = caps.effective.chatbot;

    if (!chatbotCaps.enabled || !chatbotCaps.skills_enabled) return false;

    // Check capability gates
    if (skill.capabilityGates.length > 0) {
      const hasAllCaps = skill.capabilityGates.every(gate => {
        if (chatbotCaps.is_flexible) return true;
        return (
          chatbotCaps.allowed_skill_types.includes(gate as any) ||
          chatbotCaps.allowed_response_engines.includes(gate as any) ||
          chatbotCaps.allowed_kb_types.includes(gate as any)
        );
      });
      if (!hasAllCaps) return false;
    }

    // Check tier gates — match against tenant's tier key
    if (skill.tierGates.length > 0) {
      const tierKey = caps.tier.key;
      if (!skill.tierGates.includes(tierKey) && !chatbotCaps.is_flexible) return false;
    }

    // Check tenant status gates
    if (skill.tenantStatusGates.length > 0) {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { subscription_status: true },
      });
      const tenantStatus = tenant?.subscription_status || 'active';
      if (!skill.tenantStatusGates.includes(tenantStatus)) return false;
    }

    return skill.enabled;
  }

  /**
   * Execute a skill by name for a tenant.
   * Phase 1A: returns a structured result — actual endpoint call deferred to Phase 1B.
   */
  async executeSkill(tenantId: string, skillName: string, params: any): Promise<SkillResult> {
    const skill = await prisma.bot_skills.findUnique({
      where: { name: skillName },
    });

    if (!skill || skill.status !== 'active') {
      return {
        skillName,
        success: false,
        data: null,
        cardSchema: null,
        error: `Skill '${skillName}' not found or inactive`,
      };
    }

    const skillsWithConfig = await this.listSkills(tenantId);
    const skillConfig = skillsWithConfig.find(s => s.name === skillName);

    if (!skillConfig) {
      return {
        skillName,
        success: false,
        data: null,
        cardSchema: null,
        error: `Skill '${skillName}' not available`,
      };
    }

    const available = await this.isSkillAvailable(tenantId, skillConfig);
    if (!available) {
      return {
        skillName,
        success: false,
        data: null,
        cardSchema: null,
        error: `Skill '${skillName}' is not enabled for this tenant`,
      };
    }

    logger.info('[BotSkillService] Executing skill', undefined, { tenantId, skillName });

    // Platform guide skill — built-in, reads effective capabilities
    if (skillName === 'platform_guide') {
      const surface = (params?.pageContext === 'dashboard' ? 'dashboard' : 'storefront') as 'dashboard' | 'storefront';
      const guideService = BotPlatformGuideService.getInstance();
      const { cardSchema, data } = await guideService.buildSkillCard(tenantId, surface);
      return {
        skillName,
        success: true,
        data,
        cardSchema,
      };
    }

    // Phase 1A: Return skill card schema for the widget to render
    // Actual endpoint execution will be implemented in Phase 1B
    return {
      skillName,
      success: true,
      data: params,
      cardSchema: skill.skill_card_schema,
    };
  }
}

export default BotSkillService;

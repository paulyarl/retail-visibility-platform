/**
 * Bot Guardrail Service
 *
 * Rule-based only (Phase 1A): regex/keyword matching against bot_guardrail_rules.
 * BERT upgrade in Phase 3.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

export interface GuardrailResult {
  action: 'pass' | 'block' | 'flag' | 'mask' | 'replace';
  modifiedMessage: string;
  triggeredRules: Array<{
    ruleType: string;
    severity: string;
    responseTemplate: string | null;
  }>;
}

export class BotGuardrailService {
  private static instance: BotGuardrailService;

  static getInstance(): BotGuardrailService {
    if (!BotGuardrailService.instance) {
      BotGuardrailService.instance = new BotGuardrailService();
    }
    return BotGuardrailService.instance;
  }

  /**
   * Check user message against guardrail rules.
   * Returns pass if no rules trigger, otherwise the highest-severity action.
   */
  async checkMessage(tenantId: string, message: string): Promise<GuardrailResult> {
    // Fetch active rules: tenant-specific + global (tenant_id IS NULL)
    const rules = await prisma.bot_guardrail_rules.findMany({
      where: {
        OR: [
          { tenant_id: tenantId, is_active: true },
          { tenant_id: null, is_active: true },
        ],
      },
      orderBy: { severity: 'desc' },
    });

    const triggered: GuardrailResult['triggeredRules'] = [];
    let modifiedMessage = message;
    let highestAction: GuardrailResult['action'] = 'pass';

    const severityOrder: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    for (const rule of rules) {
      const matched = this.matchRule(rule.pattern, rule.rule_type, message);
      if (!matched) continue;

      triggered.push({
        ruleType: rule.rule_type,
        severity: rule.severity,
        responseTemplate: rule.response_template,
      });

      switch (rule.action) {
        case 'block':
          if (severityOrder[rule.severity] >= severityOrder[highestAction] || highestAction === 'pass') {
            highestAction = 'block';
          }
          break;
        case 'mask':
          modifiedMessage = this.maskPattern(modifiedMessage, rule.pattern);
          if (highestAction === 'pass') highestAction = 'mask';
          break;
        case 'replace':
          if (rule.replacement) {
            modifiedMessage = modifiedMessage.replace(
              new RegExp(rule.pattern, 'gi'),
              rule.replacement
            );
          }
          if (highestAction === 'pass') highestAction = 'replace';
          break;
        case 'flag':
          if (highestAction === 'pass') highestAction = 'flag';
          break;
      }
    }

    if (triggered.length > 0) {
      logger.info('[BotGuardrailService] Rules triggered', undefined, {
        tenantId,
        count: triggered.length,
        action: highestAction,
      });
    }

    return {
      action: highestAction,
      modifiedMessage,
      triggeredRules: triggered,
    };
  }

  private matchRule(pattern: string, ruleType: string, message: string): boolean {
    try {
      switch (ruleType) {
        case 'banned_phrase':
          // Simple keyword list — comma-separated
          const phrases = pattern.split(',').map(p => p.trim().toLowerCase());
          const lowerMessage = message.toLowerCase();
          return phrases.some(phrase => phrase.length > 0 && lowerMessage.includes(phrase));

        case 'pii_detection':
          // Regex patterns for email, phone, SSN, credit card
          const piiRegex = new RegExp(pattern, 'i');
          return piiRegex.test(message);

        case 'moderation':
          // Regex or keyword list
          if (pattern.startsWith('/')) {
            const moderationRegex = new RegExp(pattern.slice(1, pattern.lastIndexOf('/')), pattern.slice(pattern.lastIndexOf('/') + 1) || 'i');
            return moderationRegex.test(message);
          }
          const moderationKeywords = pattern.split(',').map(p => p.trim().toLowerCase());
          return moderationKeywords.some(kw => kw.length > 0 && message.toLowerCase().includes(kw));

        case 'competitor':
          const competitors = pattern.split(',').map(p => p.trim().toLowerCase());
          return competitors.some(comp => comp.length > 0 && message.toLowerCase().includes(comp));

        default:
          // Try as regex
          const regex = new RegExp(pattern, 'i');
          return regex.test(message);
      }
    } catch (e) {
      logger.warn('[BotGuardrailService] Invalid pattern', undefined, { pattern, ruleType, error: (e as Error).message });
      return false;
    }
  }

  private maskPattern(message: string, pattern: string): string {
    try {
      return message.replace(new RegExp(pattern, 'gi'), '***');
    } catch {
      return message;
    }
  }

  /**
   * Get the response template for a blocked message.
   */
  getBlockResponse(triggered: GuardrailResult['triggeredRules'], fallback: string): string {
    for (const rule of triggered) {
      if (rule.responseTemplate) return rule.responseTemplate;
    }
    return fallback;
  }
}

export default BotGuardrailService;

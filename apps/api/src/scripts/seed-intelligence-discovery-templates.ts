/**
 * Seed script: Intelligence Discovery Seek Templates (Sprint 3)
 *
 * Seeds two top-level intelligence-scope seek templates that appear in the
 * Prompts tab for intelligence-scope campaigns:
 *
 *   1. "Seek: Intelligence Discovery (Emerging)" — focus = emerging
 *   2. "Seek: Intelligence Discovery (Competitive)" — focus = competitive
 *
 * These templates have thin bodies — when resolvePrompt() detects an
 * intelligence-scope seek prompt, it delegates to PromptComposerService
 * which assembles the full prompt from fragments (base + extension +
 * profile block + focus). The template body is a composition marker
 * that gets replaced at resolution time.
 *
 * The output_schema is intelligence_discovery so imported results are
 * validated against the discovery schema.
 *
 * Idempotent — uses deterministic IDs so re-running updates in place.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/seed-intelligence-discovery-templates.ts
 */

import { MarketingPromptService } from '../services/MarketingPromptService';
import { logger } from '../logger';
import { INTELLIGENCE_DISCOVERY_SCHEMA_NAME } from '../validators/intelligence-discovery.schema';

const DISCOVERY_TEMPLATES = [
  {
    id: 'mpt-seed-intel-discovery-emerging-001',
    name: 'Seek: Intelligence Discovery (Emerging)',
    promptType: 'seek' as const,
    scope: 'intelligence' as const,
    body: `{{#compose_intelligence}}
This prompt is composed at runtime by PromptComposerService.
Focus: EMERGING — discover low-visibility, hard-to-find businesses.
{{/compose_intelligence}}`,
    variables: ['category', 'city', 'state', 'zip_codes', 'search_radius_miles', 'neighborhood', 'focus'],
    outputSchema: {
      name: INTELLIGENCE_DISCOVERY_SCHEMA_NAME,
      description: 'Intelligence Discovery — emerging focus. Validates discovered candidates with category fit, identity confidence, location status, discovery signals, and Business Seek recommendations.',
    },
    isDefault: false,
  },
  {
    id: 'mpt-seed-intel-discovery-competitive-001',
    name: 'Seek: Intelligence Discovery (Competitive)',
    promptType: 'seek' as const,
    scope: 'intelligence' as const,
    body: `{{#compose_intelligence}}
This prompt is composed at runtime by PromptComposerService.
Focus: COMPETITIVE — analyze established competitors.
{{/compose_intelligence}}`,
    variables: ['category', 'city', 'state', 'zip_codes', 'search_radius_miles', 'neighborhood', 'focus'],
    outputSchema: {
      name: INTELLIGENCE_DISCOVERY_SCHEMA_NAME,
      description: 'Intelligence Discovery — competitive focus. Validates discovered competitors with category fit, identity confidence, location status, discovery signals, and Business Seek recommendations.',
    },
    isDefault: false,
  },
];

async function main() {
  const service = MarketingPromptService.getInstance();

  for (const tmpl of DISCOVERY_TEMPLATES) {
    const existing = await service.getTemplate(tmpl.id);
    if (existing) {
      await service.updateTemplate(tmpl.id, {
        name: tmpl.name,
        body: tmpl.body,
        variables: tmpl.variables,
        outputSchema: tmpl.outputSchema,
      });
      logger.info(`Updated discovery template: ${tmpl.id}`, undefined, { id: tmpl.id, focus: tmpl.name.includes('Emerging') ? 'emerging' : 'competitive' });
    } else {
      await service.createTemplate({
        id: tmpl.id,
        name: tmpl.name,
        promptType: tmpl.promptType,
        scope: tmpl.scope,
        body: tmpl.body,
        variables: tmpl.variables,
        outputSchema: tmpl.outputSchema,
        isDefault: tmpl.isDefault,
      } as any);
      logger.info(`Created discovery template: ${tmpl.id}`, undefined, { id: tmpl.id, focus: tmpl.name.includes('Emerging') ? 'emerging' : 'competitive' });
    }
  }

  logger.info('Intelligence discovery templates seeded successfully', undefined, { count: DISCOVERY_TEMPLATES.length });
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, { error: (err as Error).message });
  process.exit(1);
});

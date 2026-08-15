/**
 * Seed script: Intelligence Profile Establishment Template (GAP-P8)
 *
 * Seeds the dedicated prompt template that instructs an external AI to
 * produce a §10 Category Intelligence Profile JSON for a given category.
 * The operator runs this prompt in an external AI, then imports the result
 * via /executions/external — the result is validated against the
 * intelligence_profile schema and persisted as a DRAFT profile.
 *
 * The template uses the 'intelligence' scope and has
 * output_schema = { name: 'intelligence_profile' }.
 *
 * Idempotent — uses a deterministic ID so re-running updates in place.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/seed-intelligence-profile-establishment-template.ts
 */

import { MarketingPromptService } from '../services/MarketingPromptService';
import { logger } from '../logger';
import { INTELLIGENCE_PROFILE_SCHEMA_NAME } from '../validators/intelligence-profile.schema';

const ESTABLISHMENT_TEMPLATE = {
  id: 'mpt-seed-intel-profile-establishment-001',
  name: 'Seek: Intelligence Profile Establishment',
  promptType: 'seek' as const,
  scope: 'intelligence' as const,
  body: `You are a category intelligence analyst. Your task is to establish a Category Intelligence Profile for the following category.

CATEGORY: {{category}}
CITY (reference market): {{city}}
STATE: {{state}}

=== OBJECTIVE ===
Produce a comprehensive Category Intelligence Profile that describes how to discover businesses in this category and what evidence ecosystems matter when auditing a business in this category.

The profile will be used to:
1. Guide Intelligence-scope discovery audits (finding qualifying businesses)
2. Amplify Business-scope audit prompts with category-specific evidence rules

=== PROFILE SECTIONS ===

1. TERMINOLOGY — Define the key terms used in this category. What do practitioners call their work? What terms would a customer use? What industry-specific vocabulary matters?

2. SYNONYMS — List alternative names for this category (what people search for when looking for this type of business).

3. SUBCATEGORIES — Identify the major subcategories within this category. Not all businesses in the category do the same thing — what are the specializations?

4. SPECIALIZED SOURCES — This is the most important section. Identify the category-specific sources that are useful for discovering and verifying businesses in this category. For each source:
   - Name: the source name
   - Type: service_history | certification | professional_network | mainstream_directory | vertical_directory | social_platform | other
   - Priority: 1 (highest) to 5 (lowest)
   - Capabilities: what this source CAN tell you (list at least one)
   - Limitations: what this source CANNOT tell you or what it does NOT measure (list at least one)
   
   CRITICAL: Limitations are as important as capabilities. A source's limitations define what inferences must NOT be made from its data. For example, "CARFAX service history is NOT a review system" is a limitation that prevents conflating service records with customer reviews.

5. DISCOVERY PATTERNS — How should an analyst search for businesses in this category? What vertical directories, professional networks, or niche platforms should be searched? What search strategies surface businesses that are invisible to mainstream search?

6. CATEGORY EVIDENCE RULES — What evidence indicates that a business is active, qualified, and a good prospect? What evidence is meaningful for this category specifically (as opposed to generic digital-presence signals)?

7. PROHIBITED INFERENCES — List at least one inference that must NOT be made for this category. These are inferences that seem reasonable but are actually incorrect or misleading. For example:
   - "Absence from [source] does NOT mean the business is inactive"
   - "[Source] record count ≠ total customers served"
   - "No website does NOT mean no customers"
   - "Low [platform] review count does NOT mean few customers"

8. CATEGORY SIGNALS — List the INT_* signal codes that are most relevant to this category. Use the canonical INT_ family:
   INT_LOW_VISIBILITY, INT_WEAK_MAINSTREAM_INDEXING, INT_SINGLE_SOURCE, INT_HIDDEN_TRUST, INT_RECENT_BUSINESS_EVIDENCE, INT_POSSIBLE_CATEGORY_MISALIGNMENT, INT_VERTICAL_SOURCE_DISCOVERY, INT_MULTISOURCE_IDENTITY, INT_ACTIVE_OPERATIONAL_EVIDENCE, INT_CATEGORY_SPECIALIZATION, INT_UNDEREXPOSED_CREDENTIAL

=== EVIDENCE SAFETY ===
Do NOT convert unavailable information into a negative signal. "Website not found during discovery" is not the same as "no website exists." Record what you found and what you could not verify as separate observations. The prohibited_inferences section is where you document inferences that must not be made from absence of evidence.

=== OUTPUT REQUIREMENT ===
Respond with a SINGLE JSON object only. Do NOT wrap it in markdown code fences. Do NOT include prose before or after the JSON. Do NOT include commentary. The JSON object must match the structure described in the EXPECTED OUTPUT FORMAT section below.`,
  variables: ['category', 'city', 'state'],
  outputSchema: {
    name: INTELLIGENCE_PROFILE_SCHEMA_NAME,
    description: 'Category Intelligence Profile — §10 structure with terminology, specialized sources (capabilities + limitations), discovery patterns, evidence rules, prohibited inferences, and category signals.',
  },
  isDefault: false,
};

async function main() {
  const service = MarketingPromptService.getInstance();

  const existing = await service.getTemplate(ESTABLISHMENT_TEMPLATE.id);
  if (existing) {
    await service.updateTemplate(ESTABLISHMENT_TEMPLATE.id, {
      name: ESTABLISHMENT_TEMPLATE.name,
      body: ESTABLISHMENT_TEMPLATE.body,
      variables: ESTABLISHMENT_TEMPLATE.variables,
      outputSchema: ESTABLISHMENT_TEMPLATE.outputSchema,
    });
    logger.info(`Updated establishment template: ${ESTABLISHMENT_TEMPLATE.id}`, undefined, { id: ESTABLISHMENT_TEMPLATE.id });
  } else {
    await service.createTemplate({
      name: ESTABLISHMENT_TEMPLATE.name,
      promptType: ESTABLISHMENT_TEMPLATE.promptType,
      scope: ESTABLISHMENT_TEMPLATE.scope,
      body: ESTABLISHMENT_TEMPLATE.body,
      variables: ESTABLISHMENT_TEMPLATE.variables,
      outputSchema: ESTABLISHMENT_TEMPLATE.outputSchema,
      isDefault: ESTABLISHMENT_TEMPLATE.isDefault,
    });
    logger.info(`Created establishment template: ${ESTABLISHMENT_TEMPLATE.id}`, undefined, { id: ESTABLISHMENT_TEMPLATE.id });
  }
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, { error: (err as Error).message });
  process.exit(1);
});

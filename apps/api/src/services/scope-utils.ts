/**
 * Scope compatibility helpers — shared between MarketingExecutionService
 * and MarketingPromptService (external import).
 *
 * Extracted into a separate module to avoid a circular dependency:
 *   MarketingExecutionService → MarketingPromptService → MarketingExecutionService
 */

/**
 * ScopeMismatchError — thrown when a prompt template's scope does not match
 * the campaign's scope. Surfaces as a 400 with a field-level message.
 */
export class ScopeMismatchError extends Error {
  readonly templateScope: string;
  readonly campaignScope: string;
  constructor(templateScope: string, campaignScope: string) {
    super(`template scope "${templateScope}" is not compatible with campaign scope "${campaignScope}"`);
    this.name = 'ScopeMismatchError';
    this.templateScope = templateScope;
    this.campaignScope = campaignScope;
  }
}

/**
 * Scope → variable mapping.
 * Determines which campaign variables `renderTemplate` injects for a given scope.
 *   - business: all variables (full business context)
 *   - category: category/city/neighborhood/tone/attributes (no business_name,
 *     no business-specific GBP/website fields)
 *   - city: city/neighborhood only (no business_name, no category-specific fields)
 *
 * Templates referencing out-of-scope variables are rejected at render time
 * to prevent silently producing broken prompts with empty substitutions.
 */
export const SCOPE_VARIABLES: Record<string, string[]> = {
  business: [
    'business_name', 'category', 'city', 'state', 'neighborhood', 'contact_method',
    'contact_info', 'unaddressed_reviews', 'last_review_date', 'gbp_claimed',
    'has_website', 'nap_consistent', 'pain_score', 'estimated_tier', 'notes',
    'tone', 'attributes',
  ],
  category: ['category', 'city', 'state', 'neighborhood', 'tone', 'attributes'],
  city: ['city', 'state', 'neighborhood'],
  intelligence: ['category', 'city', 'state', 'zip_codes', 'search_radius_miles', 'focus', 'neighborhood'],
};

/**
 * Assert that a prompt template's scope is compatible with a campaign's scope.
 * Throws ScopeMismatchError (→ 400) on mismatch.
 */
export function assertScopeCompatible(template: { scope?: string | null }, campaign: { scope?: string | null }): void {
  const templateScope = (template.scope ?? 'business').toLowerCase();
  const campaignScope = (campaign.scope ?? 'business').toLowerCase();
  if (templateScope !== campaignScope) {
    throw new ScopeMismatchError(templateScope, campaignScope);
  }
}

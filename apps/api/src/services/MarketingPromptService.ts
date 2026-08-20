/**
 * MarketingPromptService — Prompt template CRUD + AI execution
 *
 * Manages versioned prompt templates and executes them via AIProviderService.
 * Quality filter flags are created for responses that fail validation checks.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/local_marketing_ops_gap_analysis_and_optimized_plan.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { createHash } from 'crypto';
import { generatePromptTemplateId, generatePromptExecutionId, generateFilterFlagId, generateMarketingAuditId } from '../lib/id-generator';
import { resolveOutputSchema } from '../validators/market-analysis.schema';
import { normalizeIntelligenceDiscoveryPayload, INTELLIGENCE_DISCOVERY_SCHEMA_NAME } from '../validators/intelligence-discovery.schema';
import { assertScopeCompatible, ScopeMismatchError } from './scope-utils';
import MarketingCampaignService from './MarketingCampaignService';
import { unifiedConfig } from '../config/unifiedConfig';

/**
 * Compute a SHA-256 hash of a prompt template body for provenance stamping
 * (GAP-P4). Stored on mkt_prompt_executions_list.template_body_hash so
 * historical runs can be attributed to the exact prompt text that produced
 * them, even if the template is later updated (mutated in place).
 */
function computeBodyHash(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

export type PromptType = 'seek' | 'fulfill' | 'filter' | 'retainer' | 'category_analysis' | 'city_analysis' | 'fragment';

export type PromptScope = 'business' | 'category' | 'city' | 'intelligence';

export type IntelligenceFocus = 'emerging' | 'competitive';
export type IntelligenceCampaignKind = 'discovery' | 'establishment';

export interface PromptTemplateInput {
  name: string;
  promptType: PromptType;
  scope?: PromptScope;
  category?: string;
  tone?: string;
  body: string;
  variables?: any;
  outputSchema?: any;
  isDefault?: boolean;
  createdBy?: string;
  fragmentKind?: string;
  intelligenceFocus?: IntelligenceFocus | null;
  intelligenceCampaignKind?: IntelligenceCampaignKind | null;
  /** Optional deterministic ID (used by seed scripts for idempotent upsert). */
  id?: string;
}

export interface PromptExecutionInput {
  campaignId: string;
  templateId?: string;
  variablesUsed?: any;
  executedBy?: string;
  /** Resolution metadata from resolvePrompt() — profile amplification provenance (§1B). */
  resolution?: {
    profile_id: string | null;
    profile_version: number | null;
    intelligence_mode: 'profile' | 'none';
  };
}

/**
 * Strip common LLM JSON-generation artifacts that produce invalid JSON but are
 * semantically recoverable. Applied before JSON.parse in the external-import
 * flow as a defensive fallback when prompt guardrails don't fully hold.
 *
 * Currently handles:
 *   - Labeled array elements: e.g. `decline_3: { "rank": 3, ... }` inside a
 *     JSON array. LLMs sometimes emit JS-object-key syntax for subsequent
 *     array elements when the schema example only shows one element. The label
 *     (identifier followed by a colon) is stripped, leaving a bare `{ ... }`.
 *
 * Does NOT mutate the original string; returns a cleaned copy. If cleaning
 * fails or the input is unchanged, the original is returned so JSON.parse can
 * surface the original parse error.
 */
function stripLlmJsonArtifacts(raw: string): string {
  try {
    let text = raw;

    // 1. Extract from ```json ... ``` or ``` ... ``` code fences.
    //    LLMs often wrap JSON output in markdown code blocks.
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/i);
    if (fenceMatch) {
      text = fenceMatch[1].trim();
    }

    // 2. If the text is not pure JSON (starts with `{` or `[`), try to extract
    //    the outermost JSON object or array by finding the first `{` or `[`
    //    and matching to the corresponding closing `}` or `]`.
    const firstBrace = text.search(/[{[]/);
    if (firstBrace > 0) {
      const openChar = text[firstBrace];
      const closeChar = openChar === '{' ? '}' : ']';
      // Find the matching closing brace by counting depth
      let depth = 0;
      let inString = false;
      let escape = false;
      let endIdx = -1;
      for (let i = firstBrace; i < text.length; i++) {
        const ch = text[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === openChar) depth++;
        else if (ch === closeChar) {
          depth--;
          if (depth === 0) { endIdx = i; break; }
        }
      }
      if (endIdx > firstBrace) {
        text = text.substring(firstBrace, endIdx + 1);
      }
    }

    // 3. Strip a leading identifier label immediately preceding a `{` that itself
    //    follows a `,` or `[` (i.e. an array context). Matches patterns like:
    //    `, decline_3: {`  →  `, {`
    //    `[ city_1: {`     →  `[ {`
    //    The label is a bare word (letters, digits, underscore) followed by `:`.
    //    We require whitespace or nothing between the comma/bracket and the label.
    text = text.replace(/([\[,])\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*\{/g, '$1 {');

    return text;
  } catch {
    return raw;
  }
}

/**
 * Extract all top-level JSON objects/arrays from a raw text string as
 * separate substrings (not yet parsed). Used when an external agent's
 * raw_output contains multiple JSON payloads — e.g. a chained prompt that
 * emits a competitive audit followed by a category intelligence profile —
 * and we need to find the one matching the expected output schema.
 *
 * Handles markdown code fences (```json ... ```): fenced block contents are
 * collected and scanned alongside any unfenced JSON. Returns candidates in
 * order of appearance.
 */
function extractJsonCandidates(raw: string): string[] {
  const candidates: string[] = [];
  let text = raw;

  // Collect all ```json ... ``` fenced blocks; use their contents as the
  // search text. If no fences are present, scan the raw text directly.
  const fenceGlobal = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/gi;
  const fenceMatches = [...text.matchAll(fenceGlobal)];
  if (fenceMatches.length > 0) {
    text = fenceMatches.map((m) => m[1]).join('\n');
  }

  // Scan for top-level { or [ and extract each balanced block.
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '{' || ch === '[') {
      const openChar = ch;
      const closeChar = openChar === '{' ? '}' : ']';
      let depth = 0;
      let inString = false;
      let escape = false;
      let endIdx = -1;
      for (let j = i; j < text.length; j++) {
        const c = text[j];
        if (escape) { escape = false; continue; }
        if (c === '\\' && inString) { escape = true; continue; }
        if (c === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (c === openChar) depth++;
        else if (c === closeChar) {
          depth--;
          if (depth === 0) { endIdx = j; break; }
        }
      }
      if (endIdx > i) {
        candidates.push(text.substring(i, endIdx + 1));
        i = endIdx + 1;
      } else {
        i++; // unbalanced opener; skip
      }
    } else {
      i++;
    }
  }
  return candidates;
}

/**
 * Build a user-actionable error message from a JSON.parse failure, surfacing
 * the parse error position and a snippet of the surrounding content so the
 * operator can locate and fix the syntax error in pasted LLM output.
 *
 * V8's SyntaxError for JSON.parse includes a `message` like
 *   "Unexpected non-whitespace character after JSON at position 2732 (line 1 column 2733)"
 * We extract the position, show ~60 chars of context on either side, and mark
 * the exact offset with `<HERE>`.
 */
function formatJsonParseError(e: unknown, raw: string): string {
  const msg = (e as Error).message || 'Unknown parse error';
  const posMatch = msg.match(/position (\d+)/);
  if (!posMatch) {
    return `raw_output is not valid JSON: ${msg}`;
  }
  const pos = parseInt(posMatch[1], 10);
  const start = Math.max(0, pos - 60);
  const end = Math.min(raw.length, pos + 60);
  const before = raw.substring(start, pos);
  const after = raw.substring(pos, end);
  return (
    `raw_output is not valid JSON: ${msg}\n` +
    `Context near offset ${pos}:\n` +
    `${JSON.stringify(before)}<HERE>${JSON.stringify(after)}`
  );
}

export class MarketingPromptService extends BaseService {
  private static instance: MarketingPromptService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingPromptService {
    if (!MarketingPromptService.instance) {
      MarketingPromptService.instance = new MarketingPromptService();
    }
    return MarketingPromptService.instance;
  }

  // ====================
  // PROMPT TEMPLATES
  // ====================

  async createTemplate(input: PromptTemplateInput, ctx?: RequestCtx): Promise<any> {
    const id = input.id || generatePromptTemplateId();
    const scope = input.scope ?? (input.promptType === 'category_analysis' ? 'category' : input.promptType === 'city_analysis' ? 'city' : 'business');
    try {
      if (input.isDefault) {
        await this.clearDefaultForType(input.promptType, scope, input.category, input.tone, input.intelligenceFocus, input.intelligenceCampaignKind);
      }
      const template = await this.prisma.mkt_prompt_templates_list.create({
        data: {
          id,
          name: input.name,
          prompt_type: input.promptType,
          scope,
          category: input.category || null,
          tone: input.tone || null,
          version: 1,
          body: input.body,
          variables: input.variables || null,
          output_schema: input.outputSchema ?? null,
          is_active: true,
          is_default: input.isDefault || false,
          created_by: input.createdBy || null,
          fragment_kind: input.fragmentKind || null,
          intelligence_focus: input.intelligenceFocus ?? null,
          intelligence_campaign_kind: input.intelligenceCampaignKind ?? null,
        },
      });
      logger.info('Prompt template created', ctx, { templateId: id, name: input.name, type: input.promptType });
      return template;
    } catch (error) {
      logger.error('Failed to create prompt template', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async getTemplate(id: string, ctx?: RequestCtx): Promise<any | null> {
    try {
      return await this.prisma.mkt_prompt_templates_list.findUnique({ where: { id } });
    } catch (error) {
      logger.error('Failed to get prompt template', ctx, { error: (error as Error).message, templateId: id });
      throw this.handleError(error, ctx);
    }
  }

  async listTemplates(filters: {
    promptType?: PromptType;
    scope?: PromptScope;
    category?: string;
    tone?: string;
    isActive?: boolean;
    fragmentKind?: string;
    intelligenceFocus?: IntelligenceFocus;
    intelligenceCampaignKind?: IntelligenceCampaignKind;
    /**
     * When set, returns templates whose intelligence_focus /
     * intelligence_campaign_kind match the provided values OR are NULL
     * (legacy/untyped templates). Used by the campaign Prompts tab so a
     * focus+kind campaign sees its matching templates plus any untyped
     * ones, without hiding legacy rows.
     */
    includeNullFocusKind?: boolean;
  } = {}, ctx?: RequestCtx): Promise<any[]> {
    const where: any = {};
    if (filters.promptType) where.prompt_type = filters.promptType;
    if (filters.scope) where.scope = filters.scope;
    if (filters.category) where.category = filters.category;
    if (filters.tone) where.tone = filters.tone;
    if (filters.isActive !== undefined) where.is_active = filters.isActive;
    if (filters.fragmentKind) where.fragment_kind = filters.fragmentKind;

    const hasFocusFilter = filters.intelligenceFocus || filters.intelligenceCampaignKind;
    if (hasFocusFilter) {
      // Per-field wildcard matching: each filtered field matches if the
      // template's value equals the filter value OR (when includeNullFocusKind
      // is set) the template's value is NULL. Fields are combined with AND.
      //
      // This lets focus-agnostic templates (e.g. the Intelligence Profile
      // Establishment template, which has intelligence_campaign_kind=
      // 'establishment' but intelligence_focus=NULL) match campaigns that
      // carry a focus. The previous all-or-nothing logic required BOTH fields
      // to match exactly or BOTH to be NULL, which hid the establishment
      // template from establishment campaigns (the campaign always has a
      // focus since the form requires it).
      const andClauses: any[] = [];
      if (filters.intelligenceFocus) {
        const focusOptions: any[] = [{ intelligence_focus: filters.intelligenceFocus }];
        if (filters.includeNullFocusKind) focusOptions.push({ intelligence_focus: null });
        andClauses.push({ OR: focusOptions });
      }
      if (filters.intelligenceCampaignKind) {
        const kindOptions: any[] = [{ intelligence_campaign_kind: filters.intelligenceCampaignKind }];
        if (filters.includeNullFocusKind) kindOptions.push({ intelligence_campaign_kind: null });
        andClauses.push({ OR: kindOptions });
      }
      where.AND = [...(where.AND ?? []), ...andClauses];
    }

    try {
      return await this.prisma.mkt_prompt_templates_list.findMany({
        where,
        orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
      });
    } catch (error) {
      logger.error('Failed to list prompt templates', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async updateTemplate(id: string, input: Partial<PromptTemplateInput>, ctx?: RequestCtx): Promise<any> {
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.promptType !== undefined) data.prompt_type = input.promptType;
    if (input.scope !== undefined) data.scope = input.scope;
    if (input.category !== undefined) data.category = input.category;
    if (input.tone !== undefined) data.tone = input.tone;
    if (input.body !== undefined) data.body = input.body;
    if (input.variables !== undefined) data.variables = input.variables;
    if (input.outputSchema !== undefined) data.output_schema = input.outputSchema;
    if (input.fragmentKind !== undefined) data.fragment_kind = input.fragmentKind;
    if (input.intelligenceFocus !== undefined) data.intelligence_focus = input.intelligenceFocus;
    if (input.intelligenceCampaignKind !== undefined) data.intelligence_campaign_kind = input.intelligenceCampaignKind;
    if (input.isDefault !== undefined) {
      if (input.isDefault) {
        const current = await this.prisma.mkt_prompt_templates_list.findUnique({ where: { id } });
        if (current) {
          const targetScope = (input.scope ?? current.scope) as PromptScope;
          const targetPromptType = (input.promptType ?? current.prompt_type) as PromptType;
          const targetFocus = (input.intelligenceFocus ?? current.intelligence_focus) as IntelligenceFocus | null;
          const targetKind = (input.intelligenceCampaignKind ?? current.intelligence_campaign_kind) as IntelligenceCampaignKind | null;
          await this.clearDefaultForType(
            targetPromptType,
            targetScope,
            input.category ?? current.category,
            input.tone ?? current.tone,
            targetFocus ?? undefined,
            targetKind ?? undefined,
          );
        }
      }
      data.is_default = input.isDefault;
    }

    try {
      return await this.prisma.mkt_prompt_templates_list.update({ where: { id }, data });
    } catch (error) {
      logger.error('Failed to update prompt template', ctx, { error: (error as Error).message, templateId: id });
      throw this.handleError(error, ctx);
    }
  }

  async deleteTemplate(id: string, ctx?: RequestCtx): Promise<void> {
    try {
      await this.prisma.mkt_prompt_templates_list.delete({ where: { id } });
      logger.info('Prompt template deleted', ctx, { templateId: id });
    } catch (error) {
      logger.error('Failed to delete prompt template', ctx, { error: (error as Error).message, templateId: id });
      throw this.handleError(error, ctx);
    }
  }

  async cloneTemplate(id: string, overrides: { name?: string; createdBy?: string } = {}, ctx?: RequestCtx): Promise<any> {
    const original = await this.getTemplate(id, ctx);
    if (!original) {
      throw new Error('Prompt template not found');
    }
    const cloneName = (overrides.name || `Copy of ${original.name}`).slice(0, 100);
    return this.createTemplate({
      name: cloneName,
      promptType: original.prompt_type as PromptType,
      scope: original.scope as PromptScope,
      category: original.category,
      tone: original.tone,
      body: original.body,
      variables: original.variables,
      outputSchema: original.output_schema,
      isDefault: false,
      createdBy: overrides.createdBy,
      fragmentKind: original.fragment_kind ?? undefined,
      intelligenceFocus: (original.intelligence_focus as IntelligenceFocus | null) ?? undefined,
      intelligenceCampaignKind: (original.intelligence_campaign_kind as IntelligenceCampaignKind | null) ?? undefined,
    }, ctx);
  }

  private async clearDefaultForType(
    promptType: string,
    scope: PromptScope,
    category: string | null | undefined,
    tone: string | null | undefined,
    intelligenceFocus?: IntelligenceFocus | null,
    intelligenceCampaignKind?: IntelligenceCampaignKind | null,
  ): Promise<void> {
    await this.prisma.mkt_prompt_templates_list.updateMany({
      where: {
        prompt_type: promptType,
        scope,
        is_default: true,
        ...(category ? { category } : {}),
        ...(tone ? { tone } : {}),
        ...(intelligenceFocus ? { intelligence_focus: intelligenceFocus } : {}),
        ...(intelligenceCampaignKind ? { intelligence_campaign_kind: intelligenceCampaignKind } : {}),
      },
      data: { is_default: false },
    });
  }

  // ====================
  // PROMPT EXECUTIONS
  // ====================

  async createExecution(input: PromptExecutionInput, ctx?: RequestCtx): Promise<any> {
    const id = generatePromptExecutionId();
    try {
      // Snapshot template provenance (GAP-P4) — stamp template_version +
      // template_body_hash (+ optional full body) so historical runs can be
      // attributed to the prompt text that produced them. Also stamp resolution
      // metadata (GAP-P7 §1B) if provided by resolvePrompt().
      let templateVersion: number | null = null;
      let templateBodyHash: string | null = null;
      let templateBodySnapshot: string | null = null;
      if (input.templateId) {
        const tpl = await this.prisma.mkt_prompt_templates_list.findUnique({
          where: { id: input.templateId },
          select: { version: true, body: true },
        });
        if (tpl) {
          templateVersion = tpl.version;
          templateBodyHash = computeBodyHash(tpl.body);
          templateBodySnapshot = tpl.body;
        }
      }

      const execution = await this.prisma.mkt_prompt_executions_list.create({
        data: {
          id,
          campaign_id: input.campaignId,
          template_id: input.templateId || null,
          variables_used: input.variablesUsed || null,
          executed_by: input.executedBy || null,
          status: 'pending',
          template_version: templateVersion,
          template_body_hash: templateBodyHash,
          template_body_snapshot: templateBodySnapshot,
        },
      });
      logger.info('Prompt execution created', ctx, {
        executionId: id,
        campaignId: input.campaignId,
        templateVersion,
        templateBodyHash: templateBodyHash?.slice(0, 12),
        resolution: input.resolution ?? null,
      });
      return execution;
    } catch (error) {
      logger.error('Failed to create prompt execution', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async updateExecution(id: string, input: {
    rawOutput?: string;
    filteredOutput?: string;
    passRate?: number;
    flaggedCount?: number;
    status?: string;
    aiProvider?: string;
    aiModel?: string;
    tokensUsed?: number;
    costCents?: number;
  }, ctx?: RequestCtx): Promise<any> {
    const data: any = {};
    if (input.rawOutput !== undefined) data.raw_output = input.rawOutput;
    if (input.filteredOutput !== undefined) data.filtered_output = input.filteredOutput;
    if (input.passRate !== undefined) data.pass_rate = input.passRate;
    if (input.flaggedCount !== undefined) data.flagged_count = input.flaggedCount;
    if (input.status !== undefined) data.status = input.status;
    if (input.aiProvider !== undefined) data.ai_provider = input.aiProvider;
    if (input.aiModel !== undefined) data.ai_model = input.aiModel;
    if (input.tokensUsed !== undefined) data.tokens_used = input.tokensUsed;
    if (input.costCents !== undefined) data.cost_cents = input.costCents;

    try {
      return await this.prisma.mkt_prompt_executions_list.update({ where: { id }, data });
    } catch (error) {
      logger.error('Failed to update prompt execution', ctx, { error: (error as Error).message, executionId: id });
      throw this.handleError(error, ctx);
    }
  }

  async getExecution(id: string, ctx?: RequestCtx): Promise<any | null> {
    try {
      return await this.prisma.mkt_prompt_executions_list.findUnique({
        where: { id },
        include: {
          mkt_filter_flags_list: true,
          mkt_prompt_templates_list: true,
        },
      });
    } catch (error) {
      logger.error('Failed to get prompt execution', ctx, { error: (error as Error).message, executionId: id });
      throw this.handleError(error, ctx);
    }
  }

  async listExecutions(
    options: { campaignId?: string; templateId?: string; status?: string; limit?: number; offset?: number } = {},
    ctx?: RequestCtx,
  ): Promise<any[]> {
    const { campaignId, templateId, status, limit, offset } = options;
    const where: any = {};
    if (campaignId) where.campaign_id = campaignId;
    if (templateId) where.template_id = templateId;
    if (status) where.status = status;

    // Bound the result set — default 50, hard cap 200.
    const take = Math.min(Math.max(limit ?? 50, 1), 200);
    const skip = Math.max(offset ?? 0, 0);

    try {
      return await this.prisma.mkt_prompt_executions_list.findMany({
        where,
        orderBy: { executed_at: 'desc' },
        take,
        skip,
        // Lightweight projection — exclude payload-heavy fields that are only
        // needed when viewing a single execution via getExecution(:id).
        // variables_used, raw_output, filtered_output, template_body_snapshot
        // can each be very large and are not consumed by list views.
        select: {
          id: true,
          campaign_id: true,
          template_id: true,
          pass_rate: true,
          flagged_count: true,
          status: true,
          executed_by: true,
          executed_at: true,
          ai_provider: true,
          ai_model: true,
          tokens_used: true,
          cost_cents: true,
          created_at: true,
          updated_at: true,
          sync_report: true,
          template_version: true,
          template_body_hash: true,
        },
      });
    } catch (error) {
      logger.error('Failed to list prompt executions', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // EXTERNAL RESULT IMPORT
  // ====================

  /**
   * Import an external agent's JSON result as a prompt execution + optional audit.
   *
   * Flow:
   *   1. Load template + campaign; assert scope compatibility (S0b).
   *   2. Parse raw_output as JSON; validate against the template's declared
   *      output_schema (via OUTPUT_SCHEMA_REGISTRY). Throws on invalid JSON
   *      or schema mismatch with field-level Zod issues.
   *   3. Transactionally create:
   *      a. mkt_prompt_executions_list record (status='completed', source='external')
   *      b. mkt_audits_list record IF the output_schema's auditPlatform is set
   *         (keyed off output_schema->>'name', NOT prompt_type — fixes G18).
   *
   * Returns { execution, audit }.
   */
  async importExternalResult(input: {
    campaignId: string;
    templateId: string;
    rawOutput: string;
    source?: string;
    costCents?: number;
    /** Free-form metadata stored on the audit (model, provider, run_id, notes). */
    metadata?: Record<string, any>;
    executedBy?: string;
    /** Resolution metadata from resolvePrompt() — profile amplification provenance (§1B, GAP-P7).
     *  Accepted on the external-import path so imported results carry the same
     *  provenance an internal run stamps automatically. */
    resolution?: {
      profile_id: string | null;
      profile_version: number | null;
      intelligence_mode: 'profile' | 'none';
    };
    /** Intelligence focus for intelligence-scope imports (§41 run record). */
    focus?: 'emerging' | 'competitive';
  }, ctx?: RequestCtx): Promise<{ execution: any; audit: any | null }> {
    try {
      // 1. Load template + campaign
      const template = await this.getTemplate(input.templateId, ctx);
      if (!template) {
        throw new Error(`Template ${input.templateId} not found`);
      }
      const campaign = await MarketingCampaignService.getCampaign(input.campaignId, ctx);
      if (!campaign) {
        throw new Error(`Campaign ${input.campaignId} not found`);
      }

      // 2. Scope check (S0b)
      assertScopeCompatible(template, campaign);

      // 3. Parse + validate JSON against the template's output_schema.
      //    The raw_output may contain multiple JSON objects when an external
      //    agent runs a chained prompt (e.g. a competitive audit followed by
      //    a category intelligence profile). Extract all top-level JSON
      //    candidates and use the first one that validates against the
      //    expected schema, so the operator doesn't have to manually isolate
      //    the schema-matching payload from a multi-step agent transcript.
      const schemaName = template.output_schema?.name ?? null;
      const resolved = resolveOutputSchema(schemaName);
      if (!resolved) {
        throw new Error(
          `Template "${template.name}" does not declare a recognized output_schema (got "${schemaName ?? 'none'}"). ` +
          `Cannot validate external result. Add an output_schema to the template first.`,
        );
      }

      const candidates = extractJsonCandidates(input.rawOutput);
      let parsedJson: any | null = null;
      let firstValidationIssues: string | null = null;

      for (const candidate of candidates) {
        let candidateJson: any;
        try {
          candidateJson = JSON.parse(stripLlmJsonArtifacts(candidate));
        } catch {
          continue; // skip unparseable candidates
        }

        // Normalize intelligence_discovery payloads before validation: some
        // models emit `qualifying_businesses` as reference-style entries
        // ({business_name, note}) pointing back at discovered_businesses rather
        // than full duplicate records. Resolve those references into full records
        // so the schema accepts the payload without forcing operators to re-run.
        if (schemaName === INTELLIGENCE_DISCOVERY_SCHEMA_NAME) {
          candidateJson = normalizeIntelligenceDiscoveryPayload(candidateJson);
        }

        const candidateResult = resolved.validator.safeParse(candidateJson);
        if (candidateResult.success) {
          parsedJson = candidateJson;
          break;
        }
        // Preserve the first candidate's validation issues for error reporting
        // if no candidate matches (keeps the original error behavior for the
        // common single-JSON case).
        if (!firstValidationIssues) {
          firstValidationIssues = candidateResult.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
        }
      }

      if (!parsedJson) {
        // No candidate validated. If we found at least one JSON object, report
        // the first candidate's schema issues. If no JSON was found at all,
        // fall back to the legacy single-parse path to surface a parse error.
        if (firstValidationIssues) {
          throw new Error(`External result does not match the "${schemaName}" output schema: ${firstValidationIssues}`);
        }
        try {
          JSON.parse(stripLlmJsonArtifacts(input.rawOutput));
        } catch (e) {
          throw new Error(formatJsonParseError(e, input.rawOutput));
        }
        throw new Error(
          `External result does not match the "${schemaName}" output schema: no valid JSON found in raw_output`,
        );
      }

      // 4. Transactionally create execution + audit
      //    Snapshot template provenance (GAP-P4) — same as createExecution.
      const executionId = generatePromptExecutionId();
      const templateVersion = template.version;
      const templateBodyHash = computeBodyHash(template.body);
      const templateBodySnapshot = template.body;
      const result = await this.prisma.$transaction(async (tx) => {
        const execution = await tx.mkt_prompt_executions_list.create({
          data: {
            id: executionId,
            campaign_id: input.campaignId,
            template_id: input.templateId,
            executed_by: input.executedBy || undefined,
            status: 'completed',
            raw_output: input.rawOutput,
            filtered_output: input.rawOutput,
            ai_provider: input.source || 'external',
            cost_cents: input.costCents ?? undefined,
            template_version: templateVersion,
            template_body_hash: templateBodyHash,
            template_body_snapshot: templateBodySnapshot,
          },
        });

        let audit: any = null;
        if (resolved.auditPlatform) {
          const auditId = generateMarketingAuditId();
          // Extract audit-relevant fields from the validated JSON.
          // market_analysis exposes GBP metrics at parsedJson.market_analysis;
          // regional_city_opportunity is a regional scan with no single
          // business-level rating, so we store the full payload in audit_data
          // and leave the scalar audit columns at their defaults.
          const ma = parsedJson.market_analysis;
          const hasMarketAnalysis = !!ma;
          // Build import metadata: merge explicit operator-provided metadata
          // with the execution's source/ai_provider so the audit always
          // records which model produced it even when metadata is omitted.
          const importMetadata: Record<string, any> = { ...(input.metadata ?? {}) };
          if (input.source && !importMetadata.provider) {
            importMetadata.provider = input.source;
          }
          audit = await tx.mkt_audits_list.create({
            data: {
              id: auditId,
              campaign_id: input.campaignId,
              platform: resolved.auditPlatform,
              review_count: hasMarketAnalysis ? (ma?.average_gbp_metrics?.average_review_count ?? 0) : 0,
              average_rating: hasMarketAnalysis ? (ma?.average_gbp_metrics?.average_rating ?? undefined) : undefined,
              unaddressed_reviews: 0,
              owner_response_rate: 0,
              photo_count: 0,
              mobile_friendly: undefined,
              audit_data: parsedJson,
              import_metadata: Object.keys(importMetadata).length > 0 ? importMetadata : undefined,
            },
          });
        }

        return { execution, audit };
      });

      logger.info('External result imported', ctx, {
        executionId,
        campaignId: input.campaignId,
        templateId: input.templateId,
        schemaName,
        auditCreated: !!result.audit,
      });

      // Sprint 4: best-effort auto-sync of business_analysis audits onto
      // the campaign (data_quality-gated field sync + hotness derivation).
      // Catches + logs errors so a sync failure never fails the import.
      if (result.audit && resolved.auditPlatform === 'business_analysis' && unifiedConfig.marketingOpsHotProspectAutoSyncOnImport) {
        try {
          const { MarketingHotProspectService } = await import('./MarketingHotProspectService.js');
          await MarketingHotProspectService.getInstance().syncFromAudit(result.audit.id, ctx);
          logger.info('Auto-sync of business_analysis audit complete', ctx, {
            auditId: result.audit.id,
            campaignId: input.campaignId,
          });
        } catch (syncErr) {
          logger.error('Auto-sync of business_analysis audit failed (best-effort)', ctx, {
            error: (syncErr as Error).message,
            auditId: result.audit.id,
            campaignId: input.campaignId,
          });
        }
      }

      // GAP-P8: best-effort post-import hook for intelligence_profile schema.
      // When an operator imports an externally-generated profile via
      // /executions/external, the validated JSON is persisted as a DRAFT
      // profile by IntelligenceProfileService.importAsDraft(). The draft is
      // inert — the resolver only returns active profiles, so the operator
      // must explicitly activate it before it affects any prompts.
      // Catches + logs errors so a persistence failure never fails the import.
      if (schemaName === 'intelligence_profile' && resolved.auditPlatform === null) {
        try {
          const { IntelligenceProfileService } = await import('./intelligence/IntelligenceProfileService.js');
          // Migration 202 — Profile Type Alignment: read the establishment
          // campaign's intelligence_focus so the imported draft is born with
          // the correct type lineage. This is the key ghost-bug fix: the
          // operator's campaign focus choice flows end-to-end into the profile.
          // Migration 205 — Profile City Scoping: also read the establishment
          // campaign's city so the draft is scoped to the correct reference
          // market. Without this, a Zionsville establishment campaign would
          // produce a profile that later resolves for an Indianapolis
          // discovery campaign (cross-city contamination).
          const campaign = await this.prisma.mkt_campaigns_list.findUnique({
            where: { id: input.campaignId },
            select: { intelligence_focus: true, city: true },
          });
          const focus = (campaign?.intelligence_focus || 'emerging') as 'emerging' | 'competitive';
          const referenceCity = campaign?.city || null;
          const profile = await IntelligenceProfileService.getInstance().importAsDraft({
            categoryKey: parsedJson.category_key,
            categoryName: parsedJson.category_name,
            configurationJson: parsedJson,
            intelligenceFocus: focus,
            referenceCity,
          }, ctx);
          logger.info('Intelligence profile imported as draft (GAP-P8)', ctx, {
            profileId: profile.id,
            version: profile.version,
            categoryKey: profile.category_key,
            intelligenceFocus: focus,
            referenceCity,
            campaignId: input.campaignId,
          });
        } catch (profileErr) {
          logger.error('Intelligence profile draft persistence failed (best-effort, GAP-P8)', ctx, {
            error: (profileErr as Error).message,
            campaignId: input.campaignId,
          });
        }

        // Migration 201: mark the campaign that received the profile import
        // as an 'establishment' campaign so it is excluded from discovery-
        // workspace campaign pickers. Best-effort — a failure here does not
        // fail the import (the profile is already persisted as a draft).
        try {
          await this.prisma.mkt_campaigns_list.update({
            where: { id: input.campaignId },
            data: { intelligence_campaign_kind: 'establishment' },
          });
          logger.info('Campaign marked as establishment (intelligence_profile import)', ctx, {
            campaignId: input.campaignId,
          });
        } catch (markErr) {
          logger.error('Failed to mark campaign as establishment (best-effort)', ctx, {
            error: (markErr as Error).message,
            campaignId: input.campaignId,
          });
        }
      }

      // Post-import hook for profile_repair_triage schema: persist the
      // validated briefing to repair_triage_briefing on the campaign row so
      // RepairTrackPanel can render it. Without this, imports via the generic
      // /prompts/executions/external endpoint (Prompt Workspace copy-paste
      // bridge) create the execution row but never surface the briefing on
      // the campaign detail page. Mirrors the profile-repair-specific import
      // path (ProfileRepairPromptService.importExternalResult): track floor
      // enforcement + provenance metadata. Best-effort — failure does not
      // fail the import (the execution row is already persisted).
      if (schemaName === 'profile_repair_triage' && parsedJson?.profile_repair_triage) {
        try {
          const { ProfileRepairPromptService, PROFILE_REPAIR_TRIAGE_TEMPLATE_ID } =
            await import('./ProfileRepairPromptService.js');
          const { extractSignals } = await import('./triage/signal-extractor.js');
          const repairService = ProfileRepairPromptService.getInstance();

          const recommendation = parsedJson.profile_repair_triage;

          // Apply the code-side track floor (AI may escalate above, never below)
          const campaignRow = await this.prisma.mkt_campaigns_list.findUnique({
            where: { id: input.campaignId },
            include: {
              mkt_audits_list: { take: 1, orderBy: { created_at: 'desc' } },
            },
          });
          if (campaignRow) {
            const latestAudit = campaignRow.mkt_audits_list?.[0] ?? null;
            const signalCodes = extractSignals({
              campaign: campaignRow,
              auditData: latestAudit?.audit_data as any,
            });
            const floorTrack = repairService.resolveTrackFromSignals(signalCodes);
            if (floorTrack === 'escalated' && recommendation.recommended_track === 'standard') {
              logger.warn('Generic import de-escalated below signal floor; forcing escalated', ctx, {
                campaignId: input.campaignId,
                aiTrack: recommendation.recommended_track,
                floorTrack,
              });
              recommendation.recommended_track = 'escalated';
            }

            await this.prisma.mkt_campaigns_list.update({
              where: { id: input.campaignId },
              data: {
                repair_triage_briefing: {
                  ...recommendation,
                  _execution_id: executionId,
                  _validated: true,
                } as any,
              },
            });
            logger.info('Profile repair triage briefing persisted from generic import', ctx, {
              campaignId: input.campaignId,
              executionId,
              templateId: input.templateId,
            });
          }
        } catch (briefingErr) {
          logger.error('Failed to persist triage briefing from generic import (best-effort)', ctx, {
            error: (briefingErr as Error).message,
            campaignId: input.campaignId,
            executionId,
          });
        }
      }

      return result;
    } catch (error) {
      if (error instanceof ScopeMismatchError) {
        logger.warn('External import scope mismatch', ctx, { error: error.message });
      } else {
        logger.error('Failed to import external result', ctx, { error: (error as Error).message });
      }
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // FILTER FLAGS
  // ====================

  async createFilterFlag(input: {
    executionId: string;
    responseNumber?: number;
    failedChecks?: any;
    suggestedFix?: string;
  }, ctx?: RequestCtx): Promise<any> {
    const id = generateFilterFlagId();
    try {
      const flag = await this.prisma.mkt_filter_flags_list.create({
        data: {
          id,
          execution_id: input.executionId,
          response_number: input.responseNumber || null,
          failed_checks: input.failedChecks || null,
          suggested_fix: input.suggestedFix || null,
          status: 'pending',
        },
      });
      logger.info('Filter flag created', ctx, { flagId: id, executionId: input.executionId });
      return flag;
    } catch (error) {
      logger.error('Failed to create filter flag', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async updateFilterFlag(id: string, input: {
    humanOverride?: string;
    reviewedBy?: string;
    status?: string;
  }, ctx?: RequestCtx): Promise<any> {
    const data: any = {};
    if (input.humanOverride !== undefined) data.human_override = input.humanOverride;
    if (input.reviewedBy !== undefined) data.reviewed_by = input.reviewedBy;
    if (input.status !== undefined) data.status = input.status;
    if (input.reviewedBy !== undefined || input.status !== undefined) data.reviewed_at = new Date();

    try {
      return await this.prisma.mkt_filter_flags_list.update({ where: { id }, data });
    } catch (error) {
      logger.error('Failed to update filter flag', ctx, { error: (error as Error).message, flagId: id });
      throw this.handleError(error, ctx);
    }
  }

  async listFilterFlags(executionId?: string, status?: string, ctx?: RequestCtx): Promise<any[]> {
    const where: any = {};
    if (executionId) where.execution_id = executionId;
    if (status) where.status = status;
    try {
      return await this.prisma.mkt_filter_flags_list.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to list filter flags', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }
}

export default MarketingPromptService.getInstance();

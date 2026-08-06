/**
 * IntakeDefinitionService — registry-driven intake form definitions.
 *
 * Loads definitions from mkt_intake_definitions (cached in-memory), resolves
 * niche overrides, and builds dynamic Zod schemas from the declarative
 * form_schema JSONB. This is the core of the registry-driven architecture
 * (plan §7) — new intake kinds become definition rows, not code.
 *
 * Intake Portal Generalization Sprint 1.
 */

import { z } from 'zod';
import { prisma } from '../../prisma';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';

// ====================
// TYPES
// ====================

export type FieldType =
  | 'text'
  | 'url'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'multiselect'
  | 'checkbox'
  | 'chips'
  | 'hours_grid'
  | 'attachments'
  | 'number'
  | 'date'
  | 'object';

export interface FormField {
  key: string;
  type: FieldType;
  label: string;
  help_text?: string;
  required?: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  options?: Array<{ value: string; label: string }>;
  options_source?: string;
  custom_validator?: string;
  fields?: FormField[]; // nested fields for type === 'object'
}

export interface FieldMapping {
  field: string;
  adapter: string;
  config?: Record<string, any>;
}

export interface OwnerCopy {
  title?: string;
  subtitle?: string;
  intro?: string;
  statement_label?: string;
  success_message?: string;
}

export interface NicheOverride {
  add_fields?: FormField[];
  field_overrides?: Record<string, Partial<FormField>>;
  owner_copy_overrides?: Partial<OwnerCopy>;
}

export interface IntakeDefinition {
  intake_kind: string;
  label: string;
  description: string | null;
  driver: 'code' | 'registry';
  service_category: string | null;
  trigger_stages: string[];
  submitted_stage: string | null;
  form_schema: FormField[];
  field_mappings: FieldMapping[];
  owner_copy: OwnerCopy;
  niche_overrides: Record<string, NicheOverride>;
  downstream_agent: string | null;
  version: number;
  is_active: boolean;
  is_draft: boolean;
}

// ====================
// CUSTOM VALIDATOR REGISTRY
// ====================

/**
 * Whitelisted custom validators that can be referenced by form_schema fields
 * via `custom_validator`. Each returns an error message string or null if valid.
 */
export type CustomValidator = (value: any, ctx?: RequestCtx) => Promise<string | null>;

const customValidators: Record<string, CustomValidator> = {
  gbp_category_ids_exist: async (value: string[], ctx?: RequestCtx): Promise<string | null> => {
    if (!Array.isArray(value) || value.length === 0) return null;
    try {
      const existing = await prisma.gbp_categories_list.findMany({
        where: { id: { in: value } },
        select: { id: true },
      });
      const missing = value.filter((id) => !existing.some((e) => e.id === id));
      if (missing.length > 0) {
        return `Unknown GBP category IDs: ${missing.join(', ')}`;
      }
      return null;
    } catch (error) {
      logger.error('gbp_category_ids_exist validator failed', ctx, { error: (error as Error).message });
      return null; // fail open — don't block submission on validator infra error
    }
  },
};

// ====================
// SERVICE
// ====================

export class IntakeDefinitionService {
  private static instance: IntakeDefinitionService;
  private cache: Map<string, IntakeDefinition> = new Map();
  private cacheLoadedAt: Date | null = null;
  private readonly cacheTtlMs = 60_000; // 1 minute — definitions change rarely

  private constructor() {}

  static getInstance(): IntakeDefinitionService {
    if (!IntakeDefinitionService.instance) {
      IntakeDefinitionService.instance = new IntakeDefinitionService();
    }
    return IntakeDefinitionService.instance;
  }

  /**
   * Invalidate the in-memory cache. Call after admin definition updates.
   */
  invalidateCache(): void {
    this.cache.clear();
    this.cacheLoadedAt = null;
  }

  /**
   * Load all active, non-draft definitions from the DB into the cache.
   * Called once per TTL window.
   */
  private async loadCache(ctx?: RequestCtx): Promise<void> {
    if (this.cacheLoadedAt && Date.now() - this.cacheLoadedAt.getTime() < this.cacheTtlMs) {
      return;
    }

    try {
      const rows = await prisma.mkt_intake_definitions.findMany({
        where: { is_active: true, is_draft: false },
      });

      this.cache.clear();
      for (const row of rows) {
        const def = this.normalizeDefinition(row);
        this.cache.set(def.intake_kind, def);
      }
      this.cacheLoadedAt = new Date();
      logger.info('Intake definitions cache loaded', ctx, { count: rows.length });
    } catch (error) {
      logger.error('Failed to load intake definitions cache', ctx, { error: (error as Error).message });
      // Keep stale cache if available — better than failing
      if (this.cache.size === 0) {
        throw error;
      }
    }
  }

  /**
   * Convert a Prisma row to a normalized IntakeDefinition.
   */
  private normalizeDefinition(row: any): IntakeDefinition {
    return {
      intake_kind: row.intake_kind,
      label: row.label,
      description: row.description,
      driver: (row.driver as 'code' | 'registry') || 'registry',
      service_category: row.service_category,
      trigger_stages: Array.isArray(row.trigger_stages) ? row.trigger_stages : [],
      submitted_stage: row.submitted_stage,
      form_schema: Array.isArray(row.form_schema) ? row.form_schema : [],
      field_mappings: Array.isArray(row.field_mappings) ? row.field_mappings : [],
      owner_copy: (row.owner_copy as OwnerCopy) || {},
      niche_overrides: (row.niche_overrides as Record<string, NicheOverride>) || {},
      downstream_agent: row.downstream_agent,
      version: row.version ?? 1,
      is_active: row.is_active ?? true,
      is_draft: row.is_draft ?? false,
    };
  }

  /**
   * Resolve a definition by intake_kind, applying niche overrides for the
   * given campaign category (plan §7.2).
   */
  async resolve(intakeKind: string, campaignCategory?: string | null, ctx?: RequestCtx): Promise<IntakeDefinition | null> {
    await this.loadCache(ctx);

    const base = this.cache.get(intakeKind);
    if (!base) {
      return null;
    }

    if (!campaignCategory) {
      return base;
    }

    // Apply niche override if one exists for this category
    const nicheKey = campaignCategory.toLowerCase();
    const override = base.niche_overrides[nicheKey];
    if (!override) {
      return base;
    }

    return this.mergeNicheOverride(base, override);
  }

  /**
   * Get a definition by intake_kind without niche resolution (raw base).
   */
  async getByKind(intakeKind: string, ctx?: RequestCtx): Promise<IntakeDefinition | null> {
    await this.loadCache(ctx);
    return this.cache.get(intakeKind) ?? null;
  }

  /**
   * List all active definitions (for admin or auto-gen hook).
   */
  async listActive(ctx?: RequestCtx): Promise<IntakeDefinition[]> {
    await this.loadCache(ctx);
    return Array.from(this.cache.values());
  }

  /**
   * Get definitions whose trigger_stages contain the given stage and whose
   * service_category matches (or is NULL = matches any). Used by the
   * auto-generation hook in MarketingCampaignService.
   */
  async getDefinitionsForTrigger(stage: string, serviceCategory?: string | null, ctx?: RequestCtx): Promise<IntakeDefinition[]> {
    await this.loadCache(ctx);
    const all = Array.from(this.cache.values());
    return all.filter((def) => {
      // Only registry-driven kinds auto-generate via this hook
      if (def.driver !== 'registry') return false;
      // Must have the stage in trigger_stages
      if (!def.trigger_stages.includes(stage)) return false;
      // service_category must match or be NULL (NULL = any service)
      if (def.service_category && serviceCategory && def.service_category !== serviceCategory) {
        return false;
      }
      return true;
    });
  }

  // ====================
  // NICHE OVERRIDE MERGE
  // ====================

  /**
   * Merge a niche override into a base definition (plan §7.2).
   * - add_fields: appended to form_schema
   * - field_overrides: merged per-field (label, help_text, required, validation, options)
   * - owner_copy_overrides: shallow-merged over owner_copy
   */
  private mergeNicheOverride(base: IntakeDefinition, override: NicheOverride): IntakeDefinition {
    let formSchema = [...base.form_schema];

    // Apply field overrides
    if (override.field_overrides) {
      formSchema = formSchema.map((field) => {
        const fieldOverride = override.field_overrides?.[field.key];
        if (!fieldOverride) return field;
        return { ...field, ...fieldOverride };
      });
    }

    // Append added fields
    if (override.add_fields) {
      formSchema = [...formSchema, ...override.add_fields];
    }

    // Merge owner copy
    const ownerCopy = { ...base.owner_copy, ...(override.owner_copy_overrides || {}) };

    return {
      ...base,
      form_schema: formSchema,
      owner_copy: ownerCopy,
    };
  }

  // ====================
  // DYNAMIC ZOD SCHEMA BUILDER
  // ====================

  /**
   * Build a Zod schema dynamically from a definition's form_schema.
   * Wraps the evidence payload with the shared envelope (token, ownerEmail,
   * ownerPhone, attachmentIds). This is the authoritative server-side
   * validation — the frontend mirrors it but this is the source of truth.
   */
  buildSubmitSchema(definition: IntakeDefinition): z.ZodType {
    const evidenceSchema = this.buildEvidenceSchema(definition.form_schema);

    return z.object({
      token: z.string().min(1, 'token is required'),
      ownerEmail: z.string().email('A valid email address is required'),
      ownerPhone: z.string().optional().nullable(),
      evidencePayload: evidenceSchema,
      attachmentIds: z.array(z.string()).optional().default([]),
    });
  }

  /**
   * Build the evidence payload Zod schema from form_schema fields.
   */
  private buildEvidenceSchema(fields: FormField[]): z.ZodTypeAny {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const field of fields) {
      shape[field.key] = this.buildFieldSchema(field);
    }

    return z.object(shape);
  }

  /**
   * Build a Zod schema for a single form field.
   */
  private buildFieldSchema(field: FormField): z.ZodTypeAny {
    let schema: z.ZodTypeAny;

    switch (field.type) {
      case 'text':
      case 'url':
      case 'phone':
        schema = z.string();
        if (field.type === 'url') {
          schema = z.string().url('Must be a valid URL');
        }
        break;

      case 'email':
        schema = z.string().email('Must be a valid email');
        break;

      case 'textarea':
        schema = z.string();
        break;

      case 'select':
      case 'radio':
        if (field.options && field.options.length > 0) {
          schema = z.enum(field.options.map((o) => o.value) as [string, ...string[]]);
        } else {
          schema = z.string();
        }
        break;

      case 'multiselect':
        schema = z.array(z.string());
        break;

      case 'checkbox':
        schema = z.boolean();
        break;

      case 'chips':
        schema = z.array(z.string());
        break;

      case 'hours_grid':
        // Hours grid is a structured object with day keys
        schema = z.object({
          monday: z.object({ open: z.string().optional().nullable(), close: z.string().optional().nullable(), closed: z.boolean().optional() }).optional(),
          tuesday: z.object({ open: z.string().optional().nullable(), close: z.string().optional().nullable(), closed: z.boolean().optional() }).optional(),
          wednesday: z.object({ open: z.string().optional().nullable(), close: z.string().optional().nullable(), closed: z.boolean().optional() }).optional(),
          thursday: z.object({ open: z.string().optional().nullable(), close: z.string().optional().nullable(), closed: z.boolean().optional() }).optional(),
          friday: z.object({ open: z.string().optional().nullable(), close: z.string().optional().nullable(), closed: z.boolean().optional() }).optional(),
          saturday: z.object({ open: z.string().optional().nullable(), close: z.string().optional().nullable(), closed: z.boolean().optional() }).optional(),
          sunday: z.object({ open: z.string().optional().nullable(), close: z.string().optional().nullable(), closed: z.boolean().optional() }).optional(),
          special_hours: z.array(z.object({
            date: z.string().optional().nullable(),
            hours: z.string().optional().nullable(),
            closed: z.boolean().optional(),
          })).optional(),
        });
        break;

      case 'attachments':
        schema = z.array(z.string());
        break;

      case 'number':
        schema = z.number();
        break;

      case 'date':
        schema = z.string();
        break;

      case 'object':
        // Nested object — build from sub-fields
        if (field.fields && field.fields.length > 0) {
          const nestedShape: Record<string, z.ZodTypeAny> = {};
          for (const subField of field.fields) {
            nestedShape[subField.key] = this.buildFieldSchema(subField);
          }
          schema = z.object(nestedShape);
        } else {
          schema = z.record(z.any());
        }
        break;

      default:
        schema = z.any();
    }

    // Apply validation constraints
    if (field.validation) {
      if (field.validation.min !== undefined) {
        if (schema instanceof z.ZodString) {
          schema = schema.min(field.validation.min);
        } else if (schema instanceof z.ZodArray) {
          schema = schema.min(field.validation.min);
        } else if (schema instanceof z.ZodNumber) {
          schema = schema.min(field.validation.min);
        }
      }
      if (field.validation.max !== undefined) {
        if (schema instanceof z.ZodString) {
          schema = schema.max(field.validation.max);
        } else if (schema instanceof z.ZodArray) {
          schema = schema.max(field.validation.max);
        } else if (schema instanceof z.ZodNumber) {
          schema = schema.max(field.validation.max);
        }
      }
      if (field.validation.pattern && schema instanceof z.ZodString) {
        schema = schema.regex(new RegExp(field.validation.pattern), 'Invalid format');
      }
    }

    // Handle required vs optional
    if (!field.required) {
      schema = schema.optional().nullable();
    }

    return schema;
  }

  /**
   * Run custom validators for a definition's fields against the submitted
   * evidence payload. Returns a map of field → error message.
   */
  async runCustomValidators(
    definition: IntakeDefinition,
    evidencePayload: Record<string, any>,
    ctx?: RequestCtx,
  ): Promise<Record<string, string>> {
    const errors: Record<string, string> = {};

    for (const field of definition.form_schema) {
      if (!field.custom_validator) continue;
      const validator = customValidators[field.custom_validator];
      if (!validator) {
        logger.warn('Unknown custom validator referenced in form_schema', ctx, {
          intakeKind: definition.intake_kind,
          field: field.key,
          customValidator: field.custom_validator,
        });
        continue;
      }

      const value = evidencePayload[field.key];
      if (value === undefined || value === null) continue;

      try {
        const error = await validator(value, ctx);
        if (error) {
          errors[field.key] = error;
        }
      } catch (err) {
        logger.error('Custom validator threw', ctx, {
          intakeKind: definition.intake_kind,
          field: field.key,
          customValidator: field.custom_validator,
          error: (err as Error).message,
        });
        // Fail open — don't block submission on validator error
      }
    }

    return errors;
  }

  /**
   * Register a custom validator at runtime (for testing or extensibility).
   */
  registerCustomValidator(name: string, validator: CustomValidator): void {
    customValidators[name] = validator;
  }
}

// ====================
// EXPORTS
// ====================

const intakeDefinitionService = IntakeDefinitionService.getInstance();
export { intakeDefinitionService };
export default intakeDefinitionService;

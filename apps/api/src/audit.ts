import { prisma } from "./prisma";
import { Flags } from "./config";
import { Prisma } from '@prisma/client';
import { generateQuickStart } from "./lib/id-generator";

export type AuditPayload = Record<string, any> | null | undefined;

export async function audit(opts: {
  tenantId: string;
  actor?: string | null;
  action: string;
  payload?: AuditPayload;
}) {
  if (!Flags.AUDIT_LOG) return; // feature-guarded noop
  try {
    // Map action strings to enum values
    let mappedAction: 'create' | 'update' | 'delete' | 'sync' | 'policyApply' | 'oauthConnect' | 'oauthRefresh';
    if (opts.action.includes('create')) {
      mappedAction = 'create';
    } else if (opts.action.includes('update')) {
      mappedAction = 'update';
    } else if (opts.action.includes('delete')) {
      mappedAction = 'delete';
    } else if (opts.action.includes('sync')) {
      mappedAction = 'sync';
    } else {
      mappedAction = 'update'; // default fallback
    }

    const auditData: any = {
      id: generateQuickStart("audit"),
      tenantId: opts.tenantId,
      action: mappedAction, // Use mapped enum value instead of string
      actorId: opts.actor || 'system', // Prisma model expects this
      actorType: 'system', // Prisma model expects this
      entityId: opts.payload?.id || 'unknown', // Prisma model expects this
      entityType: 'other', // Valid EntityType enum value for categories
      diff: opts.payload || {}, // Required field
    };

    await prisma.audit_log.create({
      data: auditData,
    });
  } catch (e) {
    // swallow errors to avoid impacting hot paths
    // optionally add sampling/logging later under observability work
  }
}

export async function ensureAuditTable() {
  if (!Flags.AUDIT_LOG) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        occurred_at timestamptz NOT NULL DEFAULT now(),
        actor text,
        tenantId uuid NOT NULL,
        action text NOT NULL,
        request_id text,
        ip inet,
        user_agent text,
        diff jsonb,
        payload jsonb,
        pii_scrubbed boolean NOT NULL DEFAULT true
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_time ON audit_log(tenantId, occurred_at DESC);
    `);
  } catch (e) {
    // do not throw at startup
  }
}

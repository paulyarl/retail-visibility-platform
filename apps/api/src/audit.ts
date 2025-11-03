import { prisma } from "./prisma";
import { Flags } from "./config";

export type AuditPayload = Record<string, any> | null | undefined;

export async function audit(opts: {
  tenantId: string;
  actor?: string | null;
  action: string;
  payload?: AuditPayload;
}) {
  if (!Flags.AUDIT_LOG) return; // feature-guarded noop
  try {
    const payloadJson = opts.payload ? JSON.stringify(opts.payload) : null;
    await prisma.$executeRaw`
      INSERT INTO audit_log (tenant_id, actor, action, payload)
      VALUES (${opts.tenantId}, ${opts.actor ?? null}, ${opts.action}, ${payloadJson}::jsonb)
    `;
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
        tenant_id uuid NOT NULL,
        action text NOT NULL,
        request_id text,
        ip inet,
        user_agent text,
        diff jsonb,
        payload jsonb,
        pii_scrubbed boolean NOT NULL DEFAULT true
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_time ON audit_log(tenant_id, occurred_at DESC);
    `);
  } catch (e) {
    // do not throw at startup
  }
}

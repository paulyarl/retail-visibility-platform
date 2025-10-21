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
    await prisma.$executeRawUnsafe(
      `INSERT INTO audit_log (tenant_id, actor, action, payload) VALUES ($1, $2, $3, $4)`,
      opts.tenantId,
      opts.actor ?? null,
      opts.action,
      opts.payload ? JSON.stringify(opts.payload) : null
    );
  } catch (e) {
    // swallow errors to avoid impacting hot paths
    // optionally add sampling/logging later under observability work
  }
}

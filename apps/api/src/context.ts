import type { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";
import { getEffectivePlatform } from "./utils/effectiveFlags";
import { generateCorrelationId } from "./lib/id-generator";

export type RequestCtx = {
  region: string;
  tenantId?: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  correlationId?: string;
};

export async function setRequestContext(req: Request, res: Response, next: NextFunction) {
  const ctx: RequestCtx = { region: "us-east-1" };

  // Best-effort tenantId discovery without changing behavior
  const tenantId =
    (typeof (req.query as any)?.tenantId === "string" && (req.query as any).tenantId) ||
    (typeof (req.body as any)?.tenantId === "string" && (req.body as any).tenantId) ||
    (typeof (req.params as any)?.tenantId === "string" && (req.params as any).tenantId) ||
    undefined;

  if (tenantId) ctx.tenantId = tenantId;

  // Generate tenant-scoped correlation ID: corr-{tk|GLBL}-{nanoid}
  // Honor incoming x-correlation-id header for distributed tracing
  ctx.correlationId = (req.headers['x-correlation-id'] as string) || generateCorrelationId(tenantId);

  // Expose correlation ID on response header for client-side tracing
  res.setHeader('X-Correlation-Id', ctx.correlationId);

  // Only resolve region from DB when the flag is ON and we have a tenantId
  if (tenantId) {
    try {
      const eff = await getEffectivePlatform('FF_GLOBAL_TENANT_META');
      if (eff.effectiveOn) {
        const rows = await prisma.$queryRaw<{ region: string }[]>`
          SELECT region FROM "Tenant" WHERE id = ${tenantId} LIMIT 1
        `;
        if (rows && rows[0]?.region) ctx.region = rows[0].region;
      }
    } catch {
      // ignore lookup errors to avoid request impact
    }
  }

  (req as any).ctx = ctx;
  next();
}

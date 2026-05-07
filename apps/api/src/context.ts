import type { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";
import { Flags } from "./config";

export type RequestCtx = {
  region: string;
  tenantId?: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  correlationId?: string;
};

export async function setRequestContext(req: Request, _res: Response, next: NextFunction) {
  const ctx: RequestCtx = { region: "us-east-1" };
  // Best-effort tenantId discovery without changing behavior
  const tenantId =
    (typeof (req.query as any)?.tenantId === "string" && (req.query as any).tenantId) ||
    (typeof (req.body as any)?.tenantId === "string" && (req.body as any).tenantId) ||
    (typeof (req.params as any)?.tenantId === "string" && (req.params as any).tenantId) ||
    undefined;

  if (tenantId) ctx.tenantId = tenantId;

  // Only resolve region from DB when the flag is ON and we have a tenantId
  if (Flags.GLOBAL_TENANT_META && tenantId) {
    try {
      const rows = await prisma.$queryRaw<{ region: string }[]>`
        SELECT region FROM "Tenant" WHERE id = ${tenantId} LIMIT 1
      `;
      if (rows && rows[0]?.region) ctx.region = rows[0].region;
    } catch {
      // ignore lookup errors to avoid request impact
    }
  }

  (req as any).ctx = ctx;
  next();
}

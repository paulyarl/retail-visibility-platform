/**
 * Logger with observability tags (tenantId, region)
 * REQ: REQ-2025-904
 */
import type { Request } from "express";
import type { RequestCtx } from "./context";

export function logWithContext(req: Request, level: "info" | "warn" | "error", message: string, meta?: Record<string, any>) {
  const ctx = (req as any).ctx as RequestCtx | undefined;
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    tenantId: ctx?.tenantId || null,
    region: ctx?.region || "us-east-1",
    method: req.method,
    path: req.path,
    ...meta,
  };

  // In production, this would go to your APM/logging service (Datadog, Grafana Loki, etc.)
  // For now, we log to console with structured JSON
  console.log(JSON.stringify(logEntry));
}

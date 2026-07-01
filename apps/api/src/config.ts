// Boot-time fallback only. At runtime, use getEffectivePlatform() from utils/effectiveFlags.ts.
// Env var still takes precedence (checked inside getEffectivePlatform), so setting
// FF_AUDIT_LOG=true in env will force-on the flag even if DB says off.
export const Flags = {
  GLOBAL_TENANT_META: String(process.env.FF_GLOBAL_TENANT_META || "false").toLowerCase() === "true",
  AUDIT_LOG: String(process.env.FF_AUDIT_LOG || "false").toLowerCase() === "true",
  I18N_SCAFFOLD: String(process.env.FF_I18N_SCAFFOLD || "false").toLowerCase() === "true",
  CURRENCY_RATE_STUB: String(process.env.FF_CURRENCY_RATE_STUB || "false").toLowerCase() === "true",
  FEED_ALIGNMENT_ENFORCE: String(process.env.FF_FEED_ALIGNMENT_ENFORCE || "false").toLowerCase() === "true",
  FEED_COVERAGE: String(process.env.FF_FEED_COVERAGE || "true").toLowerCase() === "true",
  CATEGORY_MIRRORING: String(process.env.FF_CATEGORY_MIRRORING || "false").toLowerCase() === "true",
  TENANT_PLATFORM_CATEGORY: String(process.env.FF_TENANT_PLATFORM_CATEGORY || "false").toLowerCase() === "true",
  SCAN_ENRICHMENT: String(process.env.FF_SCAN_ENRICHMENT || "true").toLowerCase() === "true",
} as const;

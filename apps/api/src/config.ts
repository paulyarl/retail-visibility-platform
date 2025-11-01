export const Flags = {
  GLOBAL_TENANT_META: String(process.env.FF_GLOBAL_TENANT_META || "false").toLowerCase() === "true",
  AUDIT_LOG: String(process.env.FF_AUDIT_LOG || "false").toLowerCase() === "true",
  I18N_SCAFFOLD: String(process.env.FF_I18N_SCAFFOLD || "false").toLowerCase() === "true",
  CURRENCY_RATE_STUB: String(process.env.FF_CURRENCY_RATE_STUB || "false").toLowerCase() === "true",
  FEED_ALIGNMENT_ENFORCE: String(process.env.FF_FEED_ALIGNMENT_ENFORCE || "false").toLowerCase() === "true",
} as const;

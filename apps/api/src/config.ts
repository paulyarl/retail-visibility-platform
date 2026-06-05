export const Flags = {
  GLOBAL_TENANT_META: String(process.env.FF_GLOBAL_TENANT_META || "false").toLowerCase() === "true",
  AUDIT_LOG: String(process.env.FF_AUDIT_LOG || "false").toLowerCase() === "true",
  I18N_SCAFFOLD: String(process.env.FF_I18N_SCAFFOLD || "false").toLowerCase() === "true",
  CURRENCY_RATE_STUB: String(process.env.FF_CURRENCY_RATE_STUB || "false").toLowerCase() === "true",
  FEED_ALIGNMENT_ENFORCE: String(process.env.FF_FEED_ALIGNMENT_ENFORCE || "false").toLowerCase() === "true",
  FEED_COVERAGE: String(process.env.FF_FEED_COVERAGE || "true").toLowerCase() === "true",
  CATEGORY_MIRRORING: String(process.env.FF_CATEGORY_MIRRORING || "false").toLowerCase() === "true",
  TENANT_PLATFORM_CATEGORY: String(process.env.FF_TENANT_PLATFORM_CATEGORY || "false").toLowerCase() === "true",
  // M4: SKU Scanning
  SKU_SCANNING: String(process.env.FF_SKU_SCANNING || "false").toLowerCase() === "true",
  SCAN_CAMERA: String(process.env.FF_SCAN_CAMERA || "false").toLowerCase() === "true",
  SCAN_USB: String(process.env.FF_SCAN_USB || "true").toLowerCase() === "true", // USB enabled by default
  SCAN_ENRICHMENT: String(process.env.FF_SCAN_ENRICHMENT || "true").toLowerCase() === "true",
  SCAN_DUPLICATE_CHECK: String(process.env.FF_SCAN_DUPLICATE_CHECK || "true").toLowerCase() === "true",
} as const;

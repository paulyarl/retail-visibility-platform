/**
 * Verification script: Ensure all Tenant rows have non-NULL global-readiness fields
 * Run after migration: pnpm tsx scripts/verify-tenant-defaults.ts
 * REQ: REQ-2025-901
 */
import { prisma } from "../src/prisma";

async function verifyTenantDefaults() {
  console.log("🔍 Verifying Tenant global-readiness defaults...");

  const tenants = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      name: string;
      region: string | null;
      language: string | null;
      currency: string | null;
      data_policy_accepted: boolean | null;
    }>
  >(`
    SELECT id, name, region, language, currency, data_policy_accepted
    FROM "Tenant"
  `);

  console.log(`📊 Total tenants: ${tenants.length}`);

  const issues: string[] = [];

  for (const t of tenants) {
    if (t.region === null) issues.push(`Tenant ${t.id} (${t.name}): region is NULL`);
    if (t.language === null) issues.push(`Tenant ${t.id} (${t.name}): language is NULL`);
    if (t.currency === null) issues.push(`Tenant ${t.id} (${t.name}): currency is NULL`);
    if (t.data_policy_accepted === null)
      issues.push(`Tenant ${t.id} (${t.name}): data_policy_accepted is NULL`);
  }

  if (issues.length > 0) {
    console.error("❌ Verification FAILED:");
    issues.forEach((msg) => console.error(`  - ${msg}`));
    process.exit(1);
  }

  console.log("✅ All tenants have valid defaults:");
  tenants.forEach((t) => {
    console.log(
      `  - ${t.name}: region=${t.region}, language=${t.language}, currency=${t.currency}, policy=${t.data_policy_accepted}`
    );
  });

  console.log("\n✅ Verification passed.");
  await prisma.$disconnect();
}

verifyTenantDefaults().catch((e) => {
  console.error("❌ Script error:", e);
  process.exit(1);
});

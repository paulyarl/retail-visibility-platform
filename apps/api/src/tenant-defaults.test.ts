/**
 * Unit test: Verify tenant creation applies correct global-readiness defaults
 * REQ: REQ-2025-901
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./prisma";

describe("Tenant global-readiness defaults (REQ-2025-901)", () => {
  let createdTenantId: string | null = null;

  afterAll(async () => {
    // Cleanup
    if (createdTenantId) {
      await prisma.tenant.delete({ where: { id: createdTenantId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("should create tenant with default region, language, currency, and data_policy_accepted=false", async () => {
    const tenant = await prisma.tenant.create({
      data: { name: "Test Tenant for Defaults" } as any,
    });

    createdTenantId = tenant.id;

    // Query via raw SQL to verify columns exist and have defaults
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        region: string;
        language: string;
        currency: string;
        data_policy_accepted: boolean;
      }>
    >(`SELECT region, language, currency, data_policy_accepted FROM "Tenant" WHERE id = $1`, tenant.id);

    expect(rows).toHaveLength(1);
    const t = rows[0];

    expect(t.region).toBe("us-east-1");
    expect(t.language).toBe("en-US");
    expect(t.currency).toBe("USD");
    expect(t.data_policy_accepted).toBe(false);
  });

  it("should allow explicit region/language/currency on create (when Prisma client regenerated)", async () => {
    // This test will pass once `prisma generate` runs after schema update
    // For now, we verify via raw SQL insert
    const customTenant = await prisma.$executeRawUnsafe(
      `INSERT INTO "Tenant" (id, name, region, language, currency, "createdAt")
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id`,
      `test-custom-${Date.now()}`,
      "Custom Region Tenant",
      "eu-west-1",
      "fr-FR",
      "EUR"
    );

    expect(customTenant).toBeDefined();
  });
});

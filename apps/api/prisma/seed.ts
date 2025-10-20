import { PrismaClient, Role } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const t = await db.tenant.upsert({
    where: { id: "demo-tenant" },
    update: {},
    create: { id: "demo-tenant", name: "Demo Tenant" },
  });

  await db.user.upsert({
    where: { email: "owner@demo.local" },
    update: {},
    create: {
      email: "owner@demo.local",
      role: Role.ADMIN,
      tenantId: t.id,
    },
  });

  // SQLite does not support createMany({ skipDuplicates }) in this Prisma version.
  // Use idempotent upserts keyed by the unique [tenantId, sku] constraint.
  await Promise.all([
    db.inventoryItem.upsert({
      where: { uq_tenant_sku: { tenantId: t.id, sku: "SKU-001" } },
      update: { name: "Organic Apples", priceCents: 299, stock: 50 },
      create: { tenantId: t.id, sku: "SKU-001", name: "Organic Apples", priceCents: 299, stock: 50 },
    }),
    db.inventoryItem.upsert({
      where: { uq_tenant_sku: { tenantId: t.id, sku: "SKU-002" } },
      update: { name: "Whole Milk 1L", priceCents: 349, stock: 40 },
      create: { tenantId: t.id, sku: "SKU-002", name: "Whole Milk 1L", priceCents: 349, stock: 40 },
    }),
  ]);
}

main().finally(() => db.$disconnect());

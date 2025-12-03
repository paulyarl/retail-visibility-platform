import { PrismaClient, user_role } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  // Set trial to expire 30 days from now
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const t = await db.tenants.upsert({
    where: { id: "demo-tenant" },
    update: {
      subscription_tier: "starter", 
      subscription_status: "trial", 
      trialEndsAt: trialEndsAt,
    },
    create: {
      id: "demo-tenant",
      name: "Demo Tenant",
      subscription_tier: "starter",
      subscription_status: "trial",
      trialEndsAt: trialEndsAt,
    },
  });

  const hashedPassword = await bcrypt.hash("password123", 10);

  const user = await db.users.upsert({
    where: { email: "owner@demo.local" },
    update: {},
    create: {
      email: "owner@demo.local",
      passwordHash: hashedPassword,
      role: user_role.ADMIN,
      firstName: "Demo",
      lastName: "Owner",
      emailVerified: true,
    },
  });

  // Link user to tenant
  await db.user_tenants.upsert({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId: t.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      tenantId: t.id,
      role: user_role.OWNER,
    },
  });

  // SQLite does not support createMany({ skipDuplicates }) in this Prisma version.
  // Use idempotent upserts keyed by the unique [tenantId, sku] constraint.
  await Promise.all([
    db.inventory_items.upsert({
      where: { uq_tenant_sku: { tenantId: t.id, sku: "SKU-001" } },
      update: { name: "Organic Apples", priceCents: 299, stock: 50 },
      create: {
        tenantId: t.id,
        sku: "SKU-001",
        name: "Organic Apples",
        title: "Organic Apples",
        brand: "Fresh Farms",
        priceCents: 299,
        price: 2.99,
        currency: "USD",
        stock: 50,
        availability: "in_stock",
      },
    }),
    db.inventory_items.upsert({
      where: { uq_tenant_sku: { tenantId: t.id, sku: "SKU-002" } },
      update: { name: "Whole Milk 1L", priceCents: 349, stock: 40 },
      create: {
        tenantId: t.id,
        sku: "SKU-002",
        name: "Whole Milk 1L",
        title: "Whole Milk 1L",
        brand: "Dairy Fresh",
        priceCents: 349,
        price: 3.49,
        currency: "USD",
        stock: 40,
        availability: "in_stock",
      },
    }),
  ]);
}

main().finally(() => db.$disconnect());

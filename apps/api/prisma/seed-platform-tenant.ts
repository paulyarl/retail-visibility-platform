import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * Seeds the 'platform' system tenant used for Help Desk Support inquiries.
 * This tenant receives anonymous submissions directed at platform admin
 * via the POST /api/public/help-desk endpoint.
 *
 * Run: npx tsx prisma/seed-platform-tenant.ts
 */
async function main() {
  const platformTenant = await db.tenants.upsert({
    where: { id: "platform" },
    update: {},
    create: {
      id: "platform",
      name: "VisibleShelf Platform",
      subscription_tier: "enterprise",
      subscription_status: "active",
      slug: "platform-help-desk",
      directory_visible: false,
    },
  });

  console.log("Seeded platform system tenant:", platformTenant.id);
}

main()
  .catch((e) => {
    console.error("Failed to seed platform tenant:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

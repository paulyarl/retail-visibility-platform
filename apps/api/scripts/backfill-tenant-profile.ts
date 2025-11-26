import { prisma } from "../src/prisma";

/**
 * Backfill tenant_business_profile from legacy tenant.metadata when missing.
 * - Idempotent: will only create/update when profile table is missing or empty fields can be improved by metadata.
 * - Keeps Tenant.name in sync with business_name if provided.
 */
async function main() {
  const tenants = await prisma.tenant.findMany({});
  let created = 0; let updated = 0; let skipped = 0;

  for (const t of tenants) {
    const md: any = (t.metadata as any) || {};

    // If there is no meaningful metadata, skip
    const hasAnyMd = [
      md.business_name, md.address_line1, md.city, md.postal_code, md.country_code,
      md.phone_number, md.email, md.website, md.contact_person,
    ].some(Boolean);

    const existing = await prisma.tenantBusinessProfile.findUnique({ where: { tenantId: t.id } });

    if (!existing) {
      if (!hasAnyMd) {
        skipped++;
        continue;
      }

      const createdRow = await prisma.tenantBusinessProfile.create({
        data: { 
          tenantId: t.id,
          businessName: md.business_name || t.name || "",
          businessLine1: md.address_line1 || "", 
          businessLine2: md.address_line2 ?? null,
          city: md.city || "",
          state: md.state ?? null,
          postalCode: md.postal_code || "",
          countryCode: (md.country_code || "US").toUpperCase(),
          phoneNumber: md.phone_number ?? null,
          email: md.email ?? null,
          website: md.website ?? null,
          contactPerson: md.contact_person ?? null,
          hours: md.hours ?? null,
          specialLinks: md.social_links ?? null, 
          seoTags: md.seo_tags ?? null,
          latitude: md.latitude ?? null,
          longitude: md.longitude ?? null,
          displayMap: md.display_map ?? false,
          mapPrivacyMode: md.map_privacy_mode ?? "precise",
          updatedAt: new Date(),
        }
      });

      // Keep Tenant.name in sync if business_name present
      if (md.business_name && md.business_name !== t.name) {
        await prisma.tenant.update({ where: { id: t.id }, data: { name: md.business_name } });
      }

      created++;
      console.log(`[backfill] created profile for tenant ${t.id}`, createdRow.tenantId);
      continue;
    }

    // If profile exists, optionally fill missing fields from metadata
    const patch: any = {};
    if (!existing.businessName && (md.business_name || t.name)) patch.businessName = md.business_name || t.name;
    if (!existing.businessLine1 && md.address_line1) patch.businessLine1 = md.address_line1;
    if (existing.businessLine2 == null && md.address_line2 != null) patch.businessLine2 = md.address_line2;
    if (!existing.city && md.city) patch.city = md.city;
    if (existing.state == null && md.state != null) patch.state = md.state;
    if (!existing.postalCode && md.postal_code) patch.postalCode = md.postal_code;
    if (!existing.countryCode && md.country_code) patch.countryCode = String(md.country_code).toUpperCase();
    if (existing.phoneNumber == null && md.phone_number != null) patch.phoneNumber = md.phone_number;
    if (existing.email == null && md.email != null) patch.email = md.email;
    if (existing.website == null && md.website != null) patch.website = md.website;
    if (existing.contactPerson == null && md.contact_person != null) patch.contactPerson = md.contact_person;
    if (existing.hours == null && md.hours != null) patch.hours = md.hours;
    if (existing.specialLinks == null && md.social_links != null) patch.specialLinks = md.social_links;
    if (existing.seoTags == null && md.seo_tags != null) patch.seoTags = md.seo_tags;
    if (existing.latitude == null && md.latitude != null) patch.latitude = md.latitude;
    if (existing.longitude == null && md.longitude != null) patch.longitude = md.longitude;
    if (existing.displayMap === false && md.display_map === true) patch.displayMap = true;
    if (!existing.mapPrivacyMode && md.map_privacy_mode) patch.mapPrivacyMode = md.map_privacy_mode;

    if (Object.keys(patch).length > 0) {
      await prisma.tenantBusinessProfile.update({ where: { tenantId: t.id }, data: patch });
      if (patch.businessName && patch.businessName !== t.name) {
        await prisma.tenant.update({ where: { id: t.id }, data: { name: patch.businessName } });
      }
      updated++;
      console.log(`[backfill] updated profile for tenant ${t.id}`);
    } else {
      skipped++;
    }
  }

  console.log(JSON.stringify({ created, updated, skipped }));
}

main()
  .catch((e) => {
    console.error("[backfill] error", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

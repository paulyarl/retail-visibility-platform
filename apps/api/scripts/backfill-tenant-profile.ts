import { prisma } from "../src/prisma";

/**
 * Backfill tenant_business_profile from legacy tenant.metadata when missing.
 * - Idempotent: will only create/update when profile table is missing or empty fields can be improved by metadata.
 * - Keeps Tenant.name in sync with business_name if provided.
 */
async function main() {
  const tenants = await prisma.tenants.findMany({});
  let created = 0; let updated = 0; let skipped = 0;

  for (const t of tenants) {
    const md: any = (t.metadata as any) || {};

    // If there is no meaningful metadata, skip
    const hasAnyMd = [
      md.business_name, md.address_line1, md.city, md.postal_code, md.country_code,
      md.phone_number, md.email, md.website, md.contact_person,
    ].some(Boolean);

    const existing = await prisma.tenant_business_profiles_list.findUnique({ where: { tenant_id: t.id } });

    if (!existing) {
      if (!hasAnyMd) {
        skipped++;
        continue;
      }

      const createdRow = await prisma.tenant_business_profiles_list.create({
        data: { 
          tenant_id: t.id,
          business_name: md.business_name || t.name || "",
          address_line1: md.address_line1 || "", 
          address_line2: md.address_line2 ?? null,
          city: md.city || "",
          state: md.state ?? null,
          postal_code: md.postal_code || "",
          country_code: (md.country_code || "US").toUpperCase(),
          phone_number: md.phone_number ?? null,
          email: md.email ?? null,
          website: md.website ?? null,
          contact_person: md.contact_person ?? null,
          hours: md.hours ?? null,
          social_links: md.social_links ?? null, 
          seo_tags: md.seo_tags ?? null,
          latitude: md.latitude ?? null,
          longitude: md.longitude ?? null,
          display_map: md.display_map ?? false,
          map_privacy_mode: md.map_privacy_mode ?? "precise",
          updated_at: new Date(),
        }
      });

      // Keep Tenant.name in sync if business_name present
      if (md.business_name && md.business_name !== t.name) {
        await prisma.tenants.update({ where: { id: t.id }, data: { name: md.business_name } });
      }

      created++;
      console.log(`[backfill] created profile for tenant ${t.id}`, createdRow.tenant_id);
      continue;
    }

    // If profile exists, optionally fill missing fields from metadata
    const patch: any = {};
    if (!existing.business_name && (md.business_name || t.name)) patch.business_name = md.business_name || t.name;
    if (!existing.address_line1 && md.address_line1) patch.address_line1 = md.address_line1;
    if (existing.address_line2 == null && md.address_line2 != null) patch.address_line2 = md.address_line2;
    if (!existing.city && md.city) patch.city = md.city;
    if (existing.state == null && md.state != null) patch.state = md.state;
    if (!existing.postal_code && md.postal_code) patch.postal_code = md.postal_code;
    if (!existing.country_code && md.country_code) patch.country_code = String(md.country_code).toUpperCase();
    if (existing.phone_number == null && md.phone_number != null) patch.phone_number = md.phone_number;
    if (existing.email == null && md.email != null) patch.email = md.email;
    if (existing.website == null && md.website != null) patch.website = md.website;
    if (existing.contact_person == null && md.contact_person != null) patch.contact_person = md.contact_person;
    if (existing.hours == null && md.hours != null) patch.hours = md.hours;
    if (existing.social_links == null && md.social_links != null) patch.social_links = md.social_links;
    if (existing.seo_tags == null && md.seo_tags != null) patch.seo_tags = md.seo_tags;
    if (existing.latitude == null && md.latitude != null) patch.latitude = md.latitude;
    if (existing.longitude == null && md.longitude != null) patch.longitude = md.longitude;
    if (existing.display_map === false && md.display_map === true) patch.display_map = true;
    if (!existing.map_privacy_mode && md.map_privacy_mode) patch.map_privacy_mode = md.map_privacy_mode;

    if (Object.keys(patch).length > 0) {
      await prisma.tenant_business_profiles_list.update({ where: { tenant_id: t.id }, data: patch });
      if (patch.business_name && patch.business_name !== t.name) {
        await prisma.tenants.update({ where: { id: t.id }, data: { name: patch.business_name } });
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

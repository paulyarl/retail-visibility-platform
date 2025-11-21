import { prisma } from './prisma';
import { Flags } from './config';

/**
 * Create a helper view to expose local category path and resolved Google category id
 * NOTE: This view assumes the following columns exist:
 *  - inventory_item(id uuid, tenantId uuid, category_path text[])
 *  - tenant_category(tenantId uuid, slug text, google_category_id text, is_active boolean)
 *  - google_taxonomy(category_id text)
 * If the google taxonomy table contains a path/name column, extend the SELECT accordingly.
 */
export async function ensureFeedCategoryView() {
  // No flag guard; a harmless utility view
  try {
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE VIEW v_feed_category_resolved AS
      SELECT
        ii.id               AS item_id,
        ii.tenantId        AS tenantId,
        ii.categoryPath    AS local_path,
        -- leaf slug used to resolve tenant category
        CASE WHEN ii.categoryPath IS NOT NULL AND array_length(ii.categoryPath, 1) > 0
             THEN ii.categoryPath[array_length(ii.categoryPath, 1)]
             ELSE NULL
        END                  AS leaf_slug,
        tc.google_category_id AS google_category_id
      FROM inventory_item ii
      LEFT JOIN tenant_category tc
        ON tc.tenantId = ii.tenantId
       AND tc.is_active = TRUE
       AND CASE WHEN ii.categoryPath IS NOT NULL AND array_length(ii.categoryPath, 1) > 0
                THEN ii.categoryPath[array_length(ii.categoryPath, 1)]
                ELSE NULL
           END = tc.slug;
    `);
  } catch (e) {
    // swallow — view creation failure should not block server
  }
}

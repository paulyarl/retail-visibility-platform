-- ============================================================================
-- UPDATE STOREFRONT_PRODUCTS_MV TO INCLUDE PHOTO GALLERY, VARIANTS & DIGITAL FIELDS
-- ============================================================================

-- Drop existing MV
DROP MATERIALIZED VIEW IF EXISTS public.storefront_products_mv;

-- Create enhanced MV with all required fields
CREATE MATERIALIZED VIEW public.storefront_products_mv AS
SELECT 
  i.id,
  i.tenant_id,
  i.sku,
  i.name,
  i.title,
  i.description,
  i.price_cents,
  i.sale_price_cents,
  i.stock,
  i.image_url,
  i.brand,
  i.item_status,
  i.availability,
  i.has_variants,
  i.directory_category_id AS tenant_category_id,
  i.created_at,
  i.updated_at,
  i.metadata,
  i.currency,
  i.manufacturer,
  i.condition,
  -- Enhanced photo gallery data
  COALESCE(
    (
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', pa.id,
          'url', pa.url,
          'position', pa.position,
          'alt', pa.alt,
          'caption', pa.caption,
          'variant_id', pa.variant_id,
          'createdAt', pa."createdAt"::text,
          'isPrimary', pa.position = 0
        )
        ORDER BY pa.position
      )
      FROM photo_assets pa
      WHERE pa."inventoryItemId" = i.id
      AND pa.variant_id IS NULL
    ),
    '[]'::json
  ) AS image_gallery,
  -- Variants data
  COALESCE(
    (
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', v.id,
          'sku', v.sku,
          'variant_name', v.variant_name,
          'price_cents', v.price_cents,
          'sale_price_cents', v.sale_price_cents,
          'stock', v.stock,
          'image_url', v.image_url,
          'attributes', v.attributes,
          'sort_order', v.sort_order,
          'is_active', v.is_active,
          'is_on_sale', CASE
            WHEN v.sale_price_cents IS NOT NULL 
            AND v.sale_price_cents > 0 
            AND v.sale_price_cents < v.price_cents THEN TRUE
            ELSE FALSE
          END,
          'discount_percentage', CASE
            WHEN v.sale_price_cents IS NOT NULL 
            AND v.sale_price_cents > 0 
            AND v.sale_price_cents < v.price_cents THEN ROUND(
              (v.price_cents - v.sale_price_cents)::NUMERIC / v.price_cents::NUMERIC * 100::NUMERIC,
              2
            )
            ELSE 0::NUMERIC
          END
        )
        ORDER BY v.sort_order, v.variant_name
      )
      FROM product_variants v
      WHERE v.parent_item_id = i.id
      AND v.is_active = TRUE
    ),
    '[]'::json
  ) AS variants,
  -- Digital product fields
  i.product_type,
  i.digital_delivery_method,
  i.digital_assets,
  i.license_type,
  i.access_duration_days,
  i.download_limit,
  -- Featured product logic (existing)
  COALESCE(
    CASE
      WHEN i.sale_price_cents IS NOT NULL 
      AND i.sale_price_cents > 0 
      AND i.sale_price_cents < i.price_cents 
      AND (
        fp.featured_type IS NULL 
        OR fp.featured_type::text <> 'sale'::text
      ) THEN 'sale'::character varying
      ELSE fp.featured_type
    END,
    fp.featured_type
  ) AS featured_type,
  COALESCE(
    CASE
      WHEN i.sale_price_cents IS NOT NULL 
      AND i.sale_price_cents > 0 
      AND i.sale_price_cents < i.price_cents 
      AND (
        fp.featured_type IS NULL 
        OR fp.featured_type::text <> 'sale'::text
      ) THEN 3
      ELSE fp.featured_priority
    END,
    fp.featured_priority,
    50
  ) AS featured_priority,
  COALESCE(
    fp.featured_at,
    CASE
      WHEN i.sale_price_cents IS NOT NULL 
      AND i.sale_price_cents > 0 
      AND i.sale_price_cents < i.price_cents 
      AND (
        fp.featured_type IS NULL 
        OR fp.featured_type::text <> 'sale'::text
      ) THEN i.updated_at
      ELSE NULL::timestamp without time zone
    END
  ) AS featured_at,
  fp.featured_expires_at,
  fp.auto_unfeature,
  fp.is_active AS is_featured_active,
  CASE
    WHEN fp.featured_expires_at IS NOT NULL THEN EXTRACT(
      DAYS FROM fp.featured_expires_at::timestamp with time zone - now()
    )
    ELSE NULL::numeric
  END AS days_until_expiration,
  CASE
    WHEN fp.featured_expires_at IS NOT NULL 
    AND fp.featured_expires_at <= now() THEN TRUE
    ELSE FALSE
  END AS is_expired,
  CASE
    WHEN fp.featured_expires_at IS NOT NULL 
    AND fp.featured_expires_at > now()
    AND fp.featured_expires_at <= (now() + '3 days'::interval) THEN TRUE
    ELSE FALSE
  END AS is_expiring_soon,
  CASE
    WHEN i.sale_price_cents IS NOT NULL 
    AND i.sale_price_cents > 0 
    AND i.sale_price_cents < i.price_cents THEN TRUE
    ELSE FALSE
  END AS is_on_sale,
  CASE
    WHEN i.sale_price_cents IS NOT NULL 
    AND i.sale_price_cents > 0 
    AND i.sale_price_cents < i.price_cents 
    AND (
      fp.featured_type IS NULL 
      OR fp.featured_type::text <> 'sale'::text
    ) THEN TRUE
    ELSE FALSE
  END AS auto_tagged_as_sale,
  CASE
    WHEN i.sale_price_cents IS NOT NULL 
    AND i.sale_price_cents > 0 
    AND i.sale_price_cents < i.price_cents THEN ROUND(
      (i.price_cents - i.sale_price_cents)::NUMERIC / i.price_cents::NUMERIC * 100::NUMERIC,
      2
    )
    ELSE 0::NUMERIC
  END AS discount_percentage,
  CASE
    WHEN i.has_variants = TRUE THEN 'parent'::text
    ELSE 'simple'::text
  END AS product_type_simple
FROM inventory_items i
LEFT JOIN featured_products fp ON i.id = fp.inventory_item_id
  AND fp.is_active = TRUE
  AND (
    fp.featured_expires_at IS NULL 
    OR fp.featured_expires_at >= now()
  )
WHERE i.item_status = 'active'::item_status
  AND i.stock > 0
ORDER BY 
  i.id,
  (
    COALESCE(
      CASE
        WHEN i.sale_price_cents IS NOT NULL 
        AND i.sale_price_cents > 0 
        AND i.sale_price_cents < i.price_cents 
        AND (
          fp.featured_type IS NULL 
          OR fp.featured_type::text <> 'sale'::text
        ) THEN 'sale'::character varying
        ELSE fp.featured_type
      END,
      fp.featured_type
    )
  ),
  (
    COALESCE(
      CASE
        WHEN i.sale_price_cents IS NOT NULL 
        AND i.sale_price_cents > 0 
        AND i.sale_price_cents < i.price_cents 
        AND (
          fp.featured_type IS NULL 
          OR fp.featured_type::text <> 'sale'::text
        ) THEN 3
        ELSE fp.featured_priority
      END,
      fp.featured_priority,
      50
    )
  ) DESC;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_storefront_products_mv_tenant_id ON public.storefront_products_mv(tenant_id);
CREATE INDEX IF NOT EXISTS idx_storefront_products_mv_id ON public.storefront_products_mv(id);
CREATE INDEX IF NOT EXISTS idx_storefront_products_mv_featured_type ON public.storefront_products_mv(featured_type);
CREATE INDEX IF NOT EXISTS idx_storefront_products_mv_has_variants ON public.storefront_products_mv(has_variants);

-- Add comment
COMMENT ON MATERIALIZED VIEW public.storefront_products_mv IS 'Enhanced storefront products MV with photo gallery, variants, and digital product fields';

/**
 * GMC Validation Service
 *
 * Pre-sync validation for Google Shopping product compliance.
 * Checks products against Google Merchant Center requirements before sync.
 */

export interface ValidationIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
  value?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: number;
  warnings: number;
  issues: ValidationIssue[];
}

export interface BulkValidationReport {
  tenantId: string;
  totalItems: number;
  validItems: number;
  itemsWithErrors: number;
  itemsWithWarnings: number;
  results: Array<{
    itemId: string;
    itemName: string;
    sku: string;
    validation: ValidationResult;
  }>;
}

/**
 * Validate a single inventory item for Google Shopping compliance.
 *
 * Rules:
 * - ERROR: Title required, max 150 chars
 * - ERROR: Description required, min 30 chars (Google recommends 500-1000)
 * - ERROR: Image URL required and valid
 * - ERROR: Price > 0
 * - ERROR: Availability required
 * - WARNING: GTIN required for branded products (Google may reject without it)
 * - WARNING: Brand recommended
 * - WARNING: MPN recommended if no GTIN
 * - WARNING: Google product category recommended
 * - WARNING: Description < 500 chars (Google recommends 500-1000)
 */
export function validateProductForGMC(item: any): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Title validation
  const title = item.name || item.title || '';
  if (!title.trim()) {
    issues.push({
      field: 'title',
      severity: 'error',
      message: 'Title is required',
    });
  } else if (title.length > 150) {
    issues.push({
      field: 'title',
      severity: 'error',
      message: `Title exceeds 150 characters (current: ${title.length})`,
      value: `${title.length} chars`,
    });
  }

  // Description validation
  const description = item.description || '';
  if (!description.trim()) {
    issues.push({
      field: 'description',
      severity: 'error',
      message: 'Description is required',
    });
  } else if (description.length < 30) {
    issues.push({
      field: 'description',
      severity: 'error',
      message: `Description must be at least 30 characters (current: ${description.length})`,
      value: `${description.length} chars`,
    });
  } else if (description.length < 500) {
    issues.push({
      field: 'description',
      severity: 'warning',
      message: `Description is short (${description.length} chars). Google recommends 500-1000 characters for best results.`,
      value: `${description.length} chars`,
    });
  }

  // Image URL validation
  const imageLink = item.image_url || item.primary_image_url || '';
  if (!imageLink.trim()) {
    issues.push({
      field: 'image_url',
      severity: 'error',
      message: 'Image URL is required',
    });
  } else if (!isValidUrl(imageLink)) {
    issues.push({
      field: 'image_url',
      severity: 'error',
      message: 'Image URL is not a valid URL',
      value: imageLink,
    });
  }

  // Price validation
  const priceCents = item.price_cents || 0;
  if (priceCents <= 0) {
    issues.push({
      field: 'price_cents',
      severity: 'error',
      message: 'Price must be greater than 0',
      value: `$${(priceCents / 100).toFixed(2)}`,
    });
  }

  // Availability validation
  const stockQuantity = item.stock_quantity ?? item.stock ?? 0;
  if (stockQuantity === undefined || stockQuantity === null) {
    issues.push({
      field: 'stock_quantity',
      severity: 'warning',
      message: 'Stock quantity is not set — will default to out of stock',
    });
  }

  // GTIN validation (warning for branded products)
  const gtin = item.gtin || item.upc || item.barcode;
  const brand = item.brand;
  if (brand && !gtin) {
    issues.push({
      field: 'gtin',
      severity: 'warning',
      message: `Branded product "${brand}" has no GTIN/UPC. Google may reject or limit visibility without a valid GTIN.`,
    });
  }
  if (gtin && !isValidGtin(gtin)) {
    issues.push({
      field: 'gtin',
      severity: 'warning',
      message: 'GTIN format appears invalid (should be 8, 12, 13, or 14 digits)',
      value: gtin,
    });
  }

  // Brand recommended
  if (!brand) {
    issues.push({
      field: 'brand',
      severity: 'warning',
      message: 'Brand is recommended. Products without brand may have reduced visibility on Google Shopping.',
    });
  }

  // MPN recommended if no GTIN
  const mpn = item.mpn;
  if (!gtin && !mpn && !brand) {
    issues.push({
      field: 'mpn',
      severity: 'warning',
      message: 'No GTIN, MPN, or brand set. Set identifierExists=false or provide at least one identifier.',
    });
  }

  // Google product category recommended
  const googleCategory = item.google_product_category_id || item.google_category_id;
  if (!googleCategory) {
    issues.push({
      field: 'google_product_category',
      severity: 'warning',
      message: 'Google product category is not mapped. Products without a category may have reduced discoverability.',
    });
  }

  // Link validation
  const productLink = item.product_url;
  if (productLink && !isValidUrl(productLink)) {
    issues.push({
      field: 'product_url',
      severity: 'warning',
      message: 'Product URL is not a valid URL',
      value: productLink,
    });
  }

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;

  return {
    valid: errors === 0,
    errors,
    warnings,
    issues,
  };
}

/**
 * Validate multiple items and return a bulk report.
 */
export function validateProductsForGMC(items: any[]): BulkValidationReport {
  const results = items.map(item => ({
    itemId: item.id,
    itemName: item.name || item.title || 'Untitled',
    sku: item.sku || '',
    validation: validateProductForGMC(item),
  }));

  const validItems = results.filter(r => r.validation.valid && r.validation.warnings === 0).length;
  const itemsWithErrors = results.filter(r => r.validation.errors > 0).length;
  const itemsWithWarnings = results.filter(r => r.validation.warnings > 0 && r.validation.errors === 0).length;

  return {
    tenantId: '',
    totalItems: items.length,
    validItems,
    itemsWithErrors,
    itemsWithWarnings,
    results,
  };
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidGtin(gtin: string): boolean {
  const cleaned = gtin.replace(/\s|-/g, '');
  return /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(cleaned);
}

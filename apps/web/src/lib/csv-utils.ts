/**
 * CSV Utilities for Bulk Inventory Upload
 */

import { generateSKU, generateTenantKey } from './sku-generator';

export interface CSVItem {
  itemStatus: string | undefined;
  name: string;
  title: string;
  brand: string;
  manufacturer?: string;
  description?: string;
  price: number;
  currency: string;
  sku: string;
  availability: string;
  imageUrl?: string;
  category?: string; // Tenant category name
  status?: 'active' | 'inactive' | 'archived' | 'draft';
  visibility?: 'public' | 'private';
}

export interface CategorySuggestion {
  name: string;
  itemCount: number;
  exists: boolean;
  existingCategoryId?: string;
}

export interface CSVImportPreview {
  items: CSVItem[];
  categorySuggestions: CategorySuggestion[];
  summary: {
    totalItems: number;
    newCategories: number;
    statusBreakdown: Record<string, number>;
    visibilityBreakdown: Record<string, number>;
  };
  errors: string[];
  warnings: string[];
}

export const CSV_TEMPLATE_HEADERS = [
  'name',
  'title',
  'brand',
  'manufacturer',
  'description',
  'price',
  'currency',
  'sku',
  'availability',
  'imageUrl',
  'category',
  'status',
  'visibility'
];

export const CSV_EXAMPLE_DATA = [
  {
    name: 'Red Running Shoes',
    title: 'Premium Red Running Shoes - Size 10',
    brand: 'Nike',
    manufacturer: 'Nike Inc.',
    description: 'Comfortable running shoes with excellent support',
    price: 89.99,
    currency: 'USD',
    sku: 'SHOE-RED-10',
    availability: 'in_stock',
    imageUrl: 'https://example.com/shoe.jpg',
    category: 'Athletic Footwear',
    status: 'active',
    visibility: 'public'
  },
  {
    name: 'Blue T-Shirt',
    title: 'Cotton Blue T-Shirt - Medium',
    brand: 'Adidas',
    manufacturer: 'Adidas AG',
    description: 'Soft cotton t-shirt, perfect for casual wear',
    price: 24.99,
    currency: 'USD',
    sku: 'SHIRT-BLUE-M',
    availability: 'in_stock',
    imageUrl: '',
    category: 'Apparel',
    status: 'active',
    visibility: 'public'
  },
  {
    name: 'Yoga Mat',
    title: 'Premium Yoga Mat',
    brand: 'Generic',
    manufacturer: 'Generic Co.',
    description: 'Non-slip yoga mat',
    price: 34.99,
    currency: 'USD',
    sku: 'YOGA-MAT-01',
    availability: 'in_stock',
    imageUrl: '',
    category: 'Fitness Equipment',
    status: 'inactive',
    visibility: 'private'
  }
];

/**
 * Generate CSV template file with helpful comments
 */
export function generateCSVTemplate(): string {
  const comments = [
    '# RVP Bulk Import Template',
    '# Required fields: name, price',
    '# Optional fields: sku, title, brand, manufacturer, description, currency, availability, imageUrl, category, status, visibility',
    '#',
    '# SKU: Leave empty to auto-generate with BULK identifier (e.g., ULCW-BULK-0001-A7K9)',
    '#      This makes bulk uploaded products easy to identify and search',
    '# Category: Use your tenant category names (will be created if new)',
    '# Status: active, inactive, archived, draft (default: active)',
    '# Visibility: public, private (default: public)',
    '# Availability: in_stock, out_of_stock, preorder, discontinued',
    ''
  ].join('\n');
  
  const headers = CSV_TEMPLATE_HEADERS.join(',');
  const examples = CSV_EXAMPLE_DATA.map(row => 
    CSV_TEMPLATE_HEADERS.map(header => {
      const value = row[header as keyof typeof row] || '';
      // Escape commas and quotes
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  ).join('\n');
  
  return `${comments}${headers}\n${examples}`;
}

/**
 * Download CSV template
 */
export function downloadCSVTemplate() {
  const csv = generateCSVTemplate();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', 'inventory-template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Auto-generate SKUs for items that don't have them
 * Bulk uploaded items get 'BULK' prefix pattern for easy identification
 */
export function autoGenerateSKUs(items: CSVItem[], tenantId: string): CSVItem[] {
  let bulkCounter = 0;
  
  return items.map(item => {
    // If SKU is empty or whitespace, generate one
    if (!item.sku || !item.sku.trim()) {
      bulkCounter++;
      
      // Generate SKU with identifiable pattern for bulk uploads
      // Pattern: {TenantKey}-BULK-{Counter}-{Random}
      // Example: ULCW-BULK-0001-A7K9
      const tenantKey = generateTenantKey(tenantId);
      const counterStr = bulkCounter.toString().padStart(4, '0');
      const randomSuffix = generateRandomSuffix();
      const generatedSKU = `${tenantKey}-BULK-${counterStr}-${randomSuffix}`;
      
      return {
        ...item,
        sku: generatedSKU,
      };
    }
    
    return item;
  });
}

/**
 * Generate random suffix for SKU uniqueness
 */
function generateRandomSuffix(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Parse CSV file
 */
export function parseCSV(csvText: string): CSVItem[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const items: CSVItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) {
      console.warn(`Line ${i + 1} has ${values.length} values but expected ${headers.length}`);
      continue;
    }

    const item: any = {};
    headers.forEach((header, index) => {
      item[header] = values[index];
    });

    // Validate and convert types
    try {
      const validatedItem: CSVItem = {
        name: item.name || '',
        title: item.title || item.name || '',
        brand: item.brand || '',
        description: item.description || '',
        price: parseFloat(item.price) || 0,
        currency: item.currency || 'USD',
        sku: item.sku || '', // Will be auto-generated if empty
        availability: item.availability || 'in_stock',
        imageUrl: item.imageUrl || undefined,
        category: item.category || undefined,
        status: (item.itemStatus || item.status as any) || 'active',
        visibility: (item.visibility as any) || 'public',
        itemStatus: undefined
      };

      // Basic validation - only name is required now (SKU will be auto-generated)
      if (!validatedItem.name) {
        throw new Error(`Line ${i + 1}: name is required`);
      }

      items.push(validatedItem);
    } catch (error) {
      console.error(`Error parsing line ${i + 1}:`, error);
      throw new Error(`Line ${i + 1}: ${error instanceof Error ? error.message : 'Invalid data'}`);
    }
  }

  return items;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of value
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last value
  values.push(current.trim());

  return values;
}

/**
 * Validate CSV items
 */
export function validateCSVItems(items: CSVItem[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (items.length === 0) {
    errors.push('No items found in CSV');
    return { valid: false, errors };
  }

  if (items.length > 1000) {
    errors.push('Maximum 1000 items per upload. Please split into multiple files.');
    return { valid: false, errors };
  }

  // Check for duplicate SKUs
  const skus = new Set<string>();
  items.forEach((item, index) => {
    if (skus.has(item.sku)) {
      errors.push(`Duplicate SKU "${item.sku}" at row ${index + 2}`);
    }
    skus.add(item.sku);

    // Validate price
    if (item.price < 0) {
      errors.push(`Invalid price at row ${index + 2}: ${item.price}`);
    }

    // Validate availability
    const validAvailability = ['in_stock', 'out_of_stock', 'preorder', 'backorder', 'discontinued'];
    if (!validAvailability.includes(item.availability)) {
      errors.push(`Invalid availability at row ${index + 2}: ${item.availability}`);
    }

    // Validate status
    const itemStatus = item.itemStatus || item.status;
    if (itemStatus) {
      const validStatus = ['active', 'inactive', 'archived', 'draft'];
      if (!validStatus.includes(itemStatus)) {
        errors.push(`Invalid status at row ${index + 2}: ${itemStatus}. Must be one of: ${validStatus.join(', ')}`);
      }
    }

    // Validate visibility
    if (item.visibility) {
      const validVisibility = ['public', 'private'];
      if (!validVisibility.includes(item.visibility)) {
        errors.push(`Invalid visibility at row ${index + 2}: ${item.visibility}. Must be one of: ${validVisibility.join(', ')}`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Analyze CSV items and generate import preview
 */
export async function analyzeCSVImport(
  items: CSVItem[],
  existingCategories: Array<{ id: string; name: string }>
): Promise<CSVImportPreview> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Analyze categories
  const categoryMap = new Map<string, number>();
  items.forEach(item => {
    if (item.category) {
      categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + 1);
    } else {
      warnings.push(`Item "${item.name}" (SKU: ${item.sku}) has no category assigned`);
    }
  });
  
  const categorySuggestions: CategorySuggestion[] = Array.from(categoryMap.entries()).map(([name, count]) => {
    const existing = existingCategories.find(c => c.name.toLowerCase() === name.toLowerCase());
    return {
      name,
      itemCount: count,
      exists: !!existing,
      existingCategoryId: existing?.id
    };
  });
  
  // Status breakdown
  const statusBreakdown: Record<string, number> = {};
  items.forEach(item => {
    const status = item.itemStatus || item.status || 'active';
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
  });
  
  // Visibility breakdown
  const visibilityBreakdown: Record<string, number> = {};
  items.forEach(item => {
    const visibility = item.visibility || 'public';
    visibilityBreakdown[visibility] = (visibilityBreakdown[visibility] || 0) + 1;
  });
  
  return {
    items,
    categorySuggestions,
    summary: {
      totalItems: items.length,
      newCategories: categorySuggestions.filter(c => !c.exists).length,
      statusBreakdown,
      visibilityBreakdown
    },
    errors,
    warnings
  };
}

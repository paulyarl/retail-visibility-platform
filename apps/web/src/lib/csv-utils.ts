/**
 * CSV Utilities for Bulk Inventory Upload
 */

export interface CSVItem {
  name: string;
  title: string;
  brand: string;
  description?: string;
  price: number;
  currency: string;
  sku: string;
  availability: string;
  imageUrl?: string;
}

export const CSV_TEMPLATE_HEADERS = [
  'name',
  'title',
  'brand',
  'description',
  'price',
  'currency',
  'sku',
  'availability',
  'imageUrl'
];

export const CSV_EXAMPLE_DATA = [
  {
    name: 'Red Running Shoes',
    title: 'Premium Red Running Shoes - Size 10',
    brand: 'Nike',
    description: 'Comfortable running shoes with excellent support',
    price: 89.99,
    currency: 'USD',
    sku: 'SHOE-RED-10',
    availability: 'in_stock',
    imageUrl: 'https://example.com/shoe.jpg'
  },
  {
    name: 'Blue T-Shirt',
    title: 'Cotton Blue T-Shirt - Medium',
    brand: 'Adidas',
    description: 'Soft cotton t-shirt, perfect for casual wear',
    price: 24.99,
    currency: 'USD',
    sku: 'SHIRT-BLUE-M',
    availability: 'in_stock',
    imageUrl: ''
  }
];

/**
 * Generate CSV template file
 */
export function generateCSVTemplate(): string {
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
  
  return `${headers}\n${examples}`;
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
        sku: item.sku || '',
        availability: item.availability || 'in_stock',
        imageUrl: item.imageUrl || undefined
      };

      // Basic validation
      if (!validatedItem.name || !validatedItem.sku) {
        throw new Error(`Line ${i + 1}: name and sku are required`);
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
    const validAvailability = ['in_stock', 'out_of_stock', 'preorder', 'backorder'];
    if (!validAvailability.includes(item.availability)) {
      errors.push(`Invalid availability at row ${index + 2}: ${item.availability}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

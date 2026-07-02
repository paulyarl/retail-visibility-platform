/**
 * Open-Source Supplier Connectors
 *
 * Connectors for fetching product data from open-source catalog APIs:
 * - Open Food Facts (https://world.openfoodfacts.org/api)
 * - Open Beauty Facts (https://world.openbeautyfacts.org/api)
 * - UPC Database (https://api.upcdatabase.org/api)
 *
 * Each connector implements the SupplierConnector interface and returns
 * normalized BatchIngestRow[] for ingestion into supplier_catalog_item.
 */

import { BatchIngestRow } from './SupplierCatalogService';

export interface SupplierConnector {
  supplierId: string;
  fetchByBarcode(gtin: string): Promise<BatchIngestRow | null>;
  searchByText(query: string, page?: number): Promise<BatchIngestRow[]>;
}

// ---------------------------------------------------------------------------
// Open Food Facts Connector
// ---------------------------------------------------------------------------

export class OpenFoodFactsConnector implements SupplierConnector {
  supplierId = 'supplier-off-open-food-facts';
  private baseUrl = 'https://world.openfoodfacts.org/api/v2';

  async fetchByBarcode(gtin: string): Promise<BatchIngestRow | null> {
    try {
      const response = await fetch(`${this.baseUrl}/product/${gtin}.json`, {
        headers: {
          'User-Agent': 'VisibleShelf-Catalog/1.0',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) return null;

      const data = await response.json() as { status: number; product?: any };
      if (data.status !== 1 || !data.product) return null;

      const p = data.product;
      return {
        supplier_sku: p.code || gtin,
        gtin: p.code || gtin,
        name: p.product_name || p.product_name_en || 'Unknown Product',
        brand: p.brands || null,
        description: p.generic_name || null,
        category: p.categories_tags?.[0] || p.categories || null,
        image_url: p.image_url || p.image_front_url || null,
        attrs: {
          quantity: p.quantity,
          packaging: p.packaging,
          ingredients: p.ingredients_text_en || p.ingredients_text,
          nutrition_grade: p.nutrition_grade_fr,
          allergens: p.allergens,
          labels: p.labels,
        },
      };
    } catch {
      return null;
    }
  }

  async searchByText(query: string, page = 1): Promise<BatchIngestRow[]> {
    try {
      const url = `${this.baseUrl}/search?search_terms=${encodeURIComponent(query)}&page=${page}&page_size=50&json=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'VisibleShelf-Catalog/1.0',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) return [];

      const data = await response.json() as { products?: any[] };
      if (!data.products) return [];

      return data.products.slice(0, 50).map((p) => ({
        supplier_sku: p.code || `off-${p._id}`,
        gtin: p.code || null,
        name: p.product_name || p.product_name_en || 'Unknown Product',
        brand: p.brands || null,
        description: p.generic_name || null,
        category: p.categories_tags?.[0] || p.categories || null,
        image_url: p.image_url || p.image_front_url || null,
        attrs: {
          quantity: p.quantity,
          packaging: p.packaging,
          nutrition_grade: p.nutrition_grade_fr,
        },
      }));
    } catch {
      return [];
    }
  }
}

// ---------------------------------------------------------------------------
// Open Beauty Facts Connector
// ---------------------------------------------------------------------------

export class OpenBeautyFactsConnector implements SupplierConnector {
  supplierId = 'supplier-off-open-beauty-facts';
  private baseUrl = 'https://world.openbeautyfacts.org/api/v2';

  async fetchByBarcode(gtin: string): Promise<BatchIngestRow | null> {
    try {
      const response = await fetch(`${this.baseUrl}/product/${gtin}.json`, {
        headers: {
          'User-Agent': 'VisibleShelf-Catalog/1.0',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) return null;

      const data = await response.json() as { status: number; product?: any };
      if (data.status !== 1 || !data.product) return null;

      const p = data.product;
      return {
        supplier_sku: p.code || gtin,
        gtin: p.code || gtin,
        name: p.product_name || p.product_name_en || 'Unknown Product',
        brand: p.brands || null,
        description: p.generic_name || null,
        category: p.categories_tags?.[0] || p.categories || null,
        image_url: p.image_url || p.image_front_url || null,
        attrs: {
          quantity: p.quantity,
          packaging: p.packaging,
          ingredients: p.ingredients_text_en || p.ingredients_text,
          labels: p.labels,
        },
      };
    } catch {
      return null;
    }
  }

  async searchByText(query: string, page = 1): Promise<BatchIngestRow[]> {
    try {
      const url = `${this.baseUrl}/search?search_terms=${encodeURIComponent(query)}&page=${page}&page_size=50&json=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'VisibleShelf-Catalog/1.0',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) return [];

      const data = await response.json() as { products?: any[] };
      if (!data.products) return [];

      return data.products.slice(0, 50).map((p) => ({
        supplier_sku: p.code || `obf-${p._id}`,
        gtin: p.code || null,
        name: p.product_name || p.product_name_en || 'Unknown Product',
        brand: p.brands || null,
        description: p.generic_name || null,
        category: p.categories_tags?.[0] || p.categories || null,
        image_url: p.image_url || p.image_front_url || null,
        attrs: {
          quantity: p.quantity,
          packaging: p.packaging,
        },
      }));
    } catch {
      return [];
    }
  }
}

// ---------------------------------------------------------------------------
// UPC Database Connector
// ---------------------------------------------------------------------------

export class UPCDatabaseConnector implements SupplierConnector {
  supplierId = 'supplier-off-upc-database';
  private baseUrl = 'https://api.upcdatabase.org/product';

  async fetchByBarcode(gtin: string): Promise<BatchIngestRow | null> {
    const apiKey = process.env.UPC_DATABASE_API_KEY;
    if (!apiKey) return null;

    try {
      const response = await fetch(`${this.baseUrl}/${gtin}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return null;

      const data = await response.json() as {
        success: boolean;
        title?: string;
        description?: string;
        brand?: string;
        category?: string;
        msrp?: string;
        images?: string[];
        ean?: string;
        asin?: string;
        mpn?: string;
      };

      if (!data.success || !data.title) return null;

      return {
        supplier_sku: gtin,
        gtin: data.ean || gtin,
        name: data.title,
        brand: data.brand || null,
        description: data.description || null,
        category: data.category || null,
        image_url: data.images?.[0] || null,
        msrp_cents: data.msrp ? Math.round(parseFloat(data.msrp) * 100) : undefined,
        attrs: {
          asin: data.asin,
          mpn: data.mpn,
        },
      };
    } catch {
      return null;
    }
  }

  async searchByText(query: string): Promise<BatchIngestRow[]> {
    // UPC Database does not have a public text search endpoint
    // Text search falls through to barcode lookup if the query is numeric
    if (/^\d{8,14}$/.test(query)) {
      const item = await this.fetchByBarcode(query);
      return item ? [item] : [];
    }
    return [];
  }
}

// ---------------------------------------------------------------------------
// Connector Registry
// ---------------------------------------------------------------------------

const connectorRegistry = new Map<string, SupplierConnector>();

export function registerConnector(connector: SupplierConnector) {
  connectorRegistry.set(connector.supplierId, connector);
}

export function getConnector(supplierId: string): SupplierConnector | undefined {
  return connectorRegistry.get(supplierId);
}

export function getAllConnectors(): SupplierConnector[] {
  return Array.from(connectorRegistry.values());
}

// Auto-register built-in connectors
registerConnector(new OpenFoodFactsConnector());
registerConnector(new OpenBeautyFactsConnector());
registerConnector(new UPCDatabaseConnector());

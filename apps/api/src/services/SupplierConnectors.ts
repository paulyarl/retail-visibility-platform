/**
 * Supplier Connectors — Open-Source & Commercial
 *
 * Connectors for fetching product data from catalog APIs:
 * - Open Food Facts (https://world.openfoodfacts.org/api)
 * - Open Beauty Facts (https://world.openbeautyfacts.org/api)
 * - UPC Database (https://api.upcdatabase.org/api)
 * - BarcodeLookup.com (https://api.barcodelookup.com/v3) — commercial
 * - Go-UPC (https://go-upc.com/api/v1) — commercial
 * - Kroger Developer API (https://api.kroger.com/v1) — commercial, OAuth2
 *
 * Each connector implements the SupplierConnector interface and returns
 * normalized BatchIngestRow[] for ingestion into supplier_catalog_item.
 */

import { BatchIngestRow } from './SupplierCatalogService';
import { logger } from '../logger';

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
// BarcodeLookup.com Connector (Commercial)
// ---------------------------------------------------------------------------

export class BarcodeLookupConnector implements SupplierConnector {
  supplierId = 'supplier-off-barcodelookup';
  private baseUrl = 'https://api.barcodelookup.com/v3';

  async fetchByBarcode(gtin: string): Promise<BatchIngestRow | null> {
    const apiKey = process.env.BARCODELOOKUP_API_KEY;
    if (!apiKey) return null;

    try {
      const url = `${this.baseUrl}/products?barcode=${encodeURIComponent(gtin)}&formatted=y&key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        logger.warn('BarcodeLookup.com API returned non-OK status', undefined, {
          statusCode: response.status,
          gtin,
        });
        return null;
      }

      const data = await response.json() as { products?: any[] };
      const p = data.products?.[0];
      if (!p) return null;

      const stores = Array.isArray(p.stores) ? p.stores : [];
      const lowestPrice = stores.length > 0
        ? stores.reduce((min: number, s: any) => {
            const price = parseFloat(s.price?.replace(/[^0-9.]/g, '') || '0');
            return price > 0 && (min === 0 || price < min) ? price : min;
          }, 0)
        : 0;

      return {
        supplier_sku: p.mpn || gtin,
        gtin: p.barcode || gtin,
        name: p.title || 'Unknown Product',
        brand: p.brand || null,
        description: p.description || null,
        category: p.category || null,
        image_url: p.images?.[0] || null,
        msrp_cents: lowestPrice > 0 ? Math.round(lowestPrice * 100) : null,
        attrs: {
          mpn: p.mpn,
          model: p.model,
          asin: p.asin,
          manufacturer: p.manufacturer,
          color: p.color,
          size: p.size,
          weight: p.weight,
          dimensions: p.dimensions,
          ingredients: p.ingredients,
          nutrition_facts: p.nutrition_facts,
          features: p.features,
          stores,
          barcode_formats: p.barcode_formats,
          barcodelookup: true,
        },
      };
    } catch (error: any) {
      logger.warn('BarcodeLookup.com fetchByBarcode failed', undefined, {
        gtin,
        error: { name: (error as any)?.name, message: (error as any)?.message },
      });
      return null;
    }
  }

  async searchByText(query: string, page = 1): Promise<BatchIngestRow[]> {
    const apiKey = process.env.BARCODELOOKUP_API_KEY;
    if (!apiKey) return [];

    try {
      const url = `${this.baseUrl}/products?search=${encodeURIComponent(query)}&page=${page}&key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return [];

      const data = await response.json() as { products?: any[] };
      if (!data.products) return [];

      return data.products.slice(0, 10).map((p) => ({
        supplier_sku: p.mpn || p.barcode || `bl-${p.product_id || query}`,
        gtin: p.barcode || null,
        name: p.title || 'Unknown Product',
        brand: p.brand || null,
        description: p.description || null,
        category: p.category || null,
        image_url: p.images?.[0] || null,
        msrp_cents: null,
        attrs: {
          mpn: p.mpn,
          asin: p.asin,
          manufacturer: p.manufacturer,
          barcodelookup: true,
        },
      }));
    } catch (error: any) {
      logger.warn('BarcodeLookup.com searchByText failed', undefined, {
        query,
        error: { name: (error as any)?.name, message: (error as any)?.message },
      });
      return [];
    }
  }
}

// ---------------------------------------------------------------------------
// Go-UPC Connector (Commercial)
// ---------------------------------------------------------------------------

export class GoUpcConnector implements SupplierConnector {
  supplierId = 'supplier-off-goupc';
  private baseUrl = 'https://go-upc.com/api/v1';

  async fetchByBarcode(gtin: string): Promise<BatchIngestRow | null> {
    const apiKey = process.env.GOUPC_API_KEY;
    if (!apiKey) return null;

    try {
      const url = `${this.baseUrl}/code/${encodeURIComponent(gtin)}?key=${encodeURIComponent(apiKey)}&format=true`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        logger.warn('Go-UPC API returned non-OK status', undefined, {
          statusCode: response.status,
          gtin,
        });
        return null;
      }

      const data = await response.json() as { code?: string; product?: any };
      const p = data.product;
      if (!p) return null;

      return {
        supplier_sku: data.code || gtin,
        gtin: p.upc || p.ean || data.code || gtin,
        name: p.name || 'Unknown Product',
        brand: p.brand || null,
        description: p.description || null,
        category: p.category || null,
        image_url: p.imageUrl || null,
        msrp_cents: null,
        attrs: {
          codeType: p.codeType,
          categoryPath: p.categoryPath,
          specs: p.specs,
          ingredients: p.ingredients,
          barcodeUrl: p.barcodeUrl,
          inferred: p.inferred,
          goupc: true,
        },
      };
    } catch (error: any) {
      logger.warn('Go-UPC fetchByBarcode failed', undefined, {
        gtin,
        error: { name: (error as any)?.name, message: (error as any)?.message },
      });
      return null;
    }
  }

  async searchByText(_query: string, _page?: number): Promise<BatchIngestRow[]> {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Kroger Developer API Connector (Commercial, OAuth2)
// ---------------------------------------------------------------------------

export class KrogerConnector implements SupplierConnector {
  supplierId = 'supplier-off-kroger';
  private baseUrl = 'https://api.kroger.com/v1';
  private token: string | null = null;
  private tokenExpiresAt = 0;

  private async getAccessToken(): Promise<string | null> {
    const clientId = process.env.KROGER_CLIENT_ID;
    const clientSecret = process.env.KROGER_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    const now = Date.now();
    const safetyMarginMs = 5 * 60 * 1000;
    if (this.token && now < this.tokenExpiresAt - safetyMarginMs) {
      return this.token;
    }

    try {
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await fetch(`${this.baseUrl}/connect/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authHeader}`,
        },
        body: 'grant_type=client_credentials&scope=product.compact',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        logger.warn('Kroger OAuth2 token request failed', undefined, {
          statusCode: response.status,
        });
        return null;
      }

      const data = await response.json() as { access_token?: string; expires_in?: number };
      if (!data.access_token) return null;

      this.token = data.access_token;
      this.tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
      logger.info('Kroger OAuth2 token acquired', undefined, {
        expiresInSec: data.expires_in,
      });
      return this.token;
    } catch (error: any) {
      logger.warn('Kroger OAuth2 token fetch failed', undefined, {
        error: { name: (error as any)?.name, message: (error as any)?.message },
      });
      return null;
    }
  }

  private async fetchWithAuth(url: string): Promise<Response> {
    const token = await this.getAccessToken();
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401 && token) {
      this.token = null;
      this.tokenExpiresAt = 0;
      const newToken = await this.getAccessToken();
      if (newToken) {
        return fetch(url, {
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        });
      }
    }

    return response;
  }

  async fetchByBarcode(gtin: string): Promise<BatchIngestRow | null> {
    const clientId = process.env.KROGER_CLIENT_ID;
    if (!clientId) return null;

    try {
      const url = `${this.baseUrl}/products/${encodeURIComponent(gtin)}`;
      const response = await this.fetchWithAuth(url);

      if (!response.ok) {
        logger.warn('Kroger product lookup returned non-OK status', undefined, {
          statusCode: response.status,
          gtin,
        });
        return null;
      }

      const data = await response.json() as { data?: any };
      const p = data.data;
      if (!p) return null;

      const categories = Array.isArray(p.categories) ? p.categories : [];
      const images = Array.isArray(p.images) ? p.images : [];
      const items = Array.isArray(p.items) ? p.items : [];
      const largeImage = images.find((img: any) => img.size === 'large') || images[0];

      return {
        supplier_sku: p.productId || gtin,
        gtin: p.upc || gtin,
        name: p.description || 'Unknown Product',
        brand: p.brand || null,
        description: null,
        category: categories[0]?.name || null,
        image_url: largeImage?.url || null,
        msrp_cents: items[0]?.price?.price
          ? Math.round(parseFloat(items[0].price.price) * 100)
          : null,
        attrs: {
          productId: p.productId,
          fulfillmentTypes: p.fulfillmentTypes,
          aisleLocation: p.aisleLocation,
          temperature: p.temperature,
          categories: categories.map((c: any) => c.name),
          priceRequiresLocation: items.length === 0,
          kroger: true,
        },
      };
    } catch (error: any) {
      logger.warn('Kroger fetchByBarcode failed', undefined, {
        gtin,
        error: { name: (error as any)?.name, message: (error as any)?.message },
      });
      return null;
    }
  }

  async searchByText(query: string, page = 1): Promise<BatchIngestRow[]> {
    const clientId = process.env.KROGER_CLIENT_ID;
    if (!clientId) return [];

    try {
      const limit = 50;
      const start = (page - 1) * limit;
      const url = `${this.baseUrl}/products?filter.term=${encodeURIComponent(query)}&filter.limit=${limit}&filter.start=${start}`;
      const response = await this.fetchWithAuth(url);

      if (!response.ok) return [];

      const data = await response.json() as { data?: any[] };
      if (!data.data) return [];

      return data.data.slice(0, limit).map((p) => {
        const categories = Array.isArray(p.categories) ? p.categories : [];
        const images = Array.isArray(p.images) ? p.images : [];
        const largeImage = images.find((img: any) => img.size === 'large') || images[0];

        return {
          supplier_sku: p.productId || `kroger-${p.productId}`,
          gtin: p.upc || null,
          name: p.description || 'Unknown Product',
          brand: p.brand || null,
          description: null,
          category: categories[0]?.name || null,
          image_url: largeImage?.url || null,
          msrp_cents: null,
          attrs: {
            productId: p.productId,
            fulfillmentTypes: p.fulfillmentTypes,
            temperature: p.temperature,
            kroger: true,
          },
        };
      });
    } catch (error: any) {
      logger.warn('Kroger searchByText failed', undefined, {
        query,
        error: { name: (error as any)?.name, message: (error as any)?.message },
      });
      return [];
    }
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
registerConnector(new BarcodeLookupConnector());
registerConnector(new GoUpcConnector());
registerConnector(new KrogerConnector());

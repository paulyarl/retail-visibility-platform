/**
 * Product Matching Utility
 * 
 * Matches scanned product data with existing products from Quick Start Wizard
 * to enable scan-to-enrich workflow.
 */

import { PrismaClient, InventoryItem } from '@prisma/client';

export interface ScannedProductData {
  barcode: string;
  upc?: string;
  ean?: string;
  name: string;
  brand?: string;
  description?: string;
  category?: string;
  price?: number;
  images?: string[];
  specifications?: Record<string, any>;
  manufacturer?: string;
  mpn?: string;
}

export interface ProductMatch {
  existingProduct: InventoryItem;
  scannedData: ScannedProductData;
  matchScore: number; // 0-100
  matchReasons: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface EnrichmentOptions {
  useName?: boolean;
  useDescription?: boolean;
  useImages?: boolean;
  usePrice?: boolean;
  useBrand?: boolean;
  useSpecs?: boolean;
  useCategory?: boolean;
}

/**
 * Find matching products that could be enriched with scanned data
 */
export async function findMatchingProducts(
  prisma: PrismaClient,
  scannedData: ScannedProductData,
  tenantId: string
): Promise<ProductMatch[]> {
  const matches: ProductMatch[] = [];

  // Get products that need enrichment
  const candidateProducts = await prisma.inventoryItem.findMany({
    where: {
      tenantId,
      OR: [
        { source: 'QUICK_START_WIZARD' },
        { enrichmentStatus: 'NEEDS_ENRICHMENT' },
        { enrichmentStatus: 'PARTIALLY_ENRICHED' }
      ]
    },
    include: {
      photos: true
    }
  });

  for (const product of candidateProducts) {
    const score = calculateMatchScore(product, scannedData);

    if (score >= 60) { // 60% threshold for showing as potential match
      const matchReasons = getMatchReasons(product, scannedData, score);
      const confidence = getConfidenceLevel(score);

      matches.push({
        existingProduct: product,
        scannedData,
        matchScore: score,
        matchReasons,
        confidence
      });
    }
  }

  // Sort by match score (highest first)
  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Calculate match score between existing product and scanned data
 */
function calculateMatchScore(
  product: InventoryItem,
  scanned: ScannedProductData
): number {
  let score = 0;
  let totalWeight = 0;

  // UPC/Barcode exact match = 100% (highest priority)
  if (product.gtin && scanned.barcode) {
    totalWeight += 50;
    if (product.gtin === scanned.barcode || 
        product.gtin === scanned.upc || 
        product.gtin === scanned.ean) {
      score += 50; // Exact match
    }
  }

  // Name similarity (fuzzy match)
  if (product.name && scanned.name) {
    totalWeight += 25;
    const nameSimilarity = calculateStringSimilarity(
      normalizeString(product.name),
      normalizeString(scanned.name)
    );
    score += nameSimilarity * 25;
  }

  // Brand match
  if (product.brand && scanned.brand) {
    totalWeight += 15;
    if (normalizeString(product.brand) === normalizeString(scanned.brand)) {
      score += 15;
    } else {
      // Partial brand match
      const brandSimilarity = calculateStringSimilarity(
        normalizeString(product.brand),
        normalizeString(scanned.brand)
      );
      score += brandSimilarity * 15;
    }
  }

  // Category match
  if (product.categoryPath && product.categoryPath.length > 0 && scanned.category) {
    totalWeight += 10;
    const productCategory = product.categoryPath[product.categoryPath.length - 1];
    if (normalizeString(productCategory).includes(normalizeString(scanned.category)) ||
        normalizeString(scanned.category).includes(normalizeString(productCategory))) {
      score += 10;
    }
  }

  // Price similarity (within 30%)
  if (product.price && scanned.price) {
    totalWeight += 10;
    const productPrice = Number(product.price);
    const priceDiff = Math.abs(productPrice - scanned.price) / productPrice;
    if (priceDiff < 0.3) {
      score += 10 * (1 - priceDiff / 0.3); // Scale score based on difference
    }
  }

  // MPN match
  if (product.mpn && scanned.mpn) {
    totalWeight += 10;
    if (product.mpn === scanned.mpn) {
      score += 10;
    }
  }

  // Normalize score to 0-100 range
  if (totalWeight > 0) {
    return Math.min(Math.round((score / totalWeight) * 100), 100);
  }

  return 0;
}

/**
 * Get human-readable match reasons
 */
function getMatchReasons(
  product: InventoryItem,
  scanned: ScannedProductData,
  score: number
): string[] {
  const reasons: string[] = [];

  // UPC match
  if (product.gtin && scanned.barcode) {
    if (product.gtin === scanned.barcode || 
        product.gtin === scanned.upc || 
        product.gtin === scanned.ean) {
      reasons.push('Exact barcode match');
    }
  }

  // Name similarity
  if (product.name && scanned.name) {
    const similarity = calculateStringSimilarity(
      normalizeString(product.name),
      normalizeString(scanned.name)
    );
    if (similarity > 0.8) {
      reasons.push('Very similar product name');
    } else if (similarity > 0.6) {
      reasons.push('Similar product name');
    }
  }

  // Brand match
  if (product.brand && scanned.brand) {
    if (normalizeString(product.brand) === normalizeString(scanned.brand)) {
      reasons.push('Same brand');
    }
  }

  // Category match
  if (product.categoryPath && product.categoryPath.length > 0 && scanned.category) {
    const productCategory = product.categoryPath[product.categoryPath.length - 1];
    if (normalizeString(productCategory).includes(normalizeString(scanned.category))) {
      reasons.push('Same category');
    }
  }

  // Price similarity
  if (product.price && scanned.price) {
    const productPrice = Number(product.price);
    const priceDiff = Math.abs(productPrice - scanned.price) / productPrice;
    if (priceDiff < 0.1) {
      reasons.push('Very similar price');
    } else if (priceDiff < 0.3) {
      reasons.push('Similar price range');
    }
  }

  // MPN match
  if (product.mpn && scanned.mpn && product.mpn === scanned.mpn) {
    reasons.push('Matching manufacturer part number');
  }

  // Enrichment opportunity
  if (product.source === 'QUICK_START_WIZARD') {
    reasons.push('Created by Quick Start Wizard');
  }

  if (product.enrichmentStatus === 'NEEDS_ENRICHMENT') {
    reasons.push('Needs enrichment');
  }

  return reasons;
}

/**
 * Get confidence level based on match score
 */
function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 85) return 'high';
  if (score >= 70) return 'medium';
  return 'low';
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a value between 0 (completely different) and 1 (identical)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  const maxLength = Math.max(str1.length, str2.length);
  const distance = matrix[str2.length][str1.length];
  return 1 - distance / maxLength;
}

/**
 * Normalize string for comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ');   // Normalize whitespace
}

/**
 * Determine what fields are missing from a product
 */
export function getMissingFields(product: InventoryItem): {
  missingImages: boolean;
  missingDescription: boolean;
  missingSpecs: boolean;
  missingBrand: boolean;
} {
  return {
    missingImages: product.missingImages || false,
    missingDescription: product.missingDescription || (!product.description || product.description.length < 20),
    missingSpecs: product.missingSpecs || !product.metadata || Object.keys(product.metadata as any).length === 0,
    missingBrand: product.missingBrand || !product.brand
  };
}

/**
 * Determine what fields can be enriched from scanned data
 */
export function getEnrichableFields(
  product: InventoryItem,
  scannedData: ScannedProductData
): EnrichmentOptions {
  const missing = getMissingFields(product);

  return {
    useName: scannedData.name && scannedData.name.length > product.name.length,
    useDescription: missing.missingDescription && !!scannedData.description,
    useImages: missing.missingImages && !!scannedData.images && scannedData.images.length > 0,
    useBrand: missing.missingBrand && !!scannedData.brand,
    useSpecs: missing.missingSpecs && !!scannedData.specifications,
    usePrice: scannedData.price && scannedData.price > 0,
    useCategory: !!scannedData.category
  };
}

/**
 * Calculate potential enrichment value (how much would be improved)
 */
export function calculateEnrichmentValue(
  product: InventoryItem,
  scannedData: ScannedProductData
): {
  score: number; // 0-100
  improvements: string[];
} {
  const improvements: string[] = [];
  let score = 0;

  const missing = getMissingFields(product);
  const enrichable = getEnrichableFields(product, scannedData);

  if (enrichable.useImages && scannedData.images) {
    score += 30;
    improvements.push(`Add ${scannedData.images.length} product image(s)`);
  }

  if (enrichable.useDescription) {
    score += 25;
    improvements.push('Add detailed description');
  }

  if (enrichable.useSpecs && scannedData.specifications) {
    score += 20;
    improvements.push('Add product specifications');
  }

  if (enrichable.useBrand) {
    score += 15;
    improvements.push('Add brand information');
  }

  if (enrichable.useName && scannedData.name.length > product.name.length) {
    score += 10;
    improvements.push('Improve product name');
  }

  return { score, improvements };
}

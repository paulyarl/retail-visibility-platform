/**
 * Tests for Frontend Slug Utilities
 * 
 * These tests cover frontend-only slug operations:
 * - slugify (category/store type URL generation)
 * - unslugify (display formatting)
 * - slugsMatch (comparison)
 * - URL generation helpers
 */

import { describe, it, expect } from '@jest/globals';
import { slugify, unslugify, slugsMatch, getCategoryUrl, getStoreTypeUrl } from './slug';

describe('Frontend Slug Utilities', () => {
  describe('slugify', () => {
    it('should convert text to lowercase slug', () => {
      expect(slugify('Electronics Store')).toBe('electronics-store');
      expect(slugify('HEALTH & BEAUTY')).toBe('health-beauty');
    });

    it('should replace special characters with hyphens', () => {
      expect(slugify('Health & Beauty')).toBe('health-beauty');
      expect(slugify('Restaurant/Pizza')).toBe('restaurant-pizza');
      expect(slugify('Café & Bistro')).toBe('caf-bistro');
    });

    it('should handle multiple spaces', () => {
      expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces');
      expect(slugify('Too    Many     Spaces')).toBe('too-many-spaces');
    });

    it('should remove leading and trailing hyphens', () => {
      expect(slugify('---Leading Hyphens')).toBe('leading-hyphens');
      expect(slugify('Trailing Hyphens---')).toBe('trailing-hyphens');
      expect(slugify('---Both Sides---')).toBe('both-sides');
    });

    it('should handle empty strings', () => {
      expect(slugify('')).toBe('');
      expect(slugify('   ')).toBe('');
    });

    it('should handle numbers', () => {
      expect(slugify('Store 123')).toBe('store-123');
      expect(slugify('24/7 Service')).toBe('24-7-service');
    });

    it('should handle special characters consistently', () => {
      expect(slugify('C++ Programming')).toBe('c-programming');
      expect(slugify('AT&T Store')).toBe('at-t-store');
      expect(slugify('Price: $99.99')).toBe('price-99-99');
    });
  });

  describe('unslugify', () => {
    it('should convert slug to title case', () => {
      expect(unslugify('electronics-store')).toBe('Electronics Store');
      expect(unslugify('health-beauty')).toBe('Health Beauty');
    });

    it('should handle single words', () => {
      expect(unslugify('electronics')).toBe('Electronics');
      expect(unslugify('STORE')).toBe('Store');
    });

    it('should handle empty strings', () => {
      expect(unslugify('')).toBe('');
    });

    it('should handle multiple hyphens', () => {
      expect(unslugify('multiple---hyphens')).toBe('Multiple Hyphens');
    });

    it('should preserve numbers', () => {
      expect(unslugify('store-123')).toBe('Store 123');
      expect(unslugify('24-7-service')).toBe('24 7 Service');
    });
  });

  describe('slugsMatch', () => {
    it('should match identical slugs', () => {
      expect(slugsMatch('electronics-store', 'electronics-store')).toBe(true);
      expect(slugsMatch('health-beauty', 'health-beauty')).toBe(true);
    });

    it('should match case-insensitive', () => {
      expect(slugsMatch('Electronics-Store', 'electronics-store')).toBe(true);
      expect(slugsMatch('HEALTH-BEAUTY', 'health-beauty')).toBe(true);
    });

    it('should not match different slugs', () => {
      expect(slugsMatch('electronics-store', 'health-beauty')).toBe(false);
      expect(slugsMatch('store-123', 'store-456')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(slugsMatch('', '')).toBe(true);
      expect(slugsMatch('slug', '')).toBe(false);
      expect(slugsMatch('', 'slug')).toBe(false);
    });

    it('should handle undefined values', () => {
      expect(slugsMatch(undefined, undefined)).toBe(true);
      expect(slugsMatch('slug', undefined)).toBe(false);
      expect(slugsMatch(undefined, 'slug')).toBe(false);
    });

    it('should handle mixed undefined and empty strings', () => {
      expect(slugsMatch('', undefined)).toBe(true);
      expect(slugsMatch(undefined, '')).toBe(true);
    });
  });

  describe('getCategoryUrl', () => {
    it('should generate category URL with slug', () => {
      expect(getCategoryUrl('electronics')).toBe('/directory/categories/electronics');
      expect(getCategoryUrl('health-beauty')).toBe('/directory/categories/health-beauty');
    });

    it('should handle slugs with special characters', () => {
      const slug = slugify('Health & Beauty');
      expect(getCategoryUrl(slug)).toBe('/directory/categories/health-beauty');
    });

    it('should handle empty slug', () => {
      expect(getCategoryUrl('')).toBe('/directory/categories/');
    });
  });

  describe('getStoreTypeUrl', () => {
    it('should generate store type URL with slug', () => {
      expect(getStoreTypeUrl('restaurant')).toBe('/directory/stores/restaurant');
      expect(getStoreTypeUrl('retail-store')).toBe('/directory/stores/retail-store');
    });

    it('should handle slugs with special characters', () => {
      const slug = slugify('Coffee Shop');
      expect(getStoreTypeUrl(slug)).toBe('/directory/stores/coffee-shop');
    });

    it('should handle empty slug', () => {
      expect(getStoreTypeUrl('')).toBe('/directory/stores/');
    });
  });

  describe('Integration: slugify + unslugify', () => {
    it('should be reversible for simple cases', () => {
      const original = 'Electronics Store';
      const slugged = slugify(original);
      const unslugged = unslugify(slugged);
      expect(unslugged).toBe(original);
    });

    it('should handle round-trip with special characters', () => {
      const texts = [
        'Health Beauty', // Note: & is lost in slugification
        'Restaurant Pizza', // Note: / is lost
        'Coffee Shop',
        'Store 123'
      ];

      texts.forEach(text => {
        const slugged = slugify(text);
        const unslugged = unslugify(slugged);
        // After round-trip, special chars are gone but words remain
        expect(unslugged.toLowerCase().replace(/[^a-z0-9\s]/g, '')).toBe(
          text.toLowerCase().replace(/[^a-z0-9\s]/g, '')
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long strings', () => {
      const longText = 'A'.repeat(1000);
      const slug = slugify(longText);
      expect(slug).toBe('a'.repeat(1000));
    });

    it('should handle unicode characters', () => {
      expect(slugify('Café')).toBe('caf');
      expect(slugify('Niño')).toBe('ni-o');
      expect(slugify('日本語')).toBe(''); // Non-latin chars removed
    });

    it('should handle mixed case with numbers', () => {
      expect(slugify('iPhone 15 Pro')).toBe('iphone-15-pro');
      expect(slugify('COVID-19 Testing')).toBe('covid-19-testing');
    });

    it('should handle consecutive special characters', () => {
      expect(slugify('A&&&B')).toBe('a-b');
      expect(slugify('A///B')).toBe('a-b');
      expect(slugify('A   B')).toBe('a-b');
    });
  });
});

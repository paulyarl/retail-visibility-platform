/**
 * Unit tests for IntelligenceProfileService (Sprint 1 — Seek Intelligence Scope).
 *
 * Tests the pure helpers (normalizeCategoryKey, renderProfileBlock,
 * renderBusinessProfileBlock) without needing Prisma. The Prisma-backed
 * methods (resolve, createProfile, activateDraft, publishVersion) are tested
 * via integration tests in the routes test file.
 */

import { describe, it, expect } from 'vitest';
import {
  IntelligenceProfileService,
  normalizeCategoryKey,
  type IntelligenceProfile,
} from '../intelligence/IntelligenceProfileService';

const service = IntelligenceProfileService.getInstance();

const sampleProfile: IntelligenceProfile = {
  id: 'auto_repair_us',
  category_key: 'auto repair',
  category_name: 'Auto Repair',
  version: 1,
  status: 'active',
  created_at: new Date(),
  updated_at: new Date(),
  configuration_json: {
    terminology: {
      bay: 'A service work area where a vehicle is lifted for repair',
      RO: 'Repair Order — the work ticket tracking services performed on a vehicle',
    },
    synonyms: ['mechanic', 'garage', 'auto service'],
    specialized_sources: [
      {
        name: 'CARFAX',
        type: 'service_history',
        priority: 1,
        capabilities: ['Service history records', 'Vehicle mileage at time of service'],
        limitations: [
          'CARFAX service history is NOT a review system',
          'Not all repair shops report to CARFAX',
        ],
      },
    ],
    discovery_patterns: { vertical_search: 'Search CARFAX Service Shop directory' },
    category_evidence_rules: { active_operation: 'Recent CARFAX service records' },
    prohibited_inferences: [
      'CARFAX service record count ≠ total customers served',
      'Absence from CARFAX does NOT mean the business is inactive',
    ],
    category_signals: ['INT_VERTICAL_SOURCE_DISCOVERY', 'INT_HIDDEN_TRUST'],
  },
};

describe('normalizeCategoryKey', () => {
  it('trims whitespace', () => {
    expect(normalizeCategoryKey('  auto repair  ')).toBe('auto repair');
  });

  it('lowercases', () => {
    expect(normalizeCategoryKey('Auto Repair')).toBe('auto repair');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeCategoryKey('auto   repair')).toBe('auto repair');
  });

  it('handles single-word categories', () => {
    expect(normalizeCategoryKey('Plumbing')).toBe('plumbing');
  });
});

describe('IntelligenceProfileService.renderProfileBlock', () => {
  const block = service.renderProfileBlock(sampleProfile);

  it('includes the profile header with id + version', () => {
    expect(block).toContain('=== CATEGORY INTELLIGENCE PROFILE ===');
    expect(block).toContain('Category: Auto Repair');
    expect(block).toContain('Profile: auto_repair_us v1');
  });

  it('includes terminology section', () => {
    expect(block).toContain('--- Terminology ---');
    expect(block).toContain('bay: A service work area');
    expect(block).toContain('RO: Repair Order');
  });

  it('includes synonyms', () => {
    expect(block).toContain('--- Synonyms ---');
    expect(block).toContain('mechanic, garage, auto service');
  });

  it('includes specialized sources with capabilities and limitations', () => {
    expect(block).toContain('--- Specialized Sources ---');
    expect(block).toContain('CARFAX (service_history)');
    expect(block).toContain('Capabilities: Service history records');
    expect(block).toContain('Limitations: CARFAX service history is NOT a review system');
  });

  it('includes discovery patterns', () => {
    expect(block).toContain('--- Discovery Patterns ---');
    expect(block).toContain('vertical_search');
  });

  it('includes category evidence rules', () => {
    expect(block).toContain('--- Category Evidence Rules ---');
    expect(block).toContain('active_operation');
  });

  it('includes prohibited inferences', () => {
    expect(block).toContain('--- PROHIBITED INFERENCES');
    expect(block).toContain('CARFAX service record count');
    expect(block).toContain('Absence from CARFAX');
  });

  it('includes category signals', () => {
    expect(block).toContain('--- Category Signals ---');
    expect(block).toContain('INT_VERTICAL_SOURCE_DISCOVERY');
    expect(block).toContain('INT_HIDDEN_TRUST');
  });

  it('ends with a closing marker', () => {
    expect(block).toContain('=== END CATEGORY INTELLIGENCE PROFILE ===');
  });
});

describe('IntelligenceProfileService.renderBusinessProfileBlock', () => {
  const block = service.renderBusinessProfileBlock(sampleProfile);

  it('includes the business audit amplification header', () => {
    expect(block).toContain('=== CATEGORY INTELLIGENCE (BUSINESS AUDIT AMPLIFICATION) ===');
    expect(block).toContain('Category: Auto Repair');
    expect(block).toContain('Profile: auto_repair_us v1');
  });

  it('includes terminology', () => {
    expect(block).toContain('--- Terminology ---');
    expect(block).toContain('bay: A service work area');
  });

  it('includes specialized sources with capabilities and limitations', () => {
    expect(block).toContain('--- Specialized Sources');
    expect(block).toContain('CARFAX (service_history)');
    expect(block).toContain('Capabilities: Service history records');
    expect(block).toContain('Limitations: CARFAX service history is NOT a review system');
  });

  it('includes category evidence rules', () => {
    expect(block).toContain('--- Category Evidence Rules ---');
  });

  it('includes prohibited inferences', () => {
    expect(block).toContain('--- PROHIBITED INFERENCES');
    expect(block).toContain('CARFAX service record count');
  });

  it('includes category signals', () => {
    expect(block).toContain('--- Category Signals');
    expect(block).toContain('INT_VERTICAL_SOURCE_DISCOVERY');
  });

  it('does NOT include discovery patterns (not relevant for business audits)', () => {
    expect(block).not.toContain('--- Discovery Patterns ---');
  });

  it('ends with a closing marker', () => {
    expect(block).toContain('=== END CATEGORY INTELLIGENCE ===');
  });
});

describe('IntelligenceProfileService.renderProfileBlock — empty config', () => {
  it('handles a profile with minimal configuration', () => {
    const minimalProfile: IntelligenceProfile = {
      ...sampleProfile,
      configuration_json: {},
    };
    const block = service.renderProfileBlock(minimalProfile);
    expect(block).toContain('=== CATEGORY INTELLIGENCE PROFILE ===');
    expect(block).toContain('Category: Auto Repair');
    // No sections should be present
    expect(block).not.toContain('--- Terminology ---');
    expect(block).not.toContain('--- Specialized Sources ---');
  });
});

describe('IntelligenceProfileService — singleton', () => {
  it('returns the same instance', () => {
    expect(IntelligenceProfileService.getInstance()).toBe(IntelligenceProfileService.getInstance());
  });
});

/**
 * Seed publishability gate (§4.8) — the predicate that keeps NAP-template
 * seeds out of the index. Pins the two failure classes from the first wave:
 * the old owner-directed CTA appended to a template, and the "a African"
 * article bug. Narratives that merely end with the old CTA must still pass;
 * they are cleaned by recompose, not withheld from publish.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateSeedPublishability,
  isJunkAddress,
  isTemplateDescription,
  seedPublishableSql,
} from '../seedPublishability';

const DISCLOSURE = 'Listed on VisibleShelf from public information (address, phone).';

describe('isTemplateDescription', () => {
  it('detects the new template', () => {
    expect(
      isTemplateDescription(
        `Royal African Market LLC is an African Grocery Store. ${DISCLOSURE}`,
        'Royal African Market LLC',
        'African Grocery Store',
      ),
    ).toBe(true);
  });

  it('detects the old template with the owner CTA', () => {
    expect(
      isTemplateDescription(
        `Royal African Market LLC is a African Grocery Store. ${DISCLOSURE} Claim this listing to verify and update details.`,
        'Royal African Market LLC',
        'African Grocery Store',
      ),
    ).toBe(true);
  });

  it('detects the city/state template variant', () => {
    expect(
      isTemplateDescription(
        `Sahel African Market is an African Grocery Store in Indianapolis, IN. ${DISCLOSURE}`,
        'Sahel African Market',
        'African Grocery Store',
      ),
    ).toBe(true);
  });

  it('keeps a narrative that opens with the business name', () => {
    expect(
      isTemplateDescription(
        `Ethiopian Market LLC is an Ethiopian grocery store on the west side of Indianapolis, at 7355 W 10th Street near the Ben Davis and Chapel Hill neighborhoods. The family-run shop carries the staples of Ethiopian and Eritrean cooking. ${DISCLOSURE}`,
        'Ethiopian Market LLC',
        'Ethiopian Grocery Store',
      ),
    ).toBe(false);
  });

  it('keeps a narrative that is shorter than the template ceiling', () => {
    expect(
      isTemplateDescription(
        `Ivoire African Market is a West African grocery in Waldo run by three sisters from Côte d'Ivoire, with a full fufu aisle and dried fish. ${DISCLOSURE}`,
        'Ivoire African Market',
        'African Grocery Store',
      ),
    ).toBe(false);
  });

  it('does not treat unrelated copy as a template', () => {
    expect(isTemplateDescription('A neighborhood grocery.', 'Royal African Market', 'Grocery Store')).toBe(false);
  });
});

describe('isJunkAddress', () => {
  it.each([
    'unverified (46208 Exa result, 5.0)',
    'unverified (Southport search)',
    'Plainfield, IN (street not captured)',
    'Columbus, IN (Bartholomew County)',
    '',
  ])('rejects %s', (address) => {
    expect(isJunkAddress(address)).toBe(true);
  });

  it('accepts a street address', () => {
    expect(isJunkAddress('3071 N High School Rd, Indianapolis, IN 46224')).toBe(false);
  });
});

describe('evaluateSeedPublishability', () => {
  it('passes a narrative seed with real NAP', () => {
    const result = evaluateSeedPublishability({
      status: 'draft',
      businessName: 'Manna African Caribbean Market',
      description: `Family-owned Fort Wayne market specializing in African and Caribbean groceries. ${DISCLOSURE}`,
      address: '1732 Lake Ave, Fort Wayne, IN 46805',
      category: 'African Grocery Store',
    });

    expect(result.publishable).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('blocks template copy, junk address, and a missing category', () => {
    const result = evaluateSeedPublishability({
      status: 'draft',
      businessName: 'African Community International',
      description: `African Community International is a African Grocery Store. ${DISCLOSURE}`,
      address: 'unverified (46208 Exa result, 5.0)',
      category: '',
    });

    expect(result.publishable).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        'template_description',
        'junk_address',
        'missing_category',
      ]),
    );
  });

  it('blocks suppressed seeds even when the copy is good', () => {
    const result = evaluateSeedPublishability({
      status: 'suppressed',
      businessName: 'Enerem African Food Store',
      description: `A West African pantry in Huntertown. ${DISCLOSURE}`,
      address: '17189 Delancey Ct, Huntertown, IN 46748',
      category: 'African Grocery Store',
    });

    expect(result.blockers).toContain('seed_suppressed');
  });
});

describe('seedPublishableSql', () => {
  it('mirrors the JS gate clauses', () => {
    const sql = seedPublishableSql('dll', 'dps');

    expect(sql).toContain('dll.description IS NOT NULL');
    expect(sql).toContain('dps.category IS NOT NULL');
    expect(sql).toContain('dll.address ~ \'[0-9]\'');
    expect(sql).toContain("dll.address !~* '(unverified|street not captured|exa result|search\\)|\\([^)]*county\\))'");
    expect(sql).toContain("dll.description ILIKE (dll.business_name || ' is a ' || dps.category || '%')");
  });
});

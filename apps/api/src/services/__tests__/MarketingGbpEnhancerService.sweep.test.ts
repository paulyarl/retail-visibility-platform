/**
 * Address-keyed alternate-listing sweep — pure-helper tests.
 *
 * The fixture is the real case: two live Google listings at 6667 W Washington
 * St, Indianapolis — "Arsema Food Mart" (the platform's canonical business,
 * 4.5 / 8 reviews) and "Ethiopian Eritrean Store" (5.0 / 22 reviews), same
 * phone, different names. `lookupBusiness` is name-keyed and can only ever see
 * one of them; the sweep queries by address and must surface the other.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizePhone,
  normalizeName,
  nameTokens,
  isSameListingName,
  streetKey,
  findAlternateListings,
  type PlacesSweepPlace,
} from '../MarketingGbpEnhancerService';

const ARSEMA: PlacesSweepPlace = {
  id: 'arsema',
  displayName: { text: 'Arsema Food Mart' },
  formattedAddress: '6667 W Washington St, Indianapolis, IN 46241, USA',
  nationalPhoneNumber: '(317) 603-3274',
  rating: 4.5,
  userRatingCount: 8,
  primaryTypeDisplayName: { text: 'Convenience store' },
  plusCode: { compoundCode: 'PPVF+P9 Indianapolis, IN' },
};

const ETHIOPIAN: PlacesSweepPlace = {
  id: 'ethiopian',
  displayName: { text: 'Ethiopian Eritrean Store' },
  formattedAddress: '6667 W Washington St, Indianapolis, IN 46241, USA',
  nationalPhoneNumber: '(317) 603-3274',
  rating: 5.0,
  userRatingCount: 22,
  primaryTypeDisplayName: { text: 'Grocery store' },
  plusCode: { compoundCode: 'PPVF+PC Indianapolis, IN' },
};

describe('normalizePhone', () => {
  it('keeps the last 10 digits', () => {
    expect(normalizePhone('(317) 603-3274')).toBe('3176033274');
    expect(normalizePhone('+1 317-603-3274')).toBe('3176033274');
  });
});

describe('streetKey', () => {
  it('ignores unit, city, state and postcode', () => {
    expect(streetKey('6667 W Washington St, Unit A')).toBe('6667 w washington');
    expect(streetKey('6667 W Washington St, Indianapolis, IN 46241, USA')).toBe('6667 w washington');
  });
});

describe('isSameListingName', () => {
  it('matches a brand name against its registered legal name', () => {
    expect(isSameListingName('Arsema Food Mart', 'Arsema G Food Mart LLC')).toBe(true);
  });

  it('does not match a different trading name', () => {
    expect(isSameListingName('Ethiopian Eritrean Store', 'Arsema G Food Mart LLC')).toBe(false);
  });

  it('drops structural tokens when comparing', () => {
    expect(nameTokens('Arsema G Food Mart LLC')).toEqual(['arsema', 'food']);
  });
});

describe('findAlternateListings', () => {
  it('surfaces the second listing and carries its structured facts', () => {
    const alternates = findAlternateListings({
      targetName: 'Arsema G Food Mart LLC',
      targetAddress: '6667 W Washington St, Unit A',
      targetPhone: '(317) 603-3274',
      places: [ARSEMA, ETHIOPIAN],
    });

    expect(alternates).toHaveLength(1);
    expect(alternates[0]).toMatchObject({
      placeId: 'ethiopian',
      name: 'Ethiopian Eritrean Store',
      category: 'Grocery store',
      rating: 5.0,
      reviewCount: 22,
      sharesAddress: true,
      sharesPhone: true,
    });
  });

  it('returns nothing when only the target listing exists', () => {
    expect(
      findAlternateListings({
        targetName: 'Arsema G Food Mart LLC',
        targetAddress: '6667 W Washington St, Unit A',
        targetPhone: '(317) 603-3274',
        places: [ARSEMA],
      }),
    ).toEqual([]);
  });

  it('ignores a different business at a different address and phone', () => {
    const other: PlacesSweepPlace = {
      id: 'other',
      displayName: { text: 'Barako Somali Restaurant' },
      formattedAddress: '6701 W Washington St, Indianapolis, IN 46241, USA',
      nationalPhoneNumber: '(317) 555-0000',
    };
    expect(
      findAlternateListings({
        targetName: 'Arsema G Food Mart LLC',
        targetAddress: '6667 W Washington St, Unit A',
        targetPhone: '(317) 603-3274',
        places: [ARSEMA, other],
      }),
    ).toEqual([]);
  });

  it('catches a shared phone even when the address is written differently', () => {
    const variant: PlacesSweepPlace = {
      ...ETHIOPIAN,
      id: 'variant',
      formattedAddress: '6667 West Washington Street, Indianapolis, IN 46241',
    };
    const alternates = findAlternateListings({
      targetName: 'Arsema G Food Mart LLC',
      targetAddress: '6667 W Washington St, Unit A',
      targetPhone: '(317) 603-3274',
      places: [variant],
    });
    expect(alternates).toHaveLength(1);
    expect(alternates[0].sharesPhone).toBe(true);
  });
});

describe('normalizeName', () => {
  it('strips punctuation and collapses whitespace', () => {
    expect(normalizeName('  Arsema   Food-Mart, LLC ')).toBe('arsema food mart llc');
  });
});

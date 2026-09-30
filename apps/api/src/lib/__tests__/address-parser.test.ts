import { describe, it, expect } from 'vitest';
import { addressParser } from '../address-parser';

/**
 * parseComponents — the decompose-or-null variant used by write paths
 * (audit → campaign contact sync, verification resolve, canonical NAP).
 *
 * The corruption it exists to prevent: parse() never fails, so strings the
 * regexes can't fully decompose came back either as a whole-string
 * address_line1 or with a fabricated postal_code when a loose country
 * pattern claimed the leading street number (the Iceland `\d{3}` misfire
 * that wrote country='IS', zip='711', line1='E Thompson Rd' onto a real
 * Indianapolis campaign).
 */
describe('AddressParserMiddleware.parseComponents', () => {
  it('decomposes a clean US address', () => {
    expect(addressParser.parseComponents('711 E Thompson Rd, Indianapolis, IN 46227')).toEqual({
      country_code: 'US',
      address_line1: '711 E Thompson Rd',
      city: 'Indianapolis',
      state: 'IN',
      postal_code: '46227',
    });
  });

  it('strips a trailing ", United States" (standard GBP displayed_address) and decomposes', () => {
    expect(
      addressParser.parseComponents('711 E Thompson Rd, Indianapolis, IN 46227, United States'),
    ).toEqual({
      country_code: 'US',
      address_line1: '711 E Thompson Rd',
      city: 'Indianapolis',
      state: 'IN',
      postal_code: '46227',
    });
  });

  it('strips a trailing ", USA"', () => {
    const parsed = addressParser.parseComponents('711 E Thompson Rd, Indianapolis, IN 46227, USA');
    expect(parsed?.address_line1).toBe('711 E Thompson Rd');
    expect(parsed?.postal_code).toBe('46227');
  });

  it('returns null for a spelled-out state — refuses the Iceland street-number misfire', () => {
    // Previously parsed as country='IS', postal_code='711' (street number),
    // address_line1='E Thompson Rd', city='Indiana'.
    expect(addressParser.parseComponents('711 E Thompson Rd, Indianapolis, Indiana')).toBeNull();
  });

  it('returns null for a street+city string with no state/ZIP', () => {
    expect(addressParser.parseComponents('711 E Thompson Rd, Indianapolis')).toBeNull();
  });

  it('returns null for non-address labels', () => {
    expect(addressParser.parseComponents('Not publicly listed')).toBeNull();
    expect(addressParser.parseComponents('Address unavailable')).toBeNull();
  });
});

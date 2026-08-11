/**
 * Address Parser Middleware
 *
 * Intelligent international address parsing system that automatically
 * detects country and parses addresses into components.
 *
 * Ported from apps/web/src/lib/address-parser/index.ts (uses backend logger
 * instead of clientLogger). Used by audit → campaign contact sync to parse
 * single-line canonical addresses (e.g. "711 E Thompson Rd, Indianapolis, IN
 * 46227") into structured address_line1/city/state/zip/country fields.
 *
 * Supports: US, GB, CA, EU (17 countries), AU/NZ, Asia (5 countries), LATAM (4 countries).
 */

import { AddressParser, ParsedAddress, AddressParserConfig } from './types';
import { USAddressParser } from './parsers/us';
import { UKAddressParser } from './parsers/uk';
import { CanadaAddressParser } from './parsers/ca';
import { EuropeanAddressParser } from './parsers/eu';
import { AustraliaNewZealandParser } from './parsers/au-nz';
import { AsiaAddressParser } from './parsers/asia';
import { LatinAmericaAddressParser } from './parsers/latam';
import { logger } from '../../logger';

export class AddressParserMiddleware {
  private parsers: AddressParser[];
  private config: AddressParserConfig;

  constructor(config: AddressParserConfig = {}) {
    this.config = {
      defaultCountry: 'US',
      strictValidation: false,
      ...config,
    };

    // Order matters: more specific parsers first
    this.parsers = [
      new USAddressParser(),
      new CanadaAddressParser(),
      new UKAddressParser(),
      new AustraliaNewZealandParser(),
      new AsiaAddressParser(),
      new LatinAmericaAddressParser(),
      new EuropeanAddressParser(), // Last as it's most generic
    ];
  }

  private detectParser(address: string): AddressParser | null {
    for (const parser of this.parsers) {
      if (parser.canParse(address)) {
        return parser;
      }
    }
    return null;
  }

  canParse(address: string): boolean {
    if (!address.includes(',')) return false;
    const parser = this.detectParser(address);
    return parser !== null;
  }

  parse(address: string): ParsedAddress {
    const parser = this.detectParser(address);

    if (!parser) {
      return {
        address_line1: address.trim(),
        country_code: this.config.defaultCountry,
      };
    }

    const parsed = parser.parse(address);

    if (this.config.strictValidation && parser.validate) {
      const isValid = parser.validate(parsed);
      if (!isValid) {
        logger.warn('[AddressParser] Validation failed for parsed address', undefined, { parsed });
      }
    }

    return parsed;
  }

  getSupportedCountries(): string[] {
    return this.parsers.map(p => p.countryCode);
  }

  registerParser(parser: AddressParser): void {
    this.parsers.push(parser);
  }
}

// Singleton instance with default config
export const addressParser = new AddressParserMiddleware({
  defaultCountry: 'US',
  strictValidation: false,
});

export * from './types';
export { USAddressParser } from './parsers/us';
export { UKAddressParser } from './parsers/uk';
export { CanadaAddressParser } from './parsers/ca';
export { EuropeanAddressParser } from './parsers/eu';
export { AustraliaNewZealandParser } from './parsers/au-nz';
export { AsiaAddressParser } from './parsers/asia';
export { LatinAmericaAddressParser } from './parsers/latam';

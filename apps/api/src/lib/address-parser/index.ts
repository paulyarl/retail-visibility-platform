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
  /**
   * Trailing country label ("…, United States", "…, USA") that defeats the
   * `$`-anchored postal patterns — GBP `displayed_address` values commonly
   * carry it.
   */
  private static readonly TRAILING_COUNTRY_RE =
    /,\s*(?:united\s+states(?:\s+of\s+america)?|u\.?\s*s\.?\s*a\.?|u\.?\s*s\.?|america)\.?\s*$/i;

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

  /**
   * Decompose-or-null variant of `parse()` for write paths.
   *
   * `parse()` never fails: an undigested input comes back as a whole-string
   * `address_line1` (the middleware fallback), or with a fabricated
   * `postal_code` when a loose country pattern claims the leading street
   * number (e.g. the Iceland `\d{3}` pattern reading "711 E Thompson Rd"
   * as postcode 711). Both shapes corrupt structured address columns when
   * written back. This returns null unless the parser genuinely decomposed
   * the string, retrying once after stripping a trailing ", United States"
   * style country token that defeats the `$`-anchored postal patterns.
   */
  parseComponents(address: string): ParsedAddress | null {
    for (const candidate of [address, address.replace(AddressParserMiddleware.TRAILING_COUNTRY_RE, '')]) {
      const cleaned = candidate.trim().replace(/\s+/g, ' ');
      if (!cleaned) continue;
      const parser = this.detectParser(cleaned);
      if (!parser) continue;
      const parsed = parser.parse(cleaned);
      // Whole-string echo — the parser matched nothing and echoed the input.
      if (!parsed.address_line1 || parsed.address_line1 === cleaned) continue;
      // A postal_code at the head of the input is a street number, not a
      // postcode (the loose EU `\d{3}`/`\d{4}` patterns claim it).
      if (parsed.postal_code && cleaned.startsWith(String(parsed.postal_code).trim())) continue;
      return parsed;
    }
    return null;
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

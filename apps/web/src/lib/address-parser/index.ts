/**
 * Address Parser Middleware
 * 
 * Intelligent international address parsing system that automatically
 * detects country and parses addresses into components.
 * 
 * Supports:
 * - United States (US)
 * - United Kingdom (GB)
 * - Canada (CA)
 * 
 * Easily extensible to support additional countries.
 */

import { AddressParser, ParsedAddress, AddressParserConfig } from './types';
import { USAddressParser } from './parsers/us';
import { UKAddressParser } from './parsers/uk';
import { CanadaAddressParser } from './parsers/ca';

export class AddressParserMiddleware {
  private parsers: AddressParser[];
  private config: AddressParserConfig;

  constructor(config: AddressParserConfig = {}) {
    this.config = {
      defaultCountry: 'US',
      strictValidation: false,
      ...config
    };

    // Register all available parsers
    this.parsers = [
      new USAddressParser(),
      new UKAddressParser(),
      new CanadaAddressParser(),
    ];
  }

  /**
   * Detect which country parser can handle this address
   */
  private detectParser(address: string): AddressParser | null {
    // Try each parser's canParse method
    for (const parser of this.parsers) {
      if (parser.canParse(address)) {
        return parser;
      }
    }
    return null;
  }

  /**
   * Check if address looks like a full address (not just a street)
   */
  canParse(address: string): boolean {
    // Must contain a comma (separating components)
    if (!address.includes(',')) return false;
    
    // Try to detect a parser
    const parser = this.detectParser(address);
    return parser !== null;
  }

  /**
   * Parse an address string into components
   */
  parse(address: string): ParsedAddress {
    // Detect appropriate parser
    const parser = this.detectParser(address);
    
    if (!parser) {
      // No parser detected, return minimal result with default country
      return {
        address_line1: address.trim(),
        country_code: this.config.defaultCountry
      };
    }

    // Parse using detected parser
    const parsed = parser.parse(address);

    // Validate if strict mode enabled
    if (this.config.strictValidation && parser.validate) {
      const isValid = parser.validate(parsed);
      if (!isValid) {
        console.warn('[AddressParser] Validation failed for parsed address:', parsed);
      }
    }

    return parsed;
  }

  /**
   * Get list of supported country codes
   */
  getSupportedCountries(): string[] {
    return this.parsers.map(p => p.countryCode);
  }

  /**
   * Add a custom parser
   */
  registerParser(parser: AddressParser): void {
    this.parsers.push(parser);
  }
}

// Export singleton instance with default config
export const addressParser = new AddressParserMiddleware({
  defaultCountry: 'US',
  strictValidation: false
});

// Export types and classes for custom usage
export * from './types';
export { USAddressParser } from './parsers/us';
export { UKAddressParser } from './parsers/uk';
export { CanadaAddressParser } from './parsers/ca';

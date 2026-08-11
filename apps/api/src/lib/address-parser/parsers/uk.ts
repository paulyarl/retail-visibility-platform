/**
 * UK Address Parser
 *
 * Handles United Kingdom address formats.
 * Common format: "Street Address, Area, City, Postcode"
 * Example: "10 Downing Street, Westminster, London, SW1A 2AA"
 * Ported from apps/web/src/lib/address-parser/parsers/uk.ts.
 */

import { AddressParser, ParsedAddress } from '../types';

export class UKAddressParser implements AddressParser {
  countryCode = 'GB';

  canParse(address: string): boolean {
    const ukPostcodePattern = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/i;
    return ukPostcodePattern.test(address);
  }

  parse(address: string): ParsedAddress {
    const parsed: ParsedAddress = {
      country_code: 'GB',
    };

    const cleaned = address.trim().replace(/\s+/g, ' ');

    const postcodePattern = /([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})/i;
    const postcodeMatch = cleaned.match(postcodePattern);

    if (postcodeMatch) {
      const postcode = `${postcodeMatch[1]} ${postcodeMatch[2]}`.toUpperCase();
      parsed.postal_code = postcode;

      const withoutPostcode = cleaned.replace(postcodePattern, '').trim();
      const parts = withoutPostcode.split(',').map(p => p.trim()).filter(p => p);

      if (parts.length >= 3) {
        parsed.address_line1 = parts[0];
        parsed.state = parts[1]; // Use state field for area/district
        parsed.city = parts[2];
      } else if (parts.length === 2) {
        parsed.address_line1 = parts[0];
        parsed.city = parts[1];
      } else if (parts.length === 1) {
        parsed.address_line1 = parts[0];
      }

      return parsed;
    }

    parsed.address_line1 = cleaned;
    return parsed;
  }

  validate(parsed: ParsedAddress): boolean {
    if (!parsed.postal_code) return false;

    const ukPostcodePattern = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i;
    return ukPostcodePattern.test(parsed.postal_code);
  }
}

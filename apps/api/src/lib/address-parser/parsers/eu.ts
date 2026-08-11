/**
 * European Standard Address Parser
 *
 * Handles European address formats (17+ countries).
 * Common format: "Street Address, Postal Code City"
 * Ported from apps/web/src/lib/address-parser/parsers/eu.ts.
 */

import { AddressParser, ParsedAddress } from '../types';

export class EuropeanAddressParser implements AddressParser {
  countryCode = 'EU'; // Multi-country parser

  private postalPatterns: Record<string, RegExp> = {
    AT: /\b\d{4}\b/,
    BE: /\b\d{4}\b/,
    CH: /\b\d{4}\b/,
    CZ: /\b\d{3}\s?\d{2}\b/,
    DE: /\b\d{5}\b/,
    DK: /\b\d{4}\b/,
    ES: /\b\d{5}\b/,
    FI: /\b\d{5}\b/,
    FR: /\b\d{5}\b/,
    HU: /\b\d{4}\b/,
    IE: /\b[A-Z]\d{2}\s?[A-Z0-9]{4}\b/i,
    IS: /\b\d{3}\b/,
    IT: /\b\d{5}\b/,
    LU: /\b\d{4}\b/,
    NL: /\b\d{4}\s?[A-Z]{2}\b/,
    NO: /\b\d{4}\b/,
    PL: /\b\d{2}-?\d{3}\b/,
    PT: /\b\d{4}-?\d{3}\b/,
    RO: /\b\d{6}\b/,
    SE: /\b\d{3}\s?\d{2}\b/,
    SK: /\b\d{3}\s?\d{2}\b/,
  };

  canParse(address: string): boolean {
    for (const pattern of Object.values(this.postalPatterns)) {
      if (pattern.test(address)) return true;
    }
    return false;
  }

  parse(address: string): ParsedAddress {
    const parsed: ParsedAddress = {};
    const cleaned = address.trim().replace(/\s+/g, ' ');

    let detectedCountry: string | null = null;
    for (const [country, pattern] of Object.entries(this.postalPatterns)) {
      if (pattern.test(cleaned)) {
        detectedCountry = country;
        break;
      }
    }
    if (detectedCountry) {
      parsed.country_code = detectedCountry;
    }

    // Format 1: "Street, Postal City"
    const match1 = cleaned.match(/^(.+?),\s*(\d[\d\s-]*)\s+(.+)$/);
    if (match1) {
      parsed.address_line1 = match1[1].trim();
      parsed.postal_code = match1[2].trim().replace(/\s+/g, ' ');
      parsed.city = match1[3].trim();
      return parsed;
    }

    // Format 2: "Street, City Postal"
    const match2 = cleaned.match(/^(.+?),\s*(.+?)\s+(\d[\d\s-]*)$/);
    if (match2) {
      parsed.address_line1 = match2[1].trim();
      parsed.city = match2[2].trim();
      parsed.postal_code = match2[3].trim().replace(/\s+/g, ' ');
      return parsed;
    }

    // Format 3: Netherlands style "Street, Postal AA City"
    const match3 = cleaned.match(/^(.+?),\s*(\d{4}\s?[A-Z]{2})\s+(.+)$/i);
    if (match3) {
      parsed.address_line1 = match3[1].trim();
      parsed.postal_code = match3[2].trim().toUpperCase();
      parsed.city = match3[3].trim();
      parsed.country_code = 'NL';
      return parsed;
    }

    // Format 4: Ireland style "Street, City, Postal"
    const match4 = cleaned.match(/^(.+?),\s*(.+?),\s*([A-Z]\d{2}\s?[A-Z0-9]{4})$/i);
    if (match4) {
      parsed.address_line1 = match4[1].trim();
      parsed.city = match4[2].trim();
      parsed.postal_code = match4[3].trim().toUpperCase();
      parsed.country_code = 'IE';
      return parsed;
    }

    // Fallback: extract postal code and split the rest
    for (const [country, pattern] of Object.entries(this.postalPatterns)) {
      const postalMatch = cleaned.match(pattern);
      if (postalMatch) {
        parsed.postal_code = postalMatch[0].trim();
        parsed.country_code = country;

        const withoutPostal = cleaned.replace(pattern, '').trim();
        const parts = withoutPostal.split(',').map(p => p.trim()).filter(p => p);

        if (parts.length >= 2) {
          parsed.address_line1 = parts[0];
          parsed.city = parts[parts.length - 1];
        } else if (parts.length === 1) {
          const words = parts[0].split(/\s+/);
          if (words.length > 1) {
            parsed.city = words[words.length - 1];
            parsed.address_line1 = words.slice(0, -1).join(' ');
          } else {
            parsed.address_line1 = parts[0];
          }
        }

        return parsed;
      }
    }

    parsed.address_line1 = cleaned;
    return parsed;
  }

  validate(parsed: ParsedAddress): boolean {
    if (!parsed.postal_code || !parsed.country_code) return false;
    const pattern = this.postalPatterns[parsed.country_code];
    if (pattern && !pattern.test(parsed.postal_code)) return false;
    return true;
  }
}

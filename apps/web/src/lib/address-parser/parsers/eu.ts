/**
 * European Standard Address Parser
 * 
 * Handles European address formats (17 countries)
 * Common format: "Street Address, Postal Code City"
 * 
 * Supported Countries:
 * - Austria (AT), Belgium (BE), Denmark (DK), Finland (FI)
 * - France (FR), Germany (DE), Ireland (IE), Italy (IT)
 * - Luxembourg (LU), Netherlands (NL), Norway (NO), Portugal (PT)
 * - Spain (ES), Sweden (SE), Switzerland (CH), Iceland (IS)
 * - Czech Republic (CZ), Hungary (HU), Poland (PL), Romania (RO), Slovakia (SK)
 * 
 * Examples:
 * - Germany: "Hauptstraße 1, 10115 Berlin"
 * - France: "1 Rue de la Paix, 75002 Paris"
 * - Spain: "Calle Mayor 1, 28013 Madrid"
 */

import { AddressParser, ParsedAddress } from '../types';

export class EuropeanAddressParser implements AddressParser {
  countryCode = 'EU'; // Multi-country parser

  // European postal code patterns by country
  private postalPatterns = {
    AT: /\b\d{4}\b/,                           // Austria: 1010
    BE: /\b\d{4}\b/,                           // Belgium: 1000
    CH: /\b\d{4}\b/,                           // Switzerland: 8001
    CZ: /\b\d{3}\s?\d{2}\b/,                   // Czech: 110 00
    DE: /\b\d{5}\b/,                           // Germany: 10115
    DK: /\b\d{4}\b/,                           // Denmark: 1050
    ES: /\b\d{5}\b/,                           // Spain: 28013
    FI: /\b\d{5}\b/,                           // Finland: 00100
    FR: /\b\d{5}\b/,                           // France: 75001
    HU: /\b\d{4}\b/,                           // Hungary: 1011
    IE: /\b[A-Z]\d{2}\s?[A-Z0-9]{4}\b/i,       // Ireland: D02 AF30
    IS: /\b\d{3}\b/,                           // Iceland: 101
    IT: /\b\d{5}\b/,                           // Italy: 00118
    LU: /\b\d{4}\b/,                           // Luxembourg: 1009
    NL: /\b\d{4}\s?[A-Z]{2}\b/,                // Netherlands: 1012 AB
    NO: /\b\d{4}\b/,                           // Norway: 0001
    PL: /\b\d{2}-?\d{3}\b/,                    // Poland: 00-950
    PT: /\b\d{4}-?\d{3}\b/,                    // Portugal: 1000-001
    RO: /\b\d{6}\b/,                           // Romania: 010011
    SE: /\b\d{3}\s?\d{2}\b/,                   // Sweden: 100 05
    SK: /\b\d{3}\s?\d{2}\b/,                   // Slovakia: 811 01
  };

  canParse(address: string): boolean {
    // Check if address contains any European postal code pattern
    for (const pattern of Object.values(this.postalPatterns)) {
      if (pattern.test(address)) {
        return true;
      }
    }
    return false;
  }

  parse(address: string): ParsedAddress {
    const parsed: ParsedAddress = {};
    
    // Remove extra whitespace
    const cleaned = address.trim().replace(/\s+/g, ' ');
    
    // Try to detect which country based on postal code
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
    
    // European format typically: "Street, Postal City" or "Street, City Postal"
    // Try format 1: "Street, Postal City"
    const match1 = cleaned.match(/^(.+?),\s*(\d[\d\s-]*)\s+(.+)$/);
    if (match1) {
      parsed.address_line1 = match1[1].trim();
      parsed.postal_code = match1[2].trim().replace(/\s+/g, ' ');
      parsed.city = match1[3].trim();
      return parsed;
    }
    
    // Try format 2: "Street, City Postal" (less common)
    const match2 = cleaned.match(/^(.+?),\s*(.+?)\s+(\d[\d\s-]*)$/);
    if (match2) {
      parsed.address_line1 = match2[1].trim();
      parsed.city = match2[2].trim();
      parsed.postal_code = match2[3].trim().replace(/\s+/g, ' ');
      return parsed;
    }
    
    // Try format 3: Netherlands style "Street, Postal AA City"
    const match3 = cleaned.match(/^(.+?),\s*(\d{4}\s?[A-Z]{2})\s+(.+)$/i);
    if (match3) {
      parsed.address_line1 = match3[1].trim();
      parsed.postal_code = match3[2].trim().toUpperCase();
      parsed.city = match3[3].trim();
      parsed.country_code = 'NL';
      return parsed;
    }
    
    // Try format 4: Ireland style "Street, City, Postal"
    const match4 = cleaned.match(/^(.+?),\s*(.+?),\s*([A-Z]\d{2}\s?[A-Z0-9]{4})$/i);
    if (match4) {
      parsed.address_line1 = match4[1].trim();
      parsed.city = match4[2].trim();
      parsed.postal_code = match4[3].trim().toUpperCase();
      parsed.country_code = 'IE';
      return parsed;
    }
    
    // Try to extract postal code and split the rest
    for (const [country, pattern] of Object.entries(this.postalPatterns)) {
      const postalMatch = cleaned.match(pattern);
      if (postalMatch) {
        parsed.postal_code = postalMatch[0].trim();
        parsed.country_code = country;
        
        // Remove postal code and split by comma
        const withoutPostal = cleaned.replace(pattern, '').trim();
        const parts = withoutPostal.split(',').map(p => p.trim()).filter(p => p);
        
        if (parts.length >= 2) {
          parsed.address_line1 = parts[0];
          parsed.city = parts[parts.length - 1];
        } else if (parts.length === 1) {
          // Try to split by whitespace
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
    
    // If no pattern matches, just use as address_line1
    parsed.address_line1 = cleaned;
    return parsed;
  }

  validate(parsed: ParsedAddress): boolean {
    // Basic validation
    if (!parsed.postal_code || !parsed.country_code) return false;
    
    // Validate postal code format for detected country
    const pattern = this.postalPatterns[parsed.country_code as keyof typeof this.postalPatterns];
    if (pattern && !pattern.test(parsed.postal_code)) return false;
    
    return true;
  }
}

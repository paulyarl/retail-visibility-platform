/**
 * US Address Parser
 * 
 * Handles United States address formats
 * Common format: "Street Address, City, State ZIP"
 */

import { AddressParser, ParsedAddress } from '../types';

export class USAddressParser implements AddressParser {
  countryCode = 'US';

  canParse(address: string): boolean {
    // Check for US ZIP code pattern (5 digits or 5+4)
    return /\b\d{5}(?:-\d{4})?\b/.test(address) && 
           // Check for 2-letter state code
           /\b[A-Z]{2}\b/.test(address);
  }

  parse(address: string): ParsedAddress {
    const parsed: ParsedAddress = {
      country_code: 'US'
    };
    
    // Remove extra whitespace
    const cleaned = address.trim().replace(/\s+/g, ' ');
    
    // Format 1: "Street Address, City, State ZIP"
    const match1 = cleaned.match(/^(.+?),\s*([^,]+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
    if (match1) {
      parsed.address_line1 = match1[1].trim();
      parsed.city = match1[2].trim();
      parsed.state = match1[3].toUpperCase();
      parsed.postal_code = match1[4].trim();
      return parsed;
    }
    
    // Format 2: "Street Address, City State ZIP"
    const match2 = cleaned.match(/^(.+?),\s*([^,]+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
    if (match2) {
      parsed.address_line1 = match2[1].trim();
      parsed.city = match2[2].trim();
      parsed.state = match2[3].toUpperCase();
      parsed.postal_code = match2[4].trim();
      return parsed;
    }
    
    // Format 3: "Street Address City, State ZIP" (no comma after street)
    const match3 = cleaned.match(/^(.+?)\s+([^,]+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
    if (match3) {
      parsed.address_line1 = match3[1].trim();
      parsed.city = match3[2].trim();
      parsed.state = match3[3].toUpperCase();
      parsed.postal_code = match3[4].trim();
      return parsed;
    }
    
    // If no pattern matches, just use the input as address_line1
    parsed.address_line1 = cleaned;
    return parsed;
  }

  validate(parsed: ParsedAddress): boolean {
    // Basic validation
    if (!parsed.postal_code) return false;
    
    // Validate ZIP code format
    const zipPattern = /^\d{5}(?:-\d{4})?$/;
    if (!zipPattern.test(parsed.postal_code)) return false;
    
    // Validate state code (2 letters)
    if (parsed.state && !/^[A-Z]{2}$/.test(parsed.state)) return false;
    
    return true;
  }
}

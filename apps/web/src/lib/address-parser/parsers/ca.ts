/**
 * Canada Address Parser
 * 
 * Handles Canadian address formats
 * Common format: "Street Address, City, Province Postal Code"
 * Example: "123 Main St, Toronto, ON M5H 2N2"
 */

import { AddressParser, ParsedAddress } from '../types';

export class CanadaAddressParser implements AddressParser {
  countryCode = 'CA';

  canParse(address: string): boolean {
    // Check for Canadian postal code pattern (A1A 1A1)
    const caPostalPattern = /\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i;
    return caPostalPattern.test(address);
  }

  parse(address: string): ParsedAddress {
    const parsed: ParsedAddress = {
      country_code: 'CA'
    };
    
    // Remove extra whitespace
    const cleaned = address.trim().replace(/\s+/g, ' ');
    
    // Canadian postal code pattern (A1A 1A1)
    const postalPattern = /([A-Z]\d[A-Z])\s*(\d[A-Z]\d)/i;
    const postalMatch = cleaned.match(postalPattern);
    
    if (postalMatch) {
      // Extract and normalize postal code
      const postalCode = `${postalMatch[1]} ${postalMatch[2]}`.toUpperCase();
      parsed.postal_code = postalCode;
      
      // Remove postal code to parse the rest
      const withoutPostal = cleaned.replace(postalPattern, '').trim();
      
      // Format 1: "Street, City, Province" (postal code already extracted)
      const match1 = withoutPostal.match(/^(.+?),\s*([^,]+?),\s*([A-Z]{2})$/i);
      if (match1) {
        parsed.address_line1 = match1[1].trim();
        parsed.city = match1[2].trim();
        parsed.state = match1[3].toUpperCase(); // Province code
        return parsed;
      }
      
      // Format 2: "Street, City Province" (no comma before province)
      const match2 = withoutPostal.match(/^(.+?),\s*([^,]+?)\s+([A-Z]{2})$/i);
      if (match2) {
        parsed.address_line1 = match2[1].trim();
        parsed.city = match2[2].trim();
        parsed.state = match2[3].toUpperCase();
        return parsed;
      }
      
      // Format 3: Just split by commas
      const parts = withoutPostal.split(',').map(p => p.trim()).filter(p => p);
      if (parts.length >= 2) {
        parsed.address_line1 = parts[0];
        
        // Check if last part contains province code
        const lastPart = parts[parts.length - 1];
        const provinceMatch = lastPart.match(/^(.+?)\s+([A-Z]{2})$/i);
        if (provinceMatch) {
          parsed.city = provinceMatch[1].trim();
          parsed.state = provinceMatch[2].toUpperCase();
        } else {
          parsed.city = lastPart;
        }
      } else if (parts.length === 1) {
        parsed.address_line1 = parts[0];
      }
      
      return parsed;
    }
    
    // If no postal code found, just use as address_line1
    parsed.address_line1 = cleaned;
    return parsed;
  }

  validate(parsed: ParsedAddress): boolean {
    // Basic validation
    if (!parsed.postal_code) return false;
    
    // Validate Canadian postal code format (A1A 1A1)
    const caPostalPattern = /^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i;
    if (!caPostalPattern.test(parsed.postal_code)) return false;
    
    // Validate province code (2 letters)
    if (parsed.state && !/^[A-Z]{2}$/.test(parsed.state)) return false;
    
    return true;
  }
}

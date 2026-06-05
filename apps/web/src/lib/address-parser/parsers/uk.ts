/**
 * UK Address Parser
 * 
 * Handles United Kingdom address formats
 * Common format: "Street Address, Area, City, Postcode"
 * Example: "10 Downing Street, Westminster, London, SW1A 2AA"
 */

import { AddressParser, ParsedAddress } from '../types';

export class UKAddressParser implements AddressParser {
  countryCode = 'GB';

  canParse(address: string): boolean {
    // Check for UK postcode pattern
    // UK postcodes: "SW1A 2AA", "M1 1AE", "B33 8TH", etc.
    const ukPostcodePattern = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/i;
    return ukPostcodePattern.test(address);
  }

  parse(address: string): ParsedAddress {
    const parsed: ParsedAddress = {
      country_code: 'GB'
    };
    
    // Remove extra whitespace
    const cleaned = address.trim().replace(/\s+/g, ' ');
    
    // UK postcode pattern (more comprehensive)
    const postcodePattern = /([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})/i;
    const postcodeMatch = cleaned.match(postcodePattern);
    
    if (postcodeMatch) {
      // Extract and normalize postcode
      const postcode = `${postcodeMatch[1]} ${postcodeMatch[2]}`.toUpperCase();
      parsed.postal_code = postcode;
      
      // Remove postcode from address to parse the rest
      const withoutPostcode = cleaned.replace(postcodePattern, '').trim();
      
      // Split by commas
      const parts = withoutPostcode.split(',').map(p => p.trim()).filter(p => p);
      
      if (parts.length >= 3) {
        // Format: "Street, Area, City" or "Street, District, City"
        parsed.address_line1 = parts[0];
        parsed.state = parts[1]; // Use state field for area/district
        parsed.city = parts[2];
      } else if (parts.length === 2) {
        // Format: "Street, City"
        parsed.address_line1 = parts[0];
        parsed.city = parts[1];
      } else if (parts.length === 1) {
        // Just street address
        parsed.address_line1 = parts[0];
      }
      
      return parsed;
    }
    
    // If no postcode found, just use as address_line1
    parsed.address_line1 = cleaned;
    return parsed;
  }

  validate(parsed: ParsedAddress): boolean {
    // Basic validation
    if (!parsed.postal_code) return false;
    
    // Validate UK postcode format
    const ukPostcodePattern = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i;
    return ukPostcodePattern.test(parsed.postal_code);
  }
}

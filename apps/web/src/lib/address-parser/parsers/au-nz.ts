/**
 * Australia & New Zealand Address Parser
 * 
 * Handles Australian and New Zealand address formats
 * 
 * Australia Format: "Street Address, Suburb State Postcode"
 * Example: "42 Wallaby Way, Sydney NSW 2000"
 * 
 * New Zealand Format: "Street Address, Suburb, City Postcode"
 * Example: "123 Queen Street, Auckland CBD, Auckland 1010"
 */

import { AddressParser, ParsedAddress } from '../types';

export class AustraliaNewZealandParser implements AddressParser {
  countryCode = 'AU'; // Primary country

  // Australian state/territory codes
  private australianStates = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

  canParse(address: string): boolean {
    // Check for Australian postcode (4 digits) + state code
    const hasAustralianFormat = /\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+\d{4}\b/.test(address);
    
    // Check for NZ postcode (4 digits) without state code
    const hasNZFormat = /\b\d{4}\b/.test(address) && !/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/.test(address);
    
    return hasAustralianFormat || hasNZFormat;
  }

  parse(address: string): ParsedAddress {
    const parsed: ParsedAddress = {};
    
    // Remove extra whitespace
    const cleaned = address.trim().replace(/\s+/g, ' ');
    
    // Try Australian format first: "Street, Suburb State Postcode"
    const auMatch = cleaned.match(/^(.+?),\s*(.+?)\s+(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+(\d{4})$/i);
    if (auMatch) {
      parsed.address_line1 = auMatch[1].trim();
      parsed.city = auMatch[2].trim(); // Suburb
      parsed.state = auMatch[3].toUpperCase();
      parsed.postal_code = auMatch[4].trim();
      parsed.country_code = 'AU';
      return parsed;
    }
    
    // Try NZ format: "Street, Suburb, City Postcode"
    const nzMatch1 = cleaned.match(/^(.+?),\s*(.+?),\s*(.+?)\s+(\d{4})$/);
    if (nzMatch1) {
      parsed.address_line1 = nzMatch1[1].trim();
      // Use suburb as address_line2 or combine with city
      const suburb = nzMatch1[2].trim();
      parsed.city = nzMatch1[3].trim();
      parsed.postal_code = nzMatch1[4].trim();
      parsed.country_code = 'NZ';
      
      // If suburb is different from city, add it to address_line2
      if (suburb && suburb !== parsed.city) {
        parsed.address_line2 = suburb;
      }
      
      return parsed;
    }
    
    // Try simpler NZ format: "Street, City Postcode"
    const nzMatch2 = cleaned.match(/^(.+?),\s*(.+?)\s+(\d{4})$/);
    if (nzMatch2) {
      parsed.address_line1 = nzMatch2[1].trim();
      parsed.city = nzMatch2[2].trim();
      parsed.postal_code = nzMatch2[3].trim();
      parsed.country_code = 'NZ';
      return parsed;
    }
    
    // Try Australian format without comma: "Street Suburb State Postcode"
    const auMatch2 = cleaned.match(/^(.+?)\s+([A-Za-z\s]+?)\s+(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+(\d{4})$/i);
    if (auMatch2) {
      parsed.address_line1 = auMatch2[1].trim();
      parsed.city = auMatch2[2].trim();
      parsed.state = auMatch2[3].toUpperCase();
      parsed.postal_code = auMatch2[4].trim();
      parsed.country_code = 'AU';
      return parsed;
    }
    
    // Fallback: Try to extract postcode and determine country
    const postcodeMatch = cleaned.match(/\b(\d{4})\b/);
    if (postcodeMatch) {
      parsed.postal_code = postcodeMatch[1];
      
      // Check if Australian state is present
      const stateMatch = cleaned.match(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/i);
      if (stateMatch) {
        parsed.state = stateMatch[1].toUpperCase();
        parsed.country_code = 'AU';
      } else {
        parsed.country_code = 'NZ';
      }
      
      // Remove postcode and state from address
      let remaining = cleaned.replace(/\b\d{4}\b/, '').trim();
      if (stateMatch) {
        remaining = remaining.replace(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/i, '').trim();
      }
      
      // Split by comma
      const parts = remaining.split(',').map(p => p.trim()).filter(p => p);
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
    
    // If no pattern matches, just use as address_line1
    parsed.address_line1 = cleaned;
    return parsed;
  }

  validate(parsed: ParsedAddress): boolean {
    // Basic validation
    if (!parsed.postal_code) return false;
    
    // Validate postcode format (4 digits)
    if (!/^\d{4}$/.test(parsed.postal_code)) return false;
    
    // If Australian, validate state code
    if (parsed.country_code === 'AU' && parsed.state) {
      if (!this.australianStates.includes(parsed.state)) return false;
    }
    
    return true;
  }
}

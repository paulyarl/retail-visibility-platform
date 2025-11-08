/**
 * Asia Address Parser
 * 
 * Handles Asian address formats (5 countries)
 * - Hong Kong (HK)
 * - India (IN)
 * - Japan (JP)
 * - Singapore (SG)
 * - Taiwan (TW)
 * 
 * Examples:
 * - Japan: "1-1-1 Chiyoda, Chiyoda-ku, Tokyo 100-0001"
 * - Singapore: "1 Raffles Place, Singapore 048616"
 * - Hong Kong: "1 Queen's Road Central, Central, Hong Kong"
 * - India: "123 MG Road, Bangalore, Karnataka 560001"
 * - Taiwan: "No. 1, Sec. 1, Zhongxiao E Rd, Taipei 100"
 */

import { AddressParser, ParsedAddress } from '../types';

export class AsiaAddressParser implements AddressParser {
  countryCode = 'ASIA'; // Multi-country parser

  canParse(address: string): boolean {
    // Japan postal code: 123-4567 or 1234567
    if (/\b\d{3}-?\d{4}\b/.test(address)) return true;
    
    // Singapore postal code: 6 digits
    if (/\bSingapore\s+\d{6}\b/i.test(address)) return true;
    
    // India postal code: 6 digits
    if (/\b\d{6}\b/.test(address) && /\b(Karnataka|Maharashtra|Delhi|Tamil Nadu|Gujarat|Rajasthan|West Bengal|Uttar Pradesh|Andhra Pradesh|Telangana|Kerala|Punjab|Haryana|Bihar|Madhya Pradesh)\b/i.test(address)) return true;
    
    // Hong Kong: No postal code, but has "Hong Kong"
    if (/\bHong Kong\b/i.test(address)) return true;
    
    // Taiwan: Often has "Taipei", "Kaohsiung", etc. and 3-digit postal
    if (/\b(Taipei|Kaohsiung|Taichung|Tainan)\b/i.test(address) && /\b\d{3}\b/.test(address)) return true;
    
    return false;
  }

  parse(address: string): ParsedAddress {
    const parsed: ParsedAddress = {};
    const cleaned = address.trim().replace(/\s+/g, ' ');
    
    // Singapore format: "Street, Singapore Postal"
    const sgMatch = cleaned.match(/^(.+?),\s*Singapore\s+(\d{6})$/i);
    if (sgMatch) {
      parsed.address_line1 = sgMatch[1].trim();
      parsed.city = 'Singapore';
      parsed.postal_code = sgMatch[2].trim();
      parsed.country_code = 'SG';
      return parsed;
    }
    
    // Japan format: "Address, District, City Postal"
    const jpMatch = cleaned.match(/^(.+?),\s*(.+?),\s*(.+?)\s+(\d{3}-?\d{4})$/);
    if (jpMatch) {
      parsed.address_line1 = jpMatch[1].trim();
      parsed.state = jpMatch[2].trim(); // District/Ward
      parsed.city = jpMatch[3].trim();
      parsed.postal_code = jpMatch[4].trim();
      parsed.country_code = 'JP';
      return parsed;
    }
    
    // Hong Kong format: "Street, District, Hong Kong"
    const hkMatch = cleaned.match(/^(.+?),\s*(.+?),\s*Hong Kong$/i);
    if (hkMatch) {
      parsed.address_line1 = hkMatch[1].trim();
      parsed.city = hkMatch[2].trim(); // District
      parsed.country_code = 'HK';
      return parsed;
    }
    
    // India format: "Street, City, State Postal"
    const inMatch = cleaned.match(/^(.+?),\s*(.+?),\s*([A-Za-z\s]+?)\s+(\d{6})$/);
    if (inMatch) {
      parsed.address_line1 = inMatch[1].trim();
      parsed.city = inMatch[2].trim();
      parsed.state = inMatch[3].trim();
      parsed.postal_code = inMatch[4].trim();
      parsed.country_code = 'IN';
      return parsed;
    }
    
    // Taiwan format: "Address, City Postal"
    const twMatch = cleaned.match(/^(.+?),\s*(Taipei|Kaohsiung|Taichung|Tainan)\s+(\d{3})$/i);
    if (twMatch) {
      parsed.address_line1 = twMatch[1].trim();
      parsed.city = twMatch[2].trim();
      parsed.postal_code = twMatch[3].trim();
      parsed.country_code = 'TW';
      return parsed;
    }
    
    // Fallback: Try to detect country and extract what we can
    if (/\bSingapore\b/i.test(cleaned)) {
      parsed.country_code = 'SG';
      parsed.city = 'Singapore';
      const postalMatch = cleaned.match(/\b(\d{6})\b/);
      if (postalMatch) parsed.postal_code = postalMatch[1];
    } else if (/\bHong Kong\b/i.test(cleaned)) {
      parsed.country_code = 'HK';
      parsed.city = 'Hong Kong';
    } else if (/\b\d{3}-?\d{4}\b/.test(cleaned)) {
      parsed.country_code = 'JP';
      const postalMatch = cleaned.match(/\b(\d{3}-?\d{4})\b/);
      if (postalMatch) parsed.postal_code = postalMatch[1];
    } else if (/\b\d{6}\b/.test(cleaned)) {
      // Could be India or Taiwan
      const postalMatch = cleaned.match(/\b(\d{6})\b/);
      if (postalMatch) {
        parsed.postal_code = postalMatch[1];
        // Default to India if we see state names
        if (/\b(Karnataka|Maharashtra|Delhi|Tamil Nadu|Gujarat)\b/i.test(cleaned)) {
          parsed.country_code = 'IN';
        }
      }
    }
    
    // Extract address from remaining text
    const parts = cleaned.split(',').map(p => p.trim()).filter(p => p);
    if (parts.length > 0 && !parsed.address_line1) {
      parsed.address_line1 = parts[0];
    }
    
    if (!parsed.address_line1) {
      parsed.address_line1 = cleaned;
    }
    
    return parsed;
  }

  validate(parsed: ParsedAddress): boolean {
    if (!parsed.country_code) return false;
    
    // Country-specific validation
    switch (parsed.country_code) {
      case 'SG':
        return parsed.postal_code ? /^\d{6}$/.test(parsed.postal_code) : false;
      case 'JP':
        return parsed.postal_code ? /^\d{3}-?\d{4}$/.test(parsed.postal_code) : false;
      case 'IN':
        return parsed.postal_code ? /^\d{6}$/.test(parsed.postal_code) : false;
      case 'TW':
        return parsed.postal_code ? /^\d{3}$/.test(parsed.postal_code) : false;
      case 'HK':
        return true; // Hong Kong doesn't use postal codes
      default:
        return false;
    }
  }
}

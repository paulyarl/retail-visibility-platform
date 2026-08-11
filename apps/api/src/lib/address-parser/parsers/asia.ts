/**
 * Asia Address Parser
 *
 * Handles Asian address formats (5 countries): HK, IN, JP, SG, TW.
 * Ported from apps/web/src/lib/address-parser/parsers/asia.ts.
 */

import { AddressParser, ParsedAddress } from '../types';

export class AsiaAddressParser implements AddressParser {
  countryCode = 'ASIA'; // Multi-country parser

  canParse(address: string): boolean {
    if (/\b\d{3}-?\d{4}\b/.test(address)) return true; // Japan
    if (/\bSingapore\s+\d{6}\b/i.test(address)) return true;
    if (/\b\d{6}\b/.test(address) && /\b(Karnataka|Maharashtra|Delhi|Tamil Nadu|Gujarat|Rajasthan|West Bengal|Uttar Pradesh|Andhra Pradesh|Telangana|Kerala|Punjab|Haryana|Bihar|Madhya Pradesh)\b/i.test(address)) return true;
    if (/\bHong Kong\b/i.test(address)) return true;
    if (/\b(Taipei|Kaohsiung|Taichung|Tainan)\b/i.test(address) && /\b\d{3}\b/.test(address)) return true;
    return false;
  }

  parse(address: string): ParsedAddress {
    const parsed: ParsedAddress = {};
    const cleaned = address.trim().replace(/\s+/g, ' ');

    const sgMatch = cleaned.match(/^(.+?),\s*Singapore\s+(\d{6})$/i);
    if (sgMatch) {
      parsed.address_line1 = sgMatch[1].trim();
      parsed.city = 'Singapore';
      parsed.postal_code = sgMatch[2].trim();
      parsed.country_code = 'SG';
      return parsed;
    }

    const jpMatch = cleaned.match(/^(.+?),\s*(.+?),\s*(.+?)\s+(\d{3}-?\d{4})$/);
    if (jpMatch) {
      parsed.address_line1 = jpMatch[1].trim();
      parsed.state = jpMatch[2].trim();
      parsed.city = jpMatch[3].trim();
      parsed.postal_code = jpMatch[4].trim();
      parsed.country_code = 'JP';
      return parsed;
    }

    const hkMatch = cleaned.match(/^(.+?),\s*(.+?),\s*Hong Kong$/i);
    if (hkMatch) {
      parsed.address_line1 = hkMatch[1].trim();
      parsed.city = hkMatch[2].trim();
      parsed.country_code = 'HK';
      return parsed;
    }

    const inMatch = cleaned.match(/^(.+?),\s*(.+?),\s*([A-Za-z\s]+?)\s+(\d{6})$/);
    if (inMatch) {
      parsed.address_line1 = inMatch[1].trim();
      parsed.city = inMatch[2].trim();
      parsed.state = inMatch[3].trim();
      parsed.postal_code = inMatch[4].trim();
      parsed.country_code = 'IN';
      return parsed;
    }

    const twMatch = cleaned.match(/^(.+?),\s*(Taipei|Kaohsiung|Taichung|Tainan)\s+(\d{3})$/i);
    if (twMatch) {
      parsed.address_line1 = twMatch[1].trim();
      parsed.city = twMatch[2].trim();
      parsed.postal_code = twMatch[3].trim();
      parsed.country_code = 'TW';
      return parsed;
    }

    // Fallback
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
      const postalMatch = cleaned.match(/\b(\d{6})\b/);
      if (postalMatch) {
        parsed.postal_code = postalMatch[1];
        if (/\b(Karnataka|Maharashtra|Delhi|Tamil Nadu|Gujarat)\b/i.test(cleaned)) {
          parsed.country_code = 'IN';
        }
      }
    }

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
    switch (parsed.country_code) {
      case 'SG': return parsed.postal_code ? /^\d{6}$/.test(parsed.postal_code) : false;
      case 'JP': return parsed.postal_code ? /^\d{3}-?\d{4}$/.test(parsed.postal_code) : false;
      case 'IN': return parsed.postal_code ? /^\d{6}$/.test(parsed.postal_code) : false;
      case 'TW': return parsed.postal_code ? /^\d{3}$/.test(parsed.postal_code) : false;
      case 'HK': return true;
      default: return false;
    }
  }
}

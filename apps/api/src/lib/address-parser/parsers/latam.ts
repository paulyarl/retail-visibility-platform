/**
 * Latin America Address Parser
 *
 * Handles Latin American address formats (4 countries): AR, BR, CL, MX.
 * Ported from apps/web/src/lib/address-parser/parsers/latam.ts.
 */

import { AddressParser, ParsedAddress } from '../types';

export class LatinAmericaAddressParser implements AddressParser {
  countryCode = 'LATAM'; // Multi-country parser

  private mexicanStates = ['CDMX', 'JAL', 'NL', 'GTO', 'QRO', 'YUC', 'BC', 'SON', 'CHIH', 'COAH', 'TAM', 'SLP', 'ZAC', 'AGS', 'DGO', 'SIN', 'NAY', 'COL', 'MICH', 'GRO', 'OAX', 'CHIS', 'TAB', 'CAMP', 'VER', 'PUE', 'TLX', 'MOR', 'HGO', 'MEX', 'QR', 'BCS'];
  private brazilianStates = ['SP', 'RJ', 'MG', 'BA', 'PR', 'RS', 'PE', 'CE', 'PA', 'SC', 'GO', 'MA', 'AM', 'ES', 'PB', 'RN', 'AL', 'MT', 'PI', 'DF', 'MS', 'SE', 'RO', 'TO', 'AC', 'AP', 'RR'];

  canParse(address: string): boolean {
    if (/\b\d{5}-\d{3}\b/.test(address)) return true; // Brazil
    if (/\b\d{5}\b/.test(address) && new RegExp(`\\b(${this.mexicanStates.join('|')})\\b`, 'i').test(address)) return true; // Mexico
    if (/\b[A-Z]\d{4}\s?[A-Z]{3}\b/i.test(address)) return true; // Argentina
    if (/\b\d{7}\b/.test(address) && /\b(Santiago|Valparaíso|Concepción|La Serena|Antofagasta)\b/i.test(address)) return true; // Chile
    return false;
  }

  parse(address: string): ParsedAddress {
    const parsed: ParsedAddress = {};
    const cleaned = address.trim().replace(/\s+/g, ' ');

    const brMatch = cleaned.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5}-\d{3})$/i);
    if (brMatch) {
      parsed.address_line1 = brMatch[1].trim();
      parsed.city = brMatch[2].trim();
      parsed.state = brMatch[3].toUpperCase();
      parsed.postal_code = brMatch[4].trim();
      parsed.country_code = 'BR';
      return parsed;
    }

    const mxMatch = cleaned.match(new RegExp(`^(.+?),\\s*(.+?),\\s*(${this.mexicanStates.join('|')})\\s+(\\d{5})$`, 'i'));
    if (mxMatch) {
      parsed.address_line1 = mxMatch[1].trim();
      parsed.city = mxMatch[2].trim();
      parsed.state = mxMatch[3].toUpperCase();
      parsed.postal_code = mxMatch[4].trim();
      parsed.country_code = 'MX';
      return parsed;
    }

    const arMatch = cleaned.match(/^(.+?),\s*(.+?),\s*([A-Z]\d{4}\s?[A-Z]{3})$/i);
    if (arMatch) {
      parsed.address_line1 = arMatch[1].trim();
      parsed.city = arMatch[2].trim();
      parsed.postal_code = arMatch[3].trim().toUpperCase();
      parsed.country_code = 'AR';
      return parsed;
    }

    const clMatch = cleaned.match(/^(.+?),\s*(.+?),\s*(\d{7})$/);
    if (clMatch) {
      parsed.address_line1 = clMatch[1].trim();
      parsed.city = clMatch[2].trim();
      parsed.postal_code = clMatch[3].trim();
      parsed.country_code = 'CL';
      return parsed;
    }

    // Fallbacks
    const brPostal = cleaned.match(/\b(\d{5}-\d{3})\b/);
    if (brPostal) {
      parsed.postal_code = brPostal[1];
      parsed.country_code = 'BR';
      const stateMatch = cleaned.match(new RegExp(`\\b(${this.brazilianStates.join('|')})\\b`, 'i'));
      if (stateMatch) parsed.state = stateMatch[1].toUpperCase();
    }

    const mxPostal = cleaned.match(/\b(\d{5})\b/);
    const mxState = cleaned.match(new RegExp(`\\b(${this.mexicanStates.join('|')})\\b`, 'i'));
    if (mxPostal && mxState) {
      parsed.postal_code = mxPostal[1];
      parsed.state = mxState[1].toUpperCase();
      parsed.country_code = 'MX';
    }

    const arPostal = cleaned.match(/\b([A-Z]\d{4}\s?[A-Z]{3})\b/i);
    if (arPostal) {
      parsed.postal_code = arPostal[1].toUpperCase();
      parsed.country_code = 'AR';
    }

    const clPostal = cleaned.match(/\b(\d{7})\b/);
    if (clPostal && /\b(Santiago|Valparaíso|Concepción)\b/i.test(cleaned)) {
      parsed.postal_code = clPostal[1];
      parsed.country_code = 'CL';
    }

    const parts = cleaned.split(',').map(p => p.trim()).filter(p => p);
    if (parts.length > 0 && !parsed.address_line1) {
      parsed.address_line1 = parts[0];
    }
    if (parts.length > 1 && !parsed.city) {
      parsed.city = parts[1];
    }
    if (!parsed.address_line1) {
      parsed.address_line1 = cleaned;
    }

    return parsed;
  }

  validate(parsed: ParsedAddress): boolean {
    if (!parsed.postal_code || !parsed.country_code) return false;
    switch (parsed.country_code) {
      case 'BR': return /^\d{5}-\d{3}$/.test(parsed.postal_code);
      case 'MX': return /^\d{5}$/.test(parsed.postal_code);
      case 'AR': return /^[A-Z]\d{4}\s?[A-Z]{3}$/i.test(parsed.postal_code);
      case 'CL': return /^\d{7}$/.test(parsed.postal_code);
      default: return false;
    }
  }
}

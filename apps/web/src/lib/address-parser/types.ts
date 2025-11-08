/**
 * Address Parser Types
 * 
 * Common types for international address parsing
 */

export interface ParsedAddress {
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_code?: string;
}

export interface AddressParser {
  /**
   * Country code this parser handles (ISO 3166-1 alpha-2)
   */
  countryCode: string;
  
  /**
   * Detect if this parser can handle the given address
   */
  canParse(address: string): boolean;
  
  /**
   * Parse the address into components
   */
  parse(address: string): ParsedAddress;
  
  /**
   * Validate a parsed address for this country
   */
  validate?(parsed: ParsedAddress): boolean;
}

export interface AddressParserConfig {
  /**
   * Default country code to use if detection fails
   */
  defaultCountry?: string;
  
  /**
   * Enable strict validation
   */
  strictValidation?: boolean;
}

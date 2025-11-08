# Address Parser Middleware

Intelligent international address parsing system that automatically detects country and parses addresses into components.

## Features

- 🌍 **Multi-Country Support**: 24 countries across 5 continents
- 🤖 **Auto-Detection**: Automatically detects country from address format
- 📦 **Modular Architecture**: Plugin-based parser system
- ✅ **Validation**: Optional strict validation for parsed addresses
- 🔧 **Extensible**: Easy to add new country parsers

## Supported Countries (24 Total)

### North America (2)
| Country | Code | Example Format |
|---------|------|----------------|
| United States | US | `7460 Rockville Rd, Indianapolis, IN 46214` |
| Canada | CA | `123 Main St, Toronto, ON M5H 2N2` |

### Europe (21)
| Country | Code | Example Format |
|---------|------|----------------|
| United Kingdom | GB | `10 Downing Street, Westminster, London, SW1A 2AA` |
| Germany | DE | `Hauptstraße 1, 10115 Berlin` |
| France | FR | `1 Rue de la Paix, 75002 Paris` |
| Spain | ES | `Calle Mayor 1, 28013 Madrid` |
| Italy | IT | `Via Roma 1, 00118 Roma` |
| Netherlands | NL | `Damrak 1, 1012 AB Amsterdam` |
| Belgium | BE | `Rue de la Loi 1, 1000 Brussels` |
| Austria | AT | `Ringstraße 1, 1010 Vienna` |
| Switzerland | CH | `Bahnhofstrasse 1, 8001 Zurich` |
| Ireland | IE | `O'Connell Street, Dublin, D02 AF30` |
| Denmark | DK | `Strøget 1, 1050 Copenhagen` |
| Sweden | SE | `Drottninggatan 1, 100 05 Stockholm` |
| Norway | NO | `Karl Johans gate 1, 0001 Oslo` |
| Finland | FI | `Mannerheimintie 1, 00100 Helsinki` |
| Portugal | PT | `Rua Augusta 1, 1000-001 Lisbon` |
| Poland | PL | `Marszałkowska 1, 00-950 Warsaw` |
| Czech Republic | CZ | `Václavské náměstí 1, 110 00 Prague` |
| Hungary | HU | `Andrássy út 1, 1011 Budapest` |
| Romania | RO | `Calea Victoriei 1, 010011 Bucharest` |
| Slovakia | SK | `Hlavná 1, 811 01 Bratislava` |
| Iceland | IS | `Laugavegur 1, 101 Reykjavik` |
| Luxembourg | LU | `Grand Rue 1, 1009 Luxembourg` |

### Asia-Pacific (2)
| Country | Code | Example Format |
|---------|------|----------------|
| Australia | AU | `42 Wallaby Way, Sydney NSW 2000` |
| New Zealand | NZ | `123 Queen Street, Auckland 1010` |

## Usage

### Basic Usage

```typescript
import { addressParser } from '@/lib/address-parser';

// Check if address can be parsed
const canParse = addressParser.canParse('7460 Rockville Rd, Indianapolis, IN 46214');
// Returns: true

// Parse address
const parsed = addressParser.parse('7460 Rockville Rd, Indianapolis, IN 46214');
// Returns:
// {
//   address_line1: '7460 Rockville Rd',
//   city: 'Indianapolis',
//   state: 'IN',
//   postal_code: '46214',
//   country_code: 'US'
// }
```

### International Examples

**UK Address:**
```typescript
const parsed = addressParser.parse('10 Downing Street, Westminster, London, SW1A 2AA');
// Returns:
// {
//   address_line1: '10 Downing Street',
//   state: 'Westminster',
//   city: 'London',
//   postal_code: 'SW1A 2AA',
//   country_code: 'GB'
// }
```

**Canadian Address:**
```typescript
const parsed = addressParser.parse('123 Main St, Toronto, ON M5H 2N2');
// Returns:
// {
//   address_line1: '123 Main St',
//   city: 'Toronto',
//   state: 'ON',
//   postal_code: 'M5H 2N2',
//   country_code: 'CA'
// }
```

### Custom Configuration

```typescript
import { AddressParserMiddleware } from '@/lib/address-parser';

const parser = new AddressParserMiddleware({
  defaultCountry: 'GB',
  strictValidation: true
});

const parsed = parser.parse(address);
```

### Get Supported Countries

```typescript
const countries = addressParser.getSupportedCountries();
// Returns: ['US', 'GB', 'CA']
```

## Adding a New Country Parser

1. Create a new parser file in `parsers/`:

```typescript
// parsers/au.ts
import { AddressParser, ParsedAddress } from '../types';

export class AustraliaAddressParser implements AddressParser {
  countryCode = 'AU';

  canParse(address: string): boolean {
    // Detect Australian postcode pattern (4 digits)
    return /\b\d{4}\b/.test(address) && 
           /\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/.test(address);
  }

  parse(address: string): ParsedAddress {
    // Implementation
  }

  validate(parsed: ParsedAddress): boolean {
    // Optional validation
  }
}
```

2. Register the parser in `index.ts`:

```typescript
import { AustraliaAddressParser } from './parsers/au';

this.parsers = [
  new USAddressParser(),
  new UKAddressParser(),
  new CanadaAddressParser(),
  new AustraliaAddressParser(), // Add here
];
```

## Architecture

```
address-parser/
├── index.ts              # Main middleware orchestrator
├── types.ts              # TypeScript interfaces
├── parsers/
│   ├── us.ts            # United States parser
│   ├── uk.ts            # United Kingdom parser
│   ├── ca.ts            # Canada parser
│   └── [country].ts     # Add more parsers here
└── README.md            # This file
```

## How It Works

1. **Detection**: Each parser has a `canParse()` method that checks if it can handle the address format
2. **Parsing**: The middleware tries each parser until one successfully detects the format
3. **Extraction**: The parser extracts components (street, city, state, postal code)
4. **Validation**: Optional validation ensures the parsed data is correct

## Detection Patterns

### US
- ZIP code: `12345` or `12345-6789`
- State: 2-letter code (e.g., `IN`, `CA`, `NY`)

### UK
- Postcode: `SW1A 2AA`, `M1 1AE`, `B33 8TH`
- Format: Alphanumeric with space

### Canada
- Postal code: `A1A 1A1` (letter-digit-letter digit-letter-digit)
- Province: 2-letter code (e.g., `ON`, `BC`, `QC`)

## Benefits

- ✅ **User Experience**: Copy address from Google Maps → instant auto-fill
- ✅ **Data Quality**: Reduces manual entry errors
- ✅ **International**: Works with multiple address formats
- ✅ **Maintainable**: Clean separation of concerns
- ✅ **Extensible**: Easy to add new countries

## Future Enhancements

- [ ] Add Australia, New Zealand parsers
- [ ] Add European country parsers (Germany, France, etc.)
- [ ] Integrate with Google Places API for validation
- [ ] Add fuzzy matching for typos
- [ ] Support for PO Box addresses
- [ ] Address normalization (standardize abbreviations)

## License

Part of the Retail Visibility Platform

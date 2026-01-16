# Auto-Generated SKU System

## Overview
The platform automatically generates unique, structured SKUs for products when users don't provide one manually.

## SKU Pattern
```
{TenantKey}-{ProductType}-{DeliveryMethod}-{AccessControl}-{Random}
```

## Components

### 1. Tenant Key (4 characters)
- **Purpose:** Globally unique identifier for each tenant
- **Generation:** Consistent hash from tenant ID
- **Example:** `M8IJ`, `ABC1`, `XYZ7`
- **Display:** Shown on items page header with copy button
- **Benefit:** Easy to identify which tenant owns a product

### 2. Product Type (4 characters)
- `PHYS` - Physical product
- `DIGI` - Digital product
- `HYBR` - Hybrid (both physical and digital)

### 3. Delivery Method (4 characters)
- `DWNL` - Direct download
- `LINK` - External link
- `MAIL` - Email delivery
- `SHIP` - Shipping
- `PICK` - Pickup
- `DELV` - Delivery

### 4. Access Control (4 characters)
- `PERS` - Personal license
- `COMM` - Commercial license
- `ENTR` - Enterprise license
- `PUBL` - Public (no restrictions)
- `SUBS` - Subscription-based

### 5. Random Suffix (4 characters)
- Alphanumeric characters (excluding ambiguous: 0, O, 1, I)
- Ensures uniqueness within tenant

## Examples

### Digital Product
```
M8IJ-DIGI-DWNL-PERS-A7K9
```
- Tenant: M8IJ
- Type: Digital
- Delivery: Direct download
- Access: Personal license
- Unique ID: A7K9

### Physical Product
```
ABC1-PHYS-SHIP-PUBL-B3M2
```
- Tenant: ABC1
- Type: Physical
- Delivery: Shipping
- Access: Public
- Unique ID: B3M2

### Hybrid Product
```
XYZ7-HYBR-LINK-COMM-C5N8
```
- Tenant: XYZ7
- Type: Hybrid
- Delivery: External link
- Access: Commercial license
- Unique ID: C5N8

## User Experience

### Creating a Product
1. User opens "Add Product" modal
2. SKU field shows: "Leave empty to auto-generate"
3. Helper text: "✨ Will auto-generate with tenant prefix, product type, delivery method, and access control"
4. User fills in product details (name, type, delivery, etc.)
5. User leaves SKU field empty
6. On save, system generates SKU automatically

### Viewing Tenant Key
- Displayed at top of items page
- Format: "Your SKU Prefix: **M8IJ**"
- Copy button for easy reference
- Consistent across all products for that tenant

### Manual SKU Entry
- Users can still enter custom SKUs if desired
- Auto-generation only happens when field is empty
- No validation against the pattern for manual entries

## Benefits

### For Tenants
✅ **No thinking required** - System handles SKU creation
✅ **Consistent format** - All SKUs follow same pattern
✅ **Easy identification** - First 4 characters identify tenant
✅ **Searchable** - Can search by tenant prefix
✅ **Professional** - Structured, organized SKUs

### For Platform
✅ **Global uniqueness** - Tenant prefix prevents collisions
✅ **Traceability** - Easy to identify product owner
✅ **Analytics** - Can analyze by product type, delivery method
✅ **Support** - Quick identification of tenant from SKU
✅ **Scalability** - Supports unlimited tenants and products

## Technical Implementation

### Files
- `apps/web/src/lib/sku-generator.ts` - Core generation logic
- `apps/web/src/components/items/TenantSKUPrefix.tsx` - Display component
- `apps/web/src/components/items/EditItemModal.tsx` - Integration in form

### Key Functions
```typescript
// Generate tenant key from tenant ID
generateTenantKey(tenantId: string): string

// Generate full SKU
generateSKU(params: SKUGenerationParams): string

// Parse SKU back to components
parseSKU(sku: string): Partial<SKUGenerationParams> | null
```

### Consistency
- Same tenant ID always generates same tenant key
- Uses deterministic hashing algorithm
- No database storage needed for tenant keys

## Future Enhancements

### Potential Additions
- [ ] SKU search by pattern
- [ ] Bulk SKU regeneration
- [ ] Custom tenant key assignment (override hash)
- [ ] SKU analytics dashboard
- [ ] Export SKU mapping report
- [ ] Barcode generation from SKU

### Considerations
- Keep pattern length manageable (currently 24 chars with dashes)
- Maintain backward compatibility with manual SKUs
- Consider industry-specific patterns for certain verticals

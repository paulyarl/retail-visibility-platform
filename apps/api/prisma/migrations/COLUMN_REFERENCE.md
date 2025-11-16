# Database Column Name Reference

## Mixed Casing in Schema

The database has mixed column naming conventions:

### InventoryItem Table
- `tenantId` - camelCase (no @map) → use `"tenantId"` with quotes
- `tenant_category_id` - snake_case (@map) → use without quotes
- `itemStatus` - camelCase (no @map) → use `"itemStatus"` with quotes
- `updatedAt` - camelCase (no @map) → use `"updatedAt"` with quotes
- `visibility` - lowercase (no @map) → use without quotes

### Tenant Table  
- Most columns: snake_case with @map
- New columns we're adding: snake_case

### TenantCategory Table (tenant_category)
- `tenant_id` - snake_case (@map)
- `is_active` - snake_case (@map)
- Other columns: snake_case

### TenantBusinessProfile Table (tenant_business_profile)
- `tenant_id` - snake_case (@map)
- All columns: snake_case

## Rule of Thumb
- If column has `@map("snake_case")` → use snake_case without quotes
- If column is camelCase without @map → use "camelCase" with quotes
- If column is lowercase without @map → use without quotes

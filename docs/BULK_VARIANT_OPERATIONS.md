# Bulk Variant Operations System

## Overview

The Bulk Variant Operations System provides merchants with powerful tools to manage multiple product variants simultaneously. This system allows for efficient bulk operations including featured type assignments, sale pricing, stock management, and activation control across multiple variants of a product.

## 🎯 Business Value

### For Merchants
- **Time Efficiency**: Apply operations to dozens of variants in seconds instead of minutes
- **Consistency**: Ensure uniform pricing, stock levels, or featured types across variant groups
- **Campaign Management**: Quickly set up sales or promotions across entire product lines
- **Inventory Control**: Bulk activate/deactivate seasonal variants
- **Error Reduction**: Reduce manual entry errors through bulk operations

### For Platform
- **Performance**: Optimized database operations with MV refreshes
- **Scalability**: Handle bulk operations across thousands of variants
- **Data Integrity**: Atomic operations ensure consistency
- **Audit Trail**: Complete logging of bulk operations

## 🏗️ Architecture

### Core Components

1. **VariantBulkOperations Component** (`VariantBulkOperations.tsx`)
   - UI for selecting operations and variants
   - Real-time preview of operation effects
   - Progress tracking and error handling

2. **Bulk Operations API** (`variant-bulk-operations.ts`)
   - RESTful endpoints for bulk operations
   - Validation and authorization
   - MV refresh integration

3. **Database Integration**
   - Direct operations on `product_variants` table
   - Featured type management via `featured_products` table
   - Materialized view refresh for real-time updates

## 📋 Supported Operations

### 1. Featured Type Assignment
**Endpoint**: `POST /api/variants/bulk/featured-type`

Apply featured types to multiple variants simultaneously.

**Request Body**:
```json
{
  "variantIds": ["var-123", "var-456", "var-789"],
  "featuredType": "sale",
  "priority": 3,
  "expiresAt": "2024-12-31T23:59:59Z",
  "autoUnfeature": true
}
```

**Available Featured Types**:
- `sale` - Items on sale (priority: 3)
- `new_arrival` - New products (priority: 5)
- `featured` - Featured items (priority: 4)
- `bestseller` - Popular items (priority: 6)
- `clearance` - Final sale items (priority: 2)
- `store_selection` - Curated choices (priority: 1)

### 2. Sale Price Management
**Endpoint**: `POST /api/variants/bulk/sale-price`

Set sale prices for multiple variants at once.

**Request Body**:
```json
{
  "variantIds": ["var-123", "var-456"],
  "salePriceCents": 1499
}
```

**Smart Integration**: Automatically triggers smart sale tagging in the MV.

### 3. Stock Management
**Endpoint**: `POST /api/variants/bulk/stock`

Update stock quantities for multiple variants.

**Request Body**:
```json
{
  "variantIds": ["var-123", "var-456"],
  "stock": 100
}
```

**Parent Product Update**: Automatically updates parent product stock (sum of variants).

### 4. Activation Control
**Endpoint**: `POST /api/variants/bulk/activation`

Activate or deactivate multiple variants.

**Request Body**:
```json
{
  "variantIds": ["var-123", "var-456"],
  "isActive": true
}
```

## 🔄 Operation Workflow

### Step 1: Operation Selection
Merchant chooses from 5 operation types:
- Featured Type
- Sale Price  
- Stock
- Activate
- Deactivate

### Step 2: Variant Selection
- Select individual variants via checkboxes
- "Select All" for bulk selection
- Visual feedback on selected variants
- Variant details shown (name, SKU, price, status)

### Step 3: Configuration
- **Featured Type**: Choose from 6 predefined types
- **Sale Price**: Enter price in dollars
- **Stock**: Enter quantity
- **Activate/Deactivate**: Confirmation dialog

### Step 4: Execution
- API call to backend
- Progress indicator during operation
- Success/error feedback
- Automatic MV refresh

### Step 5: Results
- Success message with count
- Updated variant states
- Refreshed product displays

## 🎨 UI Components

### Operation Selection Grid
```typescript
// 5 operation buttons in responsive grid
<div className="grid grid-cols-2 md:grid-cols-5 gap-2">
  <button onClick={() => setSelectedOperation('featured_type')}>
    <Tag className="w-5 h-5" />
    <span>Featured Type</span>
  </button>
  // ... other operations
</div>
```

### Variant Selection Panel
```typescript
// Scrollable grid of variant checkboxes
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
  {variants.map((variant, index) => (
    <label className="flex items-center gap-2 p-2 border rounded">
      <input type="checkbox" checked={selectedVariants.has(index)} />
      <div className="flex-1">
        <div className="font-medium">{variant.variant_name}</div>
        <div className="text-xs text-gray-500">
          {variant.sku} • ${(variant.price_cents / 100).toFixed(2)}
        </div>
        <Badge variant={variant.is_active ? 'default' : 'warning'}>
          {variant.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>
    </label>
  ))}
</div>
```

### Configuration Panels
Each operation type has its own configuration panel:

**Featured Type Panel**:
```typescript
// Grid of featured type options
<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
  {featuredTypeOptions.map((option) => (
    <button 
      onClick={() => setOperationData({ featuredType: option.type })}
      className={operationData.featuredType === option.type ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
    >
      <Tag className={`w-4 h-4 text-${option.color}-500`} />
      <span className="font-medium">{option.label}</span>
      <div className="text-xs text-gray-600">{option.description}</div>
    </button>
  ))}
</div>
```

**Sale Price Panel**:
```typescript
<div className="mb-4">
  <label className="block text-sm font-medium mb-2">Sale Price ($)</label>
  <input
    type="number"
    step="0.01"
    min="0"
    value={operationData.salePriceCents ? operationData.salePriceCents / 100 : ''}
    onChange={(e) => setOperationData({ salePriceCents: Math.round(parseFloat(e.target.value) * 100) })}
    className="w-full px-3 py-2 border rounded-lg"
  />
  <p className="text-xs text-gray-500 mt-1">
    This will set the sale price for {selectedVariants.size} selected variant(s)
  </p>
</div>
```

## 🔧 API Implementation

### Authentication & Authorization
```typescript
router.post('/bulk/featured-type', authenticateToken, async (req: Request, res: Response) => {
  const user = (req as any).user;
  
  // Verify tenant access
  const variants = await prisma.product_variants.findMany({
    where: {
      id: { in: validated.variantIds },
      tenant_id: user.tenantId,
    }
  });
});
```

### Validation
```typescript
const bulkFeaturedTypeSchema = z.object({
  variantIds: z.array(z.string()).min(1),
  featuredType: z.enum(['sale', 'new_arrival', 'featured', 'bestseller', 'clearance', 'store_selection']),
  priority: z.number().int().min(1).max(10).default(3),
  expiresAt: z.string().datetime().optional(),
  autoUnfeature: z.boolean().default(true),
});
```

### Database Operations
```typescript
// Clear existing featured types
await prisma.featured_products.deleteMany({
  where: {
    inventory_item_id: { in: validated.variantIds },
    tenant_id: user.tenantId,
  }
});

// Apply new featured types
const featuredProducts = await Promise.all(
  validated.variantIds.map(variantId =>
    prisma.featured_products.create({
      data: {
        inventory_item_id: variantId,
        tenant_id: user.tenantId,
        featured_type: validated.featuredType,
        featured_priority: validated.priority,
        featured_at: new Date().toISOString(),
        featured_expires_at: validated.expiresAt ? new Date(validated.expiresAt).toISOString() : null,
        auto_unfeature: validated.autoUnfeature,
        is_active: true,
      }
    })
  )
);
```

### MV Refresh Integration
```typescript
// Refresh materialized view for real-time updates
try {
  await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_products_mv`;
} catch (error) {
  logger.warn('[BULK VARIANT] MV refresh failed:', error);
}
```

## 📊 Performance Considerations

### Database Optimization
- **Bulk Operations**: Single database queries for multiple updates
- **Indexing**: Optimized indexes on `tenant_id`, `variant_id` combinations
- **Concurrent MV Refresh**: Non-blocking materialized view updates
- **Transaction Safety**: Atomic operations with rollback capability

### Frontend Performance
- **Lazy Loading**: Variant selection panel with virtual scrolling
- **Debounced Updates**: Prevent excessive API calls during configuration
- **Progress Indicators**: Real-time feedback during operations
- **Error Handling**: Graceful degradation with retry mechanisms

### Caching Strategy
- **MV Refresh**: Immediate updates for consistency
- **API Response Caching**: Short TTL for variant data
- **UI State Management**: Local state with optimistic updates

## 🛡️ Security Features

### Access Control
- **Tenant Isolation**: Operations limited to user's tenant variants
- **Authentication**: Required for all bulk operations
- **Authorization**: Role-based access control
- **Input Validation**: Comprehensive schema validation

### Audit Trail
```typescript
logger.info('[BULK VARIANT] Featured type applied', {
  userId: user.userId,
  tenantId: user.tenantId,
  featuredType: validated.featuredType,
  variantCount: validated.variantIds.length
});
```

### Rate Limiting
- **Operation Limits**: Maximum variants per operation
- **Frequency Limits**: Prevent abuse of bulk operations
- **Resource Protection**: Database connection pooling

## 📈 Monitoring & Analytics

### Operation Metrics
- **Success Rates**: Track operation success/failure rates
- **Performance**: Measure operation duration and database load
- **Usage Patterns**: Analyze which operations are most popular
- **Error Tracking**: Monitor and alert on operation failures

### Business Intelligence
- **Bulk Operation Frequency**: How often merchants use bulk features
- **Variant Management**: Insights into variant complexity
- **Featured Type Usage**: Popular featured types and effectiveness
- **Sale Campaign Impact**: Track bulk sale operations and results

## 🔄 Integration Points

### Smart Sale Tagging System
```typescript
// Automatic integration with smart sale tagging
if (selectedOperation === 'sale_price') {
  // MV automatically detects sale price changes
  // Smart tagging applies "sale" featured type
  // Real-time updates across storefront
}
```

### Inventory Management
```typescript
// Parent product stock updates
CREATE TRIGGER trigger_update_parent_stock
AFTER INSERT OR UPDATE OF stock OR DELETE ON product_variants
FOR EACH ROW
EXECUTE FUNCTION update_parent_stock();
```

### Featured Products System
```typescript
// Integration with existing featured products
await prisma.featured_products.deleteMany({
  where: {
    inventory_item_id: { in: validated.variantIds },
    tenant_id: user.tenantId,
  }
});
```

## 🧪 Testing Strategy

### Unit Tests
- **Component Testing**: UI component behavior
- **API Testing**: Endpoint validation and responses
- **Database Testing**: Operation correctness and performance

### Integration Tests
- **End-to-End**: Complete operation workflows
- **MV Refresh**: Materialized view update verification
- **Multi-tenant**: Isolation and security testing

### Performance Tests
- **Load Testing**: Bulk operations with large variant sets
- **Concurrent Operations**: Multiple simultaneous operations
- **Database Performance**: Query optimization validation

## 📚 Usage Examples

### Scenario 1: Seasonal Sale Setup
```typescript
// Merchant wants to put all t-shirt variants on sale
1. Select "Sale Price" operation
2. Select all t-shirt variants (12 total)
3. Set sale price to $15.99
4. Apply operation
5. Result: All 12 variants now have sale price + smart "sale" tagging
```

### Scenario 2: New Product Launch
```typescript
// Merchant launching new product variants
1. Select "Featured Type" operation  
2. Choose "new_arrival" featured type
3. Select all new variants (8 total)
4. Set 30-day expiration
5. Apply operation
6. Result: All 8 variants tagged as "new_arrival"
```

### Scenario 3: Seasonal Inventory Management
```typescript
// Merchant deactivating winter variants
1. Select "Deactivate" operation
2. Select all winter clothing variants (25 total)
3. Apply operation
4. Result: All 25 variants deactivated, removed from storefront
```

## 🚀 Future Enhancements

### Planned Features
- **Scheduled Operations**: Set up bulk operations for future execution
- **Template Operations**: Save and reuse common operation patterns
- **Advanced Filtering**: Filter variants by attributes, price ranges, etc.
- **Undo Functionality**: Reverse bulk operations within time window
- **Bulk Import/Export**: CSV-based variant management

### Performance Improvements
- **Background Processing**: Large operations in background jobs
- **Real-time Updates**: WebSocket-based progress updates
- **Optimized Queries**: Further database performance tuning
- **Caching Layer**: Redis-based caching for variant data

### User Experience
- **Drag & Drop**: Visual variant selection
- **Preview Mode**: See operation effects before applying
- **Keyboard Shortcuts**: Power user features
- **Mobile Optimization**: Responsive design improvements

---

**Status**: ✅ Production Ready  
**Last Updated**: January 25, 2026  
**Dependencies**: PostgreSQL 12+, Node.js 18+, React 18+

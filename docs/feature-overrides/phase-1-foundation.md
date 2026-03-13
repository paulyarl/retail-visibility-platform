# Phase 1: Foundation Layer - Override System Core

## 🎯 Objective
Establish the core override system foundation with full CRUD operations and UI.

## 📋 Implementation Tasks

### 1.1 Core Service Layer
- [ ] **FeatureOverridesService.ts** - Complete implementation
  - [ ] Fix existing TypeScript errors
  - [ ] Add missing `getTenant()` and `getTier()` methods
  - [ ] Implement proper API response parsing
  - [ ] Add comprehensive error handling
  - [ ] Add caching strategy with proper invalidation

- [ ] **Override Interfaces** - Complete type definitions
  - [ ] `FeaturedProductsOverride` interface
  - [ ] `TenantLimitsOverride` interface  
  - [ ] `CreateFeaturedProductsOverrideData` interface
  - [ ] `CreateTenantLimitsOverrideData` interface
  - [ ] Union types and status enums

### 1.2 Database Schema
  ```

- [ ] **API Endpoints** - Backend implementation
  - [ ] `GET /api/admin/feature-overrides` - List overrides
  - [ ] `POST /api/admin/feature-overrides/feature` - Create feature override
  - [ ] `POST /api/admin/feature-overrides/pricing` - Create pricing override
  - [ ] `POST /api/admin/feature-overrides/limits` - Create limits override
  - [ ] `POST /api/admin/feature-overrides/featured-products` - Create featured products override
  - [ ] `POST /api/admin/feature-overrides/tenant-limits` - Create tenant limits override
  - [ ] `PUT /api/admin/feature-overrides/:id/status` - Update status
  - [ ] `DELETE /api/admin/feature-overrides/:id` - Delete override

### 1.3 Admin UI
- [ ] **Feature Overrides Page** - Complete admin interface
  - [ ] Fix existing dropdown integration
  - [ ] Add featured products and tenant limits to override types
  - [ ] Implement form validation
  - [ ] Add success/error notifications
  - [ ] Add override management (activate, deactivate, delete)

- [ ] **Data Integration** - API data sources
  - [ ] Featured products API integration (`/api/tenant-limits/featured-products/all`)
  - [ ] Tenant limits API integration (`/api/tenant-limits/tiers`)
  - [ ] Error handling for API failures
  - [ ] Loading states and fallbacks

## 📚 Documentation

### 1.4 Technical Documentation
- [ ] **API Documentation** - Override endpoints
  - [ ] Request/response schemas
  - [ ] Error response formats
  - [ ] Authentication requirements
  - [ ] Rate limiting considerations

- [ ] **Database Documentation** - Schema and relationships
  - [ ] Table definitions
  - [ ] Index requirements
  - [ ] Foreign key relationships
  - [ ] Data migration scripts

### 1.5 User Documentation
- [ ] **Admin Guide**#### Main Overrides Table (`feature_overrides`)
```sql
-- Following database naming standards: snake_case_plural
CREATE TABLE IF NOT EXISTS public.feature_overrides (
    id TEXT NOT NULL PRIMARY KEY,
    organization_id TEXT NULL,           -- References organizations_list.id (app-level validation)
    tenant_id TEXT NULL,                 -- References tenants.id (app-level validation)
    override_type TEXT NOT NULL CHECK (override_type IN ('feature', 'pricing', 'limits', 'featured_products', 'tenant_limits')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'pending')),
    reason TEXT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    granted_by TEXT NOT NULL,
    approved_by TEXT NULL,
    approved_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Common fields for most override types (snake_case)
    subscription_tier TEXT NULL,
    original_limit INTEGER NULL,
    custom_limit INTEGER NULL,
    custom_price DECIMAL(10,2) NULL,
    currency TEXT NULL DEFAULT 'USD'
    -- Note: No foreign key constraints - handled via application logic
);
```

#### Details Table (`feature_override_details`)
```sql
-- Following database naming standards: snake_case_plural
CREATE TABLE IF NOT EXISTS public.feature_override_details (
    id TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    override_id TEXT NOT NULL,
    detail_type TEXT NOT NULL,           -- 'feature', 'pricing_field', 'limit_type', 'featured_type', etc.
    detail_key TEXT NOT NULL,            -- 'feature_name', 'billing_interval', 'limit_name', etc.
    detail_value TEXT NOT NULL,          -- 'Advanced Analytics', 'monthly', 'skus', etc.
    detail_numeric_value DECIMAL(10,2) NULL, -- For numeric values
    detail_boolean_value BOOLEAN NULL,    -- For boolean values
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_feature_override_details_override FOREIGN KEY (override_id) 
        REFERENCES feature_overrides(id) ON UPDATE CASCADE ON DELETE CASCADE
);

## ✅ Acceptance Criteria

### Functional Requirements
- [ ] Admin can create all 5 override types (feature, pricing, limits, featured_products, tenant_limits)
- [ ] Override data persists correctly in database
- [ ] UI displays all override information accurately
- [ ] Dropdown options populate from real API data
- [ ] Form validation prevents invalid submissions

### Technical Requirements
- [ ] All TypeScript errors resolved
- [ ] API responses properly parsed and handled
- [ ] Error states handled gracefully
- [ ] Performance acceptable (< 2s load times)
- [ ] Responsive design works on mobile/tablet

### Integration Requirements
- [ ] Feature overrides service integrates with existing tenant/organization services
- [ ] API endpoints follow existing platform patterns
- [ ] UI follows existing design system
- [ ] Error handling follows platform standards

## 🧪 Testing Strategy

### Unit Tests
- [ ] FeatureOverridesService methods
- [ ] Override interface validation
- [ ] API response parsing
- [ ] Error handling scenarios

### Integration Tests  
- [ ] Override CRUD operations
- [ ] API endpoint functionality
- [ ] Database operations
- [ ] UI component interactions

### E2E Tests
- [ ] Complete override creation flow
- [ ] Override management workflows
- [ ] Error scenario handling
- [ ] Cross-browser compatibility

## 📅 Timeline

**Week 1**
- Days 1-2: Service layer implementation and TypeScript fixes
- Days 3-4: Database schema and API endpoints
- Days 5: Unit tests and service validation

**Week 2**  
- Days 1-3: Admin UI implementation and data integration
- Days 4-5: Integration testing and documentation

## 🚨 Risks & Mitigations

### Technical Risks
- **TypeScript complexity** - Incremental implementation with frequent testing
- **API integration issues** - Mock data fallbacks during development
- **Database performance** - Proper indexing and query optimization

### Project Risks
- **Scope creep** - Focus on core functionality only
- **Timeline delays** - Parallel development tracks
- **Integration challenges** - Early testing with existing services

## 📊 Success Metrics

- **Functionality**: 100% of override types working in UI
- **Performance**: < 2s load times for override management
- **Quality**: 90%+ test coverage
- **Usability**: Admin can create overrides without training

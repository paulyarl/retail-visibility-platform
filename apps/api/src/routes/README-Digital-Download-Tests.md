# Digital Download Pages API Tests

This directory contains comprehensive test scripts for validating the Digital Download Pages API functionality.

## Test Files

### 1. `test-digital-download-pages.bat`
- **Platform**: Windows (Batch)
- **Usage**: Double-click or run from command line
- **Purpose**: Quick API endpoint testing without database setup

### 2. `test-digital-download-pages.ps1`
- **Platform**: Windows (PowerShell)
- **Usage**: `.\test-digital-download-pages.ps1`
- **Purpose**: Enhanced testing with better error handling and output

### 3. `test-digital-download-pages-integration.js`
- **Platform**: Node.js (Cross-platform)
- **Usage**: `node test-digital-download-pages-integration.js`
- **Purpose**: Full integration testing with database setup/cleanup

## Running Tests

### Prerequisites

1. **API Server Running**: Make sure your API server is running on `http://localhost:3001`
2. **Database Access**: For integration tests, ensure database connection is configured
3. **Authentication**: Update auth tokens in scripts if needed

### Quick Test (No Database Setup)

```bash
# Windows Batch
test-digital-download-pages.bat

# Windows PowerShell
.\test-digital-download-pages.ps1
```

### Full Integration Test

```bash
# From the API directory
cd apps/api
node src/routes/test-digital-download-pages-integration.js
```

## Test Coverage

### API Endpoints Tested
- ✅ `GET /api/tenants/[tenantId]/digital-download-pages` - List pages
- ✅ `POST /api/tenants/[tenantId]/digital-download-pages` - Create page
- ✅ `GET /api/tenants/[tenantId]/digital-download-pages/[id]` - Get page
- ✅ `PUT /api/tenants/[tenantId]/digital-download-pages/[id]` - Update page
- ✅ `DELETE /api/tenants/[tenantId]/digital-download-pages/[id]` - Delete page
- ✅ `POST /api/tenants/[tenantId]/digital-download-pages/[id]/preview-token` - Generate preview token
- ✅ `GET /api/tenants/[tenantId]/digital-download-pages/[id]/assets` - Get assets
- ✅ `PUT /api/tenants/[tenantId]/digital-download-pages/[id]/assets/reorder` - Reorder assets

### Validation Tested
- ✅ Required field validation
- ✅ Email format validation
- ✅ Color format validation
- ✅ Tenant ownership verification
- ✅ Item type validation (digital/hybrid only)
- ✅ Duplicate page prevention

### Database Operations Tested
- ✅ Create, Read, Update, Delete operations
- ✅ Foreign key relationships
- ✅ Transaction handling
- ✅ Slug generation and uniqueness
- ✅ Preview token generation and expiry

## Expected Results

### Successful Test Flow
1. **Initial State**: Empty download pages list
2. **Create Page**: Successfully creates with generated slug
3. **Read Operations**: Retrieve page details and list
4. **Update Page**: Successfully updates title and status
5. **Preview Token**: Generates valid token with expiry
6. **Asset Management**: Handles empty asset lists
7. **Delete Page**: Successfully removes page
8. **Final State**: Back to empty list

### Error Cases Tested
1. **Invalid Item ID**: Returns 404/400 for non-existent items
2. **Missing Fields**: Returns 400 for validation errors
3. **Invalid Data**: Returns 400 for malformed data
4. **Unauthorized**: Returns 401/403 for invalid auth
5. **Duplicate Pages**: Returns 409 for existing pages

## Troubleshooting

### Common Issues

**"Connection refused" errors**
- Ensure API server is running on port 3001
- Check if firewall is blocking requests

**Authentication errors**
- Update auth tokens in test scripts
- Verify tenant authentication middleware

**Database errors**
- Check database connection configuration
- Ensure Prisma schema is up to date
- Run migrations if needed

**Validation failures**
- Check if validation rules match expected format
- Verify request body structure

### Debug Mode

For detailed debugging, modify the test scripts to:
1. Log full request/response details
2. Add console.log statements
3. Use browser dev tools to inspect network requests

## Next Steps

After successful API testing:
1. ✅ Verify all endpoints work correctly
2. ✅ Confirm error handling is robust
3. ✅ Validate database operations
4. ✅ Test edge cases and validation
5. 🔄 **Ready for UI Development**

Once all tests pass, the API is ready for Phase 3: Tenant Management UI development.

## Test Data Cleanup

The integration test automatically cleans up test data. If tests fail, you may need to manually clean up:

```sql
-- Manual cleanup if needed
DELETE FROM digital_download_pages WHERE tenant_id = 'test-tenant-digital-download';
DELETE FROM digital_downloads WHERE tenant_id = 'test-tenant-digital-download';
DELETE FROM digital_preview_tokens WHERE tenant_id = 'test-tenant-digital-download';
DELETE FROM inventory_items WHERE id = 'test-item-digital-download';
DELETE FROM tenants WHERE id = 'test-tenant-digital-download';
```

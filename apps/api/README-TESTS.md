# Backend Services Readiness Test

This directory contains test scripts to verify backend services are ready for shops pages development.

## Test Scripts

### 1. Node.js Script (Recommended)
```bash
node test-backend-readiness.js
```

**Features:**
- Detailed JSON response parsing
- Color-coded output
- Comprehensive error reporting
- Success rate calculation
- Recommendations based on results

### 2. Windows Batch Script
```bash
test-backend-readiness.bat
```

**Features:**
- Simple HTTP status code checking
- Basic error reporting
- Windows-compatible
- No dependencies required

## Test Coverage

### Core Services
- ✅ Health Check (`/api/health`)
- ✅ Public API Status (`/api/public/status`)
- ✅ Featured Products (`/api/featured-products`)
- ✅ Items API (`/api/items`)
- ✅ Tenants API (`/api/tenants`)

### Shops Featured Service
- ✅ Random Products (`/api/shops/featured/random`)
- ✅ Trending Products (`/api/shops/featured/trending`)
- ✅ New Products (`/api/shops/featured/new`)
- ✅ Sale Products (`/api/shops/featured/sale`)
- ✅ Seasonal Products (`/api/shops/featured/seasonal`)
- ✅ Staff Pick Products (`/api/shops/featured/staff-pick`)
- ✅ Store Selection Products (`/api/shops/featured/store-selection`)
- ✅ Trending Shops (`/api/shops/trending`)
- ✅ Shop-scoped Products (with tenant filtering)

### Capacity & Limits Services
- ✅ Tenant Limits Status (`/api/tenant-limits/status`)
- ✅ Tenant Limits Tiers (`/api/tenant-limits/tiers`)
- ✅ Subscription Usage (`/api/subscription-usage`)

### Authentication Services
- ✅ Auth Status (`/api/auth/status`)
- ✅ User Profile (`/api/user/profile` - expects 401)

### Directory Services
- ✅ Directory Search (`/api/directory/search`)
- ✅ Directory Categories (`/api/directory/categories`)

### Database Connectivity
- ✅ Database Health (`/api/health/database`)
- ✅ Prisma Connection (`/api/health/prisma`)

## Usage

### Prerequisites
1. API server must be running (default: `http://localhost:3001`)
2. Database must be accessible
3. Environment variables configured

### Running Tests

#### Option 1: Node.js Script (Recommended)
```bash
# Set custom API URL (optional)
export API_BASE_URL=http://localhost:3001

# Run tests
node test-backend-readiness.js
```

#### Option 2: Windows Batch Script
```bash
# Double-click or run from command line
test-backend-readiness.bat
```

### Configuration

#### Environment Variables
- `API_BASE_URL`: Base URL for API testing (default: `http://localhost:3001`)
- `TEST_TIMEOUT`: Timeout per test in milliseconds (default: `10000`)

#### Script Configuration
Edit the test scripts to modify:
- API endpoints being tested
- Expected HTTP status codes
- Timeout values
- Test data

## Results Interpretation

### Success Criteria
- ✅ **100% Pass Rate**: All services ready for development
- ⚠️ **80-99% Pass Rate**: Mostly ready, some fixes needed
- ❌ **<80% Pass Rate**: Significant fixes required

### Common Issues & Solutions

#### Connection Refused
```bash
# Check if API server is running
curl http://localhost:3001/api/health

# Start API server
npm start
```

#### Database Errors
```bash
# Check database connection
npx prisma db pull

# Reset database if needed
npx prisma db push --force-reset
```

#### Missing Routes
```bash
# Check route mounting
grep "shops" src/index.ts

# Verify route file exists
ls -la src/routes/shops.ts
```

## API Endpoints Reference

### Shops Featured Products
All endpoints support query parameters:
- `tenantId`: Filter by tenant
- `limit`: Number of results (default: 12)
- `shopScope`: 'global' or 'shop'

#### Product Buckets
- `GET /api/shops/featured/random` - Random product selection
- `GET /api/shops/featured/trending` - Trending products
- `GET /api/shops/featured/new` - New arrivals
- `GET /api/shops/featured/sale` - Sale items
- `GET /api/shops/featured/seasonal` - Seasonal products
- `GET /api/shops/featured/staff-pick` - Staff recommendations
- `GET /api/shops/featured/store-selection` - Store favorites

#### Shop Discovery
- `GET /api/shops/trending` - Trending shops
- `GET /api/shops/recently-viewed?userId=xxx` - User's recently viewed shops

#### Health Check
- `GET /api/shops/health` - Service health status

## Development Workflow

### Before Building Shops Pages
1. Run the readiness test script
2. Ensure 100% pass rate
3. Fix any failing endpoints
4. Verify API responses match expected format

### During Development
1. Run tests after backend changes
2. Monitor for regressions
3. Update test expectations when API changes

### Before Deployment
1. Full test suite execution
2. Performance testing
3. Load testing for shops endpoints

## Troubleshooting

### Test Script Issues
- **Permission Denied**: `chmod +x test-backend-readiness.js`
- **Node.js Not Found**: Install Node.js from nodejs.org
- **Module Not Found**: Check Node.js installation and PATH

### API Issues
- **Routes Not Found**: Verify route mounting in `src/index.ts`
- **Database Errors**: Check Prisma configuration and connection
- **Authentication Errors**: Verify auth middleware configuration

### Performance Issues
- **Slow Responses**: Check database queries and caching
- **Timeout Errors**: Increase timeout values or optimize endpoints
- **Memory Issues**: Monitor memory usage during tests

## Contributing

### Adding New Tests
1. Add endpoint to test script
2. Update this README
3. Test with both scripts
4. Update expected responses

### Modifying Existing Tests
1. Update test expectations
2. Verify API contract changes
3. Update documentation
4. Run full test suite

## Support

For issues with:
- **Test Scripts**: Check script syntax and Node.js version
- **API Endpoints**: Check route files and server logs
- **Database**: Check Prisma configuration and connection
- **Environment**: Check environment variables and configuration

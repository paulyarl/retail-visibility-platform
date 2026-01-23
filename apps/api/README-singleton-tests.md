# API Singleton Batch Test Script

This comprehensive test script validates all API singleton contexts and their performance characteristics.

## Test Coverage

### 🌐 Public API Singleton
- Health check endpoint
- Public products endpoint
- Featured products with location
- Public categories
- Public stores

### 🔒 Private API Singleton
- Authentication endpoint availability
- Protected route access control
- Authorization requirements

### 📦 Product Singleton
- Product search functionality
- Individual product retrieval
- Product categories
- Product filtering

### 🏪 Store Singleton
- Store listing
- Store search
- Store by slug retrieval
- Store metadata

### 📂 Category Singleton
- Category listing
- Category tree structure
- Category by slug
- Category products

### ⚡ Performance Tests
- Concurrent request handling
- Cache effectiveness
- Response time analysis

## Usage

### Quick Start
```bash
# From the API directory
npm run test:singletons
```

### Custom Configuration
```bash
# Set custom API base URL
API_BASE_URL=http://localhost:4000 npm run test:singletons

# Or with environment variable
export API_BASE_URL=http://localhost:4000
npm run test:singletons
```

### Running Individual Test Suites
```bash
# Run specific test categories
node test-singletons.js --category=publicApi
node test-singletons.js --category=productSingleton
node test-singletons.js --category=performance
```

## Expected Results

### ✅ Success Indicators
- All endpoints return appropriate HTTP status codes
- Response times are reasonable (< 2000ms for most operations)
- Cache hits show performance improvements
- Concurrent requests are handled properly

### ⚠️ Warning Indicators
- Some endpoints fail but core functionality works
- Response times are slow but functional
- Cache effectiveness is minimal

### 🚨 Failure Indicators
- Core endpoints are unreachable
- Authentication/authorization is broken
- Performance is severely degraded
- Concurrent requests cause failures

## Test Output

The script provides detailed logging including:
- ✅ Success messages for passed tests
- ❌ Error messages for failed tests
- ⚠️ Warnings for edge cases
- 📊 Performance metrics and timing
- 📈 Success rates and statistics

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `http://localhost:4000` | Base URL for API endpoints |
| `TEST_TIMEOUT` | `30000` | Timeout per test in milliseconds |

## API Requirements

The test script expects the following API endpoints to be available:

### Public Endpoints
- `GET /health`
- `GET /api/public/products`
- `GET /api/public/products/featured`
- `GET /api/public/products/search`
- `GET /api/public/products/{id}`
- `GET /api/public/products/categories`
- `GET /api/public/categories`
- `GET /api/public/categories/tree`
- `GET /api/public/categories/{slug}`
- `GET /api/public/categories/{id}/products`
- `GET /api/public/stores`
- `GET /api/public/stores/search`
- `GET /api/public/stores/{slug}`

### Private Endpoints
- `POST /auth/login`
- `GET /api/tenants` (protected)

## Performance Benchmarks

### Expected Performance
- **Simple endpoints**: < 200ms
- **Search endpoints**: < 500ms
- **Complex queries**: < 1000ms
- **Cache improvement**: > 20% faster on second request
- **Concurrent handling**: 10 requests in < 2000ms

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure API server is running
   - Check API_BASE_URL environment variable
   - Verify port configuration

2. **Timeout Errors**
   - Increase TEST_TIMEOUT for slow systems
   - Check database connectivity
   - Verify API server performance

3. **Authentication Failures**
   - Expected behavior for protected endpoints
   - Tests verify auth is required, not that it works

4. **Missing Endpoints**
   - Verify API routes are properly configured
   - Check API server logs for routing issues

### Debug Mode
For detailed debugging, modify the script to add more logging or inspect individual test responses.

## Integration with CI/CD

This test script can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run API Singleton Tests
  run: |
    cd apps/api
    npm run test:singletons
  env:
    API_BASE_URL: http://localhost:4000
```

## Extending Tests

To add new test cases:

1. Create a new test function following the existing pattern
2. Add it to the appropriate test suite
3. Update the results tracking
4. Add documentation for new tests

Example:
```javascript
await runTest(category, 'New Test Case', async () => {
  const response = await fetch(`${API_BASE_URL}/api/new-endpoint`);
  return {
    success: response.ok,
    message: `New endpoint returned ${response.status}`,
    data: await response.json()
  };
});
```

# UniversalSingleton Test Suite

🚀 **Comprehensive testing for the UniversalSingleton architecture**

## 📋 Test Suite Overview

This test suite validates the complete UniversalSingleton architecture including:
- **Unit Tests**: Core singleton functionality
- **Integration Tests**: Real API endpoints with authentication
- **Performance Tests**: Load handling and response times
- **Stress Tests**: Breaking points and failure scenarios

## 🎯 Quick Start

### **Option 1: Quick Test (Recommended)**
```bash
# Run the interactive test runner
quick-test.bat
```

### **Option 2: Run All Tests**
```bash
# Run complete test suite
run-all-tests.bat
```

### **Option 3: Individual Test Types**
```bash
# Unit tests only
run-unit-tests.bat

# Integration tests with real data
run-integration-tests.bat

# Performance tests
run-performance-tests.bat

# Stress tests
run-stress-tests.bat
```

## 🔧 Test Data Configuration

The integration tests use real test data:

**Tenant**: `tid-m8ijkrnk`  
**User**: `platform@rvp.com`  
**Role**: `PLATFORMFORM_ADMIN`  
**Token**: JWT token with admin permissions

## 📊 Test Reports

After running tests, you'll find detailed reports in:

- **`reports/test-report.html`** - Interactive HTML report
- **`reports/test-report.json`** - Machine-readable JSON data
- **`logs/`** - Detailed log files for each test type
- **`logs/integration-test-summary.txt`** - Quick summary

## 🧪 Test Types Explained

### **Unit Tests**
- ✅ Singleton pattern validation
- ✅ Cache operations (get/set/clear)
- ✅ TTL behavior
- ✅ Metrics tracking
- ✅ Authentication context
- ✅ Encryption/decryption
- ✅ Private cache security

### **Integration Tests**
- 🔐 **Authentication Flow**: Token validation and role-based access
- 🛡️ **Security Monitoring**: Event recording and metrics
- ⚡ **Rate Limiting**: Rules and status checking
- 📊 **Behavior Tracking**: Event tracking and analytics
- 👥 **Tenant Profiles**: Profile management and analytics
- 🗄️ **Cache Performance**: Hit/miss ratio and response times
- 🔒 **Encryption Features**: Encrypted storage and retrieval
- 🚀 **Load Handling**: Concurrent request processing

### **Performance Tests**
- ⚡ Cache performance under load
- 🔄 Concurrent access handling
- 💾 Memory usage efficiency
- ⏱️ Response time validation
- 📈 Throughput measurement

### **Stress Tests**
- 🔥 High load scenarios
- 💥 Cache overflow handling
- 🧠 Memory pressure testing
- 🗄️ Database failure simulation
- 🌐 Network issue handling

## 📈 Success Criteria

### **Performance Benchmarks**
- **Response Time**: <50ms (99th percentile)
- **Cache Hit Ratio**: >95%
- **Throughput**: >10,000 requests/second
- **Memory Usage**: <1GB per service

### **Security Benchmarks**
- **Authentication**: 100% accuracy
- **Authorization**: Zero bypass attempts
- **Encryption**: No data leakage
- **Audit Trail**: Complete logging

### **Reliability Benchmarks**
- **Success Rate**: >99%
- **Error Rate**: <0.1%
- **Recovery Time**: <30 seconds

## 🎯 Launch Readiness

The test suite provides clear launch readiness assessment:

- ✅ **READY FOR PRODUCTION**: All tests pass, metrics meet requirements
- ⚠️ **NEEDS ATTENTION**: Some tests failed or metrics below thresholds
- ❌ **NOT READY**: Critical failures or major performance issues

## 🔧 Customization

### **Adding New Tests**
1. Add test methods to `test-runner.js`
2. Update corresponding batch script
3. Regenerate reports

### **Modifying Test Data**
Update the `TEST_DATA` object in `integration-test.js`:
```javascript
const TEST_DATA = {
    tenant: 'your-tenant-id',
    token: 'your-jwt-token',
    userId: 'your-user-id',
    email: 'your-email',
    role: 'your-role'
};
```

### **Adjusting Performance Thresholds**
Modify success criteria in `report-generator.js`:
```javascript
// Performance thresholds
if (responseTime > 50) throw new Error('Response too slow');
if (cacheHitRatio < 95) throw new Error('Cache hit ratio too low');
```

## 🚀 Running Tests in CI/CD

### **Automated Testing**
```bash
# Run tests in CI/CD pipeline
node test-runner.js --type=unit --output=logs/unit-ci.log
node test-runner.js --type=integration --output=logs/integration-ci.log
node test-runner.js --type=performance --output=logs/performance-ci.log
node report-generator.js --input=logs --output=reports/ci-report.html
```

### **Docker Testing**
```dockerfile
FROM node:18-alpine
COPY tests/ /app/tests/
WORKDIR /app/tests
RUN npm install
CMD ["node", "test-runner.js", "--type=all"]
```

## 📊 Troubleshooting

### **Common Issues**

**Tests failing with authentication errors:**
- Check JWT token validity
- Verify tenant ID matches
- Ensure user has required permissions

**Performance tests showing slow response times:**
- Check cache configuration
- Verify Redis connection
- Monitor system resources

**Integration tests failing:**
- Ensure API server is running
- Check network connectivity
- Verify endpoint URLs

### **Debug Mode**
Run tests with verbose logging:
```bash
DEBUG=true node test-runner.js --type=unit
```

## 🎊 Best Practices

1. **Run tests before each deployment**
2. **Monitor performance trends over time**
3. **Update test data regularly**
4. **Review failure logs immediately**
5. **Maintain >95% success rate**

## 🏆 Success Metrics

When all tests pass, you'll have:
- ✅ **Validated singleton architecture**
- ✅ **Confirmed performance under load**
- ✅ **Verified security features**
- ✅ **Proven scalability**
- ✅ **Launch confidence**

---

**🚀 Ready to test your UniversalSingleton architecture? Run `quick-test.bat` to get started!**

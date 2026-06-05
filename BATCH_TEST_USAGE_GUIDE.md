# Batch Test Usage Guide

**Automated testing for Phase 2 tenant access system with command-line parameters**

## 🚀 **Quick Start**

### **Option 1: Windows Batch Script (Simple)**
```batch
# Basic test
test-access.bat admin@example.com tenant-123

# Test specific scenario
test-access.bat admin@example.com tenant-123 platform-admin

# Test with custom password
test-access.bat user@example.com tenant-456 tenant-member mypassword
```

### **Option 2: PowerShell Script (Advanced)**
```powershell
# Basic test
.\test-access.ps1 -User "admin@example.com" -Tenant "tenant-123"

# Test specific scenario
.\test-access.ps1 -User "admin@example.com" -Tenant "tenant-123" -Scenario "platform-admin"

# Run critical tests only (fastest)
.\test-access.ps1 -User "admin@example.com" -Tenant "tenant-123" -Critical

# Generate JSON report
.\test-access.ps1 -User "admin@example.com" -Tenant "tenant-123" -Critical -JsonReport
```

### **Option 3: Node.js Direct (Cross-platform)**
```bash
# Basic test
node scripts/test-tenant-access.js --user=admin@example.com --tenant=tenant-123

# Test specific scenario
node scripts/test-tenant-access.js --user=admin@example.com --tenant=tenant-123 --scenario=platform-admin
```

---

## 📋 **Available Test Scenarios**

| Scenario | Description | Expected Access |
|----------|-------------|-----------------|
| `platform-admin` | Platform administrator | ✅ Full access to all tenants |
| `platform-support` | Platform support | ✅ Support access with bypasses |
| `platform-viewer` | Platform viewer | ✅ Read-only across platform |
| `tenant-owner` | Tenant owner | ✅ Full control of owned tenants |
| `tenant-admin` | Tenant admin | ✅ Support access but below Tenant Owner |
| `tenant-manager` | Tenant manager | ✅ Management operations |
| `tenant-member` | Tenant member | ✅ Edit only, no manage |
| `tenant-viewer` | Tenant viewer | ✅ View only |

---

## 🔥 **Critical Test Examples**

### **Pre-Deployment Validation (5 minutes)**
```batch
REM Test the 5 most critical access scenarios
test-access.bat admin@platform.com tenant-123 platform-admin
test-access.bat support@platform.com tenant-123 platform-support  
test-access.bat owner@tenant.com tenant-123 tenant-owner
test-access.bat member@tenant.com tenant-123 tenant-member
test-access.bat viewer@platform.com tenant-123 platform-viewer
```

### **PowerShell Critical Test (Automated)**
```powershell
# Run all critical tests in one command
.\test-access.ps1 -User "admin@example.com" -Tenant "tenant-123" -Critical
```

### **Continuous Integration**
```bash
# In CI/CD pipeline
node scripts/test-tenant-access.js --user=$CI_TEST_USER --tenant=$CI_TEST_TENANT --scenario=platform-admin
if [ $? -ne 0 ]; then
  echo "❌ Critical access test failed - blocking deployment"
  exit 1
fi
```

---

## 🛠️ **Advanced Usage**

### **Custom Environment**
```batch
REM Set custom URLs
set TEST_BASE_URL=https://staging.example.com
set API_BASE_URL=https://api-staging.example.com
test-access.bat admin@example.com tenant-123
```

```powershell
# PowerShell with custom URLs
.\test-access.ps1 -User "admin@example.com" -Tenant "tenant-123" -BaseUrl "https://staging.example.com" -ApiUrl "https://api-staging.example.com"
```

### **Batch Testing Multiple Scenarios**
```batch
REM Create a batch test script
@echo off
echo Testing all user roles...

call test-access.bat admin@platform.com tenant-123 platform-admin
if errorlevel 1 goto :failed

call test-access.bat owner@tenant.com tenant-123 tenant-owner  
if errorlevel 1 goto :failed

call test-access.bat member@tenant.com tenant-123 tenant-member
if errorlevel 1 goto :failed

echo ✅ All tests passed!
goto :end

:failed
echo ❌ Tests failed - check output above
exit /b 1

:end
```

### **PowerShell Automated Testing**
```powershell
# Test multiple users and tenants
$testCases = @(
    @{ User = "admin@platform.com"; Tenant = "tenant-123"; Scenario = "platform-admin" },
    @{ User = "owner@tenant.com"; Tenant = "tenant-123"; Scenario = "tenant-owner" },
    @{ User = "member@tenant.com"; Tenant = "tenant-456"; Scenario = "tenant-member" }
)

foreach ($test in $testCases) {
    Write-Host "Testing: $($test.User) on $($test.Tenant)" -ForegroundColor Cyan
    .\test-access.ps1 -User $test.User -Tenant $test.Tenant -Scenario $test.Scenario
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Test failed for $($test.User)" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ All tests passed!" -ForegroundColor Green
```

---

## 📊 **Output Examples**

### **Successful Test Output**
```
================================================================
                 TENANT ACCESS TEST RUNNER
================================================================

🔧 TEST CONFIGURATION:
   User: admin@example.com
   Tenant: tenant-123
   Scenario: platform-admin

🔐 Testing authentication...
✅ Authentication successful

👤 Testing user profile...
✅ User profile retrieved
   Platform Role: PLATFORM_ADMIN
   User ID: user-456
   Email: admin@example.com

🏢 Testing tenant access for: tenant-123
✅ Tier data retrieved
   Effective Tier: Professional
✅ User role retrieved
   Tenant Role: None
✅ Usage data retrieved

🧪 Validating access for scenario: Platform Admin
✅ platformAccess: Expected true, Got true
✅ tenantAccess: Expected true, Got true
✅ tierBypass: Expected true, Got true
✅ roleBypass: Expected true, Got true
✅ canView: Expected true, Got true
✅ canEdit: Expected true, Got true
✅ canManage: Expected true, Got true
✅ canAdmin: Expected true, Got true

📊 TEST REPORT
==================================================

🧪 Platform Admin: ✅ PASS
   Passed: 8
   Failed: 0

📈 SUMMARY
Total Checks: 8
Passed: 8
Failed: 0
Success Rate: 100%

🎉 ALL TESTS PASSED - Ready for deployment!
```

### **Failed Test Output**
```
🧪 Validating access for scenario: Tenant Member
✅ platformAccess: Expected false, Got false
✅ tenantAccess: Expected true, Got true
✅ tierBypass: Expected false, Got false
✅ roleBypass: Expected false, Got false
✅ canView: Expected true, Got true
✅ canEdit: Expected true, Got true
❌ canManage: Expected false, Got true
❌ canAdmin: Expected false, Got true

📊 TEST REPORT
==================================================

🧪 Tenant Member: ❌ FAIL
   Passed: 6
   Failed: 2
   Issues:
     ❌ canManage: Expected false, Got true
     ❌ canAdmin: Expected false, Got true

📈 SUMMARY
Total Checks: 8
Passed: 6
Failed: 2
Success Rate: 75%

🚨 TESTS FAILED - Do not deploy!
```

---

## 🚨 **Error Handling**

### **Common Issues & Solutions**

#### **Authentication Failed**
```
❌ Authentication failed: 401
```
**Solution:** Check user credentials, ensure user exists in system

#### **Tenant Not Found**
```
❌ Tier data failed: 404
```
**Solution:** Verify tenant ID exists, check user has access to tenant

#### **Server Not Running**
```
❌ Request error: ECONNREFUSED
```
**Solution:** Start development servers (`npm run dev`)

#### **Node.js Not Found**
```
❌ ERROR: Node.js is not installed or not in PATH
```
**Solution:** Install Node.js from https://nodejs.org/

---

## 🔧 **Configuration Options**

### **Environment Variables**
```batch
REM Set custom configuration
set TEST_BASE_URL=http://localhost:3000
set API_BASE_URL=http://localhost:3001
set TEST_TIMEOUT=30000
```

### **PowerShell Parameters**
```powershell
.\test-access.ps1 `
  -User "admin@example.com" `
  -Tenant "tenant-123" `
  -Scenario "platform-admin" `
  -Password "custompassword" `
  -BaseUrl "https://staging.example.com" `
  -ApiUrl "https://api-staging.example.com" `
  -Verbose `
  -JsonReport `
  -OutputFile "custom-report.json"
```

### **Node.js Options**
```bash
node scripts/test-tenant-access.js \
  --user=admin@example.com \
  --tenant=tenant-123 \
  --scenario=platform-admin \
  --password=custompassword
```

---

## 📈 **Integration Examples**

### **GitHub Actions**
```yaml
name: Access Control Tests
on: [push, pull_request]

jobs:
  test-access:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Start servers
        run: |
          npm run dev &
          sleep 30
      
      - name: Test critical access
        run: |
          .\test-access.ps1 -User "${{ secrets.TEST_USER }}" -Tenant "${{ secrets.TEST_TENANT }}" -Critical
```

### **Jenkins Pipeline**
```groovy
pipeline {
    agent any
    stages {
        stage('Access Tests') {
            steps {
                bat '''
                    test-access.bat %TEST_USER% %TEST_TENANT% platform-admin
                    if errorlevel 1 exit /b 1
                '''
            }
        }
    }
}
```

### **Azure DevOps**
```yaml
steps:
- task: PowerShell@2
  displayName: 'Run Access Tests'
  inputs:
    targetType: 'inline'
    script: |
      .\test-access.ps1 -User "$(TEST_USER)" -Tenant "$(TEST_TENANT)" -Critical
      if ($LASTEXITCODE -ne 0) { exit 1 }
```

---

## 🎯 **Best Practices**

### **Pre-Deployment Checklist**
1. **Run critical tests:** `.\test-access.ps1 -Critical`
2. **Test platform admin:** Ensure full access
3. **Test tenant restrictions:** Verify proper limitations
4. **Check error handling:** Test with invalid data
5. **Validate performance:** Ensure <3 second response times

### **Development Workflow**
1. **Make access control changes**
2. **Run affected scenario tests**
3. **Run full critical test suite**
4. **Only deploy if all tests pass**

### **Monitoring & Alerts**
```batch
REM Schedule regular access validation
schtasks /create /tn "AccessValidation" /tr "C:\path\to\test-access.bat admin@example.com tenant-123 platform-admin" /sc hourly
```

---

## 📞 **Support & Troubleshooting**

### **Getting Help**
```batch
REM Show usage information
test-access.bat

REM PowerShell help
Get-Help .\test-access.ps1 -Full

REM Node.js help
node scripts/test-tenant-access.js --help
```

### **Debug Mode**
```powershell
# Enable verbose output
.\test-access.ps1 -User "admin@example.com" -Tenant "tenant-123" -Verbose

# Check server connectivity
Test-NetConnection localhost -Port 3000
Test-NetConnection localhost -Port 3001
```

### **Log Files**
- Test results: `test-results.json` (if using `-JsonReport`)
- Server logs: Check console output from `npm run dev`
- Browser logs: Check browser developer tools console

---

**Use these batch scripts to ensure no critical access is broken before deploying Phase 2!** 🛡️

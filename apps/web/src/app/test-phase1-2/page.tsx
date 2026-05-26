/**
 * Test Page for Phases 1-2: Core Infrastructure & Basic Shop Management
 * Tests foundational functionality
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { tenantLimitsService } from '@/services/TenantLimitsSingletonService';
import { tenantManagementService } from '@/services/TenantManagementService';
import { tenantInfoService } from '@/services/TenantInfoService';

export default function TestPhase1_2() {
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Test Phase 1: Core Infrastructure
  const testPhase1 = async () => {
    const results: Record<string, any> = {};

    try {
      // Test 1: Database Connection
      console.log('Testing Database Connection...');
      const dbTest = await tenantManagementService.getAllTenants();
      results.database = {
        success: dbTest !== null,
        tenantCount: Array.isArray(dbTest) ? dbTest.length : 0
      };

      // Test 2: Authentication Status
      console.log('Testing Authentication...');
      const authTest = await tenantInfoService.getCurrentUser().catch(() => null);
      results.authentication = {
        success: authTest !== null,
        authenticated: authTest !== null
      };

      // Test 3: Tenant Limits
      console.log('Testing Tenant Limits...');
      const limitsTest = await tenantLimitsService.getTenantLimitsStatus();
      results.tenantLimits = {
        success: !!limitsTest,
        hasLimits: !!limitsTest?.canCreate
      };

      // Test 4: Basic API Health
      // console.log('Testing API Health...');
      // const healthTests = await Promise.allSettled([
      //   tenantLimitsService.makePublicRequest('/api/categories'),
      //   tenantLimitsService.makePublicRequest('/api/dashboard'),
      //   tenantLimitsService.makePublicRequest('/api/items')
      // ]);
      // results.apiHealth = {
      //   success: healthTests.every(t => t.status === 'fulfilled'),
      //   endpointsWorking: healthTests.filter(t => t.status === 'fulfilled').length
      // };

    } catch (error: unknown) {
      console.error('Phase 1 test error:', error);
      results.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return results;
  };

  // Test Phase 2: Basic Shop Management
  const testPhase2 = async () => {
    const results: Record<string, any> = {};

    try {
      // Test 1: Shop Directory
      // console.log('Testing Shop Directory...');
      // const directoryTest = await tenantInfoService.getShopDirectory().catch(() => null);
      // results.shopDirectory = {
      //   success: directoryTest !== null,
      //   storeCount: Array.isArray(directoryTest) ? directoryTest.length : 0
      // };

      // Test 2: Categories API
      // console.log('Testing Categories API...');
      // const categoriesTest = await tenantInfoService.getCategories().catch(() => null);
      // results.categories = {
      //   success: categoriesTest !== null,
      //   categoryCount: Array.isArray(categoriesTest) ? categoriesTest.length : 0
      // };

      // Test 3: Items API
      // console.log('Testing Items API...');
      // const itemsTest = await tenantInfoService.getItems().catch(() => null);
      // results.items = {
      //   success: itemsTest !== null,
      //   itemCount: Array.isArray(itemsTest) ? itemsTest.length : 0
      // };

      // Test 4: Dashboard API
      // console.log('Testing Dashboard API...');
      // const dashboardTest = await tenantInfoService.getDashboardData().catch(() => null);
      // results.dashboard = {
      //   success: dashboardTest !== null,
      //   hasData: !!dashboardTest
      // };

    } catch (error: unknown) {
      console.error('Phase 2 test error:', error);
      results.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return results;
  };

  // Run all tests
  const runAllTests = async () => {
    setLoading(true);
    const results: Record<string, any> = {};

    try {
      const [phase1Results, phase2Results] = await Promise.all([
        testPhase1(),
        testPhase2()
      ]);

      results.phase1 = phase1Results;
      results.phase2 = phase2Results;
      results.overall = {
        phase1Success: !phase1Results.error && Object.values(phase1Results).every((r: any) => r?.success !== false),
        phase2Success: !phase2Results.error && Object.values(phase2Results).every((r: any) => r?.success !== false),
        totalTests: Object.keys(phase1Results).length + Object.keys(phase2Results).length
      };

    } catch (error: unknown) {
      console.error('Test error:', error);
      results.error = error instanceof Error ? error.message : 'Unknown error';
      results.overall = {
        phase1Success: false,
        phase2Success: false,
        totalTests: 0
      };
    }

    setTestResults(results);
    setLoading(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Phase 1-2 Integration Test</h1>
        <p className="text-muted-foreground">
          Test core infrastructure and basic shop management
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runAllTests} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Running Tests...' : 'Run Phase 1-2 Tests'}
          </Button>
        </CardContent>
      </Card>

      {testResults.overall && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Overall Results
              <Badge variant={testResults.overall.phase1Success && testResults.overall.phase2Success ? 'default' : 'error'}>
                {testResults.overall.phase1Success && testResults.overall.phase2Success ? 'ALL PASS' : 'SOME FAIL'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold">Phase 1: Core Infrastructure</h3>
                <Badge variant={testResults.phase1?.success ? 'default' : 'error'}>
                  {testResults.overall.phase1Success ? '✅ PASS' : '❌ FAIL'}
                </Badge>
              </div>
              <div>
                <h3 className="font-semibold">Phase 2: Shop Management</h3>
                <Badge variant={testResults.phase2?.success ? 'default' : 'error'}>
                  {testResults.overall.phase2Success ? '✅ PASS' : '❌ FAIL'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {testResults.phase1 && (
        <Card>
          <CardHeader>
            <CardTitle>Phase 1: Core Infrastructure Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(testResults.phase1).map(([testName, result]: [string, any]) => (
                <div key={testName} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <h4 className="font-semibold capitalize">{testName.replace(/([A-Z])/g, ' $1').trim()}</h4>
                    {result.success !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        Status: {result.success ? 'Working' : 'Failed'}
                      </p>
                    )}
                  </div>
                  <Badge variant={result.success ? 'default' : 'error'}>
                    {result.success ? '✅' : '❌'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {testResults.phase2 && (
        <Card>
          <CardHeader>
            <CardTitle>Phase 2: Shop Management Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(testResults.phase2).map(([testName, result]: [string, any]) => (
                <div key={testName} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <h4 className="font-semibold capitalize">{testName.replace(/([A-Z])/g, ' $1').trim()}</h4>
                    {result.success !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        Status: {result.success ? 'Working' : 'Failed'}
                      </p>
                    )}
                    {result.storeCount !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        Stores: {result.storeCount}
                      </p>
                    )}
                    {result.categoryCount !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        Categories: {result.categoryCount}
                      </p>
                    )}
                    {result.itemCount !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        Items: {result.itemCount}
                      </p>
                    )}
                  </div>
                  <Badge variant={result.success ? 'default' : 'error'}>
                    {result.success ? '✅' : '❌'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Manual Test Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Phase 1: Core Infrastructure</h3>
              <div className="space-y-1">
                <a href="/auth/login" className="text-blue-600 hover:underline block">→ Login Page</a>
                <a href="/auth/signup" className="text-blue-600 hover:underline block">→ Register Page</a>
                <a href="/tenants" className="text-blue-600 hover:underline block">→ Tenants List</a>
                <a href="/t/demo-tenant" className="text-blue-600 hover:underline block">→ Demo Tenant</a>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Phase 2: Shop Management</h3>
              <div className="space-y-1">
                <a href="/directory" className="text-blue-600 hover:underline block">→ Directory</a>
                <a href="/shops" className="text-blue-600 hover:underline block">→ Shops</a>
                <a href="/shops/directory" className="text-blue-600 hover:underline block">→ Shop Directory</a>
                <a href="/t/demo-tenant/dashboard" className="text-blue-600 hover:underline block">→ Dashboard</a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Console Test Commands</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-1">Test Database Connection:</h3>
              <code className="text-sm bg-gray-100 p-2 rounded block">
                {`fetch('/api/tenants').then(r => r.json()).then(console.log)`}
              </code>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Test Authentication:</h3>
              <code className="text-sm bg-gray-100 p-2 rounded block">
                {`fetch('/api/user/profile').then(r => r.json()).then(console.log)`}
              </code>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Test Shop Directory:</h3>
              <code className="text-sm bg-gray-100 p-2 rounded block">
                {`fetch('/api/directory/stores').then(r => r.json()).then(console.log)`}
              </code>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Test Categories:</h3>
              <code className="text-sm bg-gray-100 p-2 rounded block">
                {`fetch('/api/categories').then(r => r.json()).then(console.log)`}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Database Schema Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Required Commands:</h3>
              <div className="space-y-2">
                <code className="text-sm bg-gray-100 p-2 rounded block">
                  npx prisma generate
                </code>
                <code className="text-sm bg-gray-100 p-2 rounded block">
                  npx prisma db pull
                </code>
                <code className="text-sm bg-gray-100 p-2 rounded block">
                  npx prisma studio
                </code>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What to Check:</h3>
              <ul className="text-sm space-y-1">
                <li>✅ Database connection works</li>
                <li>✅ All tables exist</li>
                <li>✅ Prisma client generates</li>
                <li>✅ Sample data loads</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

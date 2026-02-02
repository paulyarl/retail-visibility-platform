/**
 * Test Page for Shop Discovery Components
 * Tests all Phase 3-6 functionality
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';

// Import services to test
import { cartService } from '@/services/cart/PlatformCartService';
import { shopTierMiddleware } from '@/services/tiers/ShopTierMiddleware';
import { featuredShopManager } from '@/services/featured/FeaturedShopManager';
import { shopBrandingService } from '@/services/branding/ShopBrandingService';
import { publishingWorkflow } from '@/services/publishing/ShopPublishingWorkflow';
import { useShopProducts } from '@/types/products';

export default function TestPage() {
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  // Test all services
  const runTests = async () => {
    setLoading(true);
    const results: Record<string, any> = {};

    try {
      // Test 1: Platform Cart Service
      console.log('Testing Platform Cart Service...');
      await cartService.addToCart('test-shop-1', 'test-product-1', 2);
      const cart = await cartService.getPlatformCart();
      results.cartService = {
        success: true,
        totalItems: cart.totalItems,
        totalPrice: cart.totalPrice
      };

      // Test 2: Shop Tier Middleware
      console.log('Testing Shop Tier Middleware...');
      const tier = await shopTierMiddleware.getShopTier('test-shop-1');
      const hasFeature = await shopTierMiddleware.validateShopFeature('test-shop-1', 'analytics');
      results.tierMiddleware = {
        success: true,
        tier,
        hasAnalyticsFeature: hasFeature
      };

      // Test 3: Featured Shop Manager
      console.log('Testing Featured Shop Manager...');
      const featuredShops = await featuredShopManager.getFeaturedShops('trending', 5);
      const featuredStats = await featuredShopManager.getFeaturedStats();
      results.featuredManager = {
        success: true,
        featuredCount: featuredShops.length,
        totalFeatured: featuredStats.totalFeatured
      };

      // Test 4: Shop Branding Service
      console.log('Testing Shop Branding Service...');
      const branding = await shopBrandingService.getShopBranding('test-shop-1');
      const presets = await shopBrandingService.getAvailablePresets();
      results.brandingService = {
        success: true,
        hasBranding: !!branding,
        presetCount: presets.length
      };

      // Test 5: Publishing Workflow
      console.log('Testing Publishing Workflow...');
      const review = await publishingWorkflow.reviewShopInformation('test-shop-1');
      const compliance = await publishingWorkflow.checkShopCompliance('test-shop-1');
      results.publishingWorkflow = {
        success: true,
        reviewPassed: review.passed,
        compliancePassed: compliance.compliant,
        reviewScore: review.score
      };

      // Test 6: Product Types
      console.log('Testing Product Types...');
      const { products, loading: productsLoading } = useShopProducts('test-shop-1');
      results.productTypes = {
        success: true,
        productCount: products.length,
        loading: productsLoading
      };

    } catch (error: unknown) {
      console.error('Test error:', error);
      if (error instanceof Error) {
        results.error = { message: error.message };
      } else {
        results.error = { message: 'Unknown error' };
      }
    }

    setTestResults(results);
    setLoading(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Phase 3-6 Integration Test</h1>
        <p className="text-muted-foreground">
          Test all shop management and discovery features
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runTests} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Running Tests...' : 'Run All Tests'}
          </Button>
        </CardContent>
      </Card>

      {Object.keys(testResults).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(testResults).map(([testName, result]) => (
            <Card key={testName}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {testName.replace(/([A-Z])/g, ' $1').trim()}
                  <Badge variant={result.success ? 'default' : 'error'}>
                    {result.success ? 'PASS' : 'FAIL'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.success ? (
                    <>
                      <p><strong>Status:</strong> ✅ Working</p>
                      {result.totalItems !== undefined && (
                        <p><strong>Cart Items:</strong> {result.totalItems}</p>
                      )}
                      {result.tier && (
                        <p><strong>Tier:</strong> {result.tier}</p>
                      )}
                      {result.featuredCount !== undefined && (
                        <p><strong>Featured Shops:</strong> {result.featuredCount}</p>
                      )}
                      {result.hasBranding !== undefined && (
                        <p><strong>Branding:</strong> {result.hasBranding ? '✅' : '❌'}</p>
                      )}
                      {result.reviewPassed !== undefined && (
                        <p><strong>Review Passed:</strong> {result.reviewPassed ? '✅' : '❌'}</p>
                      )}
                      {result.productCount !== undefined && (
                        <p><strong>Products:</strong> {result.productCount}</p>
                      )}
                    </>
                  ) : (
                    <p><strong>Error:</strong> {result.error || 'Unknown error'}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Manual Test Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Phase 3: Shop Management</h3>
              <a href="/t/demo-tenant/dashboard/shops/manage" className="text-blue-600 hover:underline">
                → Shop Management Dashboard
              </a>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Phase 4: Shop Directory</h3>
              <a href="/shops/directory" className="text-blue-600 hover:underline">
                → Shop Directory
              </a>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Phase 5: Discovery</h3>
              <a href="/shops/directory" className="text-blue-600 hover:underline">
                → Shop Discovery Components
              </a>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Phase 6: Advanced</h3>
              <a href="/test-advanced-features" className="text-blue-600 hover:underline">
                → Advanced Features Test
              </a>
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
              <h3 className="font-semibold mb-1">Test Cart Service:</h3>
              <code className="text-sm bg-gray-100 p-2 rounded block">
                cartService.addToCart('shop-1', 'product-1', 2)
              </code>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Test Tier Middleware:</h3>
              <code className="text-sm bg-gray-100 p-2 rounded block">
                shopTierMiddleware.validateShopFeature('shop-1', 'analytics')
              </code>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Test Featured Shops:</h3>
              <code className="text-sm bg-gray-100 p-2 rounded block">
                featuredShopManager.getFeaturedShops('trending')
              </code>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Test Branding:</h3>
              <code className="text-sm bg-gray-100 p-2 rounded block">
                shopBrandingService.getShopBranding('shop-1')
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

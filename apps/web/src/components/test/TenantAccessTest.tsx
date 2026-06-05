/**
 * Tenant Access Test Component
 * 
 * Test component to validate the new Phase 2 architecture.
 * This will be removed after validation is complete.
 */

'use client';

import React from 'react';
import { useTenantAccess } from '@/hooks/tenant-access';

interface TenantAccessTestProps {
  tenantId: string;
}

export function TenantAccessTest({ tenantId }: TenantAccessTestProps) {
  const {
    loading,
    error,
    tier,
    userRole,
    platformRole,
    canBypassTier,
    canBypassRole,
    hasFeature,
    canAccess,
    getFeatureBadge,
    usage,
    isLimitReached
  } = useTenantAccess(tenantId);

  // Enhanced role analysis
  const getRoleAnalysis = () => {
    const isPlatformUser = ['PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_VIEWER'].includes(platformRole || '');
    const isTenantUser = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'].includes(userRole || '');
    
    return {
      isPlatformUser,
      isTenantUser,
      hasFullPlatformAccess: platformRole === 'PLATFORM_ADMIN',
      hasLimitedPlatformAccess: platformRole === 'PLATFORM_SUPPORT',
      hasReadOnlyPlatformAccess: platformRole === 'PLATFORM_VIEWER',
      hasTenantOwnership: userRole === 'OWNER',
      hasTenantAdmin: userRole === 'ADMIN',
      hasTenantOperations: ['OWNER', 'ADMIN', 'MANAGER'].includes(userRole || ''),
      hasTenantEdit: ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'].includes(userRole || ''),
      hasTenantView: ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'].includes(userRole || ''),
    };
  };

  const roleAnalysis = getRoleAnalysis();

  if (loading) {
    return (
      <div className="p-4 border rounded-lg bg-blue-50">
        <h3 className="font-semibold text-blue-900">Loading Tenant Access...</h3>
        <p className="text-blue-700">Testing new Phase 2 architecture</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg bg-red-50">
        <h3 className="font-semibold text-red-900">Error Loading Access</h3>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-green-50">
      <h3 className="font-semibold text-green-900 mb-4">✅ Phase 2 Architecture Test</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        {/* Role & Scope Analysis */}
        <div className="space-y-2">
          <h4 className="font-medium text-green-800">🔐 Role & Scope Analysis</h4>
          <div className="space-y-1 text-green-700">
            <p><strong>Platform Role:</strong> {platformRole || 'None'}</p>
            <p><strong>Tenant Role:</strong> {userRole || 'None'}</p>
            <p><strong>Platform Access:</strong> {roleAnalysis.isPlatformUser ? '✅ Yes' : '❌ No'}</p>
            <p><strong>Tenant Access:</strong> {roleAnalysis.isTenantUser ? '✅ Yes' : '❌ No'}</p>
            <p><strong>Tier Bypass:</strong> {canBypassTier ? '✅ Yes' : '❌ No'}</p>
            <p><strong>Role Bypass:</strong> {canBypassRole ? '✅ Yes' : '❌ No'}</p>
          </div>
        </div>

        {/* Tier Information */}
        <div className="space-y-2">
          <h4 className="font-medium text-green-800">🏢 Tier Context</h4>
          <div className="space-y-1 text-green-700">
            <p><strong>Effective Tier:</strong> {tier?.effective.name || 'Unknown'}</p>
            <p><strong>Is Chain:</strong> {tier?.isChain ? 'Yes' : 'No'}</p>
            {tier?.organization && (
              <p><strong>Organization:</strong> {tier.organization.name}</p>
            )}
          </div>
        </div>

        {/* Permission Matrix */}
        <div className="space-y-2">
          <h4 className="font-medium text-green-800">📋 Permission Matrix</h4>
          <div className="space-y-1 text-green-700">
            <p><strong>Can View:</strong> {roleAnalysis.hasTenantView ? '✅' : '❌'}</p>
            <p><strong>Can Edit:</strong> {roleAnalysis.hasTenantEdit ? '✅' : '❌'}</p>
            <p><strong>Can Manage:</strong> {roleAnalysis.hasTenantOperations ? '✅' : '❌'}</p>
            <p><strong>Can Admin:</strong> {roleAnalysis.hasTenantAdmin || roleAnalysis.hasTenantOwnership ? '✅' : '❌'}</p>
            <p><strong>Full Platform:</strong> {roleAnalysis.hasFullPlatformAccess ? '✅' : '❌'}</p>
            <p><strong>Read Platform:</strong> {roleAnalysis.hasReadOnlyPlatformAccess ? '✅' : '❌'}</p>
          </div>
        </div>

        {/* Feature Access Tests */}
        <div className="space-y-2">
          <h4 className="font-medium text-green-800">Feature Access</h4>
          <div className="space-y-1 text-green-700">
            <p><strong>Has Barcode Scan:</strong> {hasFeature('barcode_scan') ? '✅' : '❌'}</p>
            <p><strong>Can Edit Barcode:</strong> {canAccess('barcode_scan', 'canEdit') ? '✅' : '❌'}</p>
            <p><strong>Has Quick Start:</strong> {hasFeature('quick_start_wizard') ? '✅' : '❌'}</p>
            <p><strong>Can Manage Quick Start:</strong> {canAccess('quick_start_wizard', 'canManage') ? '✅' : '❌'}</p>
            <p><strong>Has Propagation:</strong> {hasFeature('propagation_products') ? '✅' : '❌'}</p>
          </div>
        </div>

        {/* Usage Information */}
        <div className="space-y-2">
          <h4 className="font-medium text-green-800">Usage Limits</h4>
          <div className="space-y-1 text-green-700">
            {usage && (
              <>
                <p><strong>Products:</strong> {usage.products.current}/{usage.products.limit || '∞'} ({usage.products.percent}%)</p>
                <p><strong>Products Limit Reached:</strong> {isLimitReached('products') ? '❌' : '✅'}</p>
                <p><strong>Locations:</strong> {usage.locations.current}/{usage.locations.limit || '∞'}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Feature Badges Test */}
      <div className="mt-4 space-y-2">
        <h4 className="font-medium text-green-800">Feature Badges</h4>
        <div className="flex flex-wrap gap-2">
          {['barcode_scan', 'quick_start_wizard', 'propagation_products', 'storefront'].map(feature => {
            const badge = getFeatureBadge(feature, 'canEdit', `use ${feature}`);
            return badge ? (
              <span
                key={feature}
                className={`px-2 py-1 text-xs text-white rounded ${badge.colorClass}`}
                title={badge.tooltip}
              >
                {badge.text}
              </span>
            ) : (
              <span
                key={feature}
                className="px-2 py-1 text-xs bg-green-600 text-white rounded"
                title={`Access granted to ${feature}`}
              >
                ✅ {feature}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-4 text-xs text-green-600">
        <p>🎉 New Phase 2 architecture is working! Hooks are focused and composable.</p>
        <p>📊 Performance: Single component, multiple focused hooks, clean separation of concerns.</p>
      </div>
    </div>
  );
}

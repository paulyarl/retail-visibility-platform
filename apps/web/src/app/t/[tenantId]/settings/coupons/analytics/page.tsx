import React from 'react';
import CouponAnalyticsClient from './CouponAnalyticsClient';

export default async function CouponAnalyticsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return <CouponAnalyticsClient tenantId={tenantId} />;
}

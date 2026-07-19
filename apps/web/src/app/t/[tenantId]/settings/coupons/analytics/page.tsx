import React from 'react';
import CouponAnalyticsClient from './CouponAnalyticsClient';

export default function CouponAnalyticsPage({ params }: { params: { tenantId: string } }) {
  return <CouponAnalyticsClient tenantId={params.tenantId} />;
}

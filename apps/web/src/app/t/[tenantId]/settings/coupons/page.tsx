import CouponManagementClient from './CouponManagementClient';

export default async function CouponsPage({ params }: { params: { tenantId: string } }) {
  return <CouponManagementClient tenantId={params.tenantId} />;
}

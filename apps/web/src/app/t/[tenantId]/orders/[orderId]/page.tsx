import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import OrderDetailClient from './OrderDetailClient';

export const metadata: Metadata = {
  title: 'Order Details - Order Management',
  description: 'View and manage order details',
};

interface PageProps {
  params: Promise<{ tenantId: string; orderId: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { tenantId, orderId } = await params;

  if (!tenantId || !orderId) {
    redirect('/');
  }

  return <OrderDetailClient tenantId={tenantId} orderId={orderId} />;
}

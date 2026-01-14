import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import OrdersClient from './OrdersClient';

export const metadata: Metadata = {
  title: 'Orders - Order Management',
  description: 'Manage your store orders',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function OrdersPage({ params, searchParams }: PageProps) {
  const { tenantId } = await params;
  const resolvedSearchParams = await searchParams;

  if (!tenantId) {
    redirect('/');
  }

  return <OrdersClient tenantId={tenantId} searchParams={resolvedSearchParams} />;
}

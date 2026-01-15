/**
 * Customer Order Details Page
 * Shows order information and digital download links
 */

import { Metadata } from 'next';
import OrderDetailsClient from '@/components/orders/OrderDetailsClient';

export const metadata: Metadata = {
  title: 'Order Details',
  description: 'View your order details and download digital products',
};

interface PageProps {
  params: {
    orderId: string;
  };
}

export default function OrderDetailsPage({ params }: PageProps) {
  return <OrderDetailsClient orderId={params.orderId} />;
}

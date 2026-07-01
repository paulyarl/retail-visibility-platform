'use client';

import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  Download,
  Calendar,
  CalendarCheck,
  Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ProductType = 'physical' | 'digital' | 'service' | 'hybrid';

export interface FulfillmentStep {
  label: string;
  date: string | null;
  icon: LucideIcon;
  completed: boolean;
}

interface FulfillmentTimelineProps {
  productType: ProductType;
  orderStatus: string;
  createdAt: string;
  paidAt?: string | null;
  fulfilledAt?: string | null;
  digitalDeliveredAt?: string | null;
  trackingNumber?: string | null;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
}

function getStepsForType(
  productType: ProductType,
  orderStatus: string,
  createdAt: string,
  paidAt?: string | null,
  fulfilledAt?: string | null,
  digitalDeliveredAt?: string | null,
  appointmentDate?: string | null,
): FulfillmentStep[] {
  const isDelivered = orderStatus === 'delivered' || orderStatus === 'completed';
  const isCancelled = orderStatus === 'cancelled';

  if (isCancelled) {
    return [
      { label: 'Order Placed', date: createdAt, icon: CheckCircle, completed: true },
      { label: 'Cancelled', date: null, icon: Clock, completed: true },
    ];
  }

  switch (productType) {
    case 'digital':
      return [
        { label: 'Order Placed', date: createdAt, icon: CheckCircle, completed: true },
        { label: 'Payment Confirmed', date: paidAt || null, icon: Clock, completed: !!paidAt },
        { label: 'Access Granted', date: digitalDeliveredAt || fulfilledAt || null, icon: Download, completed: !!(digitalDeliveredAt || fulfilledAt) },
        { label: 'Downloaded', date: null, icon: Package, completed: isDelivered },
      ];

    case 'service':
      return [
        { label: 'Order Placed', date: createdAt, icon: CheckCircle, completed: true },
        { label: 'Payment Confirmed', date: paidAt || null, icon: Clock, completed: !!paidAt },
        { label: 'Service Scheduled', date: appointmentDate || null, icon: Calendar, completed: !!appointmentDate },
        { label: 'Service Completed', date: fulfilledAt || null, icon: CalendarCheck, completed: isDelivered || !!fulfilledAt },
      ];

    case 'hybrid': {
      const steps: FulfillmentStep[] = [
        { label: 'Order Placed', date: createdAt, icon: CheckCircle, completed: true },
        { label: 'Payment Confirmed', date: paidAt || null, icon: Clock, completed: !!paidAt },
        { label: 'Digital Access Granted', date: digitalDeliveredAt || null, icon: Download, completed: !!digitalDeliveredAt },
        { label: 'Physical Shipped', date: fulfilledAt || null, icon: Truck, completed: !!fulfilledAt },
        { label: 'Delivered', date: null, icon: Package, completed: isDelivered },
      ];
      return steps;
    }

    case 'physical':
    default:
      return [
        { label: 'Order Placed', date: createdAt, icon: CheckCircle, completed: true },
        { label: 'Processing', date: paidAt || null, icon: Clock, completed: !!paidAt },
        { label: 'Shipped', date: fulfilledAt || null, icon: Truck, completed: !!fulfilledAt },
        { label: 'Delivered', date: null, icon: Package, completed: isDelivered },
      ];
  }
}

export default function FulfillmentTimeline({
  productType,
  orderStatus,
  createdAt,
  paidAt,
  fulfilledAt,
  digitalDeliveredAt,
  trackingNumber,
  appointmentDate,
  appointmentTime,
}: FulfillmentTimelineProps) {
  const steps = getStepsForType(
    productType,
    orderStatus,
    createdAt,
    paidAt,
    fulfilledAt,
    digitalDeliveredAt,
    appointmentDate,
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center flex-1">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              step.completed
                ? 'bg-green-100 text-green-600'
                : 'bg-gray-100 text-gray-400'
            }`}>
              <step.icon className="w-6 h-6" />
            </div>
            <p className={`text-sm mt-2 ${step.completed ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              {step.label}
            </p>
            {step.date && formatDate(step.date) && (
              <p className="text-xs text-gray-500 mt-1">
                {formatDate(step.date)}
              </p>
            )}
          </div>
        ))}
      </div>
      {trackingNumber && productType !== 'digital' && productType !== 'service' && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Tracking Number: </span>
            {trackingNumber}
          </p>
        </div>
      )}
      {appointmentDate && productType === 'service' && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Appointment: </span>
            {new Date(appointmentDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            {appointmentTime && ` at ${appointmentTime}`}
          </p>
        </div>
      )}
    </div>
  );
}

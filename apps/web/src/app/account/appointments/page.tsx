'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { customerOrderService, ServiceBooking } from '@/services/CustomerOrderService';
import ServiceAppointmentCard from '@/components/orders/ServiceAppointmentCard';
import { Calendar, Loader2, ChevronLeft } from 'lucide-react';

export default function AppointmentsPage() {
  const { customer } = useCustomerAuth();
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (customer?.email) {
      loadBookings();
    }
  }, [customer?.email]);

  const loadBookings = async () => {
    if (!customer?.email) return;
    setIsLoading(true);
    try {
      const result = await customerOrderService.getCustomerServiceBookings(customer.email);
      const sorted = result.sort((a, b) => {
        if (!a.scheduled_date) return 1;
        if (!b.scheduled_date) return -1;
        return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
      });
      setBookings(sorted);
    } catch (error) {
      console.error('Failed to load service bookings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const upcoming = bookings.filter(b =>
    b.status !== 'cancelled' && b.status !== 'completed' &&
    (!b.scheduled_date || new Date(b.scheduled_date) >= new Date(new Date().toDateString()))
  );
  const past = bookings.filter(b =>
    b.status === 'completed' ||
    (b.scheduled_date && new Date(b.scheduled_date) < new Date(new Date().toDateString()))
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/account/orders" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ChevronLeft className="w-4 h-4" />
            Back to Orders
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-green-600" />
            Service Appointments
          </h1>
          <p className="text-sm text-gray-500 mt-1">View and manage your upcoming service appointments</p>
        </div>

        {bookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No service appointments found</p>
              <Link href="/account/orders">
                <Button variant="outline" className="mt-4">View Orders</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Upcoming</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {upcoming.map(booking => (
                    <ServiceAppointmentCard key={booking.id} booking={booking} showActions />
                  ))}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Past Appointments</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {past.map(booking => (
                    <ServiceAppointmentCard key={booking.id} booking={booking} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

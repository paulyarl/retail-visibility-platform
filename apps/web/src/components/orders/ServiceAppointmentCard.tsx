'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Calendar, Clock, MapPin, User, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { ServiceBooking } from '@/services/CustomerOrderService';

interface ServiceAppointmentCardProps {
  booking: ServiceBooking;
  showActions?: boolean;
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'pending':
      return { icon: AlertCircle, color: 'text-yellow-600 bg-yellow-50 border-yellow-200', label: 'Pending' };
    case 'confirmed':
      return { icon: CheckCircle, color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'Confirmed' };
    case 'in_progress':
      return { icon: Loader2, color: 'text-purple-600 bg-purple-50 border-purple-200', label: 'In Progress' };
    case 'completed':
      return { icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 border-emerald-200', label: 'Completed' };
    case 'cancelled':
      return { icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200', label: 'Cancelled' };
    default:
      return { icon: AlertCircle, color: 'text-gray-600 bg-gray-50 border-gray-200', label: status };
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Not yet scheduled';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  return timeStr;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours} hr`;
  return `${hours} hr ${remaining} min`;
}

export default function ServiceAppointmentCard({ booking, showActions = false }: ServiceAppointmentCardProps) {
  const statusConfig = getStatusConfig(booking.status);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-600" />
            Service Appointment
          </CardTitle>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.color}`}>
            <StatusIcon className="w-3 h-3" />
            {statusConfig.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-gray-500 text-xs">Date</p>
              <p className="font-medium text-gray-900">{formatDate(booking.scheduled_date)}</p>
            </div>
          </div>
          {booking.scheduled_time && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-gray-500 text-xs">Time</p>
                <p className="font-medium text-gray-900">{formatTime(booking.scheduled_time)}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-gray-500 text-xs">Duration</p>
              <p className="font-medium text-gray-900">{formatDuration(booking.duration_minutes)}</p>
            </div>
          </div>
          {booking.provider_name && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-gray-500 text-xs">Provider</p>
                <p className="font-medium text-gray-900">{booking.provider_name}</p>
              </div>
            </div>
          )}
          {booking.service_location && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-gray-500 text-xs">Location</p>
                <p className="font-medium text-gray-900">{booking.service_location}</p>
              </div>
            </div>
          )}
        </div>

        {booking.notes && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-gray-500 text-xs">Notes</p>
            <p className="text-sm text-gray-700">{booking.notes}</p>
          </div>
        )}

        {showActions && booking.status !== 'cancelled' && booking.status !== 'completed' && (
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              onClick={() => {/* Future: reschedule */}}
            >
              Reschedule
            </button>
            <span className="text-gray-300">|</span>
            <button
              className="text-sm text-red-600 hover:text-red-700 font-medium"
              onClick={() => {/* Future: cancel */}}
            >
              Cancel
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { getTodaySpecialHours } from '@/lib/hours-utils';
import { Clock } from 'lucide-react';

interface BusinessHoursDisplayProps {
  businessHours: any;
  className?: string;
}

export default function BusinessHoursDisplay({ businessHours, className = '' }: BusinessHoursDisplayProps) {
  if (!businessHours) return null;

  const formatTime = (time24: string): string => {
    if (!time24) return "";
    const [h, m] = time24.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const specialHours = getTodaySpecialHours(businessHours);
  const todayHours = specialHours.filter(sh => sh.label === 'today');
  const upcomingHours = specialHours.filter(sh => sh.label === 'upcoming');

  return (
    <div className={className}>
      <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
        <Clock className="w-4 h-4 text-gray-500" />
        Business Hours
      </h3>
      <div className="space-y-0">
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
          const dayHours = businessHours[day];
          const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;
          return (
            <div 
              key={day} 
              className={`flex items-start justify-between py-2.5 px-3 border-b border-gray-100 last:border-b-0 ${
                isToday ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>
                  {day}
                </span>
                {isToday && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Today</span>}
              </div>
              <div className={`text-right text-xs ${
                isToday 
                  ? 'text-blue-600' 
                  : dayHours ? 'text-gray-500' : 'text-gray-400'
              }`}>
                {dayHours ? (
                  <div className="flex flex-col">
                    <span>{formatTime(dayHours.open)}</span>
                    <span>{formatTime(dayHours.close)}</span>
                  </div>
                ) : (
                  <span>Closed</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Special Hours - Today & Upcoming */}
      {specialHours.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            Special Hours
          </h4>
          <div className="space-y-2 text-sm">
            {/* Today's Special Hours */}
            {todayHours.map((sh, idx) => (
              <div key={`today-${sh.date}-${idx}`} className="flex flex-col gap-1 p-2 bg-amber-50 rounded border border-amber-200">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-amber-900">Today</span>
                  <span className="text-amber-800">
                    {sh.isClosed ? 'Closed' : `${formatTime(sh.open!)} - ${formatTime(sh.close!)}`}
                  </span>
                </div>
                {sh.note && (
                  <span className="text-xs text-amber-700 italic">{sh.note}</span>
                )}
              </div>
            ))}
            
            {/* Upcoming Special Hours */}
            {upcomingHours.map((sh, idx) => (
              <div key={`upcoming-${sh.date}-${idx}`} className="flex flex-col gap-1 p-2 bg-blue-50 rounded border border-blue-200">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-blue-900">
                    {formatDate(sh.date)} {sh.daysAway && `(in ${sh.daysAway} day${sh.daysAway > 1 ? 's' : ''})`}
                  </span>
                  <span className="text-blue-800">
                    {sh.isClosed ? 'Closed' : `${formatTime(sh.open!)} - ${formatTime(sh.close!)}`}
                  </span>
                </div>
                {sh.note && (
                  <span className="text-xs text-blue-700 italic">{sh.note}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

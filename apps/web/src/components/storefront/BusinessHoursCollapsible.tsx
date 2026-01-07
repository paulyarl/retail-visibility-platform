"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getTodaySpecialHours } from '@/lib/hours-utils';

interface BusinessHoursCollapsibleProps {
  businessHours?: any;
}

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function BusinessHoursCollapsible({
  businessHours,
}: BusinessHoursCollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!businessHours) return null;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden mb-5">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Store Hours
          </h2>
          <span className="text-sm text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 px-3 py-1 rounded-full">
            Weekly schedule
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
        )}
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;

                // Check if we have periods format (multiple periods per day)
                const hasPeriodsFormat = businessHours?.periods && Array.isArray(businessHours.periods);
                let displayText = '';
                let hasHours = false;

                if (hasPeriodsFormat) {
                  // New format: periods array
                  const dayUpper = day.toUpperCase();
                  const dayPeriods = businessHours.periods.filter((p: any) => p.day === dayUpper);
                  hasHours = dayPeriods.length > 0;
                  if (hasHours) {
                    displayText = dayPeriods
                      .map((period: any) => {
                        const formatTime = (time24: string): string => {
                          if (!time24) return "";
                          const [h, m] = time24.split(":").map(Number);
                          const period = h >= 12 ? "PM" : "AM";
                          const hour12 = h % 12 || 12;
                          return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
                        };
                        return `${formatTime(period.open)} - ${formatTime(period.close)}`;
                      })
                      .join(', ');
                  }
                } else {
                  // Old format: single period per day
                  const dayHours = businessHours?.[day];
                  hasHours = !!dayHours;
                  if (hasHours) {
                    const formatTime = (time24: string): string => {
                      if (!time24) return "";
                      const [h, m] = time24.split(":").map(Number);
                      const period = h >= 12 ? "PM" : "AM";
                      const hour12 = h % 12 || 12;
                      return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
                    };
                    displayText = `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}`;
                  }
                }

                return (
                  <div
                    key={day}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isToday
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isToday ? 'text-blue-900 dark:text-blue-100' : 'text-neutral-900 dark:text-neutral-100'}`}>
                        {day}
                      </span>
                      {isToday && <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">Today</span>}
                    </div>
                    <div className={`text-right ${
                      isToday
                        ? 'text-blue-700 dark:text-blue-300'
                        : hasHours ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-500 dark:text-neutral-400'
                    }`}>
                      {hasHours ? (
                        <span className="text-sm">{displayText}</span>
                      ) : (
                        <span className="text-sm">Closed</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Special Hours - Today & Upcoming */}
            {(() => {
              const specialHours = getTodaySpecialHours(businessHours);
              if (specialHours.length === 0) return null;

              const todayHours = specialHours.filter(sh => sh.label === 'today');
              const upcomingHours = specialHours.filter(sh => sh.label === 'upcoming');

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

              return (
                <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    Special Hours
                  </h3>
                  <div className="space-y-3">
                    {/* Today's Special Hours */}
                    {todayHours.map((sh, idx) => (
                      <div key={`today-${sh.date}-${idx}`} className="flex flex-col gap-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-amber-900 dark:text-amber-100">Today</span>
                          <span className="text-amber-800 dark:text-amber-200">
                            {sh.isClosed ? 'Closed' : `${formatTime(sh.open!)} - ${formatTime(sh.close!)}`}
                          </span>
                        </div>
                        {sh.note && (
                          <span className="text-sm text-amber-700 dark:text-amber-300 italic">{sh.note}</span>
                        )}
                      </div>
                    ))}

                    {/* Upcoming Special Hours */}
                    {upcomingHours.map((sh, idx) => (
                      <div key={`upcoming-${sh.date}-${idx}`} className="flex flex-col gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-blue-900 dark:text-blue-100">
                            {formatDate(sh.date)} {sh.daysAway && `(in ${sh.daysAway} day${sh.daysAway > 1 ? 's' : ''})`}
                          </span>
                          <span className="text-blue-800 dark:text-blue-200">
                            {sh.isClosed ? 'Closed' : `${formatTime(sh.open!)} - ${formatTime(sh.close!)}`}
                          </span>
                        </div>
                        {sh.note && (
                          <span className="text-sm text-blue-700 dark:text-blue-300 italic">{sh.note}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

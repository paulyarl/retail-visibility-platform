"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Input, Alert } from '@/components/ui';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { externalApiService } from '@/services/ExternalApiService';

interface BusinessHoursStepProps {
  tenantId: string;
  initialData?: Partial<BusinessProfile>;
  onDataChange: (data: Partial<BusinessProfile>) => void;
  onValidationChange: (isValid: boolean) => void;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const DEFAULT_HOURS = {
  monday: '9:00 AM - 5:00 PM',
  tuesday: '9:00 AM - 5:00 PM',
  wednesday: '9:00 AM - 5:00 PM',
  thursday: '9:00 AM - 5:00 PM',
  friday: '9:00 AM - 5:00 PM',
  saturday: 'Closed',
  sunday: 'Closed',
};

const TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Asia/Tokyo",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Australia/Sydney",
];

export default function BusinessHoursStep({
  tenantId,
  initialData = {},
  onDataChange,
  onValidationChange,
}: BusinessHoursStepProps) {
  const [hours, setHours] = useState<Record<string, string>>(() => {
    const initialHours = (initialData.hours as Record<string, string>);
    // Filter out timezone from hours state
    const { timezone: _, ...hoursWithoutTimezone } = initialHours || {};
    return Object.keys(hoursWithoutTimezone).length > 0 ? hoursWithoutTimezone : DEFAULT_HOURS;
  });
  const [useDefaultHours, setUseDefaultHours] = useState(() => {
    const initialHours = (initialData.hours as Record<string, string>);
    return !initialHours || Object.keys(initialHours).filter(k => k !== 'timezone').length === 0;
  });
  const [timezone, setTimezone] = useState<string>(() => {
    // Initialize with browser timezone immediately to avoid empty state
    return (initialData.hours as any)?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  });
  const [autoDetected, setAutoDetected] = useState(false);
  const hasDetectedTimezone = useRef(false);
  const hoursRef = useRef(hours);
  
  // Keep hoursRef in sync
  useEffect(() => {
    hoursRef.current = hours;
  }, [hours]);

  // Auto-detect timezone from coordinates if available (runs once)
  useEffect(() => {
    // Skip if already detected
    if (hasDetectedTimezone.current) {
      return;
    }
    
    // Check if we have coordinates from the previous step
    const lat = initialData.latitude;
    const lng = initialData.longitude;
    
    // Handle both string and number types for coordinates
    const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
    const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng;
    
    if (!latNum || !lngNum || isNaN(latNum) || isNaN(lngNum)) {
      return;
    }
    
    // Mark as detected BEFORE async call to prevent re-runs
    hasDetectedTimezone.current = true;
    
    console.log('[BusinessHoursStep] Detecting timezone from coordinates:', { latNum, lngNum });
    
    externalApiService.getTimezoneFromCoordinates(latNum, lngNum).then(detectedTz => {
      if (detectedTz) {
        console.log('[BusinessHoursStep] Detected timezone:', detectedTz);
        setTimezone(detectedTz);
        setAutoDetected(true);
        // Use ref to get latest hours value
        onDataChange({ hours: { ...hoursRef.current, timezone: detectedTz } });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData.latitude, initialData.longitude]);

  useEffect(() => {
    // This step is always valid (hours are optional)
    onValidationChange(true);
  }, [onValidationChange]);

  const handleHoursChange = (day: string, value: string) => {
    setHours((prev) => {
      const newHours = {
        ...prev,
        [day]: value,
      };
      return newHours;
    });
    
    // Notify parent after state update (in next tick)
    setTimeout(() => {
      onDataChange({ hours: { ...hours, timezone } });
    }, 0);
  };

  const handleToggleDefault = () => {
    if (useDefaultHours) {
      // Clear hours
      setHours({});
      setTimeout(() => {
        onDataChange({ hours: { timezone } });
      }, 0);
    } else {
      // Apply default hours
      setHours(DEFAULT_HOURS);
      setTimeout(() => {
        onDataChange({ hours: { ...DEFAULT_HOURS, timezone } });
      }, 0);
    }
    setUseDefaultHours(!useDefaultHours);
  };

  const handleSetClosed = (day: string) => {
    handleHoursChange(day, 'Closed');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-2xl mb-4"
        >
          <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </motion.div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">Business Hours</h2>
        <p className="text-neutral-600">
          Let customers know when you're open for business
        </p>
      </div>

      {/* Info Alert */}
      <Alert variant="info">
        Business hours help customers plan their visits and improve your store's visibility in local search results.
      </Alert>

      {/* Timezone Selection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-50 border border-blue-200 rounded-lg p-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <label className="text-sm font-medium text-blue-800">Store Timezone</label>
          </div>
          <select
            value={timezone}
            onChange={(e) => {
              const newTimezone = e.target.value;
              setTimezone(newTimezone);
              setAutoDetected(false); // User manually changed
              onDataChange({ hours: { ...hours, timezone: newTimezone } });
            }}
            className="border border-blue-300 rounded-md px-3 py-2 text-sm bg-white flex-1 sm:max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {autoDetected && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Auto-detected from your location
            </span>
          )}
          <p className="text-xs text-blue-700">
            Used to calculate open/closed status on your storefront.
          </p>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleToggleDefault}
          className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
            useDefaultHours
              ? 'border-primary-600 bg-primary-50 text-primary-700'
              : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
          }`}
        >
          {useDefaultHours ? '✓ Using Default Hours' : 'Use Default Hours (Mon-Fri 9-5)'}
        </button>
      </div>

      {/* Hours Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Operating Hours
        </label>
        <p className="text-xs text-neutral-500 mb-3">
          Enter hours in format: "9:00 AM - 5:00 PM" or "By Appointment" or "Closed"
        </p>

        {DAYS_OF_WEEK.map((day) => (
          <div key={day.key} className="flex items-center gap-3">
            <div className="w-28 flex-shrink-0">
              <span className="text-sm font-medium text-neutral-700">{day.label}</span>
            </div>
            <Input
              placeholder="e.g., 9:00 AM - 5:00 PM"
              value={hours[day.key] || ''}
              onChange={(e) => handleHoursChange(day.key, e.target.value)}
              className="flex-1"
            />
            <button
              onClick={() => handleSetClosed(day.key)}
              className="px-3 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              Closed
            </button>
          </div>
        ))}
      </motion.div>

      {/* Preview */}
      {Object.keys(hours).length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-neutral-50 rounded-lg p-4 border border-neutral-200"
        >
          <h4 className="text-sm font-medium text-neutral-700 mb-3">Hours Preview</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.key} className="flex justify-between">
                <span className="text-neutral-600">{day.label.slice(0, 3)}:</span>
                <span className={hours[day.key] === 'Closed' ? 'text-red-600' : 'text-neutral-900'}>
                  {hours[day.key] || 'Not set'}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

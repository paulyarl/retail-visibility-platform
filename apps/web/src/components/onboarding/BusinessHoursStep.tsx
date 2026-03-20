"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Input, Alert } from '@/components/ui';
import { BusinessProfile } from '@/lib/validation/businessProfile';

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

export default function BusinessHoursStep({
  tenantId,
  initialData = {},
  onDataChange,
  onValidationChange,
}: BusinessHoursStepProps) {
  const [hours, setHours] = useState<Record<string, string>>(
    (initialData.hours as Record<string, string>) || DEFAULT_HOURS
  );
  const [useDefaultHours, setUseDefaultHours] = useState(!initialData.hours);

  useEffect(() => {
    // This step is always valid (hours are optional)
    onValidationChange(true);
  }, [onValidationChange]);

  useEffect(() => {
    onDataChange({ hours });
  }, [hours, onDataChange]);

  const handleHoursChange = (day: string, value: string) => {
    setHours((prev) => ({
      ...prev,
      [day]: value,
    }));
  };

  const handleToggleDefault = () => {
    if (useDefaultHours) {
      // Clear hours
      setHours({});
    } else {
      // Apply default hours
      setHours(DEFAULT_HOURS);
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

"use client";

import { useState, useEffect, useRef } from "react";

interface TimeInputProps {
  value: string; // 12-hour format like "9:00 AM"
  onChange: (value: string) => void;
  placeholder?: string;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function TimeInput({ value, onChange, placeholder }: TimeInputProps) {
  const [hour, setHour] = useState<number>(9);
  const [minute, setMinute] = useState<number>(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const lastValueRef = useRef<string>('');

  // Parse the input value when it changes from parent
  useEffect(() => {
    if (!value || value === lastValueRef.current) return;
    
    const match = value.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
      setHour(parseInt(match[1]));
      setMinute(parseInt(match[2]));
      setPeriod(match[3].toUpperCase() as 'AM' | 'PM');
      lastValueRef.current = value;
    }
  }, [value]);

  // Update parent when user changes values
  const updateParent = (newHour: number, newMinute: number, newPeriod: 'AM' | 'PM') => {
    const timeString = `${newHour}:${newMinute.toString().padStart(2, '0')} ${newPeriod}`;
    lastValueRef.current = timeString;
    onChange(timeString);
  };

  const incrementHour = () => {
    const newHour = hour === 12 ? 1 : hour + 1;
    setHour(newHour);
    updateParent(newHour, minute, period);
  };

  const decrementHour = () => {
    const newHour = hour === 1 ? 12 : hour - 1;
    setHour(newHour);
    updateParent(newHour, minute, period);
  };

  const incrementMinute = () => {
    const newMinute = (minute + 15) % 60;
    setMinute(newMinute);
    updateParent(hour, newMinute, period);
  };

  const decrementMinute = () => {
    const newMinute = minute === 0 ? 45 : minute - 15;
    setMinute(newMinute);
    updateParent(hour, newMinute, period);
  };

  const togglePeriod = () => {
    const newPeriod = period === 'AM' ? 'PM' : 'AM';
    setPeriod(newPeriod);
    updateParent(hour, minute, newPeriod);
  };

  return (
    <div className="inline-flex items-center gap-1 border border-gray-300 rounded-lg bg-white">
      {/* Hour */}
      <div className="flex flex-col">
        <button
          type="button"
          onClick={incrementHour}
          className="px-2 py-0.5 hover:bg-gray-100 rounded-t-lg text-gray-600 hover:text-gray-900"
          aria-label="Increment hour"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <input
          type="number"
          min="1"
          max="12"
          value={hour}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            if (val >= 1 && val <= 12) {
              setHour(val);
              updateParent(val, minute, period);
            }
          }}
          className="w-12 text-center py-1 border-0 focus:ring-0 focus:outline-none"
        />
        <button
          type="button"
          onClick={decrementHour}
          className="px-2 py-0.5 hover:bg-gray-100 rounded-b-lg text-gray-600 hover:text-gray-900"
          aria-label="Decrement hour"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <span className="text-gray-400 font-bold">:</span>

      {/* Minute */}
      <div className="flex flex-col">
        <button
          type="button"
          onClick={incrementMinute}
          className="px-2 py-0.5 hover:bg-gray-100 rounded-t-lg text-gray-600 hover:text-gray-900"
          aria-label="Increment minute"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <input
          type="number"
          min="0"
          max="59"
          step="15"
          value={minute}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            if (val >= 0 && val <= 59) {
              setMinute(val);
              updateParent(hour, val, period);
            }
          }}
          className="w-12 text-center py-1 border-0 focus:ring-0 focus:outline-none"
        />
        <button
          type="button"
          onClick={decrementMinute}
          className="px-2 py-0.5 hover:bg-gray-100 rounded-b-lg text-gray-600 hover:text-gray-900"
          aria-label="Decrement minute"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* AM/PM Toggle */}
      <button
        type="button"
        onClick={togglePeriod}
        className="px-3 py-2 hover:bg-gray-100 rounded-r-lg font-medium text-sm text-gray-700 hover:text-gray-900 border-l border-gray-300"
      >
        {period}
      </button>
    </div>
  );
}

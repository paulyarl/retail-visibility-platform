"use client";
import React, { useEffect, useState, useRef } from "react";
import TimeInput from "./TimeInput";
import { tenantManagementService } from "@/services/TenantManagementService";
import { useStoreStatus } from "@/hooks/useStoreStatus";
import { platformHomeService } from "@/services/PlatformHomeSingletonService";

type Period = { day: string; open: string; close: string };
type SpecialHour = { date: string; isClosed: boolean; open?: string; close?: string; note?: string };

// Convert 24-hour to 12-hour format
function to12Hour(time24: string): string {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

// Convert 12-hour to 24-hour format
function to24Hour(time12: string): string {
  if (!time12) return "";
  const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return time12; // Return as-is if not in 12-hour format
  let [, h, m, period] = match;
  let hour = parseInt(h);
  if (period.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (period.toUpperCase() === "AM" && hour === 12) hour = 0;
  return `${hour.toString().padStart(2, "0")}:${m}`;
}

// Parse time string (HH:MM) to minutes since midnight
function parseTimeToMinutes(time: string): number | null {
  if (!time) return null;
  const parts = time.split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// Convert profile hours format to business hours periods format
function convertProfileHoursToPeriods(profileHours: Record<string, string>): Period[] {
  const dayMap: Record<string, string> = {
    'monday': 'MONDAY',
    'tuesday': 'TUESDAY', 
    'wednesday': 'WEDNESDAY',
    'thursday': 'THURSDAY',
    'friday': 'FRIDAY',
    'saturday': 'SATURDAY',
    'sunday': 'SUNDAY'
  };

  const periods: Period[] = [];

  Object.entries(profileHours).forEach(([day, hours]) => {
    const dayName = dayMap[day.toLowerCase()];
    if (!dayName) return;

    if (hours.toLowerCase() === 'closed') {
      // Skip closed days for now, or handle as needed
      return;
    }

    // Parse "9:00 AM - 5:00 PM" format
    const match = hours.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
    if (match) {
      const openTime = to24Hour(match[1]);
      const closeTime = to24Hour(match[2]);
      
      if (openTime && closeTime) {
        periods.push({
          day: dayName,
          open: openTime,
          close: closeTime
        });
      }
    }
  });

  return periods;
}

// Convert business hours periods format back to profile hours format
function convertPeriodsToProfileHours(periods: Period[]): Record<string, string> {
  const dayMap: Record<string, string> = {
    'MONDAY': 'monday',
    'TUESDAY': 'tuesday', 
    'WEDNESDAY': 'wednesday',
    'THURSDAY': 'thursday',
    'FRIDAY': 'friday',
    'SATURDAY': 'saturday',
    'SUNDAY': 'sunday'
  };

  const profileHours: Record<string, string> = {};

  // Initialize all days as closed
  Object.values(dayMap).forEach(day => {
    profileHours[day] = 'Closed';
  });

  // Convert periods to profile format
  periods.forEach(period => {
    const dayName = dayMap[period.day];
    if (!dayName) return;

    const openTime = to12Hour(period.open);
    const closeTime = to12Hour(period.close);
    
    if (openTime && closeTime) {
      profileHours[dayName] = `${openTime} - ${closeTime}`;
    }
  });

  return profileHours;
}



export default function HoursEditor({ tenantId, timezone: externalTimezone }: { tenantId: string; timezone?: string }) {
  const [timezone, setTimezone] = useState("America/New_York");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [specialHours, setSpecialHours] = useState<SpecialHour[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Use external timezone if provided, otherwise use internal state
  const currentTimezone = externalTimezone || timezone;

  // Use centralized status hook instead of local calculation
  const { status: currentStatus } = useStoreStatus(tenantId, false); // Private scope

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Sync with external timezone changes
  useEffect(() => {
    if (externalTimezone) {
      setTimezone(externalTimezone);
    }
  }, [externalTimezone]);

  useEffect(() => {
    const load = async () => {
      try {
        // Load regular business hours
        const hoursData = await tenantManagementService.getBusinessHours(tenantId);
        if (!mountedRef.current) return;
        setTimezone(hoursData?.timezone || "America/New_York");
        
        let businessHoursPeriods = Array.isArray(hoursData?.periods) ? hoursData.periods : [];
        
        // If no business hours exist, check profile for hours data and sync it
        if (businessHoursPeriods.length === 0) {
          try {
            const profileData = await platformHomeService.getOnboardingTenantData(tenantId);
            if (profileData?.hours && typeof profileData.hours === 'object') {
              console.log('[HoursEditor] Syncing profile hours to business hours:', profileData.hours);
              const convertedPeriods = convertProfileHoursToPeriods(profileData.hours);
              
              if (convertedPeriods.length > 0) {
                // Save the converted periods to business hours
                await tenantManagementService.updateBusinessHours(tenantId, {
                  timezone: hoursData?.timezone || "America/New_York",
                  periods: convertedPeriods
                });
                businessHoursPeriods = convertedPeriods;
                console.log('[HoursEditor] Successfully synced profile hours to business hours');
              }
            }
          } catch (syncError) {
            console.warn('[HoursEditor] Failed to sync profile hours:', syncError);
          }
        }
        
        setPeriods(businessHoursPeriods);
        
        // Load special hours
        const specialData = await tenantManagementService.getSpecialBusinessHours(tenantId);
        if (!mountedRef.current) return;
        setSpecialHours(Array.isArray(specialData?.overrides) ? specialData.overrides : []);
      } catch (error) {
        console.error('Failed to load business hours:', error);
      }
    };
    load();
  }, [tenantId]);

  const add = () => setPeriods([...periods, { day: "MONDAY", open: "09:00", close: "17:00" }]);
  const update = (i: number, k: keyof Period, v: string) => {
    const next = periods.slice();
    // Convert 12-hour input to 24-hour for storage
    if (k === "open" || k === "close") {
      v = to24Hour(v);
    }
    next[i] = { ...next[i], [k]: v } as Period;
    setPeriods(next);
  };
  const remove = (i: number) => setPeriods(periods.filter((_, idx) => idx !== i));

  const save = async () => {
    // Validate that open time is before close time for each period
    const invalidPeriods = periods.filter(p => {
      if (!p.open || !p.close) return false;
      const openMinutes = parseTimeToMinutes(p.open);
      const closeMinutes = parseTimeToMinutes(p.close);
      return openMinutes !== null && closeMinutes !== null && openMinutes >= closeMinutes;
    });

    if (invalidPeriods.length > 0) {
      setMsg("✗ Invalid hours: close time must be after open time");
      setTimeout(() => setMsg(null), 3000);
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      // Save to business hours table
      await tenantManagementService.updateBusinessHours(tenantId, { timezone, periods });
      
      // Also sync back to profile for consistency
      try {
        const profileHours = convertPeriodsToProfileHours(periods);
        await platformHomeService.saveOnboardingProfile(tenantId, { hours: profileHours });
        console.log('[HoursEditor] Successfully synced business hours back to profile');
      } catch (profileSyncError) {
        console.warn('[HoursEditor] Failed to sync hours back to profile:', profileSyncError);
        // Don't fail the entire save if profile sync fails
      }
      
      setSaving(false);
      setMsg("✓ Saved");
      setTimeout(() => setMsg(null), 2000);
    } catch (error) {
      console.error('Failed to save business hours:', error);
      setSaving(false);
      setMsg("✗ Failed");
      setTimeout(() => setMsg(null), 2000);
    }
  };

  // Calculate current status - using centralized hook
  const statusType = currentStatus?.status || 'closed';
  const statusMessage = currentStatus?.label || 'Closed';

  return (
    <div className="space-y-4">
      {/* Current Status Badge */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
        <span className={`inline-block w-3 h-3 rounded-full ${
          statusType === 'open' ? 'bg-green-500' :
          statusType === 'closed' ? 'bg-red-500' :
          statusType === 'opening-soon' ? 'bg-yellow-500' :
          statusType === 'closing-soon' ? 'bg-orange-500' :
          'bg-gray-500' // fallback
        }`}></span>
        <span className="font-medium text-gray-900">
          {statusMessage}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="w-32">Timezone</span>
        <span className="px-2 py-1 rounded bg-gray-50 border border-gray-200">{currentTimezone}</span>
        <span className="ml-2 text-gray-500">Manage timezone above.</span>
      </div>
      
      <div className="space-y-2">
        {periods.map((p, i) => {
          const isInvalid = p.open && p.close && p.open >= p.close;
          
          // Check for overlaps with other periods on the same day
          const hasOverlap = periods.some((other, j) => {
            if (i === j || p.day !== other.day) return false;
            return p.open < other.close && other.open < p.close;
          });
          
          const hasDuplicate = periods.filter((other, j) => i !== j && p.day === other.day).length > 0;
          
          return (
            <div key={i} className={`flex gap-2 items-center flex-wrap p-2 rounded-lg dark:bg-neutral-600 ${isInvalid || hasOverlap ? 'bg-red-50 border border-red-200' : hasDuplicate ? 'bg-amber-50 border border-amber-200' : ''}`}>
              <select 
                className="border border-gray-300 px-3 py-2 rounded-lg w-40 font-medium dark:text-neutral-500 dark:bg-neutral-400" 
                value={p.day} 
                onChange={(e) => update(i, "day", e.target.value)}
              >
                {"SUNDAY,MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SATURDAY".split(",").map((d) => (
                  <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
                ))}
              </select>
              <TimeInput
                value={to12Hour(p.open)}
                onChange={(val) => update(i, "open", val)}
                placeholder="9:00 AM"
              />
              <span className="text-gray-400">to</span>
              <TimeInput
                value={to12Hour(p.close)}
                onChange={(val) => update(i, "close", val)}
                placeholder="5:00 PM"
              />
              {isInvalid && (
                <span className="text-red-600 text-sm font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Invalid time range
                </span>
              )}
              {!isInvalid && hasOverlap && (
                <span className="text-red-600 text-sm font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Overlaps with another period
                </span>
              )}
              {!isInvalid && !hasOverlap && hasDuplicate && (
                <span className="text-amber-600 text-sm font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Multiple periods for same day
                </span>
              )}
              <button 
                className="text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50" 
                onClick={() => remove(i)}
              >
                Remove
              </button>
            </div>
          );
        })}
        <button className="text-blue-600 hover:text-blue-700 font-medium" onClick={add}>+ Add period</button>
      </div>
      
      <div className="flex items-center gap-3">
        <button 
          disabled={saving} 
          className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50" 
          onClick={save}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {msg && <span className={msg.includes("✓") ? "text-green-600" : "text-red-600"}>{msg}</span>}
      </div>
    </div>
  );
}

"use client";
import React, { useEffect, useState, useRef } from "react";
import TimeInput from "../hours/TimeInput";
import { getTenantHoursSingleton } from "@/lib/singletons/TenantHoursSingleton";
import { useStoreStatus } from "@/hooks/useStoreStatus";
import { clientLogger } from '@/lib/client-logger';

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

interface ShopHoursEditorProps {
  tenantId: string;
  shop: any;
  onUpdate: (shop: any) => void;
  onCancel: () => void;
}

export default function ShopHoursEditor({ tenantId, shop, onUpdate, onCancel }: ShopHoursEditorProps) {
  const [timezone, setTimezone] = useState("America/New_York");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [specialHours, setSpecialHours] = useState<SpecialHour[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Use centralized status hook
  const { status: currentStatus } = useStoreStatus(tenantId, false); // Private scope for admin

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const hoursSingleton = getTenantHoursSingleton(tenantId);

        // Load shop hours from business profile
        const shopData = await hoursSingleton.loadShopHours(tenantId);
        
        if (!mountedRef.current) return;

        // Extract timezone from shop data or default
        const tz = shopData.timezone || shopData.hours?.timezone;
        const shopTimezone = typeof tz === 'string' ? tz : "America/New_York";
        setTimezone(shopTimezone);

        // Extract hours from business profile hours field
        const hoursData = shopData.hours || {};
        const shopPeriods = Object.entries(hoursData)
          .filter(([day, hours]) => {
            const hourObj = hours as any;
            return typeof hours === 'object' && hourObj && hourObj.open && hourObj.close;
          })
          .map(([day, hours]: [string, any]) => ({
            day: day.toUpperCase(),
            open: hours.open,
            close: hours.close
          }));

        setPeriods(shopPeriods);

        // Use overrides from already-loaded shopData (avoids redundant API call)
        const overrides = shopData.hours?.overrides || [];
        setSpecialHours(Array.isArray(overrides) ? overrides : []);
      } catch (error) {
        clientLogger.error('Failed to load shop hours:', { detail: error });
        if (mountedRef.current) {
          setMsg('Failed to load hours data');
        }
      }
    };
    load();
  }, [tenantId]);

  const addPeriod = () => setPeriods([...periods, { day: "MONDAY", open: "09:00", close: "17:00" }]);
  
  const updatePeriod = (i: number, k: keyof Period, v: string) => {
    const next = periods.slice();
    // Convert 12-hour input to 24-hour for storage
    if (k === "open" || k === "close") {
      v = to24Hour(v);
    }
    next[i] = { ...next[i], [k]: v };
    setPeriods(next);
  };

  const removePeriod = (i: number) => setPeriods(periods.filter((_, idx) => idx !== i));

  const addSpecial = () => setSpecialHours([...specialHours, { date: "", isClosed: false }]);
  
  const updateSpecial = (i: number, k: keyof SpecialHour, v: any) => {
    const next = specialHours.slice();
    if (k === "open" || k === "close") {
      v = to24Hour(v);
    }
    next[i] = { ...next[i], [k]: v };
    setSpecialHours(next);
  };

  const removeSpecial = (i: number) => setSpecialHours(specialHours.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      // Convert periods back to hours object format
      const hoursObject: Record<string, { open: string; close: string }> = {};
      periods.forEach(p => {
        hoursObject[p.day.toLowerCase()] = { open: p.open, close: p.close };
      });

      // Update shop hours via singleton
      const hoursSingleton = getTenantHoursSingleton(tenantId);
      const updatedShop = await hoursSingleton.saveShopHours(tenantId, hoursObject, timezone);
      onUpdate(updatedShop);
      setMsg('Shop hours saved successfully');
    } catch (error) {
      clientLogger.error('Failed to save shop hours:', { detail: error });
      setMsg('Failed to save hours');
    } finally {
      setSaving(false);
    }
  };

  const dayOrder = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Shop Hours</h2>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Hours'}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg mb-4 ${
          msg.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {msg}
        </div>
      )}

      {/* Timezone Setting */}
      <div className="mb-8 p-4 border border-gray-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Timezone</h3>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Shop Timezone:</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="America/Chicago">Central Time (CT)</option>
            <option value="America/Denver">Mountain Time (MT)</option>
            <option value="America/Los_Angeles">Pacific Time (PT)</option>
            <option value="Europe/London">London (GMT)</option>
            <option value="Europe/Paris">Paris (CET)</option>
            <option value="Asia/Tokyo">Tokyo (JST)</option>
            <option value="Australia/Sydney">Sydney (AEDT)</option>
          </select>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          This timezone will be used for displaying your shop's open/closed status to customers.
        </p>
      </div>

      {/* Regular Hours */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Regular Hours</h3>
          <button
            onClick={addPeriod}
            className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Add Day
          </button>
        </div>
        <div className="space-y-3">
          {periods.map((period, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
              <select
                value={period.day}
                onChange={(e) => updatePeriod(i, 'day', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {dayOrder.map(day => (
                  <option key={day} value={day}>{day.charAt(0) + day.slice(1).toLowerCase()}</option>
                ))}
              </select>
              <TimeInput
                value={to12Hour(period.open)}
                onChange={(v) => updatePeriod(i, 'open', v)}
                placeholder="Open"
              />
              <span className="text-gray-500">to</span>
              <TimeInput
                value={to12Hour(period.close)}
                onChange={(v) => updatePeriod(i, 'close', v)}
                placeholder="Close"
              />
              <button
                onClick={() => removePeriod(i)}
                className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
          {periods.length === 0 && (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
              No regular hours set. Click "Add Day" to configure business hours.
            </div>
          )}
        </div>
      </div>

      {/* Special Hours */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Special Hours</h3>
          <button
            onClick={addSpecial}
            className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Add Special Hour
          </button>
        </div>
        <div className="space-y-3">
          {specialHours.map((special, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
              <input
                type="date"
                value={special.date}
                onChange={(e) => updateSpecial(i, 'date', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={special.isClosed}
                  onChange={(e) => updateSpecial(i, 'isClosed', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Closed all day</span>
              </label>
              {!special.isClosed && (
                <>
                  <TimeInput
                    value={to12Hour(special.open || '')}
                    onChange={(v) => updateSpecial(i, 'open', v)}
                    placeholder="Open"
                  />
                  <span className="text-gray-500">to</span>
                  <TimeInput
                    value={to12Hour(special.close || '')}
                    onChange={(v) => updateSpecial(i, 'close', v)}
                    placeholder="Close"
                  />
                </>
              )}
              <input
                type="text"
                value={special.note || ''}
                onChange={(e) => updateSpecial(i, 'note', e.target.value)}
                placeholder="Note (optional)"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => removeSpecial(i)}
                className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
          {specialHours.length === 0 && (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
              No special hours set. Add special hours for holidays, events, or temporary closures.
            </div>
          )}
        </div>
      </div>

      {/* Current Status */}
      {currentStatus && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Current Status</h3>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              currentStatus.isOpen ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="font-medium">
              {currentStatus.isOpen ? 'Open' : 'Closed'}
            </span>
            <span className="text-gray-600">
              ({currentStatus.label})
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Based on {timezone} timezone
          </p>
        </div>
      )}
    </div>
  );
}

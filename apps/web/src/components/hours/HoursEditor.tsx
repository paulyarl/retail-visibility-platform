"use client";
import React, { useEffect, useState } from "react";
import TimeInput from "./TimeInput";
import { apiRequest } from "@/lib/api";

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

export default function HoursEditor({ apiBase, tenantId }: { apiBase: string; tenantId: string }) {
  const [timezone, setTimezone] = useState("America/New_York");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [specialHours, setSpecialHours] = useState<SpecialHour[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Load regular business hours
        const r = await apiRequest(`api/tenant/${tenantId}/business-hours`);
        if (r.ok) {
          const j = await r.json();
          setTimezone(j?.data?.timezone || "America/New_York");
          setPeriods(Array.isArray(j?.data?.periods) ? j.data.periods : []);
        }
        
        // Load special hours
        const specialRes = await apiRequest(`api/tenant/${tenantId}/business-hours/special`);
        if (specialRes.ok) {
          const specialData = await specialRes.json();
          setSpecialHours(Array.isArray(specialData?.data?.overrides) ? specialData.data.overrides : []);
        }
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
      return p.open >= p.close;
    });

    if (invalidPeriods.length > 0) {
      setMsg("✗ Opening time must be before closing time");
      setTimeout(() => setMsg(null), 3000);
      return;
    }

    // Check for duplicate days with overlapping times
    const dayGroups = periods.reduce((acc, p) => {
      if (!acc[p.day]) acc[p.day] = [];
      acc[p.day].push(p);
      return acc;
    }, {} as Record<string, Period[]>);

    for (const [day, dayPeriods] of Object.entries(dayGroups)) {
      if (dayPeriods.length > 1) {
        // Check for overlaps
        for (let i = 0; i < dayPeriods.length; i++) {
          for (let j = i + 1; j < dayPeriods.length; j++) {
            const p1 = dayPeriods[i];
            const p2 = dayPeriods[j];
            // Check if periods overlap: p1.open < p2.close AND p2.open < p1.close
            if (p1.open < p2.close && p2.open < p1.close) {
              setMsg(`✗ Overlapping hours on ${day.charAt(0) + day.slice(1).toLowerCase()}`);
              setTimeout(() => setMsg(null), 3000);
              return;
            }
          }
        }
      }
    }

    setSaving(true);
    setMsg(null);
    try {
      const r = await apiRequest(`api/tenant/${tenantId}/business-hours`, {
        method: "PUT",
        body: JSON.stringify({ timezone, periods }),
      });
      setSaving(false);
      setMsg(r.ok ? "✓ Saved" : "✗ Failed");
      setTimeout(() => setMsg(null), 2000);
    } catch (error) {
      console.error('Failed to save business hours:', error);
      setSaving(false);
      setMsg("✗ Failed");
      setTimeout(() => setMsg(null), 2000);
    }
  };

  // Calculate current status - considering both regular and special hours
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }).toUpperCase();
  const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: timezone });
  
  // Check for special hours for today
  const todaySpecial = specialHours.find(special => special.date === today);
  
  let isOpen = false;
  let statusMessage = '';
  
  if (todaySpecial) {
    // Use special hours if they exist for today
    if (todaySpecial.isClosed) {
      isOpen = false;
      statusMessage = 'Closed today (special hours)';
    } else if (todaySpecial.open && todaySpecial.close) {
      // Special hours with specific times
      isOpen = currentTime >= todaySpecial.open && currentTime < todaySpecial.close;
      statusMessage = isOpen 
        ? `Open now • Closes at ${to12Hour(todaySpecial.close)} (special hours)`
        : `Closed • Opens at ${to12Hour(todaySpecial.open)} (special hours)`;
    } else {
      // Special hours but no specific times (treat as closed)
      isOpen = false;
      statusMessage = 'Closed today (special hours)';
    }
  } else {
    // Use regular business hours
    const todayPeriod = periods.find(p => p.day === currentDay);
    if (todayPeriod) {
      isOpen = currentTime >= todayPeriod.open && currentTime < todayPeriod.close;
      statusMessage = isOpen 
        ? `Open now • Closes at ${to12Hour(todayPeriod.close)}`
        : 'Closed';
    } else {
      isOpen = false;
      statusMessage = 'Closed';
    }
  }

  return (
    <div className="space-y-4">
      {/* Current Status Badge */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
        <span className={`inline-block w-3 h-3 rounded-full ${isOpen ? 'bg-green-500' : 'bg-red-500'}`}></span>
        <span className="font-medium text-gray-900">
          {statusMessage}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="w-32">Timezone</span>
        <span className="px-2 py-1 rounded bg-gray-50 border border-gray-200">{timezone}</span>
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
            <div key={i} className={`flex gap-2 items-center flex-wrap p-2 rounded-lg ${isInvalid || hasOverlap ? 'bg-red-50 border border-red-200' : hasDuplicate ? 'bg-amber-50 border border-amber-200' : ''}`}>
              <select 
                className="border border-gray-300 px-3 py-2 rounded-lg w-40 font-medium" 
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

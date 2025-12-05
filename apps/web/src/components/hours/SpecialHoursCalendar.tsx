"use client";
import React, { useEffect, useState } from "react";
import TimeInput from "./TimeInput";
import { apiRequest } from "@/lib/api";

type Override = { date: string; open?: string; close?: string; note?: string; isClosed?: boolean };

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
  if (!match) return time12;
  let [, h, m, period] = match;
  let hour = parseInt(h);
  if (period.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (period.toUpperCase() === "AM" && hour === 12) hour = 0;
  return `${hour.toString().padStart(2, "0")}:${m}`;
}

export default function SpecialHoursCalendar({ apiBase, tenantId }: { apiBase: string; tenantId: string }) {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await apiRequest(`/api/tenant/${tenantId}/business-hours/special`);
        if (r.ok) {
          const j = await r.json();
          setOverrides(Array.isArray(j?.data?.overrides) ? j.data.overrides : []);
        }
      } catch (error) {
        console.error('Failed to load special hours:', error);
      }
    };
    load();
  }, [tenantId]);

  const add = () => setOverrides([...overrides, { date: new Date().toISOString().slice(0,10), open: "10:00", close: "14:00", note: "" }]);
  const update = (i: number, k: keyof Override, v: any) => {
    const next = overrides.slice();
    // Convert 12-hour input to 24-hour for storage
    if ((k === "open" || k === "close") && v) {
      v = to24Hour(v);
    }
    next[i] = { ...next[i], [k]: v } as Override;
    setOverrides(next);
  };
  const remove = (i: number) => setOverrides(overrides.filter((_, idx) => idx !== i));

  const save = async () => {
    // Validate that open time is before close time for non-closed days
    const invalidOverrides = overrides.filter(o => {
      if (o.isClosed || !o.open || !o.close) return false;
      return o.open >= o.close;
    });

    if (invalidOverrides.length > 0) {
      setMsg("✗ Opening time must be before closing time");
      setTimeout(() => setMsg(null), 3000);
      return;
    }

    // Check for overlapping times on the same date
    const dateGroups = overrides.reduce((acc, o) => {
      if (!acc[o.date]) acc[o.date] = [];
      acc[o.date].push(o);
      return acc;
    }, {} as Record<string, typeof overrides>);

    for (const [date, dateOverrides] of Object.entries(dateGroups)) {
      if (dateOverrides.length > 1) {
        // Check for overlaps between non-closed periods
        for (let i = 0; i < dateOverrides.length; i++) {
          for (let j = i + 1; j < dateOverrides.length; j++) {
            const o1 = dateOverrides[i];
            const o2 = dateOverrides[j];
            
            // Skip if either is closed
            if (o1.isClosed || o2.isClosed) continue;
            
            // Check if periods overlap: o1.open < o2.close AND o2.open < o1.close
            if (o1.open && o1.close && o2.open && o2.close) {
              if (o1.open < o2.close && o2.open < o1.close) {
                setMsg(`✗ Overlapping hours on ${date}`);
                setTimeout(() => setMsg(null), 3000);
                return;
              }
            }
          }
        }
      }
    }

    setSaving(true);
    setMsg(null);
    try {
      const r = await apiRequest(`/api/tenant/${tenantId}/business-hours/special`, {
        method: "PUT",
        body: JSON.stringify({ overrides }),
      });
      setSaving(false);
      setMsg(r.ok ? "✓ Saved" : "✗ Failed");
      setTimeout(() => setMsg(null), 2000);
    } catch (error) {
      console.error('Failed to save special hours:', error);
      setSaving(false);
      setMsg("✗ Failed");
      setTimeout(() => setMsg(null), 2000);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {overrides.map((o, i) => {
          const isInvalid = !o.isClosed && o.open && o.close && o.open >= o.close;
          
          // Check for overlaps with other periods on the same date
          const hasOverlap = overrides.some((other, j) => {
            if (i === j || o.date !== other.date || o.isClosed || other.isClosed) return false;
            if (!o.open || !o.close || !other.open || !other.close) return false;
            return o.open < other.close && other.open < o.close;
          });
          
          const hasSameDate = overrides.filter((other, j) => i !== j && o.date === other.date).length > 0;
          
          return (
            <div key={i} className={`flex flex-wrap gap-2 items-center p-2 rounded-lg ${isInvalid || hasOverlap ? 'bg-red-50 border border-red-200' : hasSameDate ? 'bg-blue-50 border border-blue-200' : 'border border-gray-200'}`}>
              <input 
                type="date" 
                className="border border-gray-300 px-3 py-2 rounded-lg" 
                value={o.date} 
                onChange={(e) => update(i, "date", e.target.value)} 
              />
              <label className="flex gap-2 items-center px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer hover:bg-gray-50">
                <input 
                  type="checkbox" 
                  checked={!!o.isClosed} 
                  onChange={(e) => update(i, "isClosed", e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="font-medium text-sm">Closed</span>
              </label>
              {!o.isClosed && (
                <>
                  <TimeInput
                    value={to12Hour(o.open || "09:00")}
                    onChange={(val) => update(i, "open", val)}
                    placeholder="9:00 AM"
                  />
                  <span className="text-gray-400">to</span>
                  <TimeInput
                    value={to12Hour(o.close || "17:00")}
                    onChange={(val) => update(i, "close", val)}
                    placeholder="5:00 PM"
                  />
                </>
              )}
              <input 
                className="border border-gray-300 px-3 py-2 rounded-lg flex-1 min-w-[200px]" 
                value={o.note || ''} 
                onChange={(e) => update(i, "note", e.target.value)} 
                placeholder="Note (e.g., Christmas Day, Thanksgiving)" 
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
              {!isInvalid && !hasOverlap && hasSameDate && (
                <span className="text-blue-600 text-sm font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Multiple periods for this date
                </span>
              )}
              <button 
                className="text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 font-medium" 
                onClick={() => remove(i)}
              >
                Remove
              </button>
            </div>
          );
        })}
        <button className="text-blue-600 hover:text-blue-700 font-medium" onClick={add}>+ Add special hours</button>
      </div>
      <div className="flex items-center gap-3 mb-6">
        <button 
          disabled={saving} 
          className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50" 
          onClick={save}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {msg && <span className={msg.includes("✓") ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{msg}</span>}
      </div>
      
      {/* Test It Live Banner */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-green-900 mb-1">🎯 Test It Live!</h4>
            <p className="text-sm text-green-800 mb-3">
              Want to see your special hours in action? Create a special hours entry for <strong>today</strong> with times around the current time, save it, then visit your storefront to see the real-time status update!
            </p>
            <a
              href={`/tenant/${tenantId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Your Storefront
            </a>
          </div>
        </div>
      </div>
      
      {/* Info Guide - Moved below controls */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1 text-sm">
            <h4 className="font-semibold text-blue-900 mb-2">Special Hours Guide</h4>
            <div className="text-blue-800 space-y-2">
              <p><strong>Multiple periods per day:</strong> You can add multiple time periods for the same date (e.g., split shifts: 9 AM-12 PM and 2 PM-6 PM). Just make sure they don't overlap.</p>
              <p><strong>Notes:</strong> Notes appear on your storefront to explain changes to customers. They are not synced to Google Business Profile.</p>
              <p><strong>Google sync:</strong> Special hours automatically sync to Google Business Profile. Google supports multiple periods per day, but may have limits (typically 2-3 periods).</p>
              <p><strong>Use cases:</strong> Holidays, emergency closures, extended hours, split shifts, or special events.</p>
              
              <div className="mt-3 pt-3 border-t border-blue-300">
                <p className="font-semibold text-blue-900 mb-1">💡 Pro Tip:</p>
                <p>Your storefront is more flexible than Google! You can add as many special hour periods as needed for complex schedules (e.g., multiple breaks, pickup windows, or appointment slots). Customers checking your storefront will see:</p>
                <ul className="list-disc list-inside mt-1 space-y-1 ml-2">
                  <li><strong>Real-time status</strong> - "Open now" during each special hour period</li>
                  <li><strong>Complete schedule</strong> - All periods with custom notes</li>
                  <li><strong>Next opening time</strong> - Even between split shifts</li>
                </ul>
                <p className="mt-2">Google only receives the first 2-3 periods and may not show accurate open/closed status during complex schedules. Direct your customers to your storefront for the most accurate, up-to-date information!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

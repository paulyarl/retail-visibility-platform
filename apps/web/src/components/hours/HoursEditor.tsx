"use client";
import React, { useEffect, useState } from "react";

type Period = { day: string; open: string; close: string };

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
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const r = await fetch(`${apiBase}/api/tenant/${tenantId}/business-hours`, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setTimezone(j?.data?.timezone || "America/New_York");
        setPeriods(Array.isArray(j?.data?.periods) ? j.data.periods : []);
      }
    };
    load();
  }, [apiBase, tenantId]);

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
    setSaving(true);
    setMsg(null);
    const r = await fetch(`${apiBase}/api/tenant/${tenantId}/business-hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone, periods }),
    });
    setSaving(false);
    setMsg(r.ok ? "✓ Saved" : "✗ Failed");
    setTimeout(() => setMsg(null), 2000);
  };

  // Calculate current status
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }).toUpperCase();
  const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: timezone });
  const todayPeriod = periods.find(p => p.day === currentDay);
  const isOpen = todayPeriod && currentTime >= todayPeriod.open && currentTime < todayPeriod.close;

  return (
    <div className="space-y-4">
      {/* Current Status Badge */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
        <span className={`inline-block w-3 h-3 rounded-full ${isOpen ? 'bg-green-500' : 'bg-red-500'}`}></span>
        <span className="font-medium text-gray-900">
          {isOpen ? `Open now • Closes at ${to12Hour(todayPeriod!.close)}` : 'Closed'}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="w-32">Timezone</span>
        <span className="px-2 py-1 rounded bg-gray-50 border border-gray-200">{timezone}</span>
        <span className="ml-2 text-gray-500">Manage timezone above.</span>
      </div>
      
      <div className="space-y-2">
        {periods.map((p, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select 
              className="border border-gray-300 px-3 py-2 rounded-lg w-40 font-medium" 
              value={p.day} 
              onChange={(e) => update(i, "day", e.target.value)}
            >
              {"SUNDAY,MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SATURDAY".split(",").map((d) => (
                <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
              ))}
            </select>
            <input 
              className="border border-gray-300 px-3 py-2 rounded-lg w-28" 
              placeholder="9:00 AM"
              value={to12Hour(p.open)} 
              onChange={(e) => update(i, "open", e.target.value)} 
            />
            <span className="text-gray-400">to</span>
            <input 
              className="border border-gray-300 px-3 py-2 rounded-lg w-28" 
              placeholder="5:00 PM"
              value={to12Hour(p.close)} 
              onChange={(e) => update(i, "close", e.target.value)} 
            />
            <button 
              className="text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50" 
              onClick={() => remove(i)}
            >
              Remove
            </button>
          </div>
        ))}
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
